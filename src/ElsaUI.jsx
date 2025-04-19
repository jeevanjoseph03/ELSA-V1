import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Groq from "groq-sdk";
import axios from "axios"; // Make sure to install axios if not already installed

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.lang = "en-US";
recognition.isRunning = false;

const groq = new Groq({
  apiKey: process.env.REACT_APP_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

// ElevenLabs configuration
const ELEVEN_LABS_API_KEY = process.env.REACT_APP_ELEVEN_LABS_API_KEY;
// Change this to your preferred voice ID from ElevenLabs
// Some popular female voices: "21m00Tcm4TlvDq8ikWAM" (Rachel), "EXAVITQu4vr4xnSDxMaL" (Bella)
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice

export default function ElsaUI() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const chatHistoryRef = useRef(null);
  const audioRef = useRef(null);

  // Function to generate random stars
  const generateStars = (count) => {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const size = Math.random() * 2 + 1;
      stars.push({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: size,
        animationDelay: `${Math.random() * 10}s`,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }
    return stars;
  };

  // Function to generate shooting stars
  const generateShootingStars = (count) => {
    const shootingStars = [];
    for (let i = 0; i < count; i++) {
      shootingStars.push({
        id: i,
        top: `${Math.random() * 40}%`,
        left: `${Math.random() * 70}%`,
        animationDelay: `${Math.random() * 15 + 5}s`,
        animationDuration: `${Math.random() * 2 + 1}s`,
      });
    }
    return shootingStars;
  };

  const [stars] = useState(() => generateStars(150));
  const [shootingStars] = useState(() => generateShootingStars(8));

  // ElevenLabs TTS function
  const speakWithElevenLabs = async (text) => {
    try {
      setIsSpeaking(true);
      
      const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_LABS_API_KEY
        },
        data: {
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        },
        responseType: 'blob'
      });

      const audioBlob = response.data;
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      } else {
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl); // Clean up the URL object
        };
        audioRef.current = audio;
        audio.play();
      }
    } catch (error) {
      console.error("Error with ElevenLabs TTS:", error);
      setIsSpeaking(false);
      // Fallback to browser's speech synthesis in case of an error
      fallbackSpeak(text);
    }
  };

  // Fallback to browser's speech synthesis
  const fallbackSpeak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (voice) => voice.name.includes("Google UK English Female") || voice.name.includes("Microsoft Zira")
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  };

  const getGroqResponse = useCallback(async (userInput) => {
    try {
      setIsSpeaking(true);
      setIsListening(false);

      // Add user message to chat history
      const userMessage = { role: "user", content: userInput };
      setChatHistory(prev => [...prev, userMessage]);

      const { choices } = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are ELSA, a compassionate therapist who helps with emotional problems. Express empathy, validate feelings, and give supportive advice. Keep responses concise and warm." },
          ...chatHistory,
          userMessage
        ],
        model: "llama-3.3-70b-versatile",
      });

      const aiText = choices[0]?.message?.content || "I'm not sure how to respond.";
      
      // Add AI response to chat history
      setChatHistory(prev => [...prev, { role: "assistant", content: aiText }]);
      
      // Use ElevenLabs voice
      speakWithElevenLabs(aiText);
    } catch (error) {
      console.error("Error fetching Groq response:", error);
      setIsSpeaking(false);
    }
  }, [chatHistory]);

  useEffect(() => {
    recognition.onresult = async (event) => {
      const userInput = event.results[0][0].transcript;
      setTranscript(userInput);
      getGroqResponse(userInput);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition stopped");
      recognition.isRunning = false;
      setIsListening(false);
    };
    
    // Clean up audio on component unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [getGroqResponse]);

  // Scroll to bottom of chat history when it updates
  useEffect(() => {
    if (chatHistoryRef.current && showChatHistory) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory, showChatHistory]);

  const startListening = () => {
    if (isSpeaking || recognition.isRunning) {
      console.warn("Cannot start listening now.");
      return;
    }

    recognition.isRunning = true;
    setIsListening(true);
    setTranscript("");
    try {
      recognition.start();
      console.log("Speech recognition started");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      recognition.isRunning = false;
      setIsListening(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden">
      {/* Hidden audio element for ElevenLabs playback */}
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} className="hidden" />
      
      {/* Stars background */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full animate-twinkle"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: star.animationDelay,
          }}
        />
      ))}

      {/* Shooting stars */}
      {shootingStars.map((shootingStar) => (
        <div
          key={shootingStar.id}
          className="absolute bg-white animate-shooting-star"
          style={{
            top: shootingStar.top,
            left: shootingStar.left,
            width: "2px",
            height: "2px",
            boxShadow: "0 0 5px 1px white",
            animationDelay: shootingStar.animationDelay,
            animationDuration: shootingStar.animationDuration,
          }}
        />
      ))}

      {/* Content container - centered */}
      <div className="flex flex-col items-center justify-center h-full w-full">
        {/* ELSA Circle */}
        <motion.div
          animate={{
            scale: isListening ? [1, 1.2, 1] : isSpeaking ? [1, 1.3, 1, 1.3, 1] : 1,
            backgroundColor: isListening ? "#FFD700" : isSpeaking ? "#FFA500" : "#FFD700",
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          className="w-32 h-32 rounded-full shadow-lg mb-6 cursor-pointer flex items-center justify-center z-10"
          onClick={startListening}
        >
          <motion.div
            animate={{
              scale: isListening ? [1, 1.1, 1] : isSpeaking ? [1, 1.2, 0.9, 1.2, 1] : 1,
              opacity: isListening || isSpeaking ? [0.8, 1, 0.8] : 0.8,
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              repeatType: "reverse",
            }}
            className="w-24 h-24 rounded-full bg-yellow-300"
          />
        </motion.div>

        {/* Instructions */}
        <p className="text-lg text-white z-10">
          {isListening 
            ? "Listening..." 
            : isSpeaking 
              ? "ELSA is responding..." 
              : "Tap the circle to speak"}
        </p>
        
        {transcript && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-sm text-gray-400 max-w-md text-center px-4 z-10"
          >
            You: {transcript}
          </motion.p>
        )}
      </div>

      {/* Chat History Button */}
      <motion.button
        className="fixed bottom-6 right-6 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg z-20"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowChatHistory(!showChatHistory)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </motion.button>

      {/* Chat History Slide-up Panel */}
      <AnimatePresence>
        {showChatHistory && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900 bg-opacity-95 rounded-t-2xl shadow-lg z-20 max-h-96 border-t border-yellow-500"
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-yellow-400">Chat History</h3>
              <button 
                onClick={() => setShowChatHistory(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div 
              ref={chatHistoryRef}
              className="p-4 overflow-y-auto h-80"
            >
              {chatHistory.length === 0 ? (
                <p className="text-gray-500 text-center">No conversation yet. Start by speaking to ELSA.</p>
              ) : (
                chatHistory.map((message, index) => (
                  <div 
                    key={index}
                    className={`mb-4 ${message.role === "user" ? "text-right" : "text-left"}`}
                  >
                    <div 
                      className={`inline-block px-4 py-2 rounded-lg max-w-xs sm:max-w-md ${
                        message.role === "user" 
                          ? "bg-blue-600 text-white" 
                          : "bg-yellow-600 text-white"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add global CSS for animations */}
      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
        .animate-twinkle {
          animation: twinkle 3s infinite;
        }
        @keyframes shooting {
          0% { transform: translateX(0) translateY(0); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateX(200px) translateY(200px); opacity: 0; }
        }
        .animate-shooting-star {
          animation: shooting 5s linear infinite;
        }
        
        /* Force the night sky to cover the entire screen */
        html, body, #root {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: black;
        }
      `}</style>
    </div>
  );
}
//end of file
