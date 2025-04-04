import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Groq from "groq-sdk";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.lang = "en-US";
recognition.isRunning = false; // Add a flag to track recognition state

const groq = new Groq({
  apiKey: process.env.REACT_APP_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function ElsaUI() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");

  const getGroqResponse = useCallback(async (userInput) => {
    try {
      setIsSpeaking(true);

      const { choices } = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are ELSA, a helpful therapist." },
          { role: "user", content: userInput },
        ],
        model: "llama-3.3-70b-versatile",
      });

      const aiText = choices[0]?.message?.content || "I'm not sure how to respond.";
      speak(aiText);
    } catch (error) {
      console.error("Error fetching Groq response:", error);
      
    }
  }, []);

  useEffect(() => {
    recognition.onresult = async (event) => {
      const userInput = event.results[0][0].transcript;
      setTranscript(userInput);
      getGroqResponse(userInput);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    // Add an `onend` handler to reset the `isRunning` flag
    recognition.onend = () => {
      console.log("Speech recognition stopped");
      recognition.isRunning = false; // Reset the flag when recognition stops
    };
  }, [getGroqResponse]);

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);

    // Wait for voices to load
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (voice) => voice.name.includes("Google UK English Female") || voice.name.includes("Microsoft Zira")
      );

      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      // Add emotions and modulations based on the content
      if (text.includes("happy") || text.includes("great")) {
        utterance.pitch = 1.5; // Higher pitch for excitement
        utterance.rate = 1.2;  // Slightly faster rate
      } else if (text.includes("sad") || text.includes("sorry")) {
        utterance.pitch = 0.8; // Lower pitch for sadness
        utterance.rate = 0.9;  // Slower rate
      } else if (text.includes("angry") || text.includes("frustrated")) {
        utterance.pitch = 1.0; // Neutral pitch
        utterance.rate = 1.3;  // Faster rate for urgency
        utterance.volume = 1.0; // Louder volume
      } else {
        utterance.pitch = 1.0; // Default pitch
        utterance.rate = 1.0;  // Default rate
      }

      utterance.onend = () => setIsSpeaking(false);
      speechSynthesis.speak(utterance);
    };

    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.addEventListener("voiceschanged", loadVoices);
    } else {
      loadVoices();
    }
  };

  const startListening = () => {
    if (isSpeaking || recognition.isRunning) {
      console.warn("Speech recognition is already running.");
      return;
    }

    recognition.isRunning = true; // Mark recognition as running
    setTranscript("");
    try {
      recognition.start();
      console.log("Speech recognition started");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      recognition.isRunning = false; // Reset the flag if an error occurs
    }
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
    </div>
  );
}