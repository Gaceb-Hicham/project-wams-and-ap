from rest_framework import serializers
from .models import Image, Album, Tag, ImageVerification


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color', 'created_at']
        read_only_fields = ['id', 'created_at']


class AlbumSerializer(serializers.ModelSerializer):
    image_count = serializers.ReadOnlyField()
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = [
            'id', 'title', 'description', 'user_id', 'user_username',
            'image_count', 'cover_url', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user_id', 'user_username', 'created_at', 'updated_at']

    def get_cover_url(self, obj):
        request = self.context.get('request')
        # Use explicit cover or first image in album
        cover = obj.cover_image or obj.images.first()
        if cover and cover.thumbnail and request:
            return request.build_absolute_uri(cover.thumbnail.url)
        if cover and cover.image_file and request:
            return request.build_absolute_uri(cover.image_file.url)
        return None


class ImageSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()
    dimensions_display = serializers.ReadOnlyField()
    thumbnail_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    album_title = serializers.CharField(source='album.title', read_only=True, default=None)

    class Meta:
        model = Image
        fields = [
            'id', 'title', 'description', 'image_url', 'thumbnail_url',
            'user_id', 'user_username', 'verification_status',
            'ai_confidence_score', 'ai_report', 'verified_at',
            'uploaded_at', 'updated_at',
            'original_filename', 'file_size', 'file_size_display',
            'mime_type', 'width', 'height', 'dimensions_display',
            'is_favorite', 'album', 'album_title', 'tags',
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
    album_id = serializers.IntegerField(required=False, allow_null=True)


class VerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageVerification
        fields = ['id', 'status', 'confidence_score', 'ai_response',
                  'requested_at', 'completed_at', 'error_message']
        read_only_fields = fields
