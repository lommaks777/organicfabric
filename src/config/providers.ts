/**
 * Provider Configuration - External service provider configurations
 */

interface ProviderConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

// TODO: Add provider configurations here
export const providers: Record<string, ProviderConfig> = {};

// Example provider configuration (commented out):
// export const providers: Record<string, ProviderConfig> = {
//   openai: {
//     name: 'OpenAI',
//     enabled: true,
//     config: {
//       model: 'gpt-4',
//       temperature: 0.7,
//       maxTokens: 2000,
//     },
//   },
//   vertexai: {
//     name: 'Vertex AI Imagen',
//     enabled: true,
//     config: {
//       model: 'imagegeneration@005',
//       aspectRatio: '1:1',
//     },
//   },
// };
