import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

export default function App() {
  const [file, setFile] = useState(null);
  const [fileBytes, setFileBytes] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [translations, setTranslations] = useState(null);
  const [stats, setStats] = useState(null);
  const [stage, setStage] = useState(null); // uploading, translating, generating, done
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const uploadFile = () => {
    if (!file) return alert("Please select a file");

    setStage("uploading");
    setError(null);
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setFileBytes(base64);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setStage("translating");

          try {
            const data = JSON.parse(xhr.responseText);
            setTranslations(data.translations);
            setStats(data.stats);
            setStage("done");
            setUploadProgress(0);
            setError(null);
            setDownloadUrl(null);
          } catch (err) {
            setError({ stage: "translating", message: "Invalid response from server" });
            setStage(null);
            setUploadProgress(0);
          }
        } else {
          let message = xhr.statusText || "Unknown error";
          try {
            const errData = JSON.parse(xhr.responseText);
            if (errData.error) message = errData.error;
          } catch {}
          setError({ stage: "uploading", message });
          setStage(null);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        setError({ stage: "uploading", message: "Network error during file upload" });
        setStage(null);
        setUploadProgress(0);
      };

      xhr.open("POST", "http://localhost:8000/translate");
      xhr.send(formData);
    };
    reader.onerror = () => {
      setError({ stage: "uploading", message: "Failed to read file" });
      setStage(null);
    };
    reader.readAsDataURL(file);
  };

  const updateTranslation = (index, value) => {
    const newTranslations = [...translations];
    newTranslations[index].translated = value;
    setTranslations(newTranslations);
  };

  const generateFile = () => {
    if (!translations || !fileBytes) return;

    setStage("generating");
    setError(null);

    fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        translations,
        filename: file.name,
        file_bytes: fileBytes,
        ext: file.name.split(".").pop().toLowerCase(),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          const message = errorData?.error || res.statusText || "Unknown error during file generation";
          setError({ stage: "generating", message });
          setStage(null);
          throw new Error(message);
        }
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        setDownloadUrl(url);
        setStage("done");

        // Trigger automatic download after short delay
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = url;
          link.download = `translated_${file.name}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }, 1000);
      })
      .catch((err) => {
        if (!error) {
          setError({ stage, message: err.message });
          setStage(null);
        }
      });
  };

  const fuzzyMatches = translations ? translations.filter((t) => t.match_type === "fuzzy") : [];

  return (
    <Box
      sx={{
        maxWidth: 900,
        mx: "auto",
        mt: 5,
        p: 3,
        border: "1px solid #ddd",
        borderRadius: 2,
        boxShadow: 2,
        backgroundColor: "#fafafa",
      }}
    >
      <Typography variant="h4" mb={3} textAlign="center" fontWeight={700}>
        Translation App (English → German)
      </Typography>

      <Stack spacing={3}>
        <input
          type="file"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setTranslations(null);
            setDownloadUrl(null);
            setStats(null);
            setFileBytes(null);
            setError(null);
            setStage(null);
          }}
          accept=".docx,.xlsx,.txt"
          style={{ marginBottom: "10px" }}
          disabled={stage === "uploading" || stage === "generating" || stage === "translating"}
        />

        {!translations && (
          <Button
            variant="contained"
            color="primary"
            onClick={uploadFile}
            disabled={!file || stage === "uploading" || stage === "generating" || stage === "translating"}
            sx={{ fontWeight: "bold" }}
          >
            {stage === "uploading"
              ? `Uploading file... (${uploadProgress}%)`
              : stage === "translating"
              ? "Translating..."
              : "Upload & Translate"}
          </Button>
        )}

        {error && (
          <Box sx={{ color: "red", mt: 2 }}>
            <Typography variant="body1" fontWeight="bold">
              Error during: {error.stage}
            </Typography>
            <Typography>{error.message}</Typography>
          </Box>
        )}

        {stats && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fff", mb: 2 }}>
            <Typography variant="h6" mb={1}>
              Translation Stats
            </Typography>
            <Typography>Efficiency: {stats.efficiency ?? "-"}</Typography>
            <Typography>Memory Hits: {stats.memory_hits ?? stats.memoryHits ?? "-"}</Typography>
            <Typography>Fuzzy Hits: {stats.fuzzy_hits ?? stats.fuzzyHits ?? "-"}</Typography>
            <Typography>OpenAI Hits: {stats.openai_hits ?? stats.openAIHits ?? "-"}</Typography>
            <Typography>Time Taken: {stats.time_seconds ?? stats.timeSeconds ?? "-"}</Typography>
          </Paper>
        )}

        {translations && fuzzyMatches.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fff" }}>
            <Typography variant="h6" mb={2}>
              Review & Edit Fuzzy Matches
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Original Text</TableCell>
                  <TableCell>Translated Text (editable)</TableCell>
                  <TableCell>Similarity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fuzzyMatches.map((item, idx) => {
                  const originalIndex = translations.indexOf(item);
                  return (
                    <TableRow key={originalIndex} sx={{ backgroundColor: "#fff3e0" }}>
                      <TableCell sx={{ maxWidth: 300, whiteSpace: "normal" }}>{item.original}</TableCell>
                      <TableCell>
                        <TextField
                          multiline
                          minRows={1}
                          maxRows={4}
                          fullWidth
                          value={item.translated}
                          onChange={(e) => updateTranslation(originalIndex, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>{item.similarity ? (item.similarity * 100).toFixed(1) + "%" : "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Stack direction="row" spacing={2} mt={2}>
              <Button variant="contained" color="primary" onClick={generateFile} disabled={stage === "generating"}>
                {stage === "generating" ? "Generating file..." : "Confirm & Download"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setTranslations(null);
                  setDownloadUrl(null);
                  setStats(null);
                  setFileBytes(null);
                  setFile(null);
                  setError(null);
                  setStage(null);
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Paper>
        )}

        {translations && fuzzyMatches.length === 0 && !downloadUrl && (
          <Stack direction="row" spacing={2} mt={2}>
            <Button variant="contained" color="primary" onClick={generateFile} disabled={stage === "generating"}>
              {stage === "generating" ? "Generating file..." : "Download Translated File"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setTranslations(null);
                setDownloadUrl(null);
                setStats(null);
                setFileBytes(null);
                setFile(null);
                setError(null);
                setStage(null);
              }}
            >
              Cancel
            </Button>
          </Stack>
        )}

        {downloadUrl && (
          <Box mt={2}>
            <Typography>File ready for download.</Typography>
            <Button
              variant="outlined"
              href={downloadUrl}
              download={`translated_${file?.name}`}
              onClick={() => {
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
              }}
            >
              Click here if download does not start automatically
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

