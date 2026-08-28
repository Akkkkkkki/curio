import { createGeminiProvider } from './providers/gemini.js';

export const getGeminiAnalyzeModel = () => process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';
export const GEMINI_ANALYZE_MODEL = getGeminiAnalyzeModel();

const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024;
const MAX_FIELDS_COUNT = 30;

const createDefaultProvider = (apiKey) =>
  createGeminiProvider({ apiKey, model: getGeminiAnalyzeModel() });

// These operation inputs are server-side injection points (tests and the
// gateway pick the provider/credentials); a request body must never reach them.
// Every HTTP entry point runs its body through this before spreading it into an
// operation, so a `{ "provider": {} }` body cannot displace the trusted default.
const SERVER_ONLY_INPUT_KEYS = ['apiKey', 'client', 'provider'];

export const sanitizeAiRequestBody = (body) => {
  const input = { ...(body || {}) };
  for (const key of SERVER_ONLY_INPUT_KEYS) delete input[key];
  return input;
};

const mapFieldTypeToSchemaType = (type) => {
  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
};

export const validateAnalyzeInput = ({ imageBase64, fields } = {}) => {
  if (typeof imageBase64 !== 'string') return 'imageBase64 must be a string';
  if (imageBase64.length === 0) return 'imageBase64 is empty';
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) return 'Image too large (max ~15MB)';
  if (!Array.isArray(fields)) return 'fields must be an array';
  if (fields.length > MAX_FIELDS_COUNT) return `Too many fields (max ${MAX_FIELDS_COUNT})`;
  for (const field of fields) {
    if (!field?.id || typeof field.id !== 'string') return 'Each field must have a string id';
    if (!field?.type || typeof field.type !== 'string') return 'Each field must have a string type';
  }
  return null;
};

export const buildAnalysisPrompt = ({ collectionContext, locale = 'en' } = {}) => {
  const contextLines = [];
  if (collectionContext?.name) contextLines.push(`- Name: "${collectionContext.name}"`);
  if (collectionContext?.description) {
    contextLines.push(`- User's description: "${collectionContext.description}"`);
  }
  const contextBlock = contextLines.length
    ? `\n\nCollection context:\n${contextLines.join('\n')}`
    : '';

  return `Analyze this image of a collectible item.${contextBlock}\n\nExtract metadata based on the provided schema.\n\nIMPORTANT RULES:\n1. Output ALL text (title, aiDescription, field values) in the "${locale}" language.\n2. Be precise. If a field cannot be determined from the image, leave it null.\n3. For the "title", provide a descriptive name (e.g., "Qing Dynasty Coin", "Vintage Kodak Camera").\n4. For "aiDescription", give a factual visual observation only. Do not tell a story or speculate about meaning.`;
};

const buildAnalysisSchema = (fields) => {
  const properties = {
    title: { type: 'string', description: 'A short, descriptive title for the item.' },
    aiDescription: {
      type: 'string',
      description:
        'A factual, neutral visual observation of the item (1-2 sentences). This is hidden metadata; it must NOT attempt to tell a story, infer emotional meaning, or speculate about the owner. Describe only what is visible.',
    },
  };

  for (const field of fields) {
    properties[field.id] = {
      type: mapFieldTypeToSchemaType(field.type),
      description: `Value for ${field.label}.`,
    };
    if (field.type === 'select' && Array.isArray(field.options)) {
      properties[field.id].description += ` Must be one of: ${field.options.join(', ')}`;
    }
  }
  return { type: 'object', properties };
};

export const analyzeItem = async ({
  apiKey,
  provider,
  imageBase64,
  fields,
  collectionContext,
  locale = 'en',
}) => {
  const validationError = validateAnalyzeInput({ imageBase64, fields });
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const ai = provider || createDefaultProvider(apiKey);
  const result = await ai.analyzeImage({
    imageBase64,
    prompt: buildAnalysisPrompt({ collectionContext, locale }),
    schema: buildAnalysisSchema(fields),
  });
  const { title, aiDescription, ...data } = result || {};
  const description = aiDescription || '';
  return {
    title: title || 'New Item',
    aiDescription: description,
    notes: description,
    data: data || {},
  };
};

