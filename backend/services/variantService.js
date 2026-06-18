const crypto = require('crypto');
const { generateVariant } = require('../utils/variantEngine');
const db = require('../config/db');

/**
 * VariantService: encapsulates deterministic seed generation and persistence helpers
 */
async function generateAndStoreVariant({ studentUid, blueprint, examId, attemptId }) {
  // Deterministic seed based on student, blueprint and exam
  const raw = `${studentUid}:${blueprint.id}:${examId}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const seedNum = Number(BigInt('0x' + hash.substring(0, 16)) % BigInt(1000000000));
  const seed = String(seedNum);

  const variant = generateVariant(blueprint, seed);

  const qRes = await db.query(
    `INSERT INTO attempt_questions (
      attempt_id, blueprint_id, variant_seed, question_text, options, correct_option, selected_variables
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, blueprint_id, question_text, options`,
    [attemptId, blueprint.id, seed, variant.questionText, variant.options, variant.correctOption, JSON.stringify(variant.selectedVariables)]
  );

  const inserted = qRes.rows[0];

  // fingerprint
  try {
    const fingerprintSource = `${variant.questionText}||${(variant.options || []).join('||')}||${seed}`;
    const questionHash = crypto.createHash('sha256').update(fingerprintSource).digest('hex');
    await db.query(
      `INSERT INTO question_audit_log (question_hash, student_id, attempt_id, blueprint_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [questionHash, studentUid, attemptId, blueprint.id]
    );
    inserted.question_hash = questionHash;
  } catch (err) {
    console.error('VariantService: failed to write audit log', err);
  }

  return inserted;
}

module.exports = { generateAndStoreVariant, investigateLeakByHashes };

/**
 * LeakDetectionService: basic fingerprint matching and aggregation
 */
async function investigateLeakByHashes(hashes) {
  if (!Array.isArray(hashes) || hashes.length === 0) return [];

  const res = await db.query(
    `SELECT question_hash, student_id, attempt_id, blueprint_id, created_at
     FROM question_audit_log WHERE question_hash = ANY($1)`,
    [hashes]
  );

  // Aggregate matches by student
  const byStudent = {};
  for (const row of res.rows) {
    const sid = row.student_id || 'unknown';
    if (!byStudent[sid]) byStudent[sid] = { student_id: sid, matches: [] };
    byStudent[sid].matches.push({ question_hash: row.question_hash, attempt_id: row.attempt_id, blueprint_id: row.blueprint_id, at: row.created_at });
  }

  // Compute simple confidence: percent of leaked hashes matched for each student
  const output = Object.values(byStudent).map((entry) => {
    const uniqueMatched = new Set(entry.matches.map(m => m.question_hash)).size;
    const confidence = Math.min(100, Math.round((uniqueMatched / hashes.length) * 100));
    return { ...entry, uniqueMatches: uniqueMatched, confidence };
  });

  return output;
}
