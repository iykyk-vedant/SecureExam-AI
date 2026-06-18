const db = require('../config/db');
const { investigateLeakByHashes } = require('../services/variantService');
const eventBus = require('../services/eventBus');

/**
 * Endpoint to report a potential leak.
 * Route: POST /api/leak/report
 */
async function reportLeak(req, res) {
  const { hashes, sourceUrl, notes } = req.body;
  const reporterUid = req.user.uid;

  if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
    return res.status(400).json({ success: false, error: "Must provide an array of question hashes." });
  }

  try {
    // Usually we would insert this into a leak_reports table, but for MVP we will directly investigate
    const results = await investigateLeakByHashes(hashes);

    if (results.length > 0) {
      // Find the student with the highest confidence
      results.sort((a, b) => b.confidence - a.confidence);
      const topSuspect = results[0];

      // Publish an event bus notification
      eventBus.publish('LeakDetected', {
        reporterId: reporterUid,
        sourceUrl: sourceUrl || 'Unknown source',
        suspectStudentId: topSuspect.student_id,
        confidence: topSuspect.confidence,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: "Leak reported and analyzed.",
      investigation: results
    });

  } catch (error) {
    console.error("Failed to report/investigate leak:", error);
    return res.status(500).json({ success: false, error: "Leak investigation failed." });
  }
}

/**
 * Admin endpoint to investigate a leak explicitly
 * Route: POST /api/leak/investigate
 */
async function investigateLeak(req, res) {
  const { hashes } = req.body;

  if (!hashes || !Array.isArray(hashes)) {
    return res.status(400).json({ success: false, error: "Must provide an array of question hashes." });
  }

  try {
    const results = await investigateLeakByHashes(hashes);
    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Failed to investigate leak:", error);
    return res.status(500).json({ success: false, error: "Leak investigation failed." });
  }
}

module.exports = {
  reportLeak,
  investigateLeak
};
