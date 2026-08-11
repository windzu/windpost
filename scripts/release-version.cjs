function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) throw new Error("Expected standard SemVer values");
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function resolveMinAppVersion(versions, pluginVersion) {
  return Object.entries(versions)
    .filter(([version]) => parseVersion(version) && compareVersions(version, pluginVersion) <= 0)
    .sort(([left], [right]) => compareVersions(left, right))
    .at(-1)?.[1] ?? null;
}

module.exports = { compareVersions, parseVersion, resolveMinAppVersion };
