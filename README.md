# 🏥 Smart Contract-Enabled Health Insurance Claims Processing

Welcome to a blockchain-powered solution for streamlining health insurance claims! This project uses the Stacks blockchain and Clarity smart contracts to enable instant verification of patient histories, automate claims processing, and reduce fraud—particularly in low-income communities where fraudulent claims can drain limited resources and delay legitimate care.

By leveraging immutable records and smart contracts, insurers, providers, and patients can trust the system to verify eligibility, history, and claims without intermediaries, cutting costs and fraud.

## ✨ Features

- 📋 **Patient Registration**: Securely register patients with hashed medical histories for privacy.
- 🔍 **Instant History Verification**: Verify patient medical records in real-time to prevent duplicate or fraudulent claims.
- 💼 **Policy Management**: Create and manage insurance policies with automated premium tracking.
- 📄 **Claim Submission & Processing**: Submit claims and automate approvals based on verified data.
- 🚫 **Fraud Detection**: Built-in rules to flag suspicious claims (e.g., frequency limits, anomaly detection).
- 💰 **Automated Payouts**: Instant payouts to providers or patients upon valid claim approval.
- ⚖️ **Dispute Resolution**: Transparent handling of claim disputes with audit trails.
- 🔒 **Privacy & Compliance**: Use hashes for sensitive data to ensure HIPAA-like privacy on-chain.
- 📊 **Audit Logs**: Immutable records for all transactions to enable regulatory audits.

## 🛠 How It Works

### For Patients
- Register your profile and upload hashed medical history using the `PatientRegistry` contract.
- Submit claims directly or through providers via the `ClaimSubmission` contract.
- Verify your own history or policy status with the `HistoryVerification` contract.

### For Healthcare Providers
- Register as a verified provider using the `ProviderRegistry` contract.
- Submit claims on behalf of patients, including treatment details.
- Receive automated payouts from the `PayoutManagement` contract if claims are approved.

### For Insurers
- Create and manage policies with the `InsurancePolicy` contract.
- Set fraud detection rules in the `FraudDetection` contract.
- Review and resolve disputes via the `DisputeResolution` contract.

### For Auditors/Regulators
- Access immutable audit logs from the `AuditLog` contract to review transactions.
- Verify any claim or history without altering records.

**Core Process**:
- A patient or provider submits a claim with a treatment hash.
- The system verifies the patient's history and policy eligibility instantly.
- Fraud checks run automatically; if passed, payout is triggered.
- All actions are logged immutably.

## 📑 Smart Contracts

1. **PatientRegistry**: Registers patients with unique IDs, basic info, and hashed medical histories.
2. **ProviderRegistry**: Registers and verifies healthcare providers.
3. **InsurancePolicy**: Manages insurance policies, including premiums, coverage limits, and eligibility.
4. **HistoryVerification**: Verifies patient medical histories against stored hashes for instant checks.
5. **ClaimSubmission**: Handles submission of claims with treatment details and hashes.
6. **FraudDetection**: Applies rules to detect fraud (e.g., claim frequency, anomaly patterns).
7. **PayoutManagement**: Automates payouts to providers or patients upon claim approval.
8. **DisputeResolution**: Manages disputes with evidence submission and resolution voting.
9. **AuditLog**: Records all actions immutably for transparency and compliance.

## 🚀 Getting Started

### Prerequisites
- Stacks blockchain environment (testnet or mainnet).
- Clarity development tools (e.g., Clarinet for local testing).
- Wallet with STX tokens for transaction fees.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/health-insurance-claims.git
   ```
2. Install Clarinet:
   ```bash
   npm install -g @hirosystems/clarinet
   ```
3. Navigate to the project directory and deploy contracts:
   ```bash
   cd health-insurance-claims
   clarinet deploy
   ```

### Usage
1. **Register a Patient**:
   - Call `PatientRegistry::register-patient` with patient ID, name, and history hash.
   - Example: `(contract-call? .patient-registry register-patient u456 "John Doe" 0xdef456...)`

2. **Register a Provider**:
   - Use `ProviderRegistry::register-provider` with provider ID and credentials.
   - Example: `(contract-call? .provider-registry register-provider u789 "Clinic XYZ" "Licensed")`

3. **Create Insurance Policy**:
   - Call `InsurancePolicy::create-policy` with patient ID, coverage details.
   - Example: `(contract-call? .insurance-policy create-policy u456 "Basic Coverage" u1000)`

4. **Verify History**:
   - Use `HistoryVerification::verify-history` with patient ID and provided hash.
   - Example: `(contract-call? .history-verification verify-history u456 0xdef456...)`

5. **Submit Claim**:
   - Call `ClaimSubmission::submit-claim` with claim ID, patient ID, treatment hash.
   - Example: `(contract-call? .claim-submission submit-claim u101 u456 0xghi789...)`

6. **Detect Fraud**:
   - Automatically triggered, but query with `FraudDetection::check-claim` for manual review.
   - Example: `(contract-call? .fraud-detection check-claim u101)`

7. **Process Payout**:
   - Call `PayoutManagement::process-payout` if approved.
   - Example: `(contract-call? .payout-management process-payout u101 u789 u500)`

8. **Raise Dispute**:
   - Use `DisputeResolution::raise-dispute` with claim ID and reason.
   - Example: `(contract-call? .dispute-resolution raise-dispute u101 "Invalid Treatment")`

9. **View Audit Log**:
   - Query `AuditLog::get-log` for a transaction ID.
   - Example: `(contract-call? .audit-log get-log u101)`

## 🧪 Testing
Run tests using Clarinet:
```bash
clarinet test
```

## 📜 License
MIT License

## 🤝 Contributing
Pull requests are welcome! Please open an issue to discuss proposed changes.