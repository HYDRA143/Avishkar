FROM python:3.12-slim
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY src/features/wifi-monitor/ ./wifi-monitor/
COPY src/shared/ ./shared/
COPY docker/run_wifi_monitor.py ./run_wifi_monitor.py
ENV PYTHONUNBUFFERED=1
ENV NETGUARD_ROLE=wifi-monitor
CMD ["python3", "run_wifi_monitor.py"]
