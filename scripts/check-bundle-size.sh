#!/bin/sh
# Fail CI if the main JS or CSS chunks exceed the documented budget.
# Run after `npm run build` so dist/ is populated.
set -eu

JS_BUDGET=512000   # 500 KB
CSS_BUDGET=204800  # 200 KB

JS_FILE=$(find dist/assets -maxdepth 1 -type f -name 'index-*.js' ! -name '*.map' | head -1)
CSS_FILE=$(find dist/assets -maxdepth 1 -type f -name 'index-*.css' | head -1)

if [ -z "$JS_FILE" ] || [ -z "$CSS_FILE" ]; then
    echo "ERROR: build artifacts not found in dist/assets/. Run 'npm run build' first."
    exit 1
fi

JS_SIZE=$(wc -c < "$JS_FILE")
CSS_SIZE=$(wc -c < "$CSS_FILE")

# Strip leading whitespace from BSD/macOS wc output
JS_SIZE=$(echo "$JS_SIZE" | tr -d ' ')
CSS_SIZE=$(echo "$CSS_SIZE" | tr -d ' ')

format_kb() {
    awk -v bytes="$1" 'BEGIN { printf "%.1f KB", bytes / 1024 }'
}

JS_PCT=$(awk -v s="$JS_SIZE" -v b="$JS_BUDGET" 'BEGIN { printf "%.0f", s/b*100 }')
CSS_PCT=$(awk -v s="$CSS_SIZE" -v b="$CSS_BUDGET" 'BEGIN { printf "%.0f", s/b*100 }')

printf "  JS:  %s / %s  (%s%% of budget)\n" "$(format_kb "$JS_SIZE")" "$(format_kb "$JS_BUDGET")" "$JS_PCT"
printf "  CSS: %s / %s  (%s%% of budget)\n" "$(format_kb "$CSS_SIZE")" "$(format_kb "$CSS_BUDGET")" "$CSS_PCT"

FAILED=0
if [ "$JS_SIZE" -gt "$JS_BUDGET" ]; then
    printf "FAIL: JS bundle %s exceeds budget %s\n" "$(format_kb "$JS_SIZE")" "$(format_kb "$JS_BUDGET")"
    FAILED=1
fi
if [ "$CSS_SIZE" -gt "$CSS_BUDGET" ]; then
    printf "FAIL: CSS bundle %s exceeds budget %s\n" "$(format_kb "$CSS_SIZE")" "$(format_kb "$CSS_BUDGET")"
    FAILED=1
fi

[ "$FAILED" = "0" ] || exit 1
echo "Bundle size check passed."
