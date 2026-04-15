import os
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils import timezone

from .models import Image, ImageVerification
from .services import AuthService, AIVerificationService, HistoriqueService
from .decorators import login_required_gallery
from .utils import validate_image_file, generate_thumbnail, get_image_dimensions


# ─── Authentication Views ────────────────────────────────────────

def login_view(request):
    """Login page — calls Authentication_Service API."""
    if getattr(request, 'user_info', None):
        return redirect('gallery:dashboard')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if not username or not password:
            messages.error(request, 'Please enter both username and password.')
            return render(request, 'GalleryImage/auth/login.html')

        data, status_code = AuthService.login(username, password)

        if status_code == 200 and 'token' in data:
            request.session['jwt_token'] = data['token']
            request.session['user_info'] = data['user']
            messages.success(request, f"Welcome back, {data['user']['username']}!")
            return redirect('gallery:dashboard')
        elif status_code == 503:
            messages.error(request, 'Authentication service is currently unavailable.')
        else:
            messages.error(request, data.get('message', 'Invalid credentials.'))

    return render(request, 'GalleryImage/auth/login.html')


def register_view(request):
    """Registration page — calls Authentication_Service API."""
    if getattr(request, 'user_info', None):
        return redirect('gallery:dashboard')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()

        if not all([username, email, password, password_confirm]):
            messages.error(request, 'Please fill in all required fields.')
            return render(request, 'GalleryImage/auth/register.html')

        if password != password_confirm:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'GalleryImage/auth/register.html')

        data, status_code = AuthService.register(
            username, email, password, password_confirm, first_name, last_name
        )

        if status_code == 201 and 'token' in data:
            request.session['jwt_token'] = data['token']
            request.session['user_info'] = data['user']
            messages.success(request, 'Account created successfully!')
            return redirect('gallery:dashboard')
        elif status_code == 503:
            messages.error(request, 'Authentication service is currently unavailable.')
        else:
            for field, errs in data.get('errors', {}).items():
                for err in (errs if isinstance(errs, list) else [errs]):
                    messages.error(request, f"{field}: {err}")

    return render(request, 'GalleryImage/auth/register.html')


def logout_view(request):
    request.session.flush()
    messages.info(request, 'You have been logged out.')
    return redirect('gallery:login')


# ─── Gallery Views ────────────────────────────────────────────────

@login_required_gallery
def dashboard_view(request):
    """Main dashboard — all user images with stats."""
    uid = request.user_info['user_id']
    images = Image.objects.filter(user_id=uid)

    stats = {
        'total': images.count(),
        'pending': images.filter(verification_status=Image.VerificationStatus.PENDING).count(),
        'unedited': images.filter(verification_status=Image.VerificationStatus.UNEDITED).count(),
        'edited': images.filter(verification_status=Image.VerificationStatus.EDITED).count(),
    }

    services_health = {
        'auth': AuthService.is_healthy(),
        'ai': AIVerificationService.is_healthy(),
        'historique': HistoriqueService.is_healthy(),
    }

    return render(request, 'GalleryImage/gallery/dashboard.html', {
        'images': images, 'stats': stats,
        'services_health': services_health,
        'page_title': 'My Gallery', 'active_tab': 'dashboard',
    })


@login_required_gallery
def edited_view(request):
    images = Image.objects.filter(
        user_id=request.user_info['user_id'],
        verification_status=Image.VerificationStatus.EDITED,
    )
    return render(request, 'GalleryImage/gallery/filtered_gallery.html', {
        'images': images, 'page_title': 'Edited Images', 'active_tab': 'edited',
        'empty_message': 'No edited images found. Images detected as modified by AI will appear here.',
    })


@login_required_gallery
def unedited_view(request):
    images = Image.objects.filter(
        user_id=request.user_info['user_id'],
        verification_status=Image.VerificationStatus.UNEDITED,
    )
    return render(request, 'GalleryImage/gallery/filtered_gallery.html', {
        'images': images, 'page_title': 'Unedited Images', 'active_tab': 'unedited',
        'empty_message': 'No unedited images found. Images verified as authentic by AI will appear here.',
    })


