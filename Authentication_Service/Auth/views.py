import jwt
from datetime import datetime, timedelta, timezone

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import User
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer


JWT_SECRET = 'microservices-shared-secret-key-2026'
JWT_ALGORITHM = 'HS256'


def generate_token(user):
    """Generate a JWT token for the given user."""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'email': user.email or '',
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """Register a new user and return a JWT token."""
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token = generate_token(user)
        return Response({
            'token': token,
            'user': UserSerializer(user).data,
            'message': 'Registration successful.',
        }, status=status.HTTP_201_CREATED)
    return Response({
        'errors': serializer.errors,
        'message': 'Registration failed.',
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Authenticate a user and return a JWT token."""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid credentials.',
                'message': 'Username or password is incorrect.',
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({
                'error': 'Invalid credentials.',
                'message': 'Username or password is incorrect.',
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                'error': 'Account disabled.',
            }, status=status.HTTP_403_FORBIDDEN)

        token = generate_token(user)
        return Response({
            'token': token,
            'user': UserSerializer(user).data,
            'message': 'Login successful.',
        })
    return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_token_view(request):
    """Verify a JWT token and return user info. Used by other microservices."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return Response({'valid': False, 'error': 'No token provided.'}, status=401)

    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = User.objects.get(id=payload['user_id'])
        return Response({
            'valid': True,
            'user_id': user.id,
            'username': user.username,
            'email': user.email or '',
        })
    except jwt.ExpiredSignatureError:
        return Response({'valid': False, 'error': 'Token expired.'}, status=401)
    except (jwt.InvalidTokenError, User.DoesNotExist):
        return Response({'valid': False, 'error': 'Invalid token.'}, status=401)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint for service discovery."""
    return Response({'status': 'healthy', 'service': 'Authentication_Service'})
