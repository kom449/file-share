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
  const [downloadPassword, setDownloadPassword] = useState("");
  const [downloadFileId, setDownloadFileId] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);

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

  const checkFileProtection = async () => {
    setRequiresPassword(false);
    setDownloadError("");

    try {
      const response = await axios.get(`http://localhost:5000/check-password/${downloadFileId}`);

      if (response.data.requiresPassword) {
        setRequiresPassword(true);
      } else {
        handleDownload();
      }
    } catch (error) {
      setDownloadError("File not found.");
    }
  };

  const handleDownload = async () => {
    setDownloadError("");

    try {
      const response = await axios.post(`http://localhost:5000/download/${downloadFileId}`, { password: downloadPassword });

      if (response.status === 200) {
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "downloaded_file";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (error) {
      setDownloadError("Invalid password or file not found.");
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

      {uploadedFile && <p>File link: {uploadedFile}</p>}

      <h2 className="mt-6 text-xl font-semibold">Download a File</h2>
      <input type="text" placeholder="File ID" value={downloadFileId} onChange={(e) => setDownloadFileId(e.target.value)} className="border p-2 mt-2" />
      <button onClick={checkFileProtection} className="mt-2 p-2 bg-blue-500 text-white">Check File</button>

      {requiresPassword && (
        <>
          <input type="password" placeholder="Enter password" value={downloadPassword} onChange={(e) => setDownloadPassword(e.target.value)} className="border p-2 mt-2" />
          <button onClick={handleDownload} className="mt-2 p-2 bg-green-500 text-white">Download</button>
        </>
      )}

      {downloadError && <p className="text-red-500">{downloadError}</p>}
    </main>
  );
}
