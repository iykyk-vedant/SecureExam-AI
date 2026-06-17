const eventBus = require('./services/eventBus');

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
  eventBus.subscribe('SubmissionReceived', (payload) => {
    console.log('[EventBus] SubmissionReceived received:', payload);
    // You could trigger an asynchronous grading job if it wasn't done synchronously
  });
}

module.exports = { initSubscribers };
