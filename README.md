<div align="center">

# SecureExam AI

**Online examination platform with tamper-proof, blockchain-anchored credential verification.**

[![Status](https://img.shields.io/badge/status-prototype-orange?style=flat-square)](https://github.com/iykyk-vedant/SecureExam-AI)
[![Network](https://img.shields.io/badge/Polygon-Amoy%20Testnet-8247E5?style=flat-square&logo=polygon&logoColor=white)](https://amoy.polygonscan.com)
[![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20Solidity-informational?style=flat-square)](#tech-stack)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

> Certificates issued through this platform are permanently recorded on the Polygon blockchain.  
> Any employer or institution can verify one in seconds — no account, no login.

</div>

---

## The Problem

Two trust gaps exist in traditional examination infrastructure:

| Gap | Impact |
|---|---|
| Question papers distributed days in advance | Paper leaks undermine exam integrity |
| PDF certificates with no verification layer | Forgery is trivial; employers cannot verify |

SecureExam AI closes both. Every issued certificate is hashed (SHA-256), pinned to IPFS via Pinata, and anchored on-chain through `CredentialRegistry.sol`. The verification endpoint is public — no authentication required.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    React + Vite Frontend                  │
│         TailwindCSS  ·  Firebase Auth  ·  Context API    │
└────────────────────────────┬─────────────────────────────┘
                             │  REST — Bearer Token
                             ▼
┌──────────────────────────────────────────────────────────┐
│               Node.js / Express — Port 5000              │
│                                                          │
│   authMiddleware (Firebase token verify)                 │
│        │                                                 │
│        ├── authController      ──▶  users table          │
│        ├── examController      ──▶  exams, questions,    │
│        │                            exam_attempts        │
│        ├── certificateController ─▶ certificates table   │
│        │        │                                        │
│        │        ├── certificateService  (PDF + QR)       │
│        │        └── ipfsService         (Pinata)         │
│        │                  │                              │
│        └── blockchainController                          │
│                 └── blockchainService  (Ethers.js)       │
└────┬──────────────────┬──────────────────────┬───────────┘
     │                  │                      │
     ▼                  ▼                      ▼
PostgreSQL            Redis              Pinata IPFS
(Neon — 7 tables)  (Upstash cache)    certificate PDFs
                                              │
                              ┌───────────────▼──────────────┐
                              │      Polygon Amoy Testnet     │
                              │    CredentialRegistry.sol      │
                              │                               │
                              │  issueCredential()  ← owner   │
                              │  getCredential()              │
                              │  getCredentialByHash()        │
                              │  verifyCredential()  ← public │
                              └───────────────────────────────┘
```

### Certificate Issuance Flow

```
Faculty clicks "Issue Certificate"
        │
        ▼
certificateService.generatePDF()   →   PDF with QR code
        │
        ▼
ipfsService.upload()               →   Pinata CID  +  SHA-256 hash
        │
        ▼
blockchainService.issueCredential(
  certificateId, firebaseUid,
  studentName, hash, ipfsCid
)                                  →   tx hash  +  block number
        │
        ▼
Saved to PostgreSQL certificates table
        │
        ▼
Student downloads PDF · QR links to GET /api/verify/:certificateId
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Firebase Auth |
| Backend | Node.js 18+, Express, Ethers.js |
| Database | PostgreSQL via Neon (serverless) |
| Cache | Redis via Upstash (serverless) |
| Blockchain | Solidity, Hardhat, OpenZeppelin, Polygon Amoy |
| Storage | IPFS via Pinata |
| Auth | Firebase Authentication + Admin SDK |

---

## Smart Contract

**`/blockchain/contracts/CredentialRegistry.sol`** — Hardhat + OpenZeppelin, deployed on Polygon Amoy Testnet.

Only the contract owner (institution wallet) can issue credentials. Duplicate issuance is rejected at the contract level on both Certificate ID and SHA-256 hash.

```solidity
// Issue a new credential — onlyOwner
function issueCredential(
    string memory certificateId,
    string memory firebaseUid,
    string memory studentName,
    string memory certificateHash,   // SHA-256 of certificate PDF
    string memory ipfsCid            // Pinata IPFS CID
) public onlyOwner

// Retrieve credential by Certificate ID
function getCredential(string memory certificateId)
    public view returns (Credential memory)

// Retrieve credential by SHA-256 hash
function getCredentialByHash(string memory hash)
    public view returns (Credential memory)

// Returns true if credential exists on-chain
function verifyCredential(string memory hash)
    public view returns (bool)
```

**Deploy:**

```bash
cd blockchain
npm install
npx hardhat test                                         # compile + unit tests
npx hardhat run scripts/deploy.js --network amoy         # deploy
npx hardhat verify --network amoy <CONTRACT_ADDRESS>     # verify on Polygonscan
```

> **Note:** Fund your deployer wallet at the [Polygon Amoy Faucet](https://faucet.polygon.technology/) before deploying.

---

## Database Schema

Tables are auto-created on first backend start via `config/db.js`.

```sql
certificates       -- certificate_id, firebase_uid, student_name,
                   -- certificate_hash, ipfs_cid, blockchain_tx_hash,
                   -- block_number, issued_at

users              -- firebase_uid, email, role (admin | faculty | student),
                   -- created_at

exams              -- title, description, duration_mins, passing_pct,
                   -- negative_marking, status (draft | published | closed)

questions          -- exam_id FK, question_text, options[], correct_answer,
                   -- marks, negative_marks

exam_attempts      -- student_uid FK, exam_id FK, answers, score,
                   -- violations, started_at, submitted_at

verification_logs  -- certificate_id, verified_by_ip, verified_at, result

system_settings    -- key, value (institution_name, etc.)
```

---

## API Reference

All routes except `/api/verify/:certificateId` and `POST /api/blockchain/verify` require:

```
Authorization: Bearer <firebase-id-token>
```

### Blockchain

```
POST  /api/blockchain/store              Issue credential on-chain + persist to DB
POST  /api/blockchain/verify             Verify by SHA-256 hash   [public]
GET   /api/blockchain/credential/:id     Fetch credential by Certificate ID
```

<details>
<summary><strong><code>POST /api/blockchain/store</code></strong></summary>

```json
// Request
{
  "certificateId":   "CERT-2026-001",
  "firebaseUid":     "abc123uid",
  "studentName":     "Vedant",
  "certificateHash": "6e34ac8a9d458641a9bb7538a7bde25df963c87e076615b5eb0bc23b20757a3e",
  "ipfsCid":         "QmZt8LzN23tG9hN6r4mFvWnLopq1234abc"
}

// Response
{
  "success": true,
  "message": "Credential successfully registered on blockchain and saved in database.",
  "data": {
    "transactionHash": "0xabc...",
    "blockNumber": 12345,
    "record": {
      "certificate_id":     "CERT-2026-001",
      "blockchain_tx_hash": "0xabc...",
      "issued_at":          "2026-06-09T06:00:00.000Z"
    }
  }
}
```

</details>

<details>
<summary><strong><code>POST /api/blockchain/verify</code></strong></summary>

```json
// Request
{ "certificateHash": "6e34ac8a9d458641a9bb7538a7bde25df963c87e076615b5eb0bc23b20757a3e" }

// Response — verified
{
  "verified":    true,
  "studentName": "Vedant",
  "issuedAt":    1749000000,
  "issuer":      "0x8a848108029b4193733C6beF2cd046c047eB56Ec",
  "ipfsCid":     "QmZt8LzN23tG9hN6r4mFvWnLopq1234abc",
  "transactionHash": "0xabc..."
}

// Response — not found
{ "verified": false, "message": "No matching record found on the blockchain." }
```

</details>

### Certificates

```
POST  /api/certificate/generate              Generate PDF preview (no issuance)
POST  /api/certificate/issue                 Issue + anchor to blockchain
GET   /api/certificate/:id/download          Download certificate PDF
GET   /api/verify/:certificateId             Public verification — no auth
GET   /api/certificate/student/:firebaseUid  All certificates for a student
```

### Exams

```
POST  /api/exams                       Create exam
POST  /api/exams/:examId/questions     Add questions array
POST  /api/exams/:examId/status        Set status: draft | published | closed
GET   /api/exams                       List exams (role-filtered)
GET   /api/exams/:examId               Exam detail + questions
POST  /api/exams/:examId/submit        Submit answers → compute score
GET   /api/exams/:examId/results       Results summary (Faculty / Admin)
GET   /api/students/attempts           Student's own attempt history
```

### Auth

```
POST  /api/auth/register   Register + assign role via Firebase token
POST  /api/auth/login       Validate token + return user record
GET   /api/auth/me          Current authenticated user
```

### Admin

```
GET   /api/admin/stats            System-wide metrics
GET   /api/admin/node-status      Blockchain node + service health
GET   /api/admin/settings         All system settings
POST  /api/admin/settings         Update key-value setting
GET   /api/admin/export/:type     Download audit log as CSV
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm
- MetaMask browser extension

### External Services Required

| Service | Purpose | Sign Up |
|---|---|---|
| Firebase | Auth + Admin SDK | [firebase.google.com](https://firebase.google.com) |
| Neon | Serverless PostgreSQL | [neon.tech](https://neon.tech) |
| Upstash | Serverless Redis | [upstash.com](https://upstash.com) |
| Pinata | IPFS pinning | [pinata.cloud](https://pinata.cloud) |
| Alchemy | Polygon RPC | [alchemy.com](https://alchemy.com) |

---

### 1 — Clone

```bash
git clone https://github.com/iykyk-vedant/SecureExam-AI.git
cd SecureExam-AI
```

### 2 — Smart Contract

```bash
cd blockchain && npm install
```

Create `blockchain/.env`:

```env
PRIVATE_KEY=your_deployer_wallet_private_key
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
```

```bash
npx hardhat test
npx hardhat run scripts/deploy.js --network amoy
# save the printed contract address
```

### 3 — Backend

```bash
cd backend && npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
REDIS_URL=rediss://default:pass@host:6379

POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=0xYourDeployedContractAddress

PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_JWT=
PINATA_GATEWAY_URL=https://your-gateway.mypinata.cloud

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

```bash
npm start        # http://localhost:5000 — DB tables auto-created on first run
```

### 4 — Frontend

```bash
cd frontend && npm install
```

Create `frontend/.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

```bash
npm run dev      # http://localhost:5173
npm run build    # production build
```

---

## Project Structure

```
SecureExam-AI/
│
├── blockchain/
│   ├── contracts/CredentialRegistry.sol   ← Solidity smart contract
│   ├── scripts/deploy.js
│   ├── test/CredentialRegistry.test.js
│   └── hardhat.config.js
│
├── backend/
│   ├── config/db.js                       ← PostgreSQL init + schema
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── blockchainController.js
│   │   ├── certificateController.js
│   │   └── examController.js
│   ├── middleware/authMiddleware.js        ← Firebase token verification
│   ├── services/
│   │   ├── blockchainService.js           ← Ethers.js + contract calls
│   │   ├── certificateService.js          ← PDF + QR generation
│   │   └── ipfsService.js                ← Pinata upload
│   └── server.js
│
└── frontend/
    └── src/
        ├── components/
        ├── context/
        ├── pages/
        │   ├── AdminDashboard.jsx
        │   ├── FacultyDashboard.jsx
        │   ├── StudentDashboard.jsx
        │   ├── ExamInterface.jsx
        │   └── VerificationPortal.jsx
        ├── firebase.js
        └── main.jsx
```

---

## Roadmap

**Done**

- [x] Role-based access — Admin / Faculty / Student
- [x] Exam creation with duration, passing %, negative marking config
- [x] Timed exam engine with real-time violation tracking
- [x] PDF certificate generation with QR codes
- [x] IPFS certificate storage via Pinata
- [x] On-chain credential issuance via `CredentialRegistry.sol`
- [x] Public verification portal — no login required
- [x] Admin analytics + CSV audit export

**Planned**

- [ ] AI-powered dynamic question generation at exam time (Zero Trust leak prevention)
- [ ] Bulk certificate issuance
- [ ] Email notifications on certificate issue
- [ ] NFT certificate integration
- [ ] LMS integrations (Moodle, Canvas)
- [ ] Mobile application
- [ ] Polygon mainnet deployment

---

## Security Notes

- `.env` files and private keys must never be committed — `.gitignore` is pre-configured to exclude them
- All non-public API routes require Firebase Bearer token validation in `authMiddleware.js`
- `CredentialRegistry.sol` enforces `onlyOwner` for issuance and rejects duplicate Certificate IDs and SHA-256 hashes at the contract level
- Rate-limit all public endpoints before any production deployment
- Have the smart contract independently audited before mainnet use — do not use a hot wallet for mainnet issuance

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit your changes:** `git commit -m 'Add amazing feature'`
4. **Push to the branch:** `git push origin feature/amazing-feature`
5. **Open a Pull Request**

---

## Author

**Vedant** — B.Tech Information Technology, 3rd Year

[![GitHub](https://img.shields.io/badge/GitHub-iykyk--vedant-181717?style=flat-square&logo=github)](https://github.com/iykyk-vedant)

---

<div align="center">
<sub>MIT License · Built to make academic credentials unforgeable</sub>
</div>
