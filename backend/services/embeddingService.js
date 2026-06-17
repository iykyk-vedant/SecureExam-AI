const axios = require('axios');
require('dotenv').config();

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
      
      // The HF API returns an array of arrays for batch requests,
      // or a single array for a single text. Let's ensure consistency.
      if (Array.isArray(texts) && Array.isArray(response.data) && !Array.isArray(response.data[0])) {
         // Single string passed as array
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

module.exports = new EmbeddingService();
