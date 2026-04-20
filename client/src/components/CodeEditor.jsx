import React, { useRef, useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import LanguageSelector from "./LanguageSelector";
import { CODE_SNIPPETS } from "../constants";
import Output from "./Output";

const CodeEditor = ({ socketRef, roomId, socketReady }) => {
  const editorRef = useRef(null);
  const [value, setValue] = useState(CODE_SNIPPETS["javascript"]);
  const [language, setLanguage] = useState("javascript");
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleCodeChange = ({ code }) => {
      isRemoteUpdate.current = true;
      setValue(code);
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        editorRef.current.setValue(code);
        if (position) editorRef.current.setPosition(position);
      }
    };

    const handleSyncData = ({ code, language: syncedLanguage }) => {
      if (code) {
        isRemoteUpdate.current = true;
        setValue(code);
        if (editorRef.current) editorRef.current.setValue(code);
      }
      if (syncedLanguage) setLanguage(syncedLanguage);
    };

    const handleLanguageChange = ({ language: newLanguage }) => {
      setLanguage(newLanguage);
      setValue(CODE_SNIPPETS[newLanguage]);
    };

    socket.on("code-change", handleCodeChange);
    socket.on("language-change", handleLanguageChange);
    socket.on("sync-code", handleSyncData);

    return () => {
      socket.off("code-change", handleCodeChange);
      socket.off("language-change", handleLanguageChange);
      socket.off("sync-code", handleSyncData);
    };
  }, [socketReady]);

  const onMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const onLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setValue(CODE_SNIPPETS[newLanguage]);
    if (socketRef.current) {
      socketRef.current.emit("language-change", { roomId, language: newLanguage });
    }
  };

  const onCodeChange = (newValue) => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    setValue(newValue);
    if (socketRef.current && roomId) {
      socketRef.current.emit("code-change", { roomId, code: newValue });
    }
  };

  return (
    <div className="flex md:flex-row flex-col bg-darkBg">
      <div className="text-light md:w-1/2 w-full">
        <LanguageSelector language={language} onLanguageChange={onLanguageChange} />
        <Editor
          height="75vh"
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
