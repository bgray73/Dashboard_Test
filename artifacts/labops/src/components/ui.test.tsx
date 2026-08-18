import assert from "node:assert/strict";
import { it, describe } from "node:test";
import { createElement } from "react";

import { Status, Loading, ErrorState, Empty, PageTitle } from "@/components/ui";
import { renderToHTML, a11y } from "@/test/axe-helpers";

describe("Status", () => {
  it("renders an accessible status indicator", () => {
    const html = renderToHTML(createElement(Status, { status: "online" }));
    a11y.assertImagesHaveAlt(html);
    assert.match(html, /online/i);
  });

  it("renders 'unknown' when status is undefined", () => {
    const html = renderToHTML(createElement(Status, { status: undefined }));
    assert.match(html, /unknown/i);
  });

  it("renders offline status with destructive styling", () => {
    const html = renderToHTML(createElement(Status, { status: "offline" }));
    assert.match(html, /offline/i);
  });
});

describe("Loading", () => {
  it("renders a loading state with aria-busy", () => {
    const html = renderToHTML(createElement(Loading));
    assert.match(html, /animate-pulse/i);
    assert.doesNotMatch(html, /<button/i);
  });
});

describe("ErrorState", () => {
  it("renders an error message with a retry button that has an accessible name", () => {
    const onRetry = () => {};
    const html = renderToHTML(createElement(ErrorState, { onRetry }));
    a11y.assertInteractiveElementsHaveAccessibleName(html);
    assert.match(html, /Unable to reach the LabOps API/i);
    assert.match(html, /<button/i);
    assert.match(html, /Retry/i);
  });
});

describe("Empty", () => {
  it("renders empty state text", () => {
    const html = renderToHTML(createElement(Empty, { text: "No devices yet." }));
    assert.match(html, /No devices yet/i);
  });
});

describe("PageTitle", () => {
  it("renders eyebrow, title, and description", () => {
    const html = renderToHTML(
      createElement(PageTitle, {
        eyebrow: "Operations overview",
        title: "Dashboard",
        description: "Lab health at a glance.",
      }),
    );
    a11y.assertHeadingOrder(html);
    assert.match(html, /Operations overview/i);
    assert.match(html, /Dashboard/i);
    assert.match(html, /Lab health at a glance/i);
  });
});
