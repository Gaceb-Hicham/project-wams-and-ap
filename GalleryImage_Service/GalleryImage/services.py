import requests
import logging
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class AuthService:
    """Client for the Authentication_Service with fault tolerance."""

    @staticmethod
    def _base_url():
        return getattr(settings, 'AUTH_SERVICE_URL', 'http://localhost:8000')

    @classmethod
    def verify_token(cls, token):
        """Verify JWT with Auth service. Returns user info dict or None."""
        cache_key = f"auth_token_{hash(token)}"
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
                        'user_id': data['user_id'],
                        'username': data['username'],
                        'email': data.get('email', ''),
                    }
                    cache.set(cache_key, user_info, 60 * 30)
                    return user_info
            return None
        except requests.exceptions.RequestException as e:
            logger.warning(f"Auth service unavailable: {e}")
            return cached

    @classmethod
    def register(cls, username, email, password, password_confirm, first_name='', last_name=''):
        try:
            resp = requests.post(
                f"{cls._base_url()}/api/auth/register/",
                json={
                    'username': username, 'email': email,
                    'password': password, 'password_confirm': password_confirm,
                    'first_name': first_name, 'last_name': last_name,
                },
                timeout=5,
            )
            return resp.json(), resp.status_code
        except requests.exceptions.RequestException as e:
            logger.error(f"Auth service unavailable: {e}")
            return {'error': 'Authentication service unavailable.'}, 503

    @classmethod
    def login(cls, username, password):
        try:
            resp = requests.post(
                f"{cls._base_url()}/api/auth/login/",
                json={'username': username, 'password': password},
                timeout=5,
            )
            return resp.json(), resp.status_code
        except requests.exceptions.RequestException as e:
            logger.error(f"Auth service unavailable: {e}")
            return {'error': 'Authentication service unavailable.'}, 503

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/auth/health/", timeout=2).status_code == 200
        except requests.exceptions.RequestException:
            return False


class AIVerificationService:
    """Client for smart_preprocessing_service with fault tolerance."""

    @staticmethod
    def _base_url():
        return getattr(settings, 'AI_SERVICE_URL', 'http://localhost:8002')

    @classmethod
    def analyze_image(cls, image_file_path):
        """Send image to AI service. Returns result dict or None if unavailable."""
        try:
            with open(image_file_path, 'rb') as f:
                resp = requests.post(
                    f"{cls._base_url()}/api/analyze/",
                    files={'image': f},
                    timeout=30,
                )
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"AI service returned {resp.status_code}: {resp.text}")
            return None
        except requests.exceptions.RequestException as e:
            logger.warning(f"AI service unavailable: {e}")
            return None

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/health/", timeout=2).status_code == 200
        except requests.exceptions.RequestException:
            return False


class HistoriqueService:
    """Client for Historique_Service. Fire-and-forget logging."""

    @staticmethod
    def _base_url():
        return getattr(settings, 'HISTORIQUE_SERVICE_URL', 'http://localhost:8003')

    @classmethod
    def log_action(cls, user_id, action, details=None):
        try:
            requests.post(
                f"{cls._base_url()}/api/history/log/",
                json={'user_id': user_id, 'action': action, 'details': details or {}, 'service': 'GalleryImage_Service'},
                timeout=5,
            )
        except requests.exceptions.RequestException as e:
            logger.warning(f"History service unavailable: {e}")

    @classmethod
    def is_healthy(cls):
        try:
            return requests.get(f"{cls._base_url()}/api/health/", timeout=2).status_code == 200
        except requests.exceptions.RequestException:
            return False
