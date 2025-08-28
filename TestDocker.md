# Docker Testing Guide

This guide explains how to configure and test your model using Docker.

## 📋 Docker Configuration

### Step 1: Configure Python Version (Optional)
If you need a different Python version, edit the `Dockerfile`:

```dockerfile
# Change this line to your desired Python version
FROM python:3.11-slim  # or python:3.10-slim, python:3.12-slim, etc.
```

### Step 2: GPU Support (Optional)
If your model requires GPU acceleration, you need to use a CUDA-enabled base image:

```dockerfile
# For GPU support, replace the FROM line with:
FROM nvidia/cuda:11.8-devel-ubuntu20.04

# Then install Python manually
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    python3.11-dev \
    && rm -rf /var/lib/apt/lists/*

# Create symlink for python command
RUN ln -s /usr/bin/python3.11 /usr/bin/python
```

Alternative GPU option with PyTorch base image:
```dockerfile
FROM pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime
```

## 🐳 Docker Build and Run

### Step 1: Build Docker Image
```bash
docker build -t model-template .
```

### Step 2: Run Docker Container
For CPU-only models:
```bash
docker run -p 8000:8000 model-template
```

For GPU-enabled models:
```bash
docker run --gpus all -p 8000:8000 model-template
```

### Step 3: Test the Application
1. **Check if the server is running:**
   Open your browser and go to: `http://localhost:8000`
   
   You should see the web interface for testing your model.

2. **Test the API endpoint:**
   ```bash
   curl http://localhost:8000/config
   ```
   
   This should return your model configuration.

3. **Test inference:**
   ```bash
   curl -X POST "http://localhost:8000/infer/" \
        -H "Content-Type: application/json" \
        -d '{
          "model_input": [
            {"name": "your_input_name", "value": "test_value", "type": "string"}
          ]
        }'
   ```

## 🔧 Troubleshooting Docker Issues

### Common Docker Problems:

1. **Build fails on dependencies:**
   - Make sure all packages in `requirements.txt` are compatible
   - For GPU models, ensure CUDA-compatible package versions

2. **Container exits immediately:**
   - Check logs: `docker logs <container_id>`
   - Verify your model files are included in the Docker build

3. **Port conflicts:**
   - Use a different port: `docker run -p 8001:8000 model-template`

4. **GPU not accessible:**
   - Install nvidia-docker: `sudo apt-get install nvidia-docker2`
   - Restart Docker daemon: `sudo systemctl restart docker`

5. **Permission errors:**
   - The Dockerfile creates a non-root user for security
   - Make sure your model files have proper permissions

### Debug Mode:
Run container with interactive shell for debugging:
```bash
docker run -it --entrypoint /bin/bash model-template
```

### View Logs:
```bash
docker logs <container_name_or_id>
```

## 📊 Performance Testing

### Test with Different Input Sizes:
```bash
# Test with sample data
curl -X POST "http://localhost:8000/infer/" \
     -H "Content-Type: application/json" \
     -d @test_input.json
```

### Monitor Resource Usage:
```bash
docker stats <container_name_or_id>
```

## 🎯 Success Criteria

Your Docker setup is successful when:
- ✅ Docker image builds without errors
- ✅ Container starts and stays running
- ✅ Web interface loads at `http://localhost:8000`
- ✅ API responds to `/config` endpoint
- ✅ Inference endpoint processes requests correctly
- ✅ No critical errors in container logs

If all these checks pass, your model is ready for deployment! 🎉