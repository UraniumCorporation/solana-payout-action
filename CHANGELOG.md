# Changelog

## [0.0.2](https://github.com/UraniumCorporation/solana-payout-action/compare/v0.0.1...v0.0.2) (2025-05-02)

### 🩹 Fixes

* 🐛 add timeout input for confirming transactions ([#2](https://github.com/UraniumCorporation/solana-payout-action/issues/2)) ([63418f0](https://github.com/UraniumCorporation/solana-payout-action/commit/63418f039fabcb23df946e447f2f622e689bde6a))

### 📖 Documentation

* 📝 update possible values for outputs ([86d7781](https://github.com/UraniumCorporation/solana-payout-action/commit/86d7781aea07024051ef1d02a47ae373a9956170))
* 🔗 update bounty payment workflow url ([db9e7a4](https://github.com/UraniumCorporation/solana-payout-action/commit/db9e7a402bd1e57de965f6568b85315d18359b75))
* 📝 update patch version to v0.0.2 for tag/release ([#3](https://github.com/UraniumCorporation/solana-payout-action/issues/3)) ([9fdc9fe](https://github.com/UraniumCorporation/solana-payout-action/commit/9fdc9fe94b6df9109ef9a5c541dadcf46aa396b8))

### ❤️ Thank You

* ktn1234 @ktn1234

## [0.0.1](https://github.com/UraniumCorporation/solana-payout-action/commits/v0.0.1) (2025-03-07)

### Solana Payout Action v0.0.1 🚀

* We're excited to announce the initial release of the Solana Payout Action, a GitHub Action that enables automatic Solana payments directly from your GitHub workflows! 💸

### What's New 🆕

* **Automated Solana Payments**: Send SOL or SPL tokens to any valid Solana wallet address directly from your GitHub workflows. 💰
* **Multi-Network Support**: Compatible with all Solana networks (mainnet-beta, devnet, testnet). 🌐
* **Comprehensive Validation**: Automatically validates wallet addresses and balances before transactions. ✅
* **Smart Token Account Management**: Automatically creates token accounts for sender and recipient if they don't exist. 🔑
* **Detailed Transaction Outputs**: Get transaction signatures and success/error information as workflow outputs. 📝

### Key Features 🔑

* **SOL Transfers**: Send native SOL to any Solana wallet. 💵
* **SPL Token Transfers**: Send any SPL token using its token address. 🪙
* **Balance Verification**: Ensures sender has sufficient SOL for transaction fees (0.05 SOL buffer). 💳
* **Token Account Creation**: Automatically creates token accounts when needed (0.003 SOL per account). 🏦
* **Comprehensive Error Handling**: Detailed error messages for troubleshooting. ⚠️

### Use Cases 📋

* **Contributor Rewards**: Automatically pay contributors when their PRs are merged. 🤝
* **Bounty Programs**: Distribute rewards for completed tasks or bug fixes. 🏆
* **Automated Payments**: Schedule regular payments to team members or service providers. 📅
* **Blockchain Integration**: Add Solana payment capabilities to your GitHub-based applications. 🔗

### Getting Started 🚀

* Check out our [README.md](https://github.com/UraniumCorporation/solana-payout-action/blob/main/README.md) for detailed usage instructions, examples, and configuration options. 📚

### ❤️ Thank You

* ktn1234 @ktn1234
