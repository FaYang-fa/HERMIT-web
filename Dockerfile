FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

RUN useradd --create-home --uid 1000 user
WORKDIR /home/user/app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY --chown=user:user . .
USER user

EXPOSE 7860
CMD ["waitress-serve", "--host=0.0.0.0", "--port=7860", "--threads=8", "app:app"]
