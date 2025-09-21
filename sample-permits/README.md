# Sample Permits

This directory contains sample permit files for testing the parsing functionality.

## Files

- `illinois-sample.txt` - Sample Illinois permit text
- `wisconsin-sample.txt` - Sample Wisconsin permit text
- `missouri-sample.txt` - Sample Missouri permit text
- `north-dakota-sample.txt` - Sample North Dakota permit text
- `indiana-sample.txt` - Sample Indiana permit text

## Usage

You can use these files to test the console application:

```bash
# Test Illinois permit parsing
node src/index.js parse --file sample-permits/illinois-sample.txt --state IL

# Test batch processing
node src/index.js batch --directory sample-permits --state IL
```

Note: These are text files instead of PDFs for easy testing. In production, the app will process PDF files.
