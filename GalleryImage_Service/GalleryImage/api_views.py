import os
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone

from .models import Image, ImageVerification
from .serializers import ImageSerializer, ImageUploadSerializer, VerificationSerializer
from .services import AuthService, AIVerificationService, HistoriqueService
from .utils import validate_image_file, generate_thumbnail, get_image_dimensions


def get_user_from_request(request):
    """Extract user info from JWT in Authorization header."""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth.split(' ')[1]
    return AuthService.verify_token(token)


def require_auth(view_func):
    """Decorator for API views that require authentication."""
    def wrapper(request, *args, **kwargs):
        user = get_user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required.'}, status=401)
        request.user_info = user
        return view_func(request, *args, **kwargs)
    return wrapper


# ─── Images API ───────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@require_auth
def image_list_api(request):
    """GET: list user images (filterable by ?status=edited). POST: upload."""
    uid = request.user_info['user_id']

    if request.method == 'GET':
        images = Image.objects.filter(user_id=uid)
        status_filter = request.query_params.get('status')
        if status_filter:
            images = images.filter(verification_status=status_filter)
        serializer = ImageSerializer(images, many=True, context={'request': request})
        return Response(serializer.data)

    # POST — upload
    ser = ImageUploadSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=400)

    image_file = ser.validated_data['image_file']
    title = ser.validated_data.get('title', '').strip() or os.path.splitext(image_file.name)[0]
    description = ser.validated_data.get('description', '')

    errors = validate_image_file(image_file)
    if errors:
        return Response({'errors': errors}, status=400)

    width, height = get_image_dimensions(image_file)
    image_file.seek(0)
    thumbnail = generate_thumbnail(image_file)
    image_file.seek(0)

    image = Image(
        title=title, description=description, image_file=image_file,
        user_id=uid, user_username=request.user_info['username'],
        original_filename=image_file.name, file_size=image_file.size,
        mime_type=image_file.content_type or 'image/jpeg',
        width=width, height=height,
        verification_status=Image.VerificationStatus.PENDING,
    )
    if thumbnail:
        image.thumbnail = thumbnail
    image.save()

    HistoriqueService.log_action(uid, 'image_uploaded', {'image_id': image.id, 'title': title})

    # AI verification is now user-initiated (optional) — image stays pending
    # Users can verify from the frontend via POST /gallery/api/images/{id}/verify/

    return Response(ImageSerializer(image, context={'request': request}).data, status=201)


@api_view(['GET', 'DELETE'])
@permission_classes([AllowAny])
@require_auth
def image_detail_api(request, image_id):
    """GET: image detail with verifications. DELETE: remove image."""
    try:
        image = Image.objects.get(id=image_id, user_id=request.user_info['user_id'])
    except Image.DoesNotExist:
        return Response({'error': 'Image not found.'}, status=404)

    if request.method == 'DELETE':
        if image.image_file:
            image.image_file.delete(save=False)
        if image.thumbnail:
            image.thumbnail.delete(save=False)
        image.delete()
        HistoriqueService.log_action(request.user_info['user_id'], 'image_deleted', {'title': image.title})
        return Response({'message': 'Image deleted.'}, status=204)

    data = ImageSerializer(image, context={'request': request}).data
    data['verifications'] = VerificationSerializer(image.verifications.all(), many=True).data
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
@require_auth
def image_verify_api(request, image_id):
    """Trigger AI verification for an image."""
    try:
        image = Image.objects.get(id=image_id, user_id=request.user_info['user_id'])
    except Image.DoesNotExist:
        return Response({'error': 'Image not found.'}, status=404)

    ai_result = AIVerificationService.analyze_image(image.image_file.path)
    if not ai_result:
        return Response({'error': 'AI service unavailable.'}, status=503)

    is_modified = ai_result.get('is_modified', False)
    confidence = ai_result.get('confidence', 0.0)
    image.verification_status = (
        Image.VerificationStatus.EDITED if is_modified
        else Image.VerificationStatus.UNEDITED
    )
    image.ai_confidence_score = confidence
    image.ai_report = ai_result
    image.verified_at = timezone.now()
    image.save()
    ImageVerification.objects.create(
        image=image, status=image.verification_status,
        confidence_score=confidence, ai_response=ai_result,
        completed_at=timezone.now(),
    )
    return Response(ImageSerializer(image, context={'request': request}).data)


# ─── Stats & Health ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
@require_auth
def stats_api(request):
    """Dashboard statistics."""
    uid = request.user_info['user_id']
    images = Image.objects.filter(user_id=uid)
    return Response({
        'total': images.count(),
        'pending': images.filter(verification_status='pending').count(),
        'unedited': images.filter(verification_status='unedited').count(),
        'edited': images.filter(verification_status='edited').count(),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_api(request):
    """Service health check — runs checks in parallel to avoid slow timeouts."""
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=3) as pool:
        auth_future = pool.submit(AuthService.is_healthy)
        ai_future = pool.submit(AIVerificationService.is_healthy)
        hist_future = pool.submit(HistoriqueService.is_healthy)

    return Response({
        'status': 'healthy',
        'service': 'GalleryImage_Service',
        'services': {
            'gallery': True,  # If this endpoint responds, Gallery is healthy
            'auth': auth_future.result(),
            'ai': ai_future.result(),
            'historique': hist_future.result(),
        }
    })

