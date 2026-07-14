import type { BlogFile } from "./prepare";

export interface GitHubPublishOptions {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  files: BlogFile[];
  message: string;
}

export interface GitHubPublishResult {
  commitSha: string;
  commitUrl: string;
}

export interface GitHubConnectionResult {
  defaultBranch: string;
  canPush: boolean;
}

const API_VERSION = "2026-03-10";

export async function verifyGitHubRepository({
  owner,
  repo,
  token,
}: {
  owner: string;
  repo: string;
  token: string;
}): Promise<GitHubConnectionResult> {
  const result = await request<{
    default_branch: string;
    permissions?: { push?: boolean };
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
  return {
    defaultBranch: result.default_branch,
    canPush: result.permissions?.push === true,
  };
}

export async function publishFilesToGitHub(options: GitHubPublishOptions): Promise<GitHubPublishResult> {
  const { owner, repo, branch, token, files, message } = options;
  if (!owner || !repo || !branch || !token) throw new Error("GitHub 发布配置不完整。");
  if (files.length === 0) throw new Error("没有可发布的 Blog 文件。");

  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const ref = await request<{ object: { sha: string } }>(
    `${base}/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`,
    token,
  );
  const parentSha = ref.object.sha;
  const parent = await request<{ tree: { sha: string } }>(`${base}/git/commits/${parentSha}`, token);

  const tree = await Promise.all(files.map(async (file) => {
    const blob = await request<{ sha: string }>(`${base}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: file.encoding }),
    });
    return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
  }));

  const nextTree = await request<{ sha: string }>(`${base}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  });
  const commit = await request<{ sha: string }>(`${base}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message, tree: nextTree.sha, parents: [parentSha] }),
  });

  await request(`${base}/git/refs/heads/${branch.split("/").map(encodeURIComponent).join("/")}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return {
    commitSha: commit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
  };
}

async function request<T = unknown>(pathname: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": API_VERSION,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(`GitHub API ${response.status}：${detail?.message || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
