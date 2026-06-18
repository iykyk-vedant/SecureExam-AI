const eventBus = require('./services/eventBus');
const blockchainService = require('./services/blockchainService');
const db = require('./config/db');
const crypto = require('crypto');

function initSubscribers() {
  // Subscribe to ExamStarted
  eventBus.subscribe('ExamStarted', (payload) => {
    console.log('[EventBus] ExamStarted received:', payload);
    // In a real system, you might trigger a notification, log analytics, etc.
  });

  // Subscribe to LeakDetected
  eventBus.subscribe('LeakDetected', (payload) => {
    console.log('[EventBus] 🚨 ALARM! LeakDetected received:', payload);
    // Here we would send an email/SMS to admins
  });

  // Subscribe to SubmissionReceived
  eventBus.subscribe('SubmissionReceived', async (payload) => {
    console.log('[EventBus] SubmissionReceived received:', payload);
    
    // If the student passed, mint a credential asynchronously
    if (payload.passed) {
      console.log(`[EventBus] Student ${payload.studentId} passed exam ${payload.examId}. Minting credential...`);
      try {
        // Generate a hash representing the certificate
        const rawCertData = `${payload.studentId}:${payload.examId}:${payload.attemptId}:${payload.score}:${payload.timestamp}`;
        const certificateHash = crypto.createHash('sha256').update(rawCertData).digest('hex');
        
        // Mint on blockchain
        const txHash = await blockchainService.mintCredential(payload.studentId, payload.attemptId, certificateHash);
        
        // Save to DB
        await db.query(
          `UPDATE exam_attempts SET certificate_hash = $1, blockchain_tx_hash = $2 WHERE id = $3`,
          [certificateHash, txHash, payload.attemptId]
        );
        console.log(`[EventBus] Successfully minted and saved credential! TX: ${txHash}`);
      } catch (err) {
        console.error('[EventBus] Failed to mint credential:', err);
      }
    }
  });
}

module.exports = { initSubscribers };
