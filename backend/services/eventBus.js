/**
 * Lightweight Redis-backed event bus wrapper with safe fallback.
 */
let Redis;
try {
  Redis = require('ioredis');
} catch (e) {
  Redis = null;
}

let publisher = null;
let subscriber = null;

function init(redisUrl) {
  if (!Redis) return false;
  try {
    publisher = new Redis(redisUrl);
    subscriber = new Redis(redisUrl);
    return true;
  } catch (err) {
    console.error('eventBus init failed', err);
    return false;
  }
}

async function publish(channel, message) {
  try {
    if (!publisher) return false;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    await publisher.publish(channel, payload);
    return true;
  } catch (err) {
    console.error('eventBus publish error', err);
    return false;
  }
}

function subscribe(channel, handler) {
  if (!subscriber) return false;
  subscriber.subscribe(channel, (err) => {
    if (err) console.error('eventBus subscribe error', err);
  });
  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      try {
        const payload = JSON.parse(message);
        handler(payload);
      } catch (e) {
        handler(message);
      }
    }
  });
  return true;
}

module.exports = { init, publish, subscribe, initSubscribers };

/**
 * Event subscribers: register all application event handlers.
 */
function initSubscribers() {
  // Lazy-require to avoid circular dependencies
  const blockchainService = require('./blockchainService');
  const db = require('../config/db');
  const crypto = require('crypto');

  // Subscribe to ExamStarted
  subscribe('ExamStarted', (payload) => {
    console.log('[EventBus] ExamStarted received:', payload);
  });

  // Subscribe to LeakDetected
  subscribe('LeakDetected', (payload) => {
    console.log('[EventBus] 🚨 ALARM! LeakDetected received:', payload);
  });

  // Subscribe to SubmissionReceived
  subscribe('SubmissionReceived', async (payload) => {
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
