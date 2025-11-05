/**
 * Sanitize - HTML sanitization for WordPress
 */

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { logger } from '../core/logger.js';

// Create a DOMPurify instance for Node.js
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Configure allowed tags and attributes for WordPress
const WORDPRESS_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'div',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'figure',
    'figcaption',
    'iframe',
    'script',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'style',
    'width',
    'height',
    'target',
    'rel',
    'data-*',
  ],
  ADD_ATTR: ['target', 'rel'],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
  // CRITICAL: Allow HTML comments for Gutenberg blocks
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  FORCE_BODY: false,
};

// Track external links processed
let externalLinksCount = 0;

// Add hook to process external links for security
purify.addHook('afterSanitizeAttributes', (node: Element) => {
  // Process anchor tags
  if (node.tagName === 'A') {
    const href = node.getAttribute('href');
    
    if (href) {
      // Check if link is external
      const isExternal = /^https?:\/\//i.test(href);
      
      if (isExternal) {
        // Get WordPress site URL to determine if truly external
        const wpSiteUrl = process.env.WP_SITE_URL || '';
        let isReallyExternal = true;
        
        if (wpSiteUrl) {
          try {
            const wpDomain = new URL(wpSiteUrl).hostname;
            const linkDomain = new URL(href).hostname;
            isReallyExternal = wpDomain !== linkDomain;
          } catch (e) {
            // If URL parsing fails, treat as external for safety
            isReallyExternal = true;
          }
        }
        
        if (isReallyExternal) {
          // Add security attributes for external links
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
          externalLinksCount++;
        }
      }
    }
  }
});

export function sanitizeHtml(dirtyHtml: string): string {
  logger.info('Starting HTML sanitization');
  
  // Reset counter
  externalLinksCount = 0;
  
  try {
    // Extract Gutenberg comments before sanitization
    const gutenbergComments: Array<{placeholder: string; comment: string}> = [];
    let htmlWithPlaceholders = dirtyHtml;
    
    // Replace Gutenberg comments with placeholders
    htmlWithPlaceholders = htmlWithPlaceholders.replace(/<!--\s*(\/?)wp:[^>]+-->/g, (match) => {
      const placeholder = `__GUTENBERG_COMMENT_${gutenbergComments.length}__`;
      gutenbergComments.push({ placeholder, comment: match });
      return placeholder;
    });
    
    // Sanitize HTML (without Gutenberg comments)
    const clean = purify.sanitize(htmlWithPlaceholders, WORDPRESS_CONFIG);
    
    // Restore Gutenberg comments
    let finalHtml = clean;
    gutenbergComments.forEach(({ placeholder, comment }) => {
      finalHtml = finalHtml.replace(placeholder, comment);
    });
    
    // Count figure blocks before and after
    const figureBefore = (dirtyHtml.match(/<figure/g) || []).length;
    const figureAfter = (finalHtml.match(/<figure/g) || []).length;
    
    if (figureBefore !== figureAfter) {
      logger.warn(`Sanitizer removed ${figureBefore - figureAfter} figure blocks (${figureBefore} -> ${figureAfter})`);
    }
    
    // Count tables before and after
    const tableBefore = (dirtyHtml.match(/<table/g) || []).length;
    const tableAfter = (finalHtml.match(/<table/g) || []).length;
    
    if (tableBefore !== tableAfter) {
      logger.warn(`Sanitizer removed ${tableBefore - tableAfter} tables (${tableBefore} -> ${tableAfter})`);
    } else if (tableAfter > 0) {
      logger.info(`Sanitizer preserved ${tableAfter} table(s)`);
    }
    
    // Count Gutenberg comments
    const gutenbergCount = (finalHtml.match(/<!-- wp:/g) || []).length;
    if (gutenbergCount > 0) {
      logger.info(`Sanitizer preserved ${gutenbergCount} Gutenberg comment(s)`);
    }
    
    if (externalLinksCount > 0) {
      logger.info(`Processed ${externalLinksCount} external links for security`);
    }
    
    logger.info('HTML sanitization completed');
    return finalHtml;
    
  } catch (error) {
    logger.error('Sanitization failed:', error);
    throw error;
  }
}

export function validateHtml(_html: string): { valid: boolean; errors: string[] } {
  // TODO: Implement HTML validation
  console.log('Validating HTML structure');
  return {
    valid: true,
    errors: [],
  };
}
