import React, { useRef, useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import LanguageSelector from "./LanguageSelector";
import { CODE_SNIPPETS } from "../constants";
import Output from "./Output";

const CodeEditor = ({ socketRef, roomId }) => {
  const editorRef = useRef(null);
  const [value, setValue] = useState(CODE_SNIPPETS["javascript"]);
  const [language, setLanguage] = useState("javascript");
  const [isDeviceMedium, setIsDeviceMedium] = useState(false);

  // Prevent rebroadcast of remote code
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!socketRef.current) return;
  
    const handleCodeChange = ({ code }) => {
      console.log("📥 Received code from server:", code?.substring(0, 50));
      
      // Update the value state
      isRemoteUpdate.current = true;
      setValue(code);
      
      // Also update editor directly if it exists
      if (editorRef.current) {
        const currentCode = editorRef.current.getValue();
        if (currentCode !== code) {
          const position = editorRef.current.getPosition();
          editorRef.current.setValue(code);
          if (position) {
            editorRef.current.setPosition(position);
          }
        }
      }
    };
  
    const handleSyncData = ({ code, language: syncedLanguage }) => {
      console.log("🔄 Syncing initial data");
      if (code) {
        isRemoteUpdate.current = true;
        setValue(code);
        if (editorRef.current) {
          editorRef.current.setValue(code);
        }
      }
      if (syncedLanguage) {
        setLanguage(syncedLanguage);
      }
    };
  
    const handleLanguageChange = ({ language: newLanguage }) => {
      console.log("📥 Received language change:", newLanguage);
      setLanguage(newLanguage);
      setValue(CODE_SNIPPETS[newLanguage]);
    };
  
    socketRef.current.on("code-change", handleCodeChange);
    socketRef.current.on("language-change", handleLanguageChange);
    socketRef.current.on("sync-code", handleSyncData);
  
    return () => {
      if (socketRef.current) {
        socketRef.current.off("code-change", handleCodeChange);
        socketRef.current.off("language-change", handleLanguageChange);
        socketRef.current.off("sync-code", handleSyncData);
      }
    };
  }, [socketRef]); // Added socketRef to dependencies
  
  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const onLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setValue(CODE_SNIPPETS[newLanguage]);
    
    console.log("📤 Emitting language change:", newLanguage);
    if (socketRef.current) {
      socketRef.current.emit("language-change", {
        roomId,
        language: newLanguage,
      });
    }
  };

  const onCodeChange = (newValue) => {
    // Skip if this change came from remote
    if (isRemoteUpdate.current) {
      console.log("⏭️  Skipping remote update rebroadcast");
      isRemoteUpdate.current = false;
      return;
    }

    console.log("📤 Emitting code change:", newValue?.substring(0, 50));
    setValue(newValue);
    
    if (socketRef.current && roomId) {
      socketRef.current.emit("code-change", {
        roomId,
        code: newValue,
      });
    }
  };

  return (
    <div className="flex md:flex-row flex-col bg-darkBg">
      <div className="text-light md:w-1/2 w-full">
        <LanguageSelector
          language={language}
          onLanguageChange={onLanguageChange}
        />
        <Editor
          height={isDeviceMedium ? "60vh" : "75vh"}
          theme="vs-dark"
          language={language}
          value={value}
          onChange={onCodeChange}
          onMount={onMount}
        />
      </div>
      <div className="md:w-1/2 w-full text-light">
        <Output editorRef={editorRef} language={language} />
      </div>
    </div>
  );
};

export default CodeEditor;