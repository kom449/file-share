"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  }, []);

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
      if (usePassword) formData.append("password", password);

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
          setUploadProgress(null);
        }
      } catch (error) {
        setUploadProgress(null);
      }
    },
  });

  const handleDownload = async (fileId: string) => {
    try {
      const checkResponse = await axios.get(`http://localhost:5000/check-password/${fileId}`);
  
      if (checkResponse.data.requiresPassword) {
        const userPassword = prompt("Enter the password for this file:");
        if (!userPassword) return;
  
        try {
          const downloadResponse = await axios.post(
            `http://localhost:5000/download/${fileId}`,
            { password: userPassword },
            { responseType: "blob" }
          );
  
          const disposition = downloadResponse.headers["content-disposition"];
          let filename = "downloaded_file";
          if (disposition && disposition.includes("filename")) {
            const filenameRegex = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/;
            const matches = filenameRegex.exec(disposition);
            if (matches && matches[1]) {
              filename = decodeURIComponent(matches[1]);
            }
          }
  
          const blob = new Blob([downloadResponse.data]);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (error) {
          alert("Incorrect password or file not found.");
        }
      } else {
        window.location.href = `http://localhost:5000/download/${fileId}`;
      }
    } catch (error) {
      alert("File not found.");
    }
  };  

  return (
    <main className="flex flex-col items-center min-h-screen p-4">
      <button onClick={toggleDarkMode} className="absolute top-5 right-5 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition">
        {darkMode ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-gray-800 dark:text-white" />}
      </button>

      <h1 className="text-4xl font-bold">Secure File Sharing</h1>

      <div {...getRootProps()} className="mt-6 p-10 border-2 border-dashed rounded-lg cursor-pointer">
        <input {...getInputProps()} />
        <p>Drag & drop a file or click to upload</p>
      </div>

      <div className="mt-4 flex items-center space-x-2">
        <input type="checkbox" checked={usePassword} onChange={() => setUsePassword(!usePassword)} />
        <label>Enable password protection</label>
      </div>

      {usePassword && <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-2 mt-2" />}

      {uploadedFile && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 shadow rounded">
          <p>File link:</p>
          <input className="border p-2 w-full dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={uploadedFile} readOnly onClick={(e) => e.currentTarget.select()} />
          <button onClick={() => handleDownload(uploadedFile.split("/").pop() || "")} className="mt-2 p-2 bg-green-500 text-white">
            Download
          </button>
        </div>
      )}
    </main>
  );
}
