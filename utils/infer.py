# PLEASE DO NOT CHANGE THIS FILE NAME
# PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
# PLEASE DO NOT REMOVE THESE IMPORTS
import os
from utils.verification import *
from utils.config import *
import base64
from PIL import Image
import io
import numpy as np
import albumentations as A
# YOUR IMPORTS HERE
# ================================================================
import segmentation_models_pytorch as smp
import torch

# ================================================================

# Initialize your model here
# ================================================================
def create_model(n_classes):
    """Create UNet++ model with ResNet50 encoder"""
    model = smp.UnetPlusPlus(
        encoder_name="resnet50",
        encoder_weights=None,  # No pre-training needed for evaluation
        in_channels=3,
        classes=n_classes,
    )
    return model

device = torch.device("cpu")   
n_classes = 2
model = create_model(n_classes)

checkpoint = torch.load("checkpoints/matssl-uhcs-metaldam-finetune-on-aachen.pth", map_location=device)

model.load_state_dict(checkpoint)
model = model.to(device)
model.eval()
transform = A.Compose([
                A.Resize(512, 512, always_apply=True),
                A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225), always_apply=True),
                A.ToTensorV2(),
            ], is_check_shapes=False)
# ================================================================

def run_infer(model_input:list): # PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
    verify_types(model_input) # PLEASE DO NOT REMOVE THIS LINE
    
    # YOUR INFERENCE LOGIC HERE
    # ================================================================

    img_bytes = base64.b64decode(model_input[0]['value'])

    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    run_image = transform(image=np.array(image))["image"]
    run_image = run_image.unsqueeze(0)
    with torch.no_grad():
        pred = torch.argmax(model(run_image), dim=1)    
    
    pred = pred.squeeze().cpu().numpy().astype(np.uint8) * 255
    pil_img = Image.fromarray(pred)
    buffered = io.BytesIO()
    pil_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    results = MODEL_PREDICTION_TEMPLATE.copy()
    results[0]['value'] = img_str  
    # ================================================================

    verify_types(results) # PLEASE DO NOT REMOVE THIS LINE
    return results

# YOU CAN ADD MORE FUNCTIONS IF NEEDED
# ================================================================

# ================================================================


if __name__ == "__main__":
    # For local testing only
    sample_input = INPUT_FEATURE_LIST
    output = run_infer(sample_input)
    print("Sample Inference Output:", output)