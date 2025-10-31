/**
 * Widget Configuration - GetCourse widget definitions
 */

export interface WidgetDefinition {
  id: string;
  type: string;
  title: string;
  topics: string[];
  embed_html: string;
  default_placement: {
    strategy: string;
    index?: number;
  };
  position: 'top' | 'bottom';
  __source__?: {
    sheet: string;
  };
}

// Widget definitions are imported from widgets.json
// This file exports the type definition for TypeScript type checking
