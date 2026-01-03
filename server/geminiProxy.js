import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILES = [".env.local", ".env"];

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
};

const shouldLoadEnvFiles = process.env.NODE_ENV !== "production";
if (shouldLoadEnvFiles) {
  // Load .env.local for the proxy since Node doesn't read Vite env files automatically.
  ENV_FILES.forEach((file) => loadEnvFile(path.join(ROOT_DIR, file)));
}

const app = express();
const port = process.env.PORT || 8787;

app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const mapFieldTypeToSchemaType = (type) => {
  switch (type) {
    case "number":
      return Type.NUMBER;
    case "boolean":
      return Type.BOOLEAN;
    case "text":
    case "long_text":
    case "select":
    case "date":
    default:
      return Type.STRING;
  }
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(apiKey) });
});

app.post("/api/gemini/analyze", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const { imageBase64, fields } = req.body || {};
  if (!imageBase64 || !Array.isArray(fields)) {
    return res.status(400).json({ error: "Missing imageBase64 or fields" });
  }

  const properties = {
    title: {
      type: Type.STRING,
      description: "A short, descriptive title for the item.",
    },
    notes: {
      type: Type.STRING,
      description: "A brief summary of visual observations about the item.",
    },
  };

  fields.forEach((field) => {
    properties[field.id] = {
      type: mapFieldTypeToSchemaType(field.type),
      description: `Value for ${field.label}.`,
    };
    if (field.type === "select" && field.options) {
      properties[field.id].description +=
        ` Must be one of: ${field.options.join(", ")}`;
    }
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          {
            text: "Analyze this image of a collectible item. Extract metadata based on the provided schema. Be precise. If a field cannot be determined, leave it null.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties,
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    const { title, notes, ...data } = result || {};
    return res.json({
      title: title || "New Item",
      notes: notes || "",
      data: data || {},
    });
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return res.status(500).json({ error: "AI analysis failed" });
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Gemini proxy listening on :${port}`);
  });
}

export default app;
