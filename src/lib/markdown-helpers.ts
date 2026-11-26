// Parsers and helpers for handling text and markdown

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
}

export function getLocalImagePathsFromMarkdown(
  markdown: string,
): RegExpMatchArray | null {
  const regex = /images\/.+\.[a-z]+/g;
  return markdown.match(regex);
}
