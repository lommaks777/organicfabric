# Structural Article Formatting Design

## Overview

The current article formatting pipeline has a critical flaw: the AI model rewrites and shortens original article content when generating HTML directly. This design document describes a complete redesign of the formatting pipeline to guarantee 100% preservation of original content by separating content analysis from HTML generation.

## Problem Statement

The existing `formatArticleHtml` function delegates both content analysis and HTML generation to the AI model. This approach causes several issues:

- AI model arbitrarily rewrites original text during HTML generation
- Content is shortened or paraphrased without user control
- No guarantee of content preservation
- Loss of original author's voice and phrasing

## Strategic Approach

The new approach separates responsibilities:

1. **AI Responsibility**: Analyze text structure and return semantic metadata as JSON
2. **Code Responsibility**: Generate HTML deterministically from original text and AI metadata

This separation ensures the original text remains untouched while still leveraging AI for intelligent structural analysis.

## Core Principles

### Content Preservation
- Original text must never be sent to AI for rewriting
- All text rendering is performed deterministically by code
- AI only provides structural hints, not content transformation

### Structural Analysis
- AI analyzes text to identify paragraph types (heading, paragraph, list item)
- AI suggests optimal image insertion points
- AI returns structured JSON metadata, not HTML

### Deterministic Assembly
- Code splits original text into paragraphs programmatically
- Code assembles final HTML using original text + AI structural metadata
- Every paragraph and image must appear exactly once in final output

## Architecture Changes

### Component: formatArticleHtml Function

**Location**: `src/pipelines/format-content.ts`

**Current Behavior**:
- Sends raw text to AI with instructions to generate HTML
- AI returns HTML with placeholders
- Code replaces placeholders with image blocks

**New Behavior**:

| Phase | Actor | Input | Output |
|-------|-------|-------|--------|
| Text Splitting | Code | Raw article text | Array of paragraph strings |
| Structure Analysis | AI (OpenAI) | Numbered paragraph list + image count | JSON structure metadata |
| HTML Assembly | Code | Original paragraphs + Structure JSON + Images | Final HTML |

### Data Model: Structure JSON Schema

The AI must return a JSON object containing a single `structure` key with an array of block objects.

**Block Types**:

| Type | Purpose | Required Fields | Example |
|------|---------|----------------|---------|
| p | Regular paragraph | `type`, `paragraphIndex` | `{"type": "p", "paragraphIndex": 0}` |
| h2 | Second-level heading | `type`, `paragraphIndex` | `{"type": "h2", "paragraphIndex": 1}` |
| h3 | Third-level heading | `type`, `paragraphIndex` | `{"type": "h3", "paragraphIndex": 2}` |
| li | List item | `type`, `paragraphIndex` | `{"type": "li", "paragraphIndex": 3}` |
| image | Image insertion point | `type`, `imageIndex` | `{"type": "image", "imageIndex": 1}` |

**Constraints**:
- Every paragraph index from 0 to N-1 must appear exactly once
- Every image index from 1 to M must appear exactly once
- No paragraph or image may be skipped or duplicated
- Order may be rearranged based on structural logic

**Example Response**:

```
{
  "structure": [
    {"type": "h2", "paragraphIndex": 0},
    {"type": "p", "paragraphIndex": 1},
    {"type": "image", "imageIndex": 1},
    {"type": "p", "paragraphIndex": 2},
    {"type": "li", "paragraphIndex": 3},
    {"type": "li", "paragraphIndex": 4},
    {"type": "image", "imageIndex": 2}
  ]
}
```

## Workflow Definition

### Step 1: Programmatic Text Splitting

**Trigger**: Function receives raw article text

**Process**:
- Split text by double newline characters (`\n\n`)
- Trim whitespace from each paragraph
- Filter out empty paragraphs
- Store result as indexed array

**Output**: Array of paragraph strings

**Rationale**: Ensures text segmentation is deterministic and reversible

### Step 2: AI Structure Analysis Request

**Trigger**: Paragraph array created

**Process**:
- Build numbered paragraph listing for AI context
- Construct system prompt defining structural analysis task
- Construct user prompt with paragraph listing and image count
- Request JSON response from OpenAI API
- Parse and validate JSON structure

**AI System Prompt Template**:

