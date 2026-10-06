FROM python:3.12-slim AS build
WORKDIR /w
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
RUN useradd -r -u 10001 app
WORKDIR /app
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* && rm -rf /wheels
COPY app.py .
USER app
EXPOSE 5001
HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5001/health')" || exit 1
CMD ["gunicorn","-b","0.0.0.0:5001","-w","2","app:app"]
