import React from "react";

/**
 * A replaceable SVG Mascot system.
 * States: "idle", "thinking", "happy", "sad", "angry", "confused", "speaking", "listening"
 *
 * This is a placeholder structure. The actual artwork can be replaced later.
 */
export default function Mascot({ state = "idle", className = "w-24 h-24" }) {
  // Simple circle-based mascot that changes color/face based on state
  const colors = {
    idle: "fill-blue-200",
    thinking: "fill-purple-200",
    happy: "fill-green-200",
    sad: "fill-blue-300",
    angry: "fill-red-200",
    confused: "fill-yellow-200",
    speaking: "fill-indigo-200",
    listening: "fill-teal-200",
  };

  const color = colors[state] || colors.idle;

  return (
    <div className={`relative ${className} flex items-center justify-center`}>
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-all duration-300"
      >
        {/* Base Body */}
        <circle cx="50" cy="50" r="45" className={`${color} transition-colors duration-300`} />

        {/* Eyes */}
        <g className="fill-gray-800">
          {state === "happy" ? (
            <>
              <path d="M 30 40 Q 35 30 40 40" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M 60 40 Q 65 30 70 40" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
            </>
          ) : state === "sad" ? (
            <>
              <path d="M 30 40 Q 35 35 40 45" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M 60 45 Q 65 35 70 40" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </>
          ) : state === "angry" ? (
            <>
              <path d="M 30 35 L 40 42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M 70 35 L 60 42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <circle cx="35" cy="45" r="3" />
              <circle cx="65" cy="45" r="3" />
            </>
          ) : state === "confused" ? (
            <>
              <circle cx="35" cy="40" r="4" />
              <circle cx="65" cy="40" r="2" />
            </>
          ) : (
            <>
              <circle cx="35" cy="40" r="4" className={state === "listening" ? "animate-pulse" : ""} />
              <circle cx="65" cy="40" r="4" className={state === "listening" ? "animate-pulse" : ""} />
            </>
          )}
        </g>

        {/* Mouth */}
        <g stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" className="text-gray-800">
          {state === "idle" && <path d="M 40 65 Q 50 70 60 65" />}
          {state === "happy" && <path d="M 35 60 Q 50 80 65 60" />}
          {state === "sad" && <path d="M 40 70 Q 50 60 60 70" />}
          {state === "angry" && <path d="M 40 65 L 60 65" />}
          {state === "confused" && <path d="M 45 65 Q 50 60 55 68" />}
          {state === "speaking" && (
            <ellipse cx="50" cy="65" rx="8" ry="4" className="fill-gray-800 animate-pulse" />
          )}
          {state === "listening" && <path d="M 45 65 Q 50 66 55 65" />}
          {state === "thinking" && <circle cx="50" cy="65" r="2" className="fill-gray-800" />}
        </g>
        
        {/* Thinking bubbles */}
        {state === "thinking" && (
          <g className="fill-gray-400 animate-pulse">
            <circle cx="75" cy="25" r="4" />
            <circle cx="85" cy="15" r="6" />
            <circle cx="95" cy="5" r="8" />
          </g>
        )}
      </svg>
    </div>
  );
}
