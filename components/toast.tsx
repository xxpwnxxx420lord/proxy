"use client"

import type * as React from "react"

interface ToastProps {
  message: string
  type: "success" | "error"
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const backgroundColor = type === "success" ? "bg-green-500" : "bg-red-500"
  const textColor = "text-white"
  const animationClasses = "animate-fade-in"

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-md shadow-lg overflow-hidden ${backgroundColor} ${textColor} ${animationClasses}`}
    >
      <div className="p-4 flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 focus:outline-none">
          <svg className="h-5 w-5 fill-current" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
