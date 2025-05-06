import { Octokit } from "@octokit/rest";
import { execSync } from "child_process";
import fs from "fs";

const CHANGELOG_PATH = "CHANGELOG.md";
const PACKAGE_JSON_PATH = "package.json";

const owner = "UraniumCorporation";
const repo = "solana-payout-action";

(async () => {
  // Get the last tag
  const octokit = new Octokit();
  const { data } = await octokit.rest.repos.listTags({
    owner,
    repo
  });

  const lastTag = data[0].name;

  // Get all unique authors since the last tag

  // Get the authors since the last tag in the format "name|email"
  const authors = execSync(
    `git log ${lastTag}..HEAD --pretty=format:"%an|%ae"`
  );

  const authorToUsername = new Map<string, string>();

  // Get unique authors and map them to their github username if available by author email
  for (const author of authors.toString().split("\n")) {
    const [name, email] = author.trim().split("|");
    if (!authorToUsername.has(name)) authorToUsername.set(name, "");
    if (!email) continue;

    // Get the github username by email
    const res = await octokit.request("GET /search/commits", {
      q: `author-email:${email}`,
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    const username = res.data.items?.[0]?.author?.login;
    if (username && !authorToUsername.get(name)) {
      console.log(`Found github username for ${name} (${email}): ${username}`);
      authorToUsername.set(name, `@${username}`);
    }
  }

  // Get the changelog
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf-8");

  // Inject the contributors section

  // Get the current version from package.json (when running release-it, this will be the new version)
  const newVersion = fs.readFileSync(PACKAGE_JSON_PATH, "utf-8");
  const newVersionTag = JSON.parse(newVersion).version;

  const contributorsSection = `\n\n### Thank You ❤️\n\n${[...authorToUsername].map(([name, username]) => `* ${name}${username ? ` ${username}` : ""}`).join("\n")}`;
  const tagHeading = `## [${newVersionTag.replace(/^v/, "")}]`;
  const index = changelog.indexOf(tagHeading);

  if (index === -1) {
    console.error(
      `[ERROR] Could not find the new tag heading "${tagHeading}" in ${CHANGELOG_PATH}`
    );
    console.error(
      `[ERROR] You will have to add the contributors section manually to the changelog`
    );
    console.error("Contributors:", contributorsSection);
    return;
  }

  // For inserting contributors after the current release content but before the previous tag ## heading (i.e. ## [vX.Y.Z])
  const nextSectionIndex = changelog.indexOf(
    "\n## ",
    index + tagHeading.length
  );

  let updatedChangelog;

  // If there is no next section, append the contributors section to the end
  if (nextSectionIndex === -1) {
    updatedChangelog = changelog.trimEnd() + contributorsSection;
  }

  // If there is a next section, insert the contributors section before it
  if (nextSectionIndex !== -1) {
    updatedChangelog =
      changelog.slice(0, nextSectionIndex).trimEnd() +
      contributorsSection +
      "\n\n" +
      changelog.slice(nextSectionIndex).trimStart();
  }

  fs.writeFileSync(CHANGELOG_PATH, updatedChangelog);
  console.log("✅ Injected contributors into CHANGELOG.md");
})();
