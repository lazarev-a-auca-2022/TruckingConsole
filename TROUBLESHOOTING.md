# Troubleshooting Guide

## Check if containers are running
```bash
docker-compose ps
```

## View application logs
```bash
docker-compose logs -f app
```

## Test PNG generation inside container
```bash
docker-compose exec app node test-png.js
```

## Test API endpoints
```bash
# On Windows
test-api.bat

# On Linux/Mac  
./test-api.sh
```

## Manual curl tests
```bash
# Test health
curl http://localhost:3000/health

# Test PNG download
curl http://localhost:3000/api/convert-png/test123 -o test.png

# Test file upload
curl -X POST \
  -F "permit=@sample-permits/image-2025-06-18-065225.png" \
  -F "state=IL" \
  http://localhost:3000/api/parse
```

## Common Issues

### 1. Download failed: Download failed
**Cause**: PNG generation error or server response issue
**Solution**: Check logs with `docker-compose logs app`

### 2. OCR not working
**Cause**: Tesseract models not downloaded
**Solution**: Wait for first OCR operation to complete (downloads ~50MB)

### 3. Container not starting
**Cause**: Port conflict or missing dependencies
**Solution**: Check if port 3000 is available, rebuild with `docker-compose up --build`

### 4. Upload fails
**Cause**: File size or format issue
**Solution**: Ensure file is < 10MB and is PNG/JPG/PDF format
