const { spawnSync } = require("child_process");

// Get inputs from environment variables
const prNumber = process.env.PR_NUMBER;
const prAuthor = process.env.PR_AUTHOR;
const issues = process.env.ISSUES;
const repo = process.env.REPO || process.env.GITHUB_REPOSITORY;

// Prepare issues text for the comment
let issuesList = "";
if (issues !== "none") {
  // Convert comma-separated list to "#X, #Y" format with links
  issuesList = issues
    .split(",")
    .map((issue) => `[#${issue}](https://github.com/${repo}/issues/${issue})`)
    .join(", ");

  // Add a comment to the PR with issues
  const comment =
    "✅ PR Merged\n\n" +
    `Thank you @${prAuthor} for your contribution in resolving ${issuesList}!`;

  const result = spawnSync(
    "gh",
    ["pr", "comment", prNumber, "--body", comment],
    {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    }
  );

  // Parse the response to get the comment URL
  let commentUrl = "";
  try {
    if (result.stdout) {
      // The gh pr comment command outputs the URL directly
      commentUrl = result.stdout.trim();
    }
  } catch (parseError) {
    console.log(`Note: Could not parse comment URL: ${parseError.message}`);
  }

  console.log(
    `Added comment to PR #${prNumber} with issues reference${
      commentUrl ? ` (${commentUrl})` : ""
    }`
  );
} else {
  // Add a comment to the PR without issues
  const comment =
    "✅ PR Merged\n\n" + `Thank you @${prAuthor} for your contribution!`;

  const result = spawnSync(
    "gh",
    ["pr", "comment", prNumber, "--body", comment],
    {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "inherit"],
    }
  );

  // Parse the response to get the comment URL
  let commentUrl = "";
  try {
    if (result.stdout) {
      // The gh pr comment command outputs the URL directly
      commentUrl = result.stdout.trim();
    }
  } catch (parseError) {
    console.log(`Note: Could not parse comment URL: ${parseError.message}`);
  }

  console.log(
    `Added comment to PR #${prNumber}${commentUrl ? ` (${commentUrl})` : ""}`
  );
}
