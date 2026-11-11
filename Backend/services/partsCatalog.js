const Part = require('../models/Part');
const sampleParts = require('../data/sampleParts');

async function ensureSampleParts() {
  await Part.bulkWrite(
    sampleParts.map((part) => ({
      updateOne: {
        filter: { partNumber: part.partNumber },
        update: { $setOnInsert: part },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

module.exports = { ensureSampleParts };