@login_required_gallery
def pending_view(request):
    images = Image.objects.filter(
        user_id=request.user_info['user_id'],
        verification_status=Image.VerificationStatus.PENDING,
    )
    return render(request, 'GalleryImage/gallery/filtered_gallery.html', {
        'images': images, 'page_title': 'Pending Verification', 'active_tab': 'pending',
        'empty_message': 'No images pending verification.',
    })


@login_required_gallery
def upload_view(request):
    """Upload page with drag-and-drop."""
    if request.method == 'POST':
        uid = request.user_info['user_id']
        uname = request.user_info['username']

        title = request.POST.get('title', '').strip()
        description = request.POST.get('description', '').strip()
        image_file = request.FILES.get('image_file')

        if not image_file:
            messages.error(request, 'Please select an image file.')
            return render(request, 'GalleryImage/gallery/upload.html', {'active_tab': 'upload'})

        if not title:
            title = os.path.splitext(image_file.name)[0]

        errors = validate_image_file(image_file)
        if errors:
            for e in errors:
                messages.error(request, e)
            return render(request, 'GalleryImage/gallery/upload.html', {'active_tab': 'upload'})

        width, height = get_image_dimensions(image_file)
        image_file.seek(0)
        thumbnail = generate_thumbnail(image_file)
        image_file.seek(0)

        image = Image(
            title=title, description=description, image_file=image_file,
            user_id=uid, user_username=uname,
            original_filename=image_file.name, file_size=image_file.size,
            mime_type=image_file.content_type or 'image/jpeg',
            width=width, height=height,
            verification_status=Image.VerificationStatus.PENDING,
        )
        if thumbnail:
            image.thumbnail = thumbnail
        image.save()

        HistoriqueService.log_action(uid, 'image_uploaded', {'image_id': image.id, 'title': title})

        # Auto-send to AI for verification
        ai_result = AIVerificationService.analyze_image(image.image_file.path)

        if ai_result:
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
            label = 'edited' if is_modified else 'unedited'
            messages.success(request, f'Image "{title}" verified as {label} (confidence: {confidence:.0%}).')
        else:
            ImageVerification.objects.create(
                image=image, status=Image.VerificationStatus.PENDING,
                error_message='AI service unavailable at time of upload.',
            )
            messages.warning(request, f'Image "{title}" uploaded but AI service is unavailable. Retry later.')

        return redirect('gallery:image_detail', image_id=image.id)

    return render(request, 'GalleryImage/gallery/upload.html', {
        'page_title': 'Upload Image', 'active_tab': 'upload',
    })


@login_required_gallery
def image_detail_view(request, image_id):
    image = get_object_or_404(Image, id=image_id, user_id=request.user_info['user_id'])
    return render(request, 'GalleryImage/gallery/image_detail.html', {
        'image': image, 'verifications': image.verifications.all(),
        'page_title': image.title, 'active_tab': None,
    })


@login_required_gallery
def verify_image_view(request, image_id):
    """Re-trigger AI verification."""
    if request.method != 'POST':
        return redirect('gallery:image_detail', image_id=image_id)

    image = get_object_or_404(Image, id=image_id, user_id=request.user_info['user_id'])
    ai_result = AIVerificationService.analyze_image(image.image_file.path)

    if ai_result:
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
        label = 'edited' if is_modified else 'unedited'
        messages.success(request, f'Image verified as {label} (confidence: {confidence:.0%}).')
    else:
        messages.error(request, 'AI service is currently unavailable. Please try again later.')

    return redirect('gallery:image_detail', image_id=image_id)


@login_required_gallery
def delete_image_view(request, image_id):
    if request.method != 'POST':
        return redirect('gallery:image_detail', image_id=image_id)

    image = get_object_or_404(Image, id=image_id, user_id=request.user_info['user_id'])
    title = image.title
    if image.image_file:
        image.image_file.delete(save=False)
    if image.thumbnail:
        image.thumbnail.delete(save=False)
    image.delete()

    HistoriqueService.log_action(request.user_info['user_id'], 'image_deleted', {'title': title})
    messages.success(request, f'Image "{title}" has been deleted.')
    return redirect('gallery:dashboard')
