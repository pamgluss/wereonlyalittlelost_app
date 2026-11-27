// Parsers and helpers for handling text and markdown
import YAML, { Document, Scalar, stringify, YAMLSeq } from "yaml";

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
}

export function getLocalImagePathsFromMarkdown(markdown: string): string[] {
  // Match on [image](/images/..) to disambiguate between
  // R2 images and local images
  const regex = /]\(\/images\/.+\.[a-z]+/g;
  const matches = markdown.match(regex);
  if (matches != null) {
    const defNotNullMatches = matches;
    // Strip the markdown bit and just return the path though
    const prefix = "](/";
    return defNotNullMatches.map((match) => {
      return match.slice(prefix.length);
    });
  } else {
    return [];
  }
}

// HeaderKeysT is the type for writing TO markdown, not what we get out of the markdown
export type HeaderKeysT = {
  title: string;
  date: string;
  draft: string | boolean;
  tags: string[];
  difficulty?: string;
  rating?: string;
};

export function parseMarkdownHeading(contents: string): HeaderKeysT {
  const content = atob(contents);
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch === null) {
    throw new Error("frontmatterMatch failed");
  }
  return YAML.parse(frontmatterMatch[1]);
}

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