```
You are a structural analyzer for articles. Your task is to analyze the provided text, which is split into numbered paragraphs, and determine the type of each paragraph (e.g., 'p', 'h2', 'h3', 'li') and decide where to insert images.

You MUST return a JSON object with a single key "structure", which is an array of objects.
Each object in the array represents a block of content and must have a "type" field.

- For a regular paragraph, use: { "type": "p", "paragraphIndex": N }
- For a heading, use: { "type": "h2", "paragraphIndex": N } or { "type": "h3", ... }
- For a list item, use: { "type": "li", "paragraphIndex": N }
- To insert an image, use: { "type": "image", "imageIndex": M }

N is the original index of the paragraph (from 0).
M is the index of the image to insert (from 1).

Use ALL paragraph and image indexes exactly once. Do not skip or reorder them.
```

**AI User Prompt Template**:

```
Analyze the following content. There are {imageCount} images available for insertion.

Paragraphs:
0: "{paragraphText0}"
1: "{paragraphText1}"
2: "{paragraphText2}"
...

Return the JSON structure.
```

**Output**: Validated JSON structure object

### Step 3: HTML Assembly

**Trigger**: Structure JSON received from AI

**Process**:
- Iterate through structure array sequentially
- For each block, use type field to determine HTML generation
- Track list context to wrap consecutive `li` elements in `ul` tags
- Concatenate HTML fragments into final string

**Type-to-HTML Mapping**:

| Block Type | Action | HTML Output Pattern |
|------------|--------|---------------------|
| p | Retrieve text from paragraphs array by paragraphIndex, wrap in `<p>` tags | `<p>{originalText}</p>` |
| h2 | Retrieve text from paragraphs array by paragraphIndex, wrap in `<h2>` tags | `<h2>{originalText}</h2>` |
| h3 | Retrieve text from paragraphs array by paragraphIndex, wrap in `<h3>` tags | `<h3>{originalText}</h3>` |
| li | Retrieve text from paragraphs array by paragraphIndex, track for list wrapping | See list handling below |
| image | Retrieve image from images array by imageIndex-1, generate figure block with caption | See image handling below |

**List Handling Logic**:

| Condition | Action |
|-----------|--------|
| Current block is `li` AND previous block was not `li` | Open `<ul>` tag before this `<li>` |
| Current block is `li` AND previous block was `li` | Continue adding `<li>` without new `<ul>` |
| Current block is NOT `li` AND previous block was `li` | Close `</ul>` tag before processing current block |
| Reached end of structure AND last block was `li` | Close `</ul>` tag at end |

**Image Block Generation**:

For each image block, the following steps occur:

1. Retrieve image object from images array using `imageIndex - 1`
2. Extract `source_url` and `prompt` from image object
3. Call `generateShortRussianCaption(prompt)` to create localized caption text
4. Generate complete `figure` HTML block with styling and semantic structure

**Figure HTML Structure**:

```
<figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
  <img src="{imageSourceUrl}" alt="{shortCaption}" />
  <figcaption style="text-align: center; font-style: italic; font-size: 0.9em; color: #555;">{shortCaption}</figcaption>
</figure>
```

**Output**: Complete HTML string with all content and images

### Step 4: Validation

**Trigger**: HTML assembly complete

**Validation Checks**:

| Check | Condition | Failure Action |
|-------|-----------|----------------|
| Paragraph Coverage | All paragraph indices 0 to N-1 used exactly once | Log warning and proceed |
| Image Coverage | All image indices 1 to M used exactly once | Log warning and proceed |
| HTML Well-Formed | No unclosed tags, valid structure | Log error, return sanitized version |

**Output**: Validated HTML string

## Component: Widget Insertion Enhancement

**Location**: `src/pipelines/widgets.ts`

**Current Issue**: Cheerio sometimes adds wrapper `<html>` and `<body>` tags during DOM manipulation, which must be extracted correctly.

**Change Required**:

The final HTML extraction logic in the `insertWidgets` function must be enhanced to handle cases where Cheerio does not create a body element.

**Current Implementation**:

```
return $('body').html() || '';
```

**New Implementation Logic**:

| Step | Action | Condition | Return Value |
|------|--------|-----------|--------------|
| 1 | Attempt to extract body content | `$('body')` exists | `$('body').html()` |
| 2 | Fallback to full HTML | Body extraction returns null/empty | `$.html()` |
| 3 | Final fallback | Both methods fail | Empty string |

**Rationale**: Provides reliable HTML extraction regardless of Cheerio's wrapper tag behavior.

## Implementation Considerations

### Error Handling

