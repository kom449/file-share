"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // ✅ Load theme from localStorage and apply the correct class
  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

  // ✅ Toggle Dark Mode and update localStorage
  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setDarkMode(!darkMode);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await axios.post("http://localhost:5000/upload", formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          },
        });

        if (response.data.fileUrl) {
          setUploadedFile(response.data.fileUrl);
          setUploadProgress(null); // Reset progress after upload
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadProgress(null); // Reset on error
      }
    },
  });

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 transition-all">
      {/* ✅ Dark Mode Toggle Button */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-5 right-5 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        {darkMode ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-gray-800 dark:text-white" />}
      </button>

      <h1 className="text-4xl font-bold">Simple File Sharing</h1>
      <p className="text-gray-600 dark:text-gray-300 mt-2">Drag, drop, and share files easily</p>

      {/* Drag & Drop Upload Area */}
      <div {...getRootProps()} className="mt-6 p-10 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
        <input {...getInputProps()} />
        <p className="text-gray-700 dark:text-gray-300">Drag & drop a file or click to upload</p>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="mt-4 w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-full">
          <div
            className="bg-blue-500 text-xs font-medium text-white text-center p-1 leading-none rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          >
            {uploadProgress}%
          </div>
        </div>
      )}

      {/* File Link Display */}
      {uploadedFile && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 shadow rounded">
          <p>Share this link:</p>
          <input
            className="border p-2 w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            value={uploadedFile}
            readOnly
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      )}
    </main>
  );
}
