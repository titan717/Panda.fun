/**
 * Wraps every absolute font-size in `calc(<value> * var(--fs, 1))`, so Settings › Display › Text size
 * scales all text with one custom property. Relative sizes (em, %, keywords, inherit) already follow
 * their parent and are left alone, which avoids compounding.
 */
const SKIP = /(em\b|%|inherit|initial|unset|revert|smaller|larger|var\(--fs)/;
export default function fontScale() {
  return {
    postcssPlugin: "panda-font-scale",
    Declaration: {
      "font-size"(decl) {
        const v = decl.value.trim();
        if (SKIP.test(v.replace(/rem\b/g, "REM"))) return;
        decl.value = `calc(${v} * var(--fs, 1))`;
      }
    }
  };
}
fontScale.postcss = true;
