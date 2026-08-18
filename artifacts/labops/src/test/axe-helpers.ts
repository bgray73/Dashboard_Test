import { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as axe from "axe-core";

/**
 * Renders a React element to an HTML string (server-side, no DOM required).
 * Uses the same approach as the existing test suite for consistency.
 */
export function renderToHTML(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/**
 * Runs axe-core accessibility checks on server-rendered HTML.
 * Throws if any accessibility violations are found.
 *
 * Color-contrast is disabled by default since CSS isn't available in
 * server-rendered output. Use the `options` parameter to override.
 *
 * Usage:
 *   const html = renderToHTML(createElement(MyComponent));
 *   await checkA11y(html);
 */
export async function checkA11y(html: string, options?: axe.RunOptions) {
  // axe needs a DOM-like structure; we create a minimal one from the HTML string
  const results = await axe.run(html, {
    rules: {
      "color-contrast": { enabled: false },
      ...options?.rules,
    },
    ...options,
  });

  if (results.violations.length > 0) {
    const violationMessages = results.violations
      .map((v) => {
        const nodes = v.nodes
          .map((n) => `  - ${n.html || n.target?.join(", ") || ""}`)
          .join("\n");
        return `  ${v.id}: ${v.description}\n${nodes}`;
      })
      .join("\n");
    throw new Error(`Accessibility violations found:\n${violationMessages}`);
  }
}

/**
 * Accessibility-focused assertion helpers for server-rendered HTML.
 * These check common WCAG 2.x patterns without needing a DOM environment.
 */
export const a11y = {
  /** Check that every <img> has an alt attribute */
  assertImagesHaveAlt(html: string) {
    const imgTags = html.match(/<img[^>]*>/gi) || [];
    for (const tag of imgTags) {
      if (!/alt=/i.test(tag)) {
        throw new Error(`Image missing alt attribute: ${tag}`);
      }
    }
  },

  /** Check that interactive elements have accessible names */
  assertInteractiveElementsHaveAccessibleName(html: string) {
    const interactiveRegex = /<(button|a|input)([^>]*?)>(.*?)<\/\1>/gi;
    let match;
    while ((match = interactiveRegex.exec(html)) !== null) {
      const attrs = match[2] || "";
      const children = match[3] || "";
      const hasAriaLabel = /aria-label=/.test(attrs);
      const hasTitle = /title=/.test(attrs);
      const hasAriaLabelledBy = /aria-labelledby=/.test(attrs);
      const hasTextContent = children.trim().length > 0;
      if (!hasAriaLabel && !hasTitle && !hasAriaLabelledBy && !hasTextContent) {
        throw new Error(
          `Interactive element <${match[1].toLowerCase()}> has no accessible name: ${match[0]}`,
        );
      }
    }
  },

  /** Check that heading levels don't skip */
  assertHeadingOrder(html: string) {
    const headings = html.match(/<h([1-6])[^>]*>/gi) || [];
    const levels = headings.map((h) =>
      parseInt(h.match(/<h(\d)/i)?.[1] || "0", 10),
    );
    let prevLevel = 0;
    for (const level of levels) {
      if (level > prevLevel + 1) {
        throw new Error(`Heading level skipped: jumped from h${prevLevel} to h${level}`);
      }
      prevLevel = level;
    }
  },

  /** Check that form controls have associated labels */
  assertFormControlsHaveLabels(html: string) {
    const inputTags = html.match(/<input[^>]*>/gi) || [];
    for (const tag of inputTags) {
      const hasAriaLabel = /aria-label=/.test(tag);
      const hasAriaLabelledBy = /aria-labelledby=/.test(tag);
      const isHidden = /type="hidden"/.test(tag);
      if (!isHidden && !hasAriaLabel && !hasAriaLabelledBy) {
        throw new Error(`Form control without accessible name: ${tag}`);
      }
    }
  },
};

export type { axe };
