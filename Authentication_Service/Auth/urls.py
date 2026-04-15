from django.urls import path
from . import views

app_name = 'auth'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('verify/', views.verify_token_view, name='verify'),
    path('health/', views.health_check, name='health'),
]
