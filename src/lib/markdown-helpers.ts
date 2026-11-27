// Parsers and helpers for handling text and markdown
import YAML, { Document, Scalar, stringify, YAMLSeq } from "yaml";

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

export function parseMarkdownHeading(contents: string): any {
  const content = atob(contents);
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch === null) return "";
  return YAML.parse(frontmatterMatch[1]);
}

export type HeaderKeysT = {
  title: string;
  date: string;
  draft: string;
  tags: string[];
  difficulty?: string;
  rating?: string;
};
export function generateMarkdownHeading(metadata: HeaderKeysT): string {
  // Here, forcing `tags: [ foo, bar ]` rather than the YAML array format with dashes
  const sequence = new Document(metadata.tags).contents as YAMLSeq<Scalar>;
  sequence.flow = true;
  // ...and forcing each tag to be double-quoted: `tags: [ "foo", "bar" ]`
  for (const tag of sequence.items) tag.type = Scalar.QUOTE_DOUBLE;
  const input = {
    ...metadata,
    tags: sequence,
  };
  const yamlContent = stringify(input).trim();
  return `---\n${yamlContent}\n---`;
}
