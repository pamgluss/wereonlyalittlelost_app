import {
  getLocalImagePathsFromMarkdown,
  parseMarkdownHeading,
} from "@/lib/markdown-helpers";

const sampleMarkdown = `---
title: "Testing Title"
date: 2020-10-12
tags: ['Tag', 'Tag2']
draft: false
---

Testing Content

This is a local Image
![20200606_064124](/images/20200606_064124.jpg)

This is an R2 Image
![20201006_081334](https://pub-6552d22062234bd394ccc7a815d71ba7.r2.dev/images/20201006_081334.jpg)

Testing Content continued
`;

const encodedMarkdown = btoa(sampleMarkdown);

describe("Markdown helpers - images", () => {
  test("getLocalImagePathsFromMarkdown returns only local image", () => {
    const matches = getLocalImagePathsFromMarkdown(sampleMarkdown);
    expect(matches).not.toBeNull();

    if (!matches) return;

    expect(matches.length).toBe(1);
    expect(matches[0]).toBe("images/20200606_064124.jpg");
  });
});

describe("Markdown helpers - heading", () => {
  test("parseMarkdownHeading returns header values", () => {
    const parsedHeading = parseMarkdownHeading(encodedMarkdown);
    console.log(parsedHeading);
    expect(parsedHeading).not.toBe(null);

    if (!parsedHeading) return;

    expect(parsedHeading.title).toBe("Testing Title");

    // When parsing from markdown, the type will be boolean
    expect(parsedHeading.draft).toBe(false);
  });
});
