const API_BASE_URL = "http://localhost:8000";

async function handleResponse(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const errorData = await response.json();
      if (typeof errorData?.detail === "string") message = errorData.detail;
      else if (errorData?.detail) message = JSON.stringify(errorData.detail);
    } catch {
      // Keep fallback message if response is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  async extractOCR(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/ocr/extract`, { method: "POST", body: formData });
    return handleResponse(response, "Document processing failed");
  },

  async verifyFace(document: File, selfie: File) {
    const formData = new FormData();
    formData.append("document", document);
    formData.append("selfie", selfie);
    const response = await fetch(`${API_BASE_URL}/face/verify`, { method: "POST", body: formData });
    return handleResponse(response, "Face verification failed");
  },

  async analyzeTampering(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/tampering/analyze`, { method: "POST", body: formData });
    return handleResponse(response, "Tampering analysis failed");
  },

  async verifyCase(documents: unknown[]) {
    const response = await fetch(`${API_BASE_URL}/verification/case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(documents),
    });
    return handleResponse(response, "Case verification failed");
  },

  async getCase(caseId: string) {
    const response = await fetch(`${API_BASE_URL}/verification/case/${encodeURIComponent(caseId)}`, { method: "GET" });
    return handleResponse(response, "Failed to load verification case");
  },

  async submitDecision(caseId: string, decision: string, officer?: string) {
    const response = await fetch(`${API_BASE_URL}/verification/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: caseId, decision, officer: officer ?? "Verification Officer" }),
    });
    return handleResponse(response, "Failed to submit officer decision");
  },

  async getHistory() {
    const response = await fetch(`${API_BASE_URL}/verification/history`, { method: "GET" });
    return handleResponse(response, "Failed to load verification history");
  },

  async healthCheck() {
    const response = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
    return handleResponse(response, "Backend health check failed");
  },
};

export { API_BASE_URL };