export const buildSuggestFieldsPrompt = ({ description, locale = 'en' }) =>
  `You are helping suggest metadata fields for a personal collection app.\n\nUser's language: ${locale}\nThe user wants to collect: "${description}"\n\nSuggest 4–6 short field names that would be useful for cataloging these items.\n\nRules:\n- Use simple, everyday labels (e.g., "Year" not "Year of Manufacture")\n- Match the user's language (${locale})\n- Focus on attributes a collector would actually track\n- NEVER suggest: "Notes", "Description", "Title", "Name", "Rating", "Diary", "Comments"\n\nReturn JSON: { "fields": [...] }`;

export const normalizeSuggestedFields = (rawFields, maxFields = 6) => {
  const fields = [];
  const seen = new Set();
  for (const raw of Array.isArray(rawFields) ? rawFields : []) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim().replace(/^[-*•\d.\s]+/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push(cleaned.slice(0, 32));
    if (fields.length >= maxFields) break;
  }
  return fields;
};

export const suggestFields = async ({ apiKey, provider, description, locale = 'en' }) => {
  if (!description || typeof description !== 'string') {
    const error = new Error('Missing description');
    error.statusCode = 400;
    throw error;
  }
  const ai = provider || createDefaultProvider(apiKey);
  const result = await ai.generateStructuredText({
    prompt: buildSuggestFieldsPrompt({ description, locale }),
    schema: {
      type: 'object',
      properties: { fields: { type: 'array', items: { type: 'string' } } },
    },
  });
  return { fields: normalizeSuggestedFields(result?.fields) };
};

export const buildStoryPrompt = ({
  title,
  collectionContext,
  aiDescription,
  knownFields,
  locale = 'en',
}) => {
  const safeTitle = title.trim();
  const contextLines = [`- Title: "${safeTitle}"`];
  if (collectionContext?.name) contextLines.push(`- Collection: "${collectionContext.name}"`);
  if (collectionContext?.description) {
    contextLines.push(`- Collection description: "${collectionContext.description}"`);
  }
  if (typeof aiDescription === 'string' && aiDescription.trim()) {
    contextLines.push(`- Visual observation: "${aiDescription.trim()}"`);
  }
  if (knownFields && typeof knownFields === 'object') {
    const knownEntries = Object.entries(knownFields)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .slice(0, 8)
      .map(([key, value]) => `  - ${key}: ${value}`);
    if (knownEntries.length) contextLines.push(`- Known facts:\n${knownEntries.join('\n')}`);
  }

  return `You are a thoughtful curator helping a collector reflect on an object. Given the object's title and known facts, produce 3 short open-ended questions (max 12 words each) that would help the owner write a personal story about it.\n\nRules:\n- Questions must be specific to the object — mention details from the title or fields where possible.\n- Never include the answer.\n- Never narrate. Never speculate about feelings.\n- Match the user's language: ${locale}.\n\nContext:\n${contextLines.join('\n')}\n\nReturn only the questions as a JSON object of the schema { "prompts": [string, string, string] }.`;
};

export const normalizeStoryPrompts = (rawPrompts) => {
  const prompts = [];
  const seen = new Set();
  for (const candidate of Array.isArray(rawPrompts) ? rawPrompts : []) {
    if (typeof candidate !== 'string') continue;
    const cleaned = candidate.trim().replace(/^[-*•\d.\s]+/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const words = cleaned.split(/\s+/);
    prompts.push(words.length > 14 ? `${words.slice(0, 12).join(' ')}…` : cleaned);
    if (prompts.length >= 3) break;
  }
  return prompts;
};

export const storyPrompts = async ({
  apiKey,
  provider,
  title,
  collectionContext,
  aiDescription,
  knownFields,
  locale = 'en',
}) => {
  if (typeof title !== 'string' || !title.trim()) {
    const error = new Error('Missing title');
    error.statusCode = 400;
    throw error;
  }
  const ai = provider || createDefaultProvider(apiKey);
  const result = await ai.generateStructuredText({
    prompt: buildStoryPrompt({ title, collectionContext, aiDescription, knownFields, locale }),
    schema: {
      type: 'object',
      properties: { prompts: { type: 'array', items: { type: 'string' } } },
    },
  });
  return { prompts: normalizeStoryPrompts(result?.prompts) };
};
