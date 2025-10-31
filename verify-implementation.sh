#!/bin/bash

echo "=== Image Generation Pipeline - Implementation Verification ==="
echo ""

echo "✓ Checking dependencies..."
npm list @google-cloud/aiplatform form-data openai 2>/dev/null | grep -E "(google-cloud|form-data|openai)" && echo "  Dependencies installed" || echo "  ❌ Missing dependencies"

echo ""
echo "✓ Checking TypeScript compilation..."
[ -f "dist/adapters/llm-openai.js" ] && echo "  llm-openai.js compiled" || echo "  ❌ llm-openai.js missing"
[ -f "dist/adapters/image-vertex-imagen.js" ] && echo "  image-vertex-imagen.js compiled" || echo "  ❌ image-vertex-imagen.js missing"
[ -f "dist/adapters/wordpress.js" ] && echo "  wordpress.js compiled" || echo "  ❌ wordpress.js missing"
[ -f "dist/pipelines/image-pick.js" ] && echo "  image-pick.js compiled" || echo "  ❌ image-pick.js missing"
[ -f "dist/core/job-runner.js" ] && echo "  job-runner.js compiled" || echo "  ❌ job-runner.js missing"

echo ""
echo "✓ Checking function exports..."
grep -q "generateImagePrompts" dist/adapters/llm-openai.js && echo "  generateImagePrompts exported" || echo "  ❌ generateImagePrompts not found"
grep -q "generateImages" dist/adapters/image-vertex-imagen.js && echo "  generateImages exported" || echo "  ❌ generateImages not found"
grep -q "uploadMedia" dist/adapters/wordpress.js && echo "  uploadMedia exported" || echo "  ❌ uploadMedia not found"
grep -q "generateAndUploadImages" dist/pipelines/image-pick.js && echo "  generateAndUploadImages exported" || echo "  ❌ generateAndUploadImages not found"

echo ""
echo "✓ Checking job runner integration..."
grep -q "image-pick" dist/core/job-runner.js && echo "  Pipeline imported in job runner" || echo "  ❌ Pipeline not imported"
grep -q "IMAGES_PICKED" dist/core/job-runner.js && echo "  IMAGES_PICKED status used" || echo "  ❌ IMAGES_PICKED status missing"
grep -q "featuredMedia" dist/core/job-runner.js && echo "  Featured image assignment added" || echo "  ❌ Featured image not assigned"

echo ""
echo "✓ Required environment variables:"
echo "  OPENAI_API_KEY - Required for prompt generation"
echo "  GOOGLE_SERVICE_ACCOUNT_JSON - Required for image generation"
echo "  VERTEX_PROJECT_ID - Required for Vertex AI"
echo "  WP_SITE_URL - Required for WordPress upload"
echo "  WP_USERNAME - Required for WordPress upload"
echo "  WP_APP_PASSWORD - Required for WordPress upload"
echo "  IMAGE_COUNT - Optional (default: 3)"

echo ""
echo "=== Verification Complete ==="
