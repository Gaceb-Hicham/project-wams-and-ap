from django.urls import path
from . import api_views

app_name = 'gallery'

urlpatterns = [
    # REST API endpoints (called by React frontend)
    path('api/images/', api_views.image_list_api, name='api_image_list'),
    path('api/images/<int:image_id>/', api_views.image_detail_api, name='api_image_detail'),
    path('api/images/<int:image_id>/verify/', api_views.image_verify_api, name='api_image_verify'),
    path('api/stats/', api_views.stats_api, name='api_stats'),
    path('api/health/', api_views.health_api, name='api_health'),
]
