from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import json
import uvicorn
import io
import datetime 
import uuid # DEPLOYMENT: Added for Session tracking
from pypdf import PdfReader

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# DEPLOYMENT: Removed SIMULATION and LIVE loop dependencies that crash Render
SAMPLE_RATE = 16000
BATCH_SECS = 7
WINDOW_SIZE_FOLLOW_UP = 8
WINDOW_SIZE_TRANSITION = 7
WINDOW_SIZE_EMPATHY = 5

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    client = openai.OpenAI()
except:
    print("⚠️ OpenAI API Key missing.")

# ---------------------------------------------------------
# GLOBAL STATE (DEPLOYMENT: Modified for multi-user)
# ---------------------------------------------------------
class InterviewSession:
    def __init__(self, sid):
        self.sid = sid # DEPLOYMENT: Track unique ID
        self.interview_id = uuid.uuid4().hex[:5].upper()
        self.transcript_history = []
        self.current_question_id = None 
        self.interview_plan = {"interview_guides_collection": []} 
        self.system_identity = (
            """You are a qualitative research assistant. The interview transcripts do
            not have speaker labels and punctuation. You should still interpret the
            dialogue correctly by inferring interviewer and interviewee turns internally.
            If priority instructions are given, you must follow them strictly and may disgerard
            any conflicting default instructions that follow below."""
        )
        self.custom_prompt = ""
        self.latest_transcript = ""
        self.analysis_followup = "Waiting for interview..."
        self.analysis_transition = "Waiting for interview..."
        self.analysis_empathy = "Status: Normal"
        self.is_recording = False
        
        # --- LOGGING SETUP ---
        self.log_filename = None

    def create_log_file(self):
        if not self.log_filename:
            # Filename now strictly uses the Interview ID
            self.log_filename = f"Interview_{self.interview_id}.txt"
            with open(self.log_filename, "w", encoding="utf-8") as f:
                # Add the ID to the very top of the log for linking
                f.write(f"=== INTERVIEW ID: {self.interview_id} ===\n")
                f.write(f"Timestamp: {datetime.datetime.now()}\n")
                f.write(f"Note: Use this ID to link to anonymous survey forms.\n")
                f.write("=" * 40 + "\n\n")
            print(f"📁 Logging to: {self.log_filename}")

    def write_log(self, category, context_input, ai_output):
        if not self.log_filename:
            self.create_log_file()
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        with open(self.log_filename, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] --- {category.upper()} ---\n")
            f.write(f"CONTEXT (Input):\n{context_input}\n")
            f.write("-" * 20 + "\n")
            f.write(f"AI RESPONSE (Output):\n{ai_output}\n")
            f.write("=" * 40 + "\n\n")

# DEPLOYMENT: Dictionary to hold 30 active participants
active_sessions = {}

# ---------------------------------------------------------
# CORE LOGIC
# ---------------------------------------------------------
def transcribe_buffer(file_obj):
    try:
        # Pass the file as a precise tuple to satisfy the SDK's validation
        res = client.audio.transcriptions.create(
            model="whisper-1", 
            file=("audio.webm", file_obj, "audio/webm"), 
            language="en"
        )
        return res.text
    except Exception as e:
        print(f"Transcription Error: {e}")
        return ""

def analyze_chunk(sess, context, transcript, sys_prompt):
    # DEPLOYMENT: Pass 'sess' to access the correct user's system_identity
    if not transcript.strip(): 
        return "Waiting..."

    if sys_prompt.strip():
        priority_instruction = f"### CRITICAL PRIORITY INSTRUCTIONS:\n{sys_prompt} \n\n"
    else:
        priority_instruction = f"N/A \n\n"

    system_content = (
        f"{priority_instruction}"
        f"{sess.system_identity}\n\n"
        f"INTERVIEW CONTEXT & GUIDELINES:\n{context}"
    )

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": f"Transcript:\n{transcript}"}
    ]

    try:
        res = client.chat.completions.create(model="gpt-5.1", messages=messages, max_completion_tokens=500)
        output = res.choices[0].message.content
        return output
    except Exception as e: 
        return f"Error: {e}"

