import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(
  process.cwd(),
  process.argv[2] ?? "bundle/manifest.template.json"
);
const policy = JSON.parse(
  readFileSync(new URL("./tpg-capability-policy.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const warnings = [];

for (const [index, capability] of (manifest.capabilities ?? []).entries()) {
  if (!capability.startsWith("tpg:")) {
    continue;
  }

  const support = policy.reservedCapabilities[capability];
  if (!support) {
    warnings.push({
      path: `capabilities[${index}]`,
      message: `Reserved platform capability "${capability}" is unknown and unavailable.`,
      trackingIssues: []
    });
  } else if (support.status !== "supported") {
    warnings.push({
      path: `capabilities[${index}]`,
      message: `${capability} is ${support.status}. ${support.description}`,
      trackingIssues: support.trackingIssues
    });
  }
}

for (const [index, permission] of (manifest.permissions ?? []).entries()) {
  if (permission !== "clipboard-read" && permission !== "clipboard-write") {
    continue;
  }

  warnings.push({
    path: `permissions[${index}]`,
    message: `Permission "${permission}" is denied by the reviewed game-frame policy.`,
    trackingIssues: []
  });
}

for (const permission of ["camera", "microphone"]) {
  const capability = `tpg:${permission}`;
  const hasPermission = (manifest.permissions ?? []).includes(permission);
  const hasCapability = (manifest.capabilities ?? []).includes(capability);
  if (hasPermission === hasCapability) {
    continue;
  }

  warnings.push({
    path: hasPermission ? "capabilities" : "permissions",
    message: `Browser feature "${permission}" must be declared in both capabilities as "${capability}" and permissions as "${permission}".`,
    trackingIssues: []
  });
}

const maximumPlayers = manifest.gameMetadata?.playerCount?.max;
if (
  maximumPlayers !== undefined &&
  maximumPlayers > policy.participants.supportedMaximum
) {
  warnings.push({
    path: "gameMetadata.playerCount.max",
    message:
      maximumPlayers > policy.participants.experimentalMaximum
        ? `${maximumPlayers} players exceeds the ${policy.participants.experimentalMaximum}-participant experimental ceiling.`
        : `${maximumPlayers} players exceeds the ${policy.participants.supportedMaximum}-participant supported ceiling and is experimental.`,
    trackingIssues: policy.reservedCapabilities["tpg:large-session"].trackingIssues
  });
}

if (warnings.length === 0) {
  console.log("TPG capability check passed: manifest requests fit the supported envelope.");
} else {
  for (const warning of warnings) {
    console.warn(`TPG capability warning at ${warning.path}: ${warning.message}`);
    for (const trackingIssue of warning.trackingIssues) {
      console.warn(`  Tracking: ${trackingIssue}`);
    }
  }
  console.warn(`Review the current platform envelope: ${policy.docsUrl}`);
}
