export type FieldType = 'text' | 'long_text' | 'number' | 'date' | 'boolean' | 'rating' | 'select';

export type AppTheme = 'gallery' | 'vault' | 'atelier';

/**
 * Display mode determines where a field appears:
 * - 'primary': Shown on item cards and collection cards (max 2)
 * - 'badge': Shown as small pills on item cards
 * - 'detail': Shown only on item detail page
 */
export type FieldDisplayMode = 'primary' | 'badge' | 'detail';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select types
  required?: boolean;
  displayMode: FieldDisplayMode; // Where this field appears in the UI
}

export interface CollectionTemplate {
  id: string;
  name: string;
  icon: string; // Emoji or icon name
  description: string;
  accentColor: string; // Tailwind class partial e.g. 'amber'
  fields: FieldDefinition[]; // Each field has displayMode - no separate displayFields/badgeFields
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  photoUrl: string;
  photoEnhancedPath?: string;
  title: string; // Core field
  rating: number; // Core field (0-5)
  // Dynamic data keyed by FieldDefinition.id. Underscore-prefixed keys are
  // system-managed (e.g. _aiDescription, _storyMigrationDismissed, _isLegacyAiNotes)
  // and must not be exposed as user-defined custom fields.
  data: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  // The visible, human-authored Story. May be empty if the user hasn't written one yet.
  // AI observations live in data._aiDescription, never here. See CUR-56 for the storage rename.
  notes: string;
  seedKey?: string; // Stability for versioned seeding
}

export interface UserCollection {
  id: string;
  templateId: string; // Reference to base template type, or 'custom' for user-defined
  name: string;
  icon?: string; // Custom icon for the collection
  customFields: FieldDefinition[]; // Users can add more fields (each has displayMode)
  items: CollectionItem[];
  isLocked?: boolean; // Vault lock feature
  isPublic?: boolean; // Public sample collection
  ownerId?: string; // Supabase user_id for the owner
  updatedAt?: string;
  collectionDescription?: string; // User's description for AI context
  seedKey?: string; // Stability for versioned seeding
}

export interface AIAnalysisResult {
  title?: string;
  data: Record<string, any>;
  /** @deprecated Kept as an alias for one release; read aiDescription instead. */
  notes?: string;
  aiDescription?: string;
}

export type EnhancementStatus = 'none' | 'processing' | 'ready' | 'failed';
export type EnhancementStrength = 'subtle' | 'beautified';

export interface EnhancementMetadata {
  status: EnhancementStatus;
  strength: EnhancementStrength;
  model?: string;
  promptVersion?: number;
  timestamp?: string;
  errorMessage?: string;
}
