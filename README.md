# Solana Payout Action

A GitHub Action to automatically pay SOL/SPL tokens to a specified recipient wallet address in Solana.

## Features

- Send SOL or SPL tokens to any valid Solana wallet address
- Support for multiple Solana networks (mainnet-beta, devnet, testnet)
- Validates wallet addresses and balances before transactions
  - Checks for sufficient SOL balance to cover transaction fees (0.05 SOL buffer)
  - Verifies sufficient token balance for token transfers
  - Automatically creates token accounts for sender and recipient if they don't exist
  - Ensures sender has enough SOL to create token accounts if needed (0.003 SOL per account)
- Comprehensive error handling and validation

## Usage

```yaml
# Send SOL
- uses: UraniumCorporation/solana-payout-action@v0.0.1
  with:
    recipient-wallet-address: "RECIPIENT_WALLET_ADDRESS"
    amount: "1.5" # Amount in SOL
    token: "SOL"
    network: "mainnet-beta" # Optional (default: mainnet-beta)
  env:
    SENDER_WALLET_SECRET: ${{ secrets.SENDER_WALLET_SECRET }}

# Send SPL Tokens
- uses: UraniumCorporation/solana-payout-action@v0.0.1
  with:
    recipient-wallet-address: "RECIPIENT_WALLET_ADDRESS"
    amount: "10" # Amount in tokens
    token: "TOKEN_ADDRESS" # SPL token address
    network: "mainnet-beta" # Optional (default: mainnet-beta)
  env:
    SENDER_WALLET_SECRET: ${{ secrets.SENDER_WALLET_SECRET }}
```

## Inputs

| Input                      | Description                                           | Type   | Required | Default      |
| -------------------------- | ----------------------------------------------------- | ------ | -------- | ------------ |
| `recipient-wallet-address` | Solana wallet address to receive the payment          | string | Yes      | -            |
| `amount`                   | Amount to send (in SOL or tokens)                     | string | Yes      | -            |
| `token`                    | Token to send - either 'SOL' or an SPL token address  | string | Yes      | -            |
| `network`                  | Solana network to use (mainnet-beta, devnet, testnet) | string | No       | mainnet-beta |
| `timeout`                  | Timeout to confirm the transaction in milliseconds    | number | No       | 300000       |

## Outputs

| Output        | Description                                         | Type             | Possible Values                                                            |
| ------------- | --------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `success`     | Whether the payment was successful                  | string (boolean) | `"true"`, `"false"`                                                        |
| `error`       | The error that occurred during the payment (if any) | string           | `"<error-message>"`, `""` (empty string if `success` == `"true"`)          |
| `transaction` | The transaction signature for successful payments   | string           | `"<transaction-signature>"`, `""` (empty string if `success` == `"false"`) |

## Environment Variables

| Variable               | Description                                         | Type   | Required |
| ---------------------- | --------------------------------------------------- | ------ | -------- |
| `SENDER_WALLET_SECRET` | Private key of the sender's wallet in base58 format | string | Yes      |

## Setup

1. Create a Solana wallet to use as the sender
2. Add the wallet's private key as a repository secret named `SENDER_WALLET_SECRET`
   - The private key must be in base58 format (the standard format used by all Solana wallets)
   - Example: `4wBqpZM9xkVJc8j7Z3gVxmBpMpRxLsQpiUbLaZCziaKAcXdwdKxRvKoRZGYXvEQZUNk5UJUZyeLHz1vHvfnzHYbN`
   - You can export this from wallets like Phantom, Solflare, or Backpack
   - No other formats are supported
3. Ensure the sender wallet has sufficient SOL for the transactions:
   - For SOL transfers: At least 0.05 SOL buffer for transaction fees, plus the amount you want to send
   - For SPL token transfers: At least 0.05 SOL buffer for transaction fees, plus up to 0.006 SOL for token account creation (0.003 SOL per account for sender and recipient), plus the token amount
4. If sending SPL tokens, ensure the sender wallet has the tokens and SOL for transaction fees

