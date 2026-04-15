from django.db import models
from django.utils import timezone


class Album(models.Model):
    """Optional grouping for images."""
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    user_id = models.IntegerField(db_index=True)
    user_username = models.CharField(max_length=150, default='anonymous')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def image_count(self):
        return self.images.count()


class Image(models.Model):
    """Core image model with AI verification status tracking."""

    class VerificationStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Verification'
        UNEDITED = 'unedited', 'Unedited (Authentic)'
        EDITED = 'edited', 'Edited (Modified)'
        REJECTED = 'rejected', 'Rejected'
        ERROR = 'error', 'Verification Error'

    # Core fields
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    image_file = models.ImageField(upload_to='gallery/images/%Y/%m/%d/')
    thumbnail = models.ImageField(upload_to='gallery/thumbnails/%Y/%m/%d/', blank=True, null=True)

    # Ownership (user_id from Authentication_Service)
    user_id = models.IntegerField(db_index=True)
    user_username = models.CharField(max_length=150, default='anonymous')

    # Album relationship
    album = models.ForeignKey(
        Album, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='images'
    )

    # Verification
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    ai_confidence_score = models.FloatField(null=True, blank=True)
    ai_report = models.JSONField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # File metadata
    original_filename = models.CharField(max_length=500)
    file_size = models.PositiveIntegerField(help_text='File size in bytes')
    mime_type = models.CharField(max_length=100)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user_id', 'verification_status']),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_verification_status_display()})"

    @property
    def file_size_display(self):
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"

    @property
    def dimensions_display(self):
        if self.width and self.height:
            return f"{self.width} x {self.height}"
        return "Unknown"


class ImageVerification(models.Model):
    """Audit trail of AI verification attempts."""
    image = models.ForeignKey(Image, on_delete=models.CASCADE, related_name='verifications')
    status = models.CharField(max_length=20, choices=Image.VerificationStatus.choices)
    confidence_score = models.FloatField(null=True, blank=True)
    ai_response = models.JSONField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-requested_at']

    def __str__(self):
        return f"Verification for {self.image.title} - {self.status}"
