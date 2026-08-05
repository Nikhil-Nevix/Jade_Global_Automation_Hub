"""MinIO object storage for raw vulnerability CSV files."""
import os
from datetime import datetime, timedelta
from functools import lru_cache

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


@lru_cache(maxsize=1)
def get_client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def ensure_bucket() -> None:
    client = get_client()
    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)


def upload_csv(local_path: str, run_id: str) -> str:
    """Upload a CSV file to MinIO under a date-partitioned path. Returns the object name."""
    ensure_bucket()
    now = datetime.utcnow()
    ts = now.strftime("%Y%m%d_%H%M%S")
    object_name = f"{now.year}/{now.month:02d}/{now.day:02d}/{ts}_{run_id}.csv"
    get_client().fput_object(
        settings.MINIO_BUCKET, object_name, local_path, content_type="text/csv",
    )
    return object_name


def get_presigned_url(object_name: str, expires_hours: int = 24) -> str:
    return get_client().presigned_get_object(
        settings.MINIO_BUCKET, object_name, expires=timedelta(hours=expires_hours),
    )
