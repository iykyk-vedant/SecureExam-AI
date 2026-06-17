const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const authController = require("./controllers/authController");
const examController = require("./controllers/examController");
const adminController = require("./controllers/adminController");
const blueprintController = require("./controllers/blueprintController");
const leakController = require("./controllers/leakController");
const { verifyToken, verifyAdmin, verifyFacultyOrAdmin } = require("./middleware/authMiddleware");
const { requireRoles } = require("./middleware/rbacMiddleware");
const eventBus = require("./services/eventBus");
const { initSubscribers } = require("./eventSubscribers");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const questionBankController = require("./controllers/questionBankController");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

const envConfig = require("./config/env");
const app = express();
const PORT = envConfig.server.port;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use("/api/", apiLimiter);

// Initialize Database Tables using Knex
async function initDatabase() {
  try {
    console.log("Running database migrations via Knex...");
    const knex = require("knex");
    const knexConfig = require("./knexfile.js");
    const db = knex(knexConfig.development);
    await db.migrate.latest();
    console.log("Database migrations applied successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
  }
}

// Routes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date() });
});



// Authentication Endpoints
app.post("/api/auth/register", verifyToken, authController.registerUser);
app.post("/api/auth/login", verifyToken, authController.loginUser);
app.get("/api/auth/me", verifyToken, authController.getCurrentUser);

// Exam Endpoints
app.post("/api/exams", verifyToken, examController.createExam);
app.post("/api/exams/:examId/questions", verifyToken, examController.addQuestions);
app.post("/api/exams/:examId/blueprints", verifyToken, verifyFacultyOrAdmin, examController.updateExamBlueprints);
app.post("/api/exams/:examId/status", verifyToken, examController.updateExamStatus);
app.get("/api/exams", verifyToken, examController.getExams);
app.get("/api/exams/:examId", verifyToken, examController.getExamDetails);
app.post("/api/exams/:examId/start", verifyToken, examController.startExam);
app.get("/api/exams/:examId/questions", verifyToken, examController.getExamQuestions);
app.post("/api/exams/:examId/submit", verifyToken, examController.submitExam);
app.get("/api/exams/:examId/results", verifyToken, examController.getExamResults);
app.get("/api/students/attempts", verifyToken, examController.getStudentAttempts);

// Knowledge Base Freeze Endpoint
app.post("/api/knowledge-base/freeze/:examId", verifyToken, verifyFacultyOrAdmin, examController.freezeKnowledgeBase);

// Blueprint Endpoints
app.post("/api/blueprints", verifyToken, verifyFacultyOrAdmin, blueprintController.createBlueprint);
app.get("/api/blueprints", verifyToken, verifyFacultyOrAdmin, blueprintController.listBlueprints);
app.get("/api/blueprints/:id", verifyToken, verifyFacultyOrAdmin, blueprintController.getBlueprintDetails);
app.put("/api/blueprints/:id", verifyToken, verifyFacultyOrAdmin, blueprintController.updateBlueprint);
app.delete("/api/blueprints/:id", verifyToken, verifyFacultyOrAdmin, blueprintController.deleteBlueprint);
app.post("/api/blueprints/preview", verifyToken, verifyFacultyOrAdmin, blueprintController.previewBlueprintVariant);

// Question Bank & AI Blueprint Pipeline Endpoints
app.post("/api/question-bank/upload", verifyToken, verifyFacultyOrAdmin, upload.single("file"), questionBankController.uploadDocument);
app.post("/api/question-bank/process", verifyToken, verifyFacultyOrAdmin, questionBankController.processDocument);
app.get("/api/question-bank/documents", verifyToken, verifyFacultyOrAdmin, questionBankController.listDocuments);
app.get("/api/concept-candidates", verifyToken, verifyFacultyOrAdmin, questionBankController.listConcepts);
app.put("/api/concept-candidates/:id", verifyToken, verifyFacultyOrAdmin, questionBankController.updateConcept);
app.post("/api/concept-candidates/:id/approve", verifyToken, verifyFacultyOrAdmin, questionBankController.approveConcept);
app.post("/api/concept-candidates/:id/reject", verifyToken, verifyFacultyOrAdmin, questionBankController.rejectConcept);
app.post("/api/concept-candidates/reject-all", verifyToken, verifyFacultyOrAdmin, questionBankController.rejectAllConcepts);
app.post("/api/concept-candidates/:id/generate-blueprints", verifyToken, verifyFacultyOrAdmin, questionBankController.generateBlueprints);
app.post("/api/concept-candidates/generate-blueprints-bulk", verifyToken, verifyFacultyOrAdmin, questionBankController.generateBlueprintsBulk);
app.get("/api/topics", verifyToken, verifyFacultyOrAdmin, questionBankController.listTopics);
app.delete("/api/topics/:id", verifyToken, verifyFacultyOrAdmin, questionBankController.deleteTopic);
app.get("/api/blueprint-candidates", verifyToken, verifyFacultyOrAdmin, questionBankController.listCandidates);
app.put("/api/blueprint-candidates/:id", verifyToken, verifyFacultyOrAdmin, questionBankController.updateCandidate);
app.post("/api/blueprint-candidates/:id/approve", verifyToken, verifyFacultyOrAdmin, questionBankController.approveCandidate);
app.post("/api/blueprint-candidates/:id/reject", verifyToken, verifyFacultyOrAdmin, questionBankController.rejectCandidate);
app.post("/api/blueprint-candidates/reject-all", verifyToken, verifyFacultyOrAdmin, questionBankController.rejectAllCandidates);
app.post("/api/blueprint-candidates/:id/preview", verifyToken, verifyFacultyOrAdmin, questionBankController.previewCandidateVariants);

// Admin Endpoints
app.get("/api/admin/stats", verifyToken, verifyAdmin, adminController.getAdminStats);

app.get("/api/admin/settings", verifyToken, verifyAdmin, adminController.getSystemSettings);
app.post("/api/admin/settings", verifyToken, verifyAdmin, adminController.updateSystemSetting);
app.get("/api/admin/export/:type", verifyToken, verifyAdmin, adminController.exportAuditCSV);

// Leak Detection Endpoints
app.post("/api/leak/report", verifyToken, verifyFacultyOrAdmin, leakController.reportLeak);
app.post("/api/leak/investigate", verifyToken, verifyFacultyOrAdmin, leakController.investigateLeak);

// Start Server after DB init
async function startServer() {
  await initDatabase();
  const VectorService = require("./services/VectorService");
  await VectorService.createCollectionIfNotExists('secureexam_chunks');
  
  if (process.env.REDIS_URL) {
    const busReady = eventBus.init(process.env.REDIS_URL);
    if (busReady) {
      console.log('Redis Event Bus initialized successfully.');
      initSubscribers();
    } else {
      console.warn('Redis Event Bus failed to initialize.');
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
