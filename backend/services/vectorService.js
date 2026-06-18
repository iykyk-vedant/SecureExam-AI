const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');
require('dotenv').config();

// --- Embedding Service ---
class EmbeddingService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.modelName = "BAAI/bge-small-en-v1.5";
    this.apiUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.modelName}`;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param {string[]} texts - The texts to embed.
   * @returns {Promise<number[][]>} - Array of embedding vectors.
   */
  async generateEmbeddings(texts) {
    if (!this.apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is not set in environment variables.");
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        { inputs: texts },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (Array.isArray(texts) && Array.isArray(response.data) && !Array.isArray(response.data[0])) {
         return [response.data];
      }
      return response.data;
    } catch (error) {
      console.error("Error generating embeddings:", error.response?.data || error.message);
      throw new Error("Failed to generate embeddings via HuggingFace.");
    }
  }

  getModelName() {
    return this.modelName;
  }
}

// --- Vector Service ---
class VectorService {
  constructor() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;

    if (!url || !apiKey) {
      console.warn("Qdrant credentials not found in environment variables. Vector service is disabled.");
      this.client = null;
      return;
    }

    this.client = new QdrantClient({
      url: url,
      apiKey: apiKey,
    });
    
    // BAAI/bge-small-en-v1.5 has 384 dimensions
    this.vectorSize = 384; 
    console.log("VectorService initialized with Qdrant client.");
  }

  /**
   * Initializes the collection if it doesn't exist.
   * @param {string} collectionName
   */
  async createCollectionIfNotExists(collectionName) {
    if (!this.client) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === collectionName);
      
      if (!exists) {
        await this.client.createCollection(collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
        console.log(`Qdrant collection '${collectionName}' created.`);
      } else {
        console.log(`Qdrant collection '${collectionName}' already exists.`);
      }
    } catch (error) {
      console.error("Failed to ensure Qdrant collection exists:", error);
    }
  }

  /**
   * Upserts vectorized chunks to Qdrant.
   * @param {string} collectionName
   * @param {Array} points - Array of { id, vector, payload } objects
   */
  async addChunks(collectionName, points) {
    if (!this.client) throw new Error("Qdrant client not initialized.");
    
    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points,
      });
      return true;
    } catch (error) {
      console.error("Failed to add chunks to Qdrant:", error);
      throw error;
    }
  }

  /**
   * Searches for similar vectors.
   * @param {string} collectionName
   * @param {number[]} queryVector
   * @param {number} topK
   */
  async searchSimilar(collectionName, queryVector, topK = 5) {
    if (!this.client) throw new Error("Qdrant client not initialized.");

    try {
      const results = await this.client.search(collectionName, {
        vector: queryVector,
        limit: topK,
        with_payload: true,
      });
      return results;
    } catch (error) {
      console.error("Failed to search Qdrant:", error);
      throw error;
    }
  }

  /**
   * Deletes chunks associated with a specific document.
   * @param {string} collectionName
   * @param {string} documentId
   */
  async deleteChunks(collectionName, documentId) {
    if (!this.client) throw new Error("Qdrant client not initialized.");

    try {
      await this.client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: "document_id",
              match: {
                value: documentId,
              },
            },
          ],
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to delete chunks from Qdrant:", error);
      throw error;
    }
  }
}

module.exports = new VectorService();
module.exports.EmbeddingService = new EmbeddingService();
