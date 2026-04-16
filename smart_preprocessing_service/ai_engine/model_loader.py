"""
Model Loader & Predictor
Loads the PyTorch model and runs predictions.
Falls back to mock predictions when no model is available.
"""
import os
import logging
import random
import numpy as np
from . import config

logger = logging.getLogger(__name__)

# Global model cache — loaded once, reused for all requests
_model = None
_model_loaded = False


def _load_pytorch_model():
    """Load the PyTorch model from disk. Returns None if unavailable."""
    global _model, _model_loaded

    if _model_loaded:
        return _model

    if not os.path.exists(config.MODEL_PATH):
        logger.warning(f"Model file not found: {config.MODEL_PATH}")
        logger.info("Running in MOCK MODE — predictions are simulated.")
        _model_loaded = True
        return None

    try:
        import torch
        import torch.nn as nn
        from torchvision import models

        # Build the model architecture
        if config.MODEL_ARCH == 'resnet18':
            model = models.resnet18(weights=None)
            model.fc = nn.Linear(model.fc.in_features, config.NUM_CLASSES)
        elif config.MODEL_ARCH == 'mobilenet_v2':
            model = models.mobilenet_v2(weights=None)
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, config.NUM_CLASSES)
        elif config.MODEL_ARCH == 'efficientnet_b0':
            model = models.efficientnet_b0(weights=None)
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, config.NUM_CLASSES)
        else:
            logger.error(f"Unknown model architecture: {config.MODEL_ARCH}")
            _model_loaded = True
            return None

        # Load trained weights
        state_dict = torch.load(config.MODEL_PATH, map_location=torch.device('cpu'), weights_only=True)
        model.load_state_dict(state_dict)
        model.eval()

        _model = model
        _model_loaded = True
        logger.info(f"Model loaded successfully: {config.MODEL_ARCH} from {config.MODEL_PATH}")
        return model

    except ImportError:
        logger.error("PyTorch not installed. Install with: pip install torch torchvision")
        _model_loaded = True
        return None
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        _model_loaded = True
        return None


def predict(preprocessed_image):
    """
    Run prediction on a preprocessed image.

    Args:
        preprocessed_image: numpy array of shape (1, 3, 224, 224)

    Returns:
        dict with 'is_modified', 'confidence', 'class_name', 'probabilities'
    """
    model = _load_pytorch_model()

    if model is None or config.MOCK_MODE:
        return _mock_predict()

    try:
        import torch

        # Convert numpy to torch tensor
        tensor = torch.FloatTensor(preprocessed_image)

        # Run inference (no gradient computation)
        with torch.no_grad():
            output = model(tensor)
            probabilities = torch.softmax(output, dim=1).numpy()[0]

        # Class 0 = Real, Class 1 = Fake
        predicted_class = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_class]) * 100

        is_modified = predicted_class == 1  # 1 = Fake

        return {
            'is_modified': is_modified,
            'confidence': round(confidence, 2),
            'class_name': config.CLASS_NAMES[predicted_class],
            'probabilities': {
                'real': round(float(probabilities[0]) * 100, 2),
                'fake': round(float(probabilities[1]) * 100, 2),
            },
            'model': config.MODEL_ARCH,
            'mock': False,
        }

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return _mock_predict()


def _mock_predict():
    """Return simulated prediction for testing when no model is loaded."""
    fake_prob = random.uniform(0.1, 0.9)
    real_prob = 1.0 - fake_prob
    is_modified = fake_prob > 0.5

    return {
        'is_modified': is_modified,
        'confidence': round(max(fake_prob, real_prob) * 100, 2),
        'class_name': 'fake' if is_modified else 'real',
        'probabilities': {
            'real': round(real_prob * 100, 2),
            'fake': round(fake_prob * 100, 2),
        },
        'model': 'mock',
        'mock': True,
    }


def get_model_status():
    """Return current model status for health checks."""
    return {
        'model_loaded': _model is not None,
        'model_path': config.MODEL_PATH,
        'model_exists': os.path.exists(config.MODEL_PATH),
        'model_arch': config.MODEL_ARCH,
        'mock_mode': config.MOCK_MODE or _model is None,
        'input_size': config.INPUT_SIZE,
        'num_classes': config.NUM_CLASSES,
        'class_names': config.CLASS_NAMES,
    }
