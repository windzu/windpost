export function parseVersion(value: string): number[] | null;
export function compareVersions(left: string, right: string): number;
export function resolveMinAppVersion(
  versions: Record<string, string>,
  pluginVersion: string,
): string | null;
