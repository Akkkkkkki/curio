import { CollectionTemplate, FieldDefinition } from './types';

/** Template ID for user-defined custom collections */
export const CUSTOM_TEMPLATE_ID = 'custom';

export const FIELD_TYPES: { type: string; label: string }[] = [
  { type: 'text', label: 'Short Text' },
  { type: 'long_text', label: 'Long Text' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'rating', label: 'Rating (1-5)' },
  { type: 'boolean', label: 'Checkbox' },
  { type: 'select', label: 'Dropdown' },
];

export const TEMPLATES: CollectionTemplate[] = [
  {
    id: 'general',
    name: 'General Archive',
    icon: '✨',
    description: 'Archive miscellaneous items like tickets, stamps, and curious finds.',
    accentColor: 'stone',
    fields: [
      { id: 'brand', label: 'Brand/Maker', type: 'text', displayMode: 'primary' },
      { id: 'category', label: 'Category', type: 'text', displayMode: 'badge' },
      { id: 'date', label: 'Date Acquired', type: 'date', displayMode: 'primary' },
      { id: 'location', label: 'Location', type: 'text', displayMode: 'detail' },
    ],
  },
  {
    id: 'chocolate',
    name: 'Chocolate Vault',
    icon: '🍫',
    description: 'Track terroir, cocoa percentages, and nuanced flavor profiles.',
    accentColor: 'orange',
    fields: [
      { id: 'brand', label: 'Chocolatier', type: 'text', displayMode: 'primary' },
      { id: 'cocoa_percent', label: 'Cocoa %', type: 'number', displayMode: 'primary' },
      { id: 'origin', label: 'Origin / Estate', type: 'text', displayMode: 'badge' },
      { id: 'flavor_notes', label: 'Tasting Notes', type: 'text', displayMode: 'detail' },
      {
        id: 'type',
        label: 'Type',
        type: 'select',
        options: ['Dark', 'Milk', 'White', 'Inclusion', 'Ruby', 'Raw'],
        displayMode: 'badge',
      },
      { id: 'batch', label: 'Batch No.', type: 'text', displayMode: 'detail' },
    ],
  },
  {
    id: 'vinyl',
    name: 'Vinyl Archives',
    icon: '🎵',
    description: 'Organize your analog sound library by artist, pressings, and quality.',
    accentColor: 'indigo',
    fields: [
      { id: 'artist', label: 'Artist', type: 'text', displayMode: 'primary' },
      { id: 'label', label: 'Label', type: 'text', displayMode: 'detail' },
      { id: 'year', label: 'Release Year', type: 'number', displayMode: 'primary' },
      { id: 'genre', label: 'Genre', type: 'text', displayMode: 'badge' },
      {
        id: 'speed',
        label: 'Speed',
        type: 'select',
        options: ['33 1/3 RPM', '45 RPM', '78 RPM'],
        displayMode: 'detail',
      },
      {
        id: 'condition',
        label: 'Condition',
        type: 'select',
        options: [
          'Mint (M)',
          'Near Mint (NM)',
          'Very Good Plus (VG+)',
          'Very Good (VG)',
          'Good (G)',
          'Fair (F)',
        ],
        displayMode: 'badge',
      },
    ],
  },
  {
    id: 'perfume',
    name: 'Scent Library',
    icon: '✨',
    description: 'Manage your fragrances, olfactive notes, and perfumery houses.',
    accentColor: 'rose',
    fields: [
      { id: 'house', label: 'Fragrance House', type: 'text', displayMode: 'primary' },
      { id: 'nose', label: 'Perfumer (Nose)', type: 'text', displayMode: 'detail' },
      {
        id: 'concentration',
        label: 'Concentration',
        type: 'select',
        options: [
          'Extrait de Parfum',
          'Parfum',
          'Eau de Parfum',
          'Eau de Toilette',
          'Eau de Cologne',
          'Body Mist',
        ],
        displayMode: 'primary',
      },
      { id: 'notes_top', label: 'Top Notes', type: 'text', displayMode: 'detail' },
      { id: 'notes_heart', label: 'Heart Notes', type: 'text', displayMode: 'detail' },
      { id: 'notes_base', label: 'Base Notes', type: 'text', displayMode: 'detail' },
      {
        id: 'season',
        label: 'Best Season',
        type: 'select',
        options: ['Spring', 'Summer', 'Autumn', 'Winter', 'All Year'],
        displayMode: 'badge',
      },
    ],
  },
  {
    id: 'sneakers',
    name: 'Sneaker Gallery',
    icon: '👟',
    description: 'Curate your footwear rotation and limited colorways.',
    accentColor: 'emerald',
    fields: [
      { id: 'brand', label: 'Brand', type: 'text', displayMode: 'badge' },
      { id: 'model', label: 'Model', type: 'text', displayMode: 'primary' },
      { id: 'colorway', label: 'Colorway', type: 'text', displayMode: 'badge' },
      { id: 'size', label: 'Size (US)', type: 'number', displayMode: 'primary' },
      { id: 'style_code', label: 'Style Code', type: 'text', displayMode: 'detail' },
      { id: 'deadstock', label: 'Deadstock', type: 'boolean', displayMode: 'detail' },
    ],
  },
  {
    id: 'spirits',
    name: 'Spirit Collection',
    icon: '🥃',
    description: 'Document rare bottles, vintages, and distillation details.',
    accentColor: 'amber',
    fields: [
      { id: 'brand', label: 'Distillery', type: 'text', displayMode: 'primary' },
      {
        id: 'type',
        label: 'Spirit Type',
        type: 'select',
        options: ['Whisky', 'Gin', 'Rum', 'Tequila', 'Mezcal', 'Cognac', 'Vodka'],
        displayMode: 'badge',
      },
      { id: 'age', label: 'Age Statement', type: 'text', displayMode: 'primary' },
      { id: 'abv', label: 'ABV %', type: 'number', displayMode: 'detail' },
      { id: 'region', label: 'Region', type: 'text', displayMode: 'badge' },
    ],
  },
];

/**
 * True only when `fieldId` is a genuine field of the given built-in template.
 * Custom fields are slugified from their label (see `buildFieldId` in App.tsx),
 * so a user-created field named "Origin", "Condition", "Batch", etc. can collide
 * with a built-in `hint_<id>` key. This scopes built-in field hints to real
 * template fields so a custom collection never inherits domain-specific copy.
 */
export const isBuiltInTemplateField = (templateId: string | undefined, fieldId: string): boolean =>
  TEMPLATES.some(
    (template) => template.id === templateId && template.fields.some((f) => f.id === fieldId),
  );
