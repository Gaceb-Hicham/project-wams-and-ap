from django.apps import AppConfig


class AiEngineConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_engine'

    def ready(self):
        """Register with Consul when Django starts."""
        import os
        if os.environ.get('CONSUL_HOST'):
            try:
                from .consul_client import register_service
                register_service()
            except Exception:
                pass
