/**
 * Configuration - Central configuration exports
 */

export type { WidgetDefinition } from './widgets.js';
export * from './providers.js';

// Import widget catalog from JSON
import type { WidgetDefinition } from './widgets.js';
import widgetsData from './widgets.json' with { type: 'json' };
export const widgets: WidgetDefinition[] = widgetsData as WidgetDefinition[];

// Environment variables
export const config = {
  database: {
    url: process.env.DATABASE_URL || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  vertex: {
    projectId: process.env.VERTEX_PROJECT_ID || '',
    location: process.env.VERTEX_LOCATION || 'us-central1',
  },
  wordpress: {
    apiUrl: process.env.WP_API_URL || '',
    username: process.env.WP_USERNAME || '',
    password: process.env.WP_PASSWORD || '',
  },
};