def run_ai_analysis(sess):
    """Uses the PDF-generated plan to drive the interview logic with priority instructions."""
    plan_str = json.dumps(sess.interview_plan)
    
    # -------------------------------------------------
    # 1. Follow-up (Deepen)
    # -------------------------------------------------
    recent_text_followup = " ".join(sess.transcript_history[-WINDOW_SIZE_FOLLOW_UP:])

    follow_up_prompt = f"""Identify the active topic in this Interview Plan: {plan_str}
    Based on the transcript, suggest 2 probes. 
    Instructions:
    Identify Theme: Determine the active theme from the Interview Plan based on the most recent transcript segments.
    Current Scope Only: You are strictly forbidden from suggesting questions that relate to future themes or topics in the plan that have not been reached yet. 
    Focus entirely on "drilling down" into the current topic, aiming to achieve the theme objective set in the interview plan
    Variation: Use different probing styles and choose the most suitable ones (e.g.: clarification probe, elaboration probe, contrast probe, consequence probe, interpretive probe or echo probe).
    Use keywords from the transcript to make the questions context-specific.
    Format: Exactly 2 questions, separated by a blank line, no other text.

    Example Output:
    **Question 1:** [Follow-up question 1]

    **Question 2:** [Follow-up question 2]

    OUTPUT RULES:
    - Use exactly the format above.
    -18 words max per question.
    - Do NOT include any extra explanation or notes.
    - Do NOT add references question.
    - No square brackets [] in output.
    - **IMPORTANT:** Prioritize any 'New Instructions' provided in the system content over these default instructions if they conflict.
    """

    sess.analysis_followup = analyze_chunk(
        sess, follow_up_prompt, recent_text_followup, sess.custom_prompt
    )

    # LOGGING FOLLOW UP
    sess.write_log("Follow-Up Generation", recent_text_followup, sess.analysis_followup)

    
    # -------------------------------------------------
    # 2. Transition (Shift)
    # -------------------------------------------------
    recent_text_transition = " ".join(sess.transcript_history[-WINDOW_SIZE_TRANSITION:])
    anchor_context = f"The interviewer just finished asking question ID: {sess.current_question_id}" if sess.current_question_id else "No specific question anchored yet."
    transition_prompt = f"""
        Using this Plan: {plan_str}
        PROGRESS ANCHOR: {anchor_context}

    TASK:
    1. Look at the PROGRESS ANCHOR. If a question ID is provided, find it in the Plan.
    2. Identify the IMMEDIATE NEXT logical question from the same theme. If that theme is finished, identify the first question of the NEXT theme.
    3. Write ONE smooth conversational transition that bridges the current context to that next question.

    Example Output:
    **Current Topic:** [Current theme title]

    **Transition:** [Conversational bridge sentence + next theme’s first question]
    
    STRICT RULES:
    - Theme title = title only (max 6 words).
    - DO NOT include question lists, evidence, quotes from the plan, arrays, brackets, or JSON.
    - DO NOT explain your reasoning.
    - DO NOT output anything outside the format.
    - Keep the no more than 25 words.
    **IMPORTANT:** Prioritize any 'New Instructions' provided in the system content regarding transition tone or style over these default instructions if they conflict.
    """
    
    sess.analysis_transition = analyze_chunk(
        sess, transition_prompt, recent_text_transition, sess.custom_prompt
    )

    # LOGGING TRANSITION
    sess.write_log("Transition Generation", recent_text_transition, sess.analysis_transition)


    # -------------------------------------------------
    # 3. Empathy
    # -------------------------------------------------
    recent_text_empathy = " ".join(sess.transcript_history[-WINDOW_SIZE_EMPATHY:])
    empathy_prompt = """
    You are an emotional support classifier. 
    Review the recent transcript and determine whether it contains any indication of difficulty, challenge, distress, constraint, personal impact etc that requires empathetic acknowledgement.

    If none are present:
    Return exactly: "Status: Normal"

    Otherwise, respond as follows:
    Provide a brief, neutral empathetic acknowledgement, use words that reflect the interviewee's worldview where possible.

    Keep it short, our goal here is to achieve empathy neutrality, acknowledge difficulty and calm interviewee down while we continue. 25 words max per question
    
    **IMPORTANT:** Prioritize any 'New Instructions' provided in the system content regarding your response style these default instructions if they conflict.
    """

    sess.analysis_empathy = analyze_chunk(
        sess, empathy_prompt, recent_text_empathy, sess.custom_prompt)
    
    # LOGGING EMPATHY
    sess.write_log("Empathy Analysis", recent_text_empathy, sess.analysis_empathy)

    
