FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY src/features/vault/ ./vault/
COPY src/shared/ ./shared/
RUN pip install --no-cache-dir --upgrade pip
CMD ["python3", "vault/signature_verify.py"]
