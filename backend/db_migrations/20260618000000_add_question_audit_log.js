exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS question_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_hash TEXT NOT NULL,
      student_id VARCHAR(255),
      attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
      blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw(`DROP TABLE IF EXISTS question_audit_log;`);
};
