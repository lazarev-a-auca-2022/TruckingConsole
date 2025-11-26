const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Example Database for Few-Shot Learning
 * Stores verified permit extractions and retrieves relevant examples
 * to improve accuracy through in-context learning
 */
class ExampleDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, '../../training-examples');
    this.examplesFile = path.join(this.dbPath, 'verified-examples.json');
    this.examples = [];
    this.initialized = false;
  }

  /**
   * Initialize the database
   */
  async initialize() {
    try {
      await fs.ensureDir(this.dbPath);
      
      if (await fs.pathExists(this.examplesFile)) {
        const data = await fs.readJson(this.examplesFile);
        this.examples = data.examples || [];
        logger.info(`📚 Loaded ${this.examples.length} verified training examples`);
      } else {
        this.examples = [];
        await this.save();
        logger.info('📚 Initialized new example database');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize example database: ${error.message}`);
      this.examples = [];
      this.initialized = false;
    }
  }

  /**
   * Add a verified example to the database
   */
  async addExample(permitInfo, extractedWaypoints, metadata = {}) {
    try {
      if (!this.initialized) await this.initialize();

      const example = {
        id: `example_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        permitInfo: {
          state: permitInfo.state || 'UNKNOWN',
          routeDescription: permitInfo.routeDescription || '',
          waypointCount: extractedWaypoints.length
        },
        waypoints: extractedWaypoints.map(wp => ({
          order: wp.order,
          type: wp.type,
          address: wp.address
        })),
        metadata: {
          verified: metadata.verified !== false,
          confidence: metadata.confidence || 1.0,
          source: metadata.source || 'user-verified',
          ...metadata
        }
      };

      this.examples.push(example);
      await this.save();

      logger.info(`✅ Added verified example: ${extractedWaypoints.length} waypoints from ${permitInfo.state}`);
      logger.info(`   Total examples: ${this.examples.length}`);

      return example.id;

    } catch (error) {
      logger.error(`Failed to add example: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the best examples to use for few-shot learning
   * Returns examples similar to the current permit
   */
  async getBestExamples(permitInfo, count = 3) {
    try {
      if (!this.initialized) await this.initialize();

      if (this.examples.length === 0) {
        logger.info('📚 No examples available yet for few-shot learning');
        return [];
      }

      // Filter by state if available
      let candidates = this.examples;
      if (permitInfo.state) {
        const stateExamples = this.examples.filter(ex => 
          ex.permitInfo.state === permitInfo.state
        );
        if (stateExamples.length > 0) {
          candidates = stateExamples;
          logger.info(`   Found ${stateExamples.length} examples from ${permitInfo.state}`);
        }
      }

      // Sort by confidence and recency
      candidates.sort((a, b) => {
        const confidenceDiff = (b.metadata.confidence || 0) - (a.metadata.confidence || 0);
        if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Return top N examples
      const selected = candidates.slice(0, count);
      logger.info(`📚 Selected ${selected.length} examples for few-shot learning`);

      return selected;

    } catch (error) {
      logger.error(`Failed to get examples: ${error.message}`);
      return [];
    }
  }

  /**
   * Build few-shot prompt from examples
   */
  buildFewShotPrompt(examples) {
    if (examples.length === 0) return '';

    let fewShotText = '\n\nEXAMPLES OF CORRECT EXTRACTIONS:\n\n';

    examples.forEach((example, idx) => {
      fewShotText += `Example ${idx + 1} (${example.permitInfo.state} - ${example.permitInfo.waypointCount} waypoints):\n`;
      fewShotText += `Route: ${example.permitInfo.routeDescription || 'Multi-stop truck route'}\n`;
      fewShotText += `Correct Output:\n`;
      fewShotText += JSON.stringify({
        waypoints: example.waypoints
      }, null, 2);
      fewShotText += '\n\n';
    });

    fewShotText += 'NOW extract waypoints from the current permit using the same format and completeness:\n';

    return fewShotText;
  }

  /**
   * Save database to disk
   */
  async save() {
    try {
      await fs.writeJson(this.examplesFile, {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        totalExamples: this.examples.length,
        examples: this.examples
      }, { spaces: 2 });

    } catch (error) {
      logger.error(`Failed to save example database: ${error.message}`);
    }
  }

  /**
   * Get statistics about the example database
   */
  getStats() {
    if (!this.initialized || this.examples.length === 0) {
      return {
        total: 0,
        byState: {},
        avgWaypoints: 0,
        avgConfidence: 0
      };
    }

    const byState = {};
    let totalWaypoints = 0;
    let totalConfidence = 0;

    this.examples.forEach(ex => {
      const state = ex.permitInfo.state || 'UNKNOWN';
      byState[state] = (byState[state] || 0) + 1;
      totalWaypoints += ex.permitInfo.waypointCount || 0;
      totalConfidence += ex.metadata.confidence || 0;
    });

    return {
      total: this.examples.length,
      byState,
      avgWaypoints: (totalWaypoints / this.examples.length).toFixed(1),
      avgConfidence: (totalConfidence / this.examples.length).toFixed(2)
    };
  }

  /**
   * Clear all examples (use with caution!)
   */
  async clear() {
    this.examples = [];
    await this.save();
    logger.info('🗑️  Cleared all examples from database');
  }
}

// Singleton instance
let instance = null;

module.exports = {
  ExampleDatabase,
  getInstance: () => {
    if (!instance) {
      instance = new ExampleDatabase();
    }
    return instance;
  }
};
