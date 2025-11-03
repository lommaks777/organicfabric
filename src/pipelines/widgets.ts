/**
 * Widgets - WordPress widget/shortcode insertion
 */

import { logger } from '../core/logger.js';
import { extractArticleTags } from '../adapters/llm-openai.js';
import { widgets } from '../config/index.js';
import type { WidgetDefinition } from '../config/widgets.js';
import * as cheerio from 'cheerio';

// Configuration: Universal fallback widget ID for bottom position
// Replace this with the actual ID of your universal call-to-action widget
const UNIVERSAL_BOTTOM_WIDGET_ID = 'universal-cta-bottom';

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
  
  // If no match found and this is bottom position, use universal fallback widget
  if (!bestWidget && position === 'bottom') {
    const fallbackWidget = widgets.find(w => w.id === UNIVERSAL_BOTTOM_WIDGET_ID);
    if (fallbackWidget) {
      logger.info(`No specific bottom widget found, using universal fallback: ${fallbackWidget.title}`);
      return fallbackWidget;
    } else {
      logger.warn(`Universal fallback widget with ID "${UNIVERSAL_BOTTOM_WIDGET_ID}" not found`);
    }
  }
  
  if (bestWidget) {
    logger.info(`Selected widget "${bestWidget.title}" (${bestWidget.id}) with score: ${maxScore}`);
  } else {
    logger.info(`No matching widget found for position: ${position}`);
  }
  
  return bestWidget;
}

/**
 * Insert GetCourse widgets into HTML based on article content analysis
 * Uses Cheerio for DOM-aware insertion at strategic positions
 * @param html - Sanitized HTML content
 * @param articleText - Raw article text for tag extraction
 * @returns HTML with inserted widgets
 */
export async function insertWidgets(
  html: string,
  articleText: string
): Promise<string> {
  logger.info('Starting advanced widget insertion pipeline');
  
  try {
    // Step 1: Extract article tags using LLM
    logger.info('Extracting article tags...');
    const articleTags = await extractArticleTags(articleText);
    logger.info(`Extracted tags: ${articleTags.join(', ')}`);
    
    // Step 2: Find best widgets for top and bottom positions
    const topWidget = findBestWidget(articleTags, 'top');
    const bottomWidget = findBestWidget(articleTags, 'bottom');
    
    // Step 3: Load HTML into Cheerio for DOM manipulation
    const $ = cheerio.load(html);
    
    // Step 4: Insert top widget after 2nd block element (or at beginning if fewer blocks)
    if (topWidget) {
      logger.info(`Inserting top widget: ${topWidget.title} (${topWidget.id})`);
      // Find first block-level elements: p, ul, ol, h2, h3, blockquote, figure
      const blockElements = $('p, ul, ol, h2, h3, blockquote, figure');
      
      if (blockElements.length > 2) {
        // Insert after 2nd block element (index 1)
        blockElements.eq(1).after(`\n${topWidget.embed_html}\n`);
        logger.info('Top widget inserted after 2nd block element');
      } else {
        // Insert at the beginning if fewer than 3 block elements
        $.root().prepend(`\n${topWidget.embed_html}\n`);
        logger.info('Top widget inserted at beginning (fewer than 3 block elements)');
      }
    }
    
    // Step 5: Insert bottom widget at the end
    if (bottomWidget) {
      logger.info(`Inserting bottom widget: ${bottomWidget.title} (${bottomWidget.id})`);
      $.root().append(`\n${bottomWidget.embed_html}`);
      logger.info('Bottom widget inserted at end');
    }
    
    // Step 6: Extract HTML content with reliable fallback handling
    const bodyContent = $('body').html();
    if (bodyContent) {
      // Count figure blocks before and after
      const figureBefore = (html.match(/<figure/g) || []).length;
      const figureAfter = (bodyContent.match(/<figure/g) || []).length;
      
      if (figureBefore !== figureAfter) {
        logger.warn(`Widget insertion removed ${figureBefore - figureAfter} figure blocks (${figureBefore} -> ${figureAfter})`);
      }
      
      logger.info('Widget insertion completed successfully');
      return bodyContent;
    }
    // Fallback if cheerio didn't create a body element
    const fallbackContent = $.html() || '';
    logger.info('Widget insertion completed successfully (using fallback extraction)');
    return fallbackContent;
    
  } catch (error) {
    logger.error('Error during widget insertion:', error);
    logger.warn('Continuing without widgets');
    // Return original HTML if widget insertion fails
    return html;
  }
}
