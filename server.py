# server.py - TrOCR Backend with Protected Technical Vocabulary

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
from autocorrect import Speller
import base64
import io
import re

app = Flask(__name__)
CORS(app)

print("Loading Microsoft TrOCR and Spell Checker...")
processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
spell = Speller(lang='en')

# 1. DEFINE YOUR CUSTOM WHITELIST
# Add any domain-specific acronyms or terms you want to protect here
TECHNICAL_WHITELIST = {
    "FLT", "UAV", "PID", "EKF", "GAZEBO", "ROS", "MAVLINK", "CAD", "MATLAB"
}

def process_and_correct_text(text):
    """
    Splits the sentence into words, filters out protected technical terms 
    and uppercase abbreviations, and spell-checks the rest.
    """
    # Split the text by spaces while keeping track of words
    words = text.split()
    corrected_words = []

    for word in words:
        # Clean the word of punctuation (e.g., "FLT," -> "FLT") to check it properly
        clean_word = re.sub(r'[^\w]', '', word)

        # Strategy 1: Skip if the word is fully uppercase (Abbreviations like FLT)
        if clean_word.isupper() and len(clean_word) > 1:
            corrected_words.append(word)
            
        # Strategy 2: Skip if the word matches your explicit whitelist
        elif clean_word.upper() in TECHNICAL_WHITELIST:
            corrected_words.append(word)
            
        # Otherwise: Perform standard spell checking
        else:
            corrected_words.append(spell(word))

    return " ".join(corrected_words)

print("Backend with Acronym Protection is ready!")

@app.route('/recognize', methods=['POST'])
def recognize_handwriting():
    try:
        data = request.json
        image_data_url = data.get('image')

        if not image_data_url:
            return jsonify({'error': 'No image provided'}), 400

        # Decode image
        encoded_data = image_data_url.split(',')[1]
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # AI Text Generation
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        generated_ids = model.generate(pixel_values)
        raw_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()

        # Pass raw text through the protected post-processing pipeline
        corrected_text = process_and_correct_text(raw_text)

        print(f"Raw AI Output: '{raw_text}'")
        print(f"Processed Output: '{corrected_text}'")
        
        return jsonify({
            'raw_text': raw_text,
            'text': corrected_text
        })

    except Exception as e:
        print("Server Error:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)