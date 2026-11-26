FROM python:3.12-slim
WORKDIR /app
COPY src/features/wifi-monitor/ ./wifi-monitor/
COPY src/shared/ ./shared/
COPY docker/run_wifi_monitor.py ./run_wifi_monitor.py
ENV PYTHONUNBUFFERED=1
ENV NETGUARD_ROLE=wifi-monitor
CMD ["python3", "run_wifi_monitor.py"]