def generate_scorecard(full_text, plan):
    """Analyzes the full interview transcript against the PDF-generated plan."""
    if not full_text.strip():
        return "No transcript available to score."
        
    plan_str = json.dumps(plan, indent=2)
    prompt = f"""
    Analyze this interview based on the following Interview Plan: 
    {plan_str}
    
    Transcript: 
    {full_text}

    TASK: Assess how well the interview transcript addresses each interview theme and its stated objective.
            Your evaluation must be grounded strictly in the transcript and written in a concise, analytical style.
                
            Evaluation Instructions

            For each theme, write a short evaluative section containing the following elements:

            1. Objective Reference (Restate the theme objective)
            2. Evidence Summary
                    -Summarise the most relevant evidence from the transcript in at most 2 short bullet points.
                    -Focus on what was actually said, not interpretation.

            3. Alignment Assessment
                    -In at most 2 sentences, explain how the evidence supports or falls short of the objective.
                    -Be specific about what aspects of the objective are addressed and what are missing.


            4. Overall Summary
            Provide a brief concluding paragraph (at most 3 sentences) that:
                    -Highlights the strongest areas of alignment
                    -Identifies the most significant gaps
                    -Give recommendations or methodological advice for upcoming inyerview sessions.
    """
    try:
        res = client.chat.completions.create(
            model="gpt-5.1", 
            messages=[
                {"role": "system", "content": f"""You are a strict qualitative research coach. The interview transcripts do
            not have speaker labels and punctuation. You should still interpret the
            dialogue correctly by inferring interviewer and interviewee turns internally"""}, 
                {"role": "user", "content": prompt}
            ]
        )
        return res.choices[0].message.content
    except Exception as e: 
        return f"Scorecard Error: {e}"

# ---------------------------------------------------------
# ENDPOINTS (DEPLOYMENT: Added {sid} to routes)
# ---------------------------------------------------------
class ConfigUpdate(BaseModel):
    custom_prompt: str

class InteractionLog(BaseModel):
    action_type: str
    content: str

@app.post("/start")
def start_recording():
    sid = str(uuid.uuid4())
    new_session = InterviewSession(sid)
    active_sessions[sid] = new_session
    new_session.is_recording = True
    return {
        "session_id": sid, 
        "interview_id": new_session.interview_id, # Send this to the UI
        "message": "Started"
    }

@app.post("/upload_pdf/{sid}")
async def upload_pdf(sid: str, file: UploadFile = File(...)):
    """Reads PDF, converts to JSON Schema via LLM, saves to session."""
    sess = active_sessions.get(sid)
    if not sess: raise HTTPException(status_code=404, detail="Session not found")

    try:
        # 1. Extract Text
        pdf_reader = PdfReader(file.file)
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text()
            
        # 2. Convert to JSON Schema
        system_prompt = """
        You are a Data Architect and Qualitative Research Expert. 
        Convert the interview plan text into a hierarchical JSON structure.

        CRITICAL INSTRUCTION:
        - DO NOT summarize or shorten the questions.
        - VERBATIM REQUIREMENT: Capture every word of preambles and context.
        - HIERARCHY: Identify "Main Questions" and their associated "Probes" or "Follow-up questions."
        
        JSON Structure:
        {
          "interview_guides_collection": [
            {
              "guide_name": "string",
              "opening_statement": "string",
              "themes": [
                {
                  "id": "theme_1", 
                  "title": "string", 
                  "objective": "string",
                  "questions": [
                    { 
                      "id": "q1", 
                      "type": "main", 
                      "text": "string",
                      "probes": [
                        { "id": "q1_p1", "text": "string" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
        """
        
        response = client.chat.completions.create(
            model="gpt-5.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the interview plan:\n{text_content}"}
            ],
            response_format={ "type": "json_object" }
        )
        
        generated_json = json.loads(response.choices[0].message.content)
        sess.interview_plan = generated_json # Update Specific Session State

        # --- LOGGING THE PLAN ---
        sess.create_log_file() 
        sess.write_log("Interview Plan Loaded (JSON)", "PDF Uploaded", json.dumps(generated_json, indent=2))
        
        return {"message": "Plan converted successfully", "data": generated_json}
        
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Failed to process PDF")

