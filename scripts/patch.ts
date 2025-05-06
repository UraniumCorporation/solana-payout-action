import { Octokit } from "@octokit/rest";
import fs from "fs";

const CHANGELOG_PATH = "CHANGELOG.md";
const PACKAGE_JSON_PATH = "package.json";

const owner = "UraniumCorporation";
const repo = "solana-payout-action";

(async () => {
  // Get the changelog
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf-8");

  // Inject the contributors section

  // Get the current version from package.json (when running release-it, this will be the new version)
  const latestVersion = fs.readFileSync(PACKAGE_JSON_PATH, "utf-8");
  const latestVersionTag = JSON.parse(latestVersion).version;

  const tagHeading = `## [${latestVersionTag.replace(/^v/, "")}]`;
  const index = changelog.indexOf(tagHeading);

  if (index === -1) {
    console.error(
      `[ERROR] Could not find the latest tag heading "${tagHeading}" in ${CHANGELOG_PATH}`
    );
    console.error(
      `[ERROR] You will have to add the contributors section manually to the github release notes from the changelog`
    );
    return;
  }

  // For inserting contributors after the current release content but before the previous tag ## heading (i.e. ## [vX.Y.Z])
  const nextSectionIndex = changelog.indexOf(
    "\n## ",
    index + tagHeading.length
  );

  let patch;

  // If there is no next section, grab the current release content
  if (nextSectionIndex === -1) {
    patch = changelog.slice(index);
  }

  // If there is a next section, grab the content between the current release and the previous release
  if (nextSectionIndex !== -1) {
    patch = changelog.slice(index, nextSectionIndex).trimEnd();
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  // Patch the gihub release notes with the contributors section
  const release = await octokit.repos.getReleaseByTag({
    owner,
    repo,
    tag: `v${latestVersionTag}`
  });

  await octokit.repos.updateRelease({
    owner,
    repo,
    release_id: release.data.id,
    body: patch
  });

  console.log(
    `✅ Updated Github release notes for the latest tag v${latestVersionTag} to include contributors`
  );
})();
