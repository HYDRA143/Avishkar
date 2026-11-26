FROM python:3.12-slim
WORKDIR /app
COPY src/features/wifi-monitor/ ./wifi-monitor/
COPY src/shared/ ./shared/
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --upgrade pip
CMD ["python3", "wifi-monitor/uno_guard.py"]