@app.get("/get_active_plan/{sid}")
def get_active_plan(sid: str):
    sess = active_sessions.get(sid)
    if not sess: return {}
    return sess.interview_plan

# DEPLOYMENT: Replaces live_loop and simulation_loop
@app.post("/process_audio/{sid}")
async def process_audio(sid: str, file: UploadFile = File(...)):
    sess = active_sessions.get(sid)
    if not sess: return {"error": "No session"}
    
    audio_data = await file.read()
    
    # WRAP IN BYTESIO AND ASSIGN A NAME:
    audio_obj = io.BytesIO(audio_data)
    audio_obj.name = "audio.webm" 
    
    text = transcribe_buffer(audio_obj)
    
    if text.strip():
        sess.transcript_history.append(text)
        recent = " ".join(sess.transcript_history[-WINDOW_SIZE_FOLLOW_UP:])
        sess.latest_transcript = recent
        run_ai_analysis(sess)
        
    return {"status": "processed"}

@app.post("/stop/{sid}")
def stop_recording(sid: str):
    sess = active_sessions.get(sid)
    if not sess or not sess.is_recording: 
        return {"message": "Not running", "scorecard": "No session active."}
    
    sess.is_recording = False
    
    # 1. Compile the full transcript from history
    full_text = " ".join(sess.transcript_history)
    
    # 2. Generate the scorecard using the stored interview plan
    score = generate_scorecard(full_text, sess.interview_plan)
    
    # --- LOGGING FINAL RESULTS ---
    sess.write_log("FINAL SCORECARD", "Full Session Transcript Analysis", score)
    sess.write_log("FULL TRANSCRIPT", "Raw Session Data", full_text)

    return {
        "message": "Stopped", 
        "scorecard": score,
        "full_transcript": full_text
    }

@app.get("/status/{sid}")
def get_status(sid: str):
    sess = active_sessions.get(sid)
    if not sess: return {"error": "Session not found"}
    return {
        "is_recording": sess.is_recording,
        "transcript_list": sess.transcript_history[-WINDOW_SIZE_FOLLOW_UP:],
        "followup": sess.analysis_followup,
        "transition": sess.analysis_transition,
        "empathy": sess.analysis_empathy
    }

@app.post("/update_progress/{sid}")
async def update_progress(sid: str, data: dict):
    sess = active_sessions.get(sid)
    if sess:
        sess.current_question_id = data.get("question_id")
        print(f"📍 Progress Anchor Updated: {sess.current_question_id}")
        run_ai_analysis(sess)
    return {"status": "success", "current_anchor": sess.current_question_id}

@app.post("/update_config/{sid}")
async def update_config(sid: str, config: ConfigUpdate):
    sess = active_sessions.get(sid)
    if sess:
        sess.custom_prompt = config.custom_prompt
        print(f"✅ Config Updated: {sess.custom_prompt}")
    return {"message": "Configuration updated successfully"}

@app.post("/log_interaction/{sid}")
async def log_interaction(sid: str, data: InteractionLog):
    sess = active_sessions.get(sid)
    if not sess: 
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Custom format requested: "The users clicked [action] the suggestion were: [content]"
    log_entry = f"The user clicked '{data.action_type}'. The suggestion shown was: {data.content}"
    sess.write_log("USER_ACTION", "Manual Button Click", log_entry)
    return {"status": "logged"}

@app.get("/download_log/{sid}")
async def download_log(sid: str):
    sess = active_sessions.get(sid)
    if not sess or not sess.log_filename:
        raise HTTPException(status_code=404, detail="Log file not found")
    
    try:
        with open(sess.log_filename, "r", encoding="utf-8") as f:
            content = f.read()
        return {"filename": sess.log_filename, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # uvicorn.run(app, host="0.0.0.0", port=8000)

    # Grab the port from Render's environment, fallback to 8000 locally
    port = int(os.environ.get("PORT", 8000)) 
    uvicorn.run(app, host="0.0.0.0", port=port)
