# server.py - Dual-Model Backend with Protected Technical Vocabulary

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
from autocorrect import Speller
import base64
import io
import re
from pix2tex.cli import LatexOCR



import google.generativeai as genai # Ensure you have this installed

# Configure your API key
genai.configure(api_key="YOUR_GEMINI_API_KEY")

def repair_latex_with_llm(image_bytes, failed_latex):
    """
    If pix2tex fails, ask the LLM to look at the image and 
    fix the LaTeX syntax hallucination.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Convert bytes to PIL for Gemini
    img = Image.open(io.BytesIO(image_bytes))
    
    prompt = f"""
    The following LaTeX was generated from an image of a math equation, 
    but it contains hallucinations or syntax errors: '{failed_latex}'.
    Please look at the image and provide ONLY the corrected, clean LaTeX 
    string. Do not include markdown backticks.
    """
    
    response = model.generate_content([prompt, img])
    return response.text.strip()


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
print("Loading pix2tex Math Model...")
math_model = LatexOCR()
print("Loading Microsoft TrOCR and Spell Checker...")
processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
spell = Speller(lang='en')

# 1. DEFINE YOUR CUSTOM WHITELIST
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

# --- THE SANITY REFEREE (NEW) ---
# --- THE SANITY REFEREE ---
def is_pix2tex_garbage(latex_string):
    """
    Evaluates a LaTeX string to determine if the model hallucinated.
    """
    clean_str = latex_string.replace(" ", "")
    
    # 1. Length Check: A single handwritten equation is rarely over 150 chars.
    if len(clean_str) > 150:
        return True
        
    # 2. The Array Hallucination Check: Reject massive broken matrices
    if "array" in clean_str and len(clean_str) > 80:
        return True

    # 3. Standard Garbage Text Check
    math_symbols = ['=', '+', '-', '*', '/', '^', '_', '\\', '<', '>', '(', ')']
    has_math_symbols = any(sym in clean_str for sym in math_symbols)
    
    if '\\' in clean_str:
        return False 
        
    alpha_chunks = re.split(r'[^a-zA-Z]', clean_str)
    longest_word_chain = max([len(chunk) for chunk in alpha_chunks] + [0])
    
    if not has_math_symbols and longest_word_chain > 4:
        return True 
        
    return False

print("Backend with Acronym Protection is ready!")

# --- ENDPOINT 1: STANDARD TEXT (UPDATED ROUTE NAME) ---
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


# --- ENDPOINT 2: MATH EQUATIONS (NEW) ---
@app.route('/recognize-math', methods=['POST'])
def process_math_equation():
    try:
        data = request.json
        image_data_url = data.get('image')
        encoded_data = image_data_url.split(',')[1]
        image_bytes = base64.b64decode(encoded_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # 1. Primary Inference
        raw_output = math_model(image)
        
        # 2. Check for Hallucinations
        if is_pix2tex_garbage(raw_output):
            print("[REFEREE] Rejected: Hallucination detected. Starting Repair Agent...")
            
            # 3. Trigger the Agentic Repair Loop
            repaired_output = repair_latex_with_llm(image_bytes, raw_output)
            print(f"[REPAIR AGENT] New Output: '{repaired_output}'")
            
            return jsonify({"text": repaired_output})
            
        return jsonify({"text": raw_output})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)