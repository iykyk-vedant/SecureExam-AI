exports.up = async function(knex) {
  const hasCertHash = await knex.schema.hasColumn('exam_attempts', 'certificate_hash');
  if (!hasCertHash) {
    await knex.raw('ALTER TABLE exam_attempts ADD COLUMN certificate_hash VARCHAR(255);');
  }

  const hasTxHash = await knex.schema.hasColumn('exam_attempts', 'blockchain_tx_hash');
  if (!hasTxHash) {
    await knex.raw('ALTER TABLE exam_attempts ADD COLUMN blockchain_tx_hash VARCHAR(255);');
  }
};

exports.down = async function(knex) {
  // Safe down migration is to drop columns, but let's be careful with exam data
  await knex.raw('ALTER TABLE exam_attempts DROP COLUMN IF EXISTS certificate_hash;');
  await knex.raw('ALTER TABLE exam_attempts DROP COLUMN IF EXISTS blockchain_tx_hash;');
};
