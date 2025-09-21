#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const { parsePermit } = require('./services/permitParser');
const { startServer } = require('./server');
const logger = require('./utils/logger');

const program = new Command();

program
  .name('trucking-console')
  .description('Console application for parsing truck permits')
  .version('1.0.0');

program
  .command('parse')
  .description('Parse a single permit file')
  .requiredOption('-f, --file <path>', 'Path to the permit file (PDF or image)')
  .requiredOption('-s, --state <state>', 'State code (IL, WI, MO, ND, IN)')
  .option('-o, --output <path>', 'Output directory for results')
  .action(async (options) => {
    try {
      logger.info(`Parsing file: ${options.file}`);
      
      if (!await fs.pathExists(options.file)) {
        logger.error(`File not found: ${options.file}`);
        process.exit(1);
      }

      const result = await parsePermit(options.file, options.state);
      
      const outputDir = options.output || './output';
      await fs.ensureDir(outputDir);
      
      const outputFile = path.join(outputDir, `parsed_${Date.now()}.json`);
      await fs.writeJson(outputFile, result, { spaces: 2 });
      
      logger.info(`Parsing completed. Results saved to: ${outputFile}`);
      console.log('\n--- Parsing Results ---');
      console.log(JSON.stringify(result, null, 2));
      
    } catch (error) {
      logger.error(`Parsing failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Batch process multiple permit files')
  .requiredOption('-d, --directory <path>', 'Directory containing permit files (PDF and images)')
  .requiredOption('-s, --state <state>', 'State code (IL, WI, MO, ND, IN)')
  .option('-o, --output <path>', 'Output directory for results')
  .action(async (options) => {
    try {
      logger.info(`Batch processing directory: ${options.directory}`);
      
      const files = await fs.readdir(options.directory);
      const permitFiles = files.filter(file => {
        const ext = file.toLowerCase();
        return ext.endsWith('.pdf') || 
               ext.endsWith('.png') || 
               ext.endsWith('.jpg') || 
               ext.endsWith('.jpeg') || 
               ext.endsWith('.gif') || 
               ext.endsWith('.bmp') || 
               ext.endsWith('.tiff') || 
               ext.endsWith('.webp');
      });
      
      if (permitFiles.length === 0) {
        logger.warn('No permit files (PDF or images) found in directory');
        return;
      }

      const outputDir = options.output || './output';
      await fs.ensureDir(outputDir);

      const results = [];
      
      for (const file of permitFiles) {
        try {
          const filePath = path.join(options.directory, file);
          logger.info(`Processing: ${file}`);
          
          const result = await parsePermit(filePath, options.state);
          result.sourceFile = file;
          results.push(result);
          
          console.log(`✓ Processed: ${file}`);
        } catch (error) {
          logger.error(`Failed to process ${file}: ${error.message}`);
          console.log(`✗ Failed: ${file} - ${error.message}`);
        }
      }

      const batchOutputFile = path.join(outputDir, `batch_results_${Date.now()}.json`);
      await fs.writeJson(batchOutputFile, results, { spaces: 2 });
      
      logger.info(`Batch processing completed. Results saved to: ${batchOutputFile}`);
      console.log(`\nProcessed ${results.length}/${permitFiles.length} files successfully`);
      
    } catch (error) {
      logger.error(`Batch processing failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Start the web server')
  .option('-p, --port <port>', 'Server port', process.env.PORT || '3000')
  .action(async (options) => {
    try {
      await startServer(parseInt(options.port));
    } catch (error) {
      logger.error(`Server startup failed: ${error.message}`);
      process.exit(1);
    }
  });

// Default action - start server if no command provided
if (process.argv.length === 2) {
  startServer(process.env.PORT || 3000);
} else {
  program.parse();
}
