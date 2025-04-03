import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios"; // Import axios

// Voice Recognition & Synthesis Setup
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.lang = "en-US";

export default function ElsaUI() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  
  const API_KEY = process.env.REACT_APP_OPENAI_API_KEY; // Secure API key access

  // Start listening when the user clicks
  const startListening = () => {
    if (isSpeaking) {
      console.warn("Speech recognition is already running.");
      return;
    }
    setTranscript("");
    setResponse("");
    recognition.start();
  };

  // Handle Speech Recognition
  useEffect(() => {
    recognition.onresult = async (event) => {
      const userInput = event.results[0][0].transcript;
      setTranscript(userInput);
      getAIResponse(userInput);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };
  }, []);

  // Fetch response from OpenAI API using axios
  const getAIResponse = async (userInput) => {
    try {
      setIsSpeaking(true);

      const { data } = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful AI therapist." },
            { role: "user", content: userInput },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      const aiText = data.choices[0]?.message?.content || "I'm not sure how to respond.";
      setResponse(aiText);
      speak(aiText);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setResponse("Oops! Something went wrong.");
    }
  };

  // Text-to-Speech Function
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <motion.div
        animate={{ scale: isSpeaking ? 1.3 : 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="w-32 h-32 bg-blue-500 rounded-full shadow-lg mb-6"
        onClick={startListening}
      ></motion.div>
      <p className="text-lg">Click the blue dot and speak</p>
      <p className="mt-4 text-sm text-gray-400">You: {transcript}</p>
      <p className="mt-2 text-sm text-green-400">Elsa: {response}</p>
    </div>
  );
}
