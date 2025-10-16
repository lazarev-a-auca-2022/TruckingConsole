#!/usr/bin/env node

const OpenRouterOCR = require('./src/services/openRouterOcr');
const path = require('path');
const fs = require('fs-extra');

async function testOpenRouterOCR() {
  console.log('🤖 Testing OpenRouter OCR Service...\n');
  
  try {
    const ocr = new OpenRouterOCR();
    
    // Check if API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('❌ OPENROUTER_API_KEY not found in environment variables');
      console.log('Please set your OpenRouter API key:');
      console.log('export OPENROUTER_API_KEY="your_key_here"');
      return;
    }
    
    console.log('✅ OpenRouter API key found');
    
    // Test template analysis
    const templatePath = path.join(__dirname, 'outputs/permit-template-IL.png');
    
    if (!await fs.pathExists(templatePath)) {
      console.log(`❌ Template not found at: ${templatePath}`);
      return;
    }
    
    console.log('📋 Analyzing permit template...');
    const templateAnalysis = await ocr.analyzeTemplate(templatePath);
    
    console.log(`✅ Template analysis completed:`);
    console.log(`   Form Type: ${templateAnalysis.formType}`);
    console.log(`   Dimensions: ${templateAnalysis.dimensions.width}x${templateAnalysis.dimensions.height}`);
    console.log(`   Fields identified: ${templateAnalysis.fields.length}`);
    
    templateAnalysis.fields.slice(0, 5).forEach(field => {
      console.log(`   - ${field.name}: (${field.x}, ${field.y}) ${field.width}x${field.height}`);
    });
    
    // Test with a sample permit if available
    const samplePermit = path.join(__dirname, 'sample-permits');
    if (await fs.pathExists(samplePermit)) {
      const files = await fs.readdir(samplePermit);
      const imageFile = files.find(f => f.toLowerCase().match(/\.(png|jpg|jpeg)$/));
      
      if (imageFile) {
        const permitPath = path.join(samplePermit, imageFile);
        console.log(`\n📄 Testing text extraction from: ${imageFile}`);
        
        const extractedData = await ocr.extractAndMapText(permitPath, templateAnalysis);
        
        console.log(`✅ Text extraction completed:`);
        console.log(`   Confidence: ${extractedData.confidence}`);
        console.log('   Extracted fields:');
        
        Object.entries(extractedData.extractedFields).forEach(([key, value]) => {
          if (value) {
            console.log(`   - ${key}: "${value}"`);
          }
        });
        
        // Test full workflow
        console.log('\n🔄 Testing complete OCR workflow...');
        const result = await ocr.processPermit(permitPath, templatePath);
        
        console.log(`✅ Complete workflow succeeded:`);
        console.log(`   Generated PNG: ${result.filledPermitBuffer.length} bytes`);
        
        // Save test result
        const outputPath = path.join(__dirname, 'test-openrouter-result.png');
        await fs.writeFile(outputPath, result.filledPermitBuffer);
        console.log(`💾 Test result saved to: ${outputPath}`);
      }
    }
    
    console.log('\n🎉 OpenRouter OCR test completed successfully!');
    
  } catch (error) {
    console.error('❌ OpenRouter OCR test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }
}

// Load environment variables
require('dotenv').config();

testOpenRouterOCR();
