import { CollectionTemplate, FieldDefinition } from './types';

export const FIELD_TYPES: { type: string; label: string }[] = [
  { type: 'text', label: 'Short Text' },
  { type: 'long_text', label: 'Long Text' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'rating', label: 'Rating (1-5)' },
  { type: 'boolean', label: 'Checkbox' },
  { type: 'select', label: 'Dropdown' },
];

const COMMON_FIELDS: FieldDefinition[] = [
  { id: 'brand', label: 'Brand/Creator', type: 'text' },
  { id: 'origin', label: 'Origin', type: 'text' },
  { id: 'year', label: 'Year', type: 'number' },
];

export const TEMPLATES: CollectionTemplate[] = [
  {
    id: 'general',
    name: 'General / Mixed',
    icon: '✨',
    description: 'For anything: tickets, receipts, stamps, etc.',
    accentColor: 'stone',
    fields: [
      { id: 'brand', label: 'Brand/Issuer', type: 'text' },
      { id: 'category', label: 'Category', type: 'text' },
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'location', label: 'Location', type: 'text' },
    ],
    displayFields: ['brand', 'date'],
    badgeFields: ['category'],
  },
  {
    id: 'chocolate',
    name: 'Chocolate',
    icon: '🍫',
    description: 'Bars, truffles, and cacao finds.',
    accentColor: 'orange', // deep brown vibes
    fields: [
      { id: 'brand', label: 'Maker', type: 'text' },
      { id: 'cocoa_percent', label: 'Cocoa %', type: 'number' },
      { id: 'origin', label: 'Bean Origin', type: 'text' },
      { id: 'flavor_notes', label: 'Flavor Notes', type: 'text' },
      { id: 'type', label: 'Type', type: 'select', options: ['Dark', 'Milk', 'White', 'Inclusion'] },
    ],
    displayFields: ['brand', 'cocoa_percent'],
    badgeFields: ['type', 'origin'],
  },
  {
    id: 'vinyl',
    name: 'Vinyl Records',
    icon: '🎵',
    description: 'LPs, EPs, and singles.',
    accentColor: 'indigo',
    fields: [
      { id: 'artist', label: 'Artist', type: 'text' },
      { id: 'label', label: 'Record Label', type: 'text' },
      { id: 'year', label: 'Release Year', type: 'number' },
      { id: 'genre', label: 'Genre', type: 'text' },
      { id: 'condition', label: 'Condition', type: 'select', options: ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair'] },
    ],
    displayFields: ['artist', 'year'],
    badgeFields: ['genre', 'condition'],
  },
  {
    id: 'perfume',
    name: 'Fragrances',
    icon: '✨',
    description: 'Perfumes, colognes, and scents.',
    accentColor: 'rose',
    fields: [
      { id: 'house', label: 'House', type: 'text' },
      { id: 'concentration', label: 'Concentration', type: 'select', options: ['Parfum', 'EDP', 'EDT', 'Cologne'] },
      { id: 'main_accords', label: 'Main Accords', type: 'text' },
      { id: 'nose', label: 'Perfumer', type: 'text' },
    ],
    displayFields: ['house', 'concentration'],
    badgeFields: ['main_accords'],
  },
  {
    id: 'sneakers',
    name: 'Sneakers',
    icon: '👟',
    description: 'Kicks, grails, and beaters.',
    accentColor: 'emerald',
    fields: [
      { id: 'brand', label: 'Brand', type: 'text' },
      { id: 'model', label: 'Model', type: 'text' },
      { id: 'colorway', label: 'Colorway', type: 'text' },
      { id: 'size', label: 'Size', type: 'number' },
    ],
    displayFields: ['model', 'size'],
    badgeFields: ['brand'],
  },
];
