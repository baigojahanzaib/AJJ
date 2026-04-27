#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const appJsonPath = path.join(rootDir, 'app.json');

const platform = process.argv[2] || 'android';
const channel = process.argv[3] || 'production';
const environment = process.argv[4] || 'production';

function extractJson(raw) {
  const objectStart = raw.indexOf('{');
  const arrayStart = raw.indexOf('[');
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  const objectEnd = raw.lastIndexOf('}');
  const arrayEnd = raw.lastIndexOf(']');
  const end = Math.max(objectEnd, arrayEnd);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Unable to find JSON in command output:\n${raw}`);
  }

  return JSON.parse(raw.slice(start, end + 1));
}

function runJsonCommand(args) {
  const command = `npx eas-cli ${args.map((arg) => JSON.stringify(arg)).join(' ')}`;
  const stdout = execSync(command, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  return extractJson(stdout);
}

function getSourceKey(source) {
  if (source.filePath) {
    return `${source.type}:${source.filePath}`;
  }

  if (source.id) {
    return `${source.type}:${source.id}`;
  }

  return `${source.type}:unknown`;
}

function getFingerprintDiffKeys(compareResult) {
  const map1 = new Map(compareResult.fingerprint1.sources.map((source) => [getSourceKey(source), source.hash]));
  const map2 = new Map(compareResult.fingerprint2.sources.map((source) => [getSourceKey(source), source.hash]));
  const keys = new Set([...map1.keys(), ...map2.keys()]);

  return [...keys].filter((key) => map1.get(key) !== map2.get(key));
}

function getConfiguredRuntimeVersion() {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expoConfig = appJson.expo || {};
  return expoConfig[platform]?.runtimeVersion ?? expoConfig.runtimeVersion ?? null;
}

function formatBuild(build) {
  return `${build.id} (${build.createdAt}, runtime ${build.runtimeVersion}, fingerprint ${build.fingerprint?.hash || 'unknown'})`;
}

function main() {
  const configuredRuntime = getConfiguredRuntimeVersion();
  if (!configuredRuntime) {
    throw new Error(`No runtimeVersion configured for platform "${platform}" in app.json.`);
  }

  const builds = runJsonCommand([
    'build:list',
    '--platform',
    platform,
    '--limit',
    '25',
    '--json',
    '--non-interactive',
  ]);

  const latestBuild = builds
    .filter((build) => build.status === 'FINISHED' && build.channel === channel)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latestBuild) {
    throw new Error(`No finished ${platform} build found on channel "${channel}".`);
  }

  const compareResult = runJsonCommand([
    'fingerprint:compare',
    '--build-id',
    latestBuild.id,
    '--environment',
    environment,
    '--json',
    '--non-interactive',
  ]);

  const diffKeys = getFingerprintDiffKeys(compareResult);
  const allowedDiffKeys = new Set([
    'contents:expoConfig',
    'contents:packageJson:scripts',
  ]);
  const blockingDiffKeys = diffKeys.filter((key) => !allowedDiffKeys.has(key));

  const currentFingerprint = compareResult.fingerprint2.hash;
  const failures = [];

  if (latestBuild.runtimeVersion !== configuredRuntime) {
    failures.push(
      `Configured ${platform} runtimeVersion is ${configuredRuntime}, but the latest ${channel} build is ${latestBuild.runtimeVersion}.`
    );
  }

  if (blockingDiffKeys.length > 0) {
    failures.push(
      `Native-relevant fingerprint sources differ from the latest ${channel} build: ${blockingDiffKeys.slice(0, 6).join(', ')}${blockingDiffKeys.length > 6 ? ', ...' : ''}.`
    );
  }

  if (failures.length > 0) {
    console.error('OTA publish blocked.');
    console.error(`Latest build: ${formatBuild(latestBuild)}`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    console.error(
      'Build a new native binary for this channel before publishing another OTA, or republish an older compatible update group.'
    );
    process.exit(1);
  }

  console.log(`OTA runtime check passed for ${platform}/${channel}.`);
  console.log(`Latest build: ${formatBuild(latestBuild)}`);
  console.log(`Current project fingerprint: ${currentFingerprint}`);
  if (diffKeys.length > 0) {
    console.log(`Allowed fingerprint differences: ${diffKeys.join(', ')}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`OTA runtime check failed: ${error.message}`);
  process.exit(1);
}