| Scenario | Detection | Recovery Strategy |
|----------|-----------|-------------------|
| AI returns invalid JSON | JSON parse exception | Log error, apply default paragraph structure (all type: 'p') |
| AI omits paragraph indices | Validation after parse | Log warning, insert missing paragraphs at end |
| AI omits image indices | Validation after parse | Log warning, append unused images at end |
| OpenAI API rate limit | API error response | Throw descriptive error with retry guidance |
| OpenAI API authentication failure | 401 response | Throw descriptive error with configuration guidance |

### Performance Optimization

- Text splitting is O(n) operation on text length
- Structure JSON parsing is O(m) where m is number of blocks
- HTML assembly is O(m) single-pass iteration
- Total complexity remains linear and efficient for typical articles (1000-3000 words)

### Backward Compatibility

- Function signature remains unchanged: `formatArticleHtml(rawText, images)`
- Return type remains unchanged: `Promise<string>`
- Existing callers require no modifications

### Testing Strategy

| Test Category | Test Case | Expected Outcome |
|---------------|-----------|------------------|
| Content Preservation | Input text with special characters | All characters appear unchanged in output |
| Content Preservation | Input with multiple paragraphs | All paragraphs present in output |
| Structure Analysis | Article with clear headings | AI correctly identifies h2/h3 blocks |
| Structure Analysis | Article with lists | AI correctly identifies li blocks and groups them |
| Image Placement | 3 images provided | All 3 images appear in output |
| Image Placement | Zero images provided | No image blocks in output |
| List Handling | Consecutive li blocks | Wrapped in single ul element |
| List Handling | Non-consecutive li blocks | Each group wrapped in separate ul element |
| Error Recovery | Invalid JSON from AI | Graceful fallback to default structure |
| Widget Integration | Cheerio with body wrapper | HTML extracted correctly |
| Widget Integration | Cheerio without body wrapper | HTML extracted via fallback |

## Integration Points

### Dependency: generateShortRussianCaption

**Source**: `src/adapters/llm-openai.ts`

**Purpose**: Generates localized Russian captions for images

**Usage**: Called during image block generation in HTML assembly step

**Contract**: Accepts English prompt string, returns Russian caption string

### Dependency: OpenAI Client

**Source**: Internal `getOpenAIClient()` function

**Purpose**: Provides authenticated OpenAI API client

**Configuration**: Requires `OPENAI_API_KEY` environment variable

**Model Selection**: Uses `process.env.OPENAI_MODEL` or defaults to `gpt-4o-mini`

### Consumer: Main Pipeline

**Location**: Likely invoked from job runner or content processing pipeline

**Usage Pattern**: Receives raw text and images, returns formatted HTML for WordPress publishing

## Configuration Parameters

| Parameter | Source | Default Value | Purpose |
|-----------|--------|---------------|---------|
| OPENAI_API_KEY | Environment variable | None (required) | Authenticates OpenAI API requests |
| OPENAI_MODEL | Environment variable | gpt-4o-mini | Specifies model for structure analysis |
| Temperature | Hardcoded | 0.7 | Controls AI creativity (lower = more deterministic) |
| Response Format | Hardcoded | json_object | Enforces JSON response from OpenAI |

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AI misidentifies paragraph types | Headings rendered as paragraphs or vice versa | Medium | User review workflow, AI prompt refinement |
| AI suggests poor image placement | Images interrupt content flow awkwardly | Medium | Conservative placement rules in system prompt |
| Paragraph splitting logic fails on unusual formatting | Text incorrectly segmented | Low | Add validation and edge case handling |
| JSON response format changes | Parsing fails | Low | Strict schema enforcement in prompt, validation layer |
| List detection misses grouped items | Related list items split across multiple ul elements | Medium | Enhanced AI prompt with list grouping examples |

## Success Criteria

| Criterion | Measurement Method |
|-----------|-------------------|
| Content Preservation | Automated test: All input text characters present in output (excluding whitespace normalization) |
| Structural Accuracy | Manual review: 90%+ of headings and lists correctly identified |
| Image Integration | Automated test: All provided images present in output exactly once |
| Performance | Execution time comparable to current implementation (within 10% variance) |
| Error Resilience | Graceful degradation when AI returns invalid structure |

## Future Enhancements

- Support for additional block types (blockquote, code, table)
- Multi-level list support (nested ul/ol)
- Image positioning hints (left/right alignment, inline vs full-width)
- A/B testing different AI models for structure analysis accuracy
- Caching of structure analysis results for repeated processing
