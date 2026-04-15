from rest_framework import serializers
from .models import Image, Album, ImageVerification


class ImageSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()
    dimensions_display = serializers.ReadOnlyField()
    thumbnail_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = [
            'id', 'title', 'description', 'image_url', 'thumbnail_url',
            'user_id', 'user_username', 'verification_status',
            'ai_confidence_score', 'ai_report', 'verified_at',
            'uploaded_at', 'updated_at',
            'original_filename', 'file_size', 'file_size_display',
            'mime_type', 'width', 'height', 'dimensions_display',
        ]
        read_only_fields = fields

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return self.get_image_url(obj)

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image_file and request:
            return request.build_absolute_uri(obj.image_file.url)
        return None


class ImageUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    image_file = serializers.ImageField()


class VerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageVerification
        fields = ['id', 'status', 'confidence_score', 'ai_response',
                  'requested_at', 'completed_at', 'error_message']
        read_only_fields = fields
