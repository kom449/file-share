"use client";

import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { MoonIcon, SunIcon, ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [downloadPassword, setDownloadPassword] = useState("");

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

      setIsLoading(true);
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
        console.error("Upload error:", error);
        setUploadProgress(null);
      }
      setIsLoading(false);
    },
  });

  const copyToClipboard = () => {
    if (uploadedFile) {
      navigator.clipboard.writeText(uploadedFile);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!uploadedFile) return;
    const parts = uploadedFile.split('/');
    const fileId = parts[parts.length - 1];

    try {
      const response = await axios.get(`http://localhost:5000/check-password/${fileId}`);
      if (response.data.requiresPassword) {
        setShowPasswordPrompt(true);
      } else {
        window.location.href = uploadedFile;
      }
    } catch (err) {
      console.error("Error checking password requirement:", err);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!uploadedFile) return;
    const parts = uploadedFile.split('/');
    const fileId = parts[parts.length - 1];

    try {
      const response = await axios.post(`http://localhost:5000/download/${fileId}`, { password: downloadPassword }, {
        responseType: 'blob'
      });

      let filename = "downloaded_file";
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setShowPasswordPrompt(false);
      setDownloadPassword("");
    } catch (err) {
      console.error("Download error:", err);
      alert("Invalid password or download error");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 transition-all">
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-5 right-5 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        {darkMode ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-gray-800 dark:text-white" />}
      </button>

      {/* Header */}
      <h1 className="text-4xl font-bold">Secure File Sharing</h1>
      <p className="text-gray-600 dark:text-gray-300 mt-2">Drag, drop, and share files securely</p>

      {/* Upload Box */}
      <div {...getRootProps()} className="mt-6 p-10 border-2 border-dashed border-gray-300 dark:border-gray-500 rounded-lg cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all w-full max-w-lg text-center">
        <input {...getInputProps()} />
        <p className="text-gray-700 dark:text-gray-300">Drag & drop a file or <span className="font-bold text-blue-500">click to upload</span></p>
      </div>

      {/* Password Protection */}
      <div className="mt-4 flex items-center space-x-2">
        <input type="checkbox" checked={usePassword} onChange={() => setUsePassword(!usePassword)} className="w-4 h-4" />
        <label className="text-gray-800 dark:text-gray-200">Enable password protection</label>
      </div>
      {usePassword && (
        <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-2 mt-2 w-full max-w-lg rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white" />
      )}

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="mt-4 w-full max-w-lg bg-gray-200 dark:bg-gray-700 rounded-full">
          <div
            className="bg-blue-500 text-xs font-medium text-white text-center p-1 leading-none rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          >
            {uploadProgress}%
          </div>
        </div>
      )}

      {/* Uploaded File Link and Download Button */}
      {uploadedFile && (
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 shadow rounded flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full max-w-lg">
          <input
            className="border p-2 w-full rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            value={uploadedFile}
            readOnly
            onClick={(e) => e.currentTarget.select()}
          />
          <div className="flex space-x-2">
            <button onClick={copyToClipboard} className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
              {copied ? <CheckIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
            <button onClick={handleDownload} className="p-2 bg-green-500 text-white rounded hover:bg-green-600 transition">
              Download
            </button>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-bold mb-4">Enter Password</h2>
            <input
              type="password"
              value={downloadPassword}
              onChange={(e) => setDownloadPassword(e.target.value)}
              className="border p-2 w-full rounded dark:bg-gray-900 dark:border-gray-700 dark:text-white mb-4"
              placeholder="Password"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowPasswordPrompt(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500">
                Cancel
              </button>
              <button onClick={handlePasswordSubmit} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Animation */}
      {isLoading && (
        <div className="mt-4 animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      )}
    </main>
  );
}
