/**
 * Library for interacting with Github & the blog repo
 */

export type GitHubFile = {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
};

export type CreateCommitResult = {
  branchName: string;
  commitSha: string;
  branchUrl: string;
};

export type StepCallback = (msg: string) => void;

async function githubFetch(
  pat: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function expectOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text();
  const trimmed = body.length > 300 ? body.slice(0, 300) + "…" : body;
  throw new Error(`${label}: HTTP ${res.status} — ${trimmed}`);
}

export async function createCommitWithFiles(opts: {
  pat: string;
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  commitMessage: string;
  files: GitHubFile[];
  onStep?: StepCallback;
}): Promise<CreateCommitResult> {
  const {
    pat,
    owner,
    repo,
    baseBranch,
    newBranch,
    commitMessage,
    files,
    onStep,
  } = opts;
  const step = (msg: string) => onStep?.(msg);
  const api = `https://api.github.com/repos/${owner}/${repo}`;

  step(`Fetching base ref heads/${baseBranch}`);
  const refRes = await githubFetch(pat, `${api}/git/ref/heads/${baseBranch}`);
  await expectOk(refRes, "Fetch base ref");
  const baseSha = (await refRes.json()).object.sha as string;

  step(`Fetching base commit ${baseSha.slice(0, 7)}`);
  const commitRes = await githubFetch(pat, `${api}/git/commits/${baseSha}`);
  await expectOk(commitRes, "Fetch base commit");
  const baseTreeSha = (await commitRes.json()).tree.sha as string;

  step(`Creating ${files.length} blob(s)`);
  const blobEntries = await Promise.all(
    files.map(async (f) => {
      const res = await githubFetch(pat, `${api}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: f.encoding }),
      });
      await expectOk(res, `Create blob ${f.path}`);
      const { sha } = (await res.json()) as { sha: string };
      return {
        path: f.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha,
      };
    }),
  );

  step("Creating tree");
  const treeRes = await githubFetch(pat, `${api}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: blobEntries }),
  });
  await expectOk(treeRes, "Create tree");
  const newTreeSha = (await treeRes.json()).sha as string;

  step("Creating commit");
  const newCommitRes = await githubFetch(pat, `${api}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: commitMessage,
      tree: newTreeSha,
      parents: [baseSha],
    }),
  });
  await expectOk(newCommitRes, "Create commit");
  const newCommitSha = (await newCommitRes.json()).sha as string;

  step(`Creating ref heads/${newBranch}`);
  const refCreateRes = await githubFetch(pat, `${api}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: newCommitSha }),
  });
  await expectOk(refCreateRes, "Create ref");

  step("Done");
  return {
    branchName: newBranch,
    commitSha: newCommitSha,
    branchUrl: `https://github.com/${owner}/${repo}/tree/${newBranch}`,
  };
}
