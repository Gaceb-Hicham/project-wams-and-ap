import os
import requests
import logging
from django.conf import settings
from django.core.cache import cache

from .messaging import publish_action_log
from .consul_client import resolve_service

logger = logging.getLogger(__name__)


class AuthService:
    """Client for the Authentication_Service with Consul discovery + fault tolerance."""

    @classmethod
    def _base_url(cls):
        url = resolve_service('auth-service', fallback_env_var='AUTH_SERVICE_URL')
        return url or getattr(settings, 'AUTH_SERVICE_URL', 'http://localhost:8000')

    @classmethod
    def verify_token(cls, token):
        """Verify JWT with Auth service. Returns user info dict or None."""
        cache_key = f"auth_token_{__import__('hashlib').sha256(token.encode()).hexdigest()[:16]}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            resp = requests.get(
                f"{cls._base_url()}/api/auth/verify/",
                headers={'Authorization': f'Bearer {token}'},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get('valid'):
                    user_info = {
                        'user_id':  data['user_id'],
                        'username': data['username'],
                        'email':    data.get('email', ''),
                        'role':     data.get('role', 'user'),
                    }
                    cache.set(cache_key, user_info, 60 * 30)
                    return user_info
            return None
        except requests.exceptions.RequestException as exc:
            logger.warning(f"Auth service unavailable: {exc}")
            return cached  # serve stale cache rather than fail

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/auth/health/", timeout=1).status_code == 200
        except requests.exceptions.RequestException:
            return False


class AIVerificationService:
    """Client for smart_preprocessing_service with Consul discovery + fault tolerance."""

    @classmethod
    def _base_url(cls):
        url = resolve_service('ai-service', fallback_env_var='AI_SERVICE_URL')
        return url or getattr(settings, 'AI_SERVICE_URL', 'http://localhost:8002')

    @classmethod
    def analyze_image(cls, image_file_path):
        """Send image file to AI service for manipulation analysis."""
        import mimetypes
        try:
            mime_type = mimetypes.guess_type(image_file_path)[0] or 'image/jpeg'
            filename  = os.path.basename(image_file_path)
            with open(image_file_path, 'rb') as f:
                resp = requests.post(
                    f"{cls._base_url()}/api/analyze/",
                    files={'image': (filename, f, mime_type)},
                    timeout=30,
                )
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"AI service returned {resp.status_code}: {resp.text}")
            return None
        except requests.exceptions.RequestException as exc:
            logger.warning(f"AI service unavailable: {exc}")
            return None

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/health/", timeout=1).status_code == 200
        except requests.exceptions.RequestException:
            return False


class HistoriqueService:
    """
    Async action logging via RabbitMQ (primary) with HTTP fallback.
    Fire-and-forget — never raises exceptions.
    """

    @classmethod
    def _base_url(cls):
        url = resolve_service('historique-service', fallback_env_var='HISTORIQUE_SERVICE_URL')
        return url or getattr(settings, 'HISTORIQUE_SERVICE_URL', 'http://localhost:8003')

    @classmethod
    def log_action(cls, user_id, action, details=None):
        """
        Publish action log to RabbitMQ queue (async).
        Falls back to direct HTTP call if RabbitMQ is unavailable.
        """
        published = publish_action_log(
            user_id=user_id,
            action=action,
            details=details or {},
            service='GalleryImage_Service',
        )
        if not published:
            # HTTP fallback
            try:
                requests.post(
                    f"{cls._base_url()}/api/history/log/",
                    json={
                        'user_id': user_id,
                        'action':  action,
                        'details': details or {},
                        'service': 'GalleryImage_Service',
                    },
                    timeout=2,
                )
            except requests.exceptions.RequestException as exc:
                logger.warning(f"History HTTP fallback also failed: {exc}")

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/history/health/", timeout=1).status_code == 200
        except requests.exceptions.RequestException:
            return False
