# AI Interview Assistant (Qualitative Research)

This tool is a specialized AI co-pilot designed to support qualitative researchers and students during live interviews. It assists interviewers in real-time by suggesting follow-up questions and maintaining the flow of the conversation without replacing the human element.

## Live Demo
Try the tool here: https://ai-interview-assistant-wheat.vercel.app/

## Key Features
* **Live Assistance:** Generates real-time suggestions to "deepen inquiry," provide "transition prompts," or offer "empathy cues" based on the live conversation.
* **Interview Plan Integration:** Allows users to upload a structured interview guide that the AI references to ensure all research objectives are met.
* **Human-in-the-Loop:** Includes a manual overwrite for AI instructions, ensuring the researcher maintains full control over the session.
* **Post-Interview Analysis:** Provides immediate feedback and summaries to help researchers refine their technique.

## Tech Stack
* **Frontend:** React (JavaScript)
* **Backend:** Python
* **LLM:** OpenAI API

## Overview
The system captures live dialogue and processes it through a Python backend. By analyzing the current transcript against the researcher’s uploaded plan, the OpenAI-powered engine identifies critical moments where a follow-up or a transition is needed, displaying these as actionable cues on the React dashboard.