> [!IMPORTANT]
> The action requires a minimum buffer of 0.05 SOL in the sender wallet to cover transaction fees for SOL transfers. For SPL token transfers, it requires a 0.05 SOL buffer plus up to 0.006 SOL for token account creation (0.003 SOL per account if needed for both sender and recipient). Token accounts will be automatically created if they don't exist, and the action will automatically calculate the required SOL based on which accounts need to be created.

## Example Workflow

### Basic SOL/SPL Token Payment Example (Manual Trigger)

```yaml
name: Send SOL/SPL Token Payment
on:
  # Manual trigger with inputs
  workflow_dispatch:
    inputs:
      recipient:
        description: "Recipient wallet address"
        required: true
      amount:
        description: "Amount to send (in SOL or tokens)"
        required: true
        default: "0.1"
      token:
        description: "Token to send - either 'SOL' or an SPL token address"
        required: true
        default: "SOL"
      network:
        description: "Solana network (mainnet-beta, devnet, testnet)"
        required: true
        default: "devnet"
        type: choice
        options:
          - mainnet-beta
          - devnet
          - testnet
      timeout:
        description: "Timeout to confirm the transaction in milliseconds"
        required: false
        default: 300000
        type: number

jobs:
  send-payment:
    runs-on: ubuntu-latest
    steps:
      - name: Solana Payout Action
      uses: UraniumCorporation/solana-payout-action@v0.0.1
        id: payout
        with:
          recipient-wallet-address: ${{ inputs.recipient }}
          amount: ${{ inputs.amount }}
          token: ${{ inputs.token }}
          network: ${{ inputs.network }}
          timeout: ${{ inputs.timeout }}
        env:
          SENDER_WALLET_SECRET: ${{ secrets.SENDER_WALLET_SECRET }}

      # Example of using the transaction output
      - name: Print Successful Payment Details
        if: steps.payout.outputs.success == 'true'
        run: |
          echo "Payment successful!"
          echo "Transaction signature: ${{ steps.payout.outputs.transaction }}"
          echo "View on Solana Explorer: https://explorer.solana.com/tx/${{ steps.payout.outputs.transaction }}"
          echo "View on Solscan: https://solscan.io/tx/${{ steps.payout.outputs.transaction }}"
```

### Use Case: Simple Automated PR Reward System

This example below shows how to automatically pay contributors in SOL/SPL Tokens when their PR is merged.

> [!CAUTION]
> This is a simplified example below and does not have any security guardrails in place. Please ensure you have the appropriate security measures applied in your workflow for your use case. DO NOT simply copy this example and use it as is in a production environment.

> [!TIP]
> For a more production-ready example of an automated PR reward system, please refer to [Uranium Corporation's Maiar AI repo's Bounty Payment Workflow](https://github.com/UraniumCorporation/maiar-ai/blob/main/.github/workflows/bounty.yaml).

#### Pull Request Format Requirements

Contributors must include their Solana wallet address in the PR description using this format:

```
## Wallet Address
solana:ABC123...XYZ
```

Example PR description:

```markdown
Fixed bug

## Wallet Address

solana:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH
```

#### Workflow Configuration

```yaml
name: Pay Contributor
on:
  pull_request:
    types: [closed]

env:
  SOLANA_NETWORK: "mainnet-beta" # or devnet, testnet, etc.
  TOKEN: "SOL" # Pay in SOL/SPL Tokens - Valid values are 'SOL' or an SPL token address

jobs:
  pay-contributor:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      # Extract wallet address from PR description
      - name: Extract wallet address
        id: extract-wallet
        run: |
          DESCRIPTION="${{ github.event.pull_request.body }}"
          WALLET=$(echo "$DESCRIPTION" | grep -o 'solana:[A-Za-z0-9]\{32,\}' | cut -d':' -f2)
          echo "wallet=$WALLET" >> $GITHUB_OUTPUT

      - uses: UraniumCorporation/solana-payout-action@v0.0.1
        with:
          recipient-wallet-address: ${{ steps.extract-wallet.outputs.wallet }}
          amount: "1.0"
          token: ${{ env.TOKEN }}
          network: ${{ env.SOLANA_NETWORK }}
          timeout: 300000 # Optional, default is 300000ms (5 minutes)
        env:
          SENDER_WALLET_SECRET: ${{ secrets.SENDER_WALLET_SECRET }}
```
