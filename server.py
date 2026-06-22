# server.py - Dual-Model Backend (TrOCR for Text, Gemini 3.5 Flash for Math)

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
from autocorrect import Speller
import base64
import io
import re
import os

# NEW: Import dotenv to read the hidden .env file
from dotenv import load_dotenv

from google import genai
from google.genai import types

# NEW: Load the environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- GEMINI SETUP (NEW SDK) ---
print("Loading Gemini API (New SDK)...")

# Initialize the new Client architecture using the hidden key
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# ... rest of your code ...
# Define the strict behavior using the new config types
math_config = types.GenerateContentConfig(
    temperature=0.0, # Zero creativity, purely factual OCR
    system_instruction="You are an expert math OCR engine. You will receive an image of handwritten mathematics. Your ONLY job is to return the exact LaTeX code representing the image. \n- NEVER output markdown formatting (like ```latex).\n- NEVER output explanations or conversational text.\n- If it is a single symbol like '+', just output '+'.\n- ONLY output the raw LaTeX string."
)


# --- TrOCR SETUP (TEXT ENGINE) ---
print("Loading Microsoft TrOCR and Spell Checker...")
processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
spell = Speller(lang='en')

# Define protected technical terminology whitelist
TECHNICAL_WHITELIST = {
    "FLT", "UAV", "PID", "EKF", "GAZEBO", "ROS", "MAVLINK", "CAD", "MATLAB", "GYRO"
}

def process_and_correct_text(text):
    """
    Splits the sentence into words, filters out protected technical terms 
    and uppercase abbreviations, and spell-checks the rest.
    """
    words = text.split()
    corrected_words = []

    for word in words:
        clean_word = re.sub(r'[^\w]', '', word)

        if clean_word.isupper() and len(clean_word) > 1:
            corrected_words.append(word)
        elif clean_word.upper() in TECHNICAL_WHITELIST:
            corrected_words.append(word)
        else:
            corrected_words.append(spell(word))

    return " ".join(corrected_words)

print("Backend with Acronym Protection is ready!")


# --- ENDPOINT 1: STANDARD TEXT ---
@app.route('/recognize-text', methods=['POST'])
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

        print(f"[TEXT AI] Raw: '{raw_text}' -> Processed: '{corrected_text}'")
        
        return jsonify({'raw_text': raw_text, 'text': corrected_text})

    except Exception as e:
        print("Text Server Error:", str(e))
        return jsonify({'error': str(e)}), 500


# --- ENDPOINT 2: MATH EQUATIONS ---
@app.route('/recognize-math', methods=['POST'])
def process_math_equation():
    try:
        data = request.json
        image_data_url = data.get('image')

        if not image_data_url:
            return jsonify({'error': 'No image provided'}), 400

        # Decode image
        encoded_data = image_data_url.split(',')[1]
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        print("[MATH AI] Sending image to Gemini 3.5 Flash...")
        
        # Pass the image directly to the new Client pointing to the 3.5 model
        response = gemini_client.models.generate_content(
            model='gemini-3.5-flash',
            contents=image,
            config=math_config
        )
        
        actual_math_output = response.text.strip()
        print(f"[MATH AI] Gemini Output: '{actual_math_output}'")
        
        return jsonify({"text": actual_math_output})

    except Exception as e:
        print("Math Server Error:", str(e))
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000)