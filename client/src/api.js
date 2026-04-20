import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";

export const executeCode = async (sourceCode, language) => {
  const { data } = await axios.post(`${SERVER_URL}/execute`, { sourceCode, language });
  return { run: { output: data.output, stderr: data.isError } };
};
