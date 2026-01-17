export type FieldType = 'text' | 'long_text' | 'number' | 'date' | 'boolean' | 'rating' | 'select';

export type AppTheme = 'gallery' | 'vault' | 'atelier';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select types
  required?: boolean;
}

export interface CollectionTemplate {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  description: string;
  accentColor: string; // Tailwind class partial e.g. 'amber'
  fields: FieldDefinition[];
  displayFields: string[]; // IDs of fields to show on card
  badgeFields: string[]; // IDs of fields to show as badges
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  photoUrl: string;
  title: string; // Core field
  rating: number; // Core field (0-5)
  data: Record<string, any>; // Dynamic data keyed by FieldDefinition.id
  createdAt: string;
  updatedAt?: string;
  notes: string;
  seedKey?: string; // Stability for versioned seeding
}

export interface UserCollection {
  id: string;
  templateId: string; // Reference to base template type
  name: string;
  icon?: string; // Custom icon for the collection
  customFields: FieldDefinition[]; // Users can add more fields
  items: CollectionItem[];
  isLocked?: boolean; // Vault lock feature
  isPublic?: boolean; // Public sample collection
  ownerId?: string; // Supabase user_id for the owner
  updatedAt?: string;
  settings: {
    displayFields: string[];
    badgeFields: string[];
  };
  seedKey?: string; // Stability for versioned seeding
}

export interface AIAnalysisResult {
  title?: string;
  data: Record<string, any>;
  notes?: string;
}
