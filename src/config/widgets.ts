/**
 * Widget Configuration - Widget definitions and templates
 */

interface WidgetDefinition {
  name: string;
  type: string;
  template: string;
  position: 'top' | 'bottom' | 'middle' | number;
  config?: Record<string, any>;
}

// TODO: Add widget definitions here
export const widgets: WidgetDefinition[] = [];

// Example widget definition (commented out):
// export const widgets: WidgetDefinition[] = [
//   {
//     name: 'call-to-action',
//     type: 'shortcode',
//     template: '[cta button_text="{{buttonText}}" link="{{link}}"]',
//     position: 'bottom',
//     config: {
//       buttonText: 'Learn More',
//       link: '#',
//     },
//   },
// ];
