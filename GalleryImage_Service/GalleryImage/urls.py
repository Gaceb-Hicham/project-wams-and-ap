from django.urls import path
from . import views

app_name = 'gallery'

urlpatterns = [
    # Auth
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),

    # Gallery
    path('', views.dashboard_view, name='dashboard'),
    path('edited/', views.edited_view, name='edited'),
    path('unedited/', views.unedited_view, name='unedited'),
    path('pending/', views.pending_view, name='pending'),
    path('upload/', views.upload_view, name='upload'),
    path('image/<int:image_id>/', views.image_detail_view, name='image_detail'),
    path('image/<int:image_id>/verify/', views.verify_image_view, name='verify_image'),
    path('image/<int:image_id>/delete/', views.delete_image_view, name='delete_image'),
]
