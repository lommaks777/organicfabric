/**
 * Widgets - WordPress widget/shortcode insertion
 */

import { logger } from '../core/logger.js';
import { extractArticleTags } from '../adapters/llm-openai.js';
import { widgets } from '../config/index.js';
import type { WidgetDefinition } from '../config/widgets.js';

/**
 * Find the best matching widget for a given position based on tag overlap
 */
function findBestWidget(
  articleTags: string[],
  position: 'top' | 'bottom'
): WidgetDefinition | null {
  logger.info(`Finding best widget for position: ${position}`);
  
  // Filter widgets by position
  const candidateWidgets = widgets.filter(
    w => w.position === position
  );
  
  if (candidateWidgets.length === 0) {
    logger.info(`No widgets found for position: ${position}`);
    return null;
  }
  
  // Normalize article tags to lowercase for case-insensitive matching
  const normalizedArticleTags = articleTags.map(tag => tag.toLowerCase());
  
  // Calculate tag overlap score for each widget
  let bestWidget: WidgetDefinition | null = null;
  let maxScore = 0;
  
  for (const widget of candidateWidgets) {
    const normalizedWidgetTopics = widget.topics.map(topic => topic.toLowerCase());
    
    // Count how many widget topics appear in article tags
    const score = normalizedWidgetTopics.filter(widgetTopic =>
      normalizedArticleTags.some(articleTag => articleTag.includes(widgetTopic))
    ).length;
    
    logger.info(`Widget "${widget.title}" (${widget.id}) score: ${score}`);
    
    if (score > maxScore) {
      maxScore = score;
      bestWidget = widget;
    }
  }
  
  if (bestWidget) {
    logger.info(`Selected widget "${bestWidget.title}" (${bestWidget.id}) with score: ${maxScore}`);
  } else {
    logger.info(`No matching widget found for position: ${position}`);
  }
  
  return maxScore > 0 ? bestWidget : null;
}

/**
 * Insert GetCourse widgets into HTML based on article content analysis
 * @param html - Sanitized HTML content
 * @param articleText - Raw article text for tag extraction
 * @returns HTML with inserted widgets
 */
export async function insertWidgets(
  html: string,
  articleText: string
): Promise<string> {
  logger.info('Starting widget insertion pipeline');
  
  try {
    // Step 1: Extract article tags using LLM
    logger.info('Extracting article tags...');
    const articleTags = await extractArticleTags(articleText);
    logger.info(`Extracted tags: ${articleTags.join(', ')}`);
    
    // Step 2: Find best widgets for top and bottom positions
    const topWidget = findBestWidget(articleTags, 'top');
    const bottomWidget = findBestWidget(articleTags, 'bottom');
    
    // Step 3: Inject widgets into HTML
    let enhancedHtml = html;
    
    // Insert top widget at the beginning
    if (topWidget) {
      logger.info(`Inserting top widget: ${topWidget.title} (${topWidget.id})`);
      enhancedHtml = topWidget.embed_html + '\n' + enhancedHtml;
    }
    
    // Insert bottom widget at the end
    if (bottomWidget) {
      logger.info(`Inserting bottom widget: ${bottomWidget.title} (${bottomWidget.id})`);
      enhancedHtml = enhancedHtml + '\n' + bottomWidget.embed_html;
    }
    
    logger.info('Widget insertion completed successfully');
    return enhancedHtml;
    
  } catch (error) {
    logger.error('Error during widget insertion:', error);
    logger.warn('Continuing without widgets');
    // Return original HTML if widget insertion fails
    return html;
  }
}
