import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VerificationDocument, VerificationResult } from "../types/verification";
import { api } from "../services/api";

type DocumentStatus =
  | "WAITING"
  | "PROCESSING"
  | "COMPLETED"
  | "WARNING"
  | "FAILED";

type CaseStatus = "CREATED" | "PROCESSING" | "COMPLETED";

type CaseResult = {
  valid?: boolean;
  score?: number;
  level?: string;
  identity_score?: number | null;
  document_risk_score?: number;
  passed_checks?: number;
  total_checks?: number;
  checks?: Record<string, string>;
  issues?: string[];
  document_risks?: Array<{
    filename?: string;
    score?: number;
    level?: string;
    reasons?: string[];
  }>;
  recommended_action?: string;
};

type HistoryItem = {
  caseId: string;
  passenger: string;
  documents: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selfieInputRef = useRef<HTMLInputElement>(null);

  const [selfie, setSelfie] = useState<File | null>(null);

  const [faceResult, setFaceResult] = useState<{
    match: boolean;
    similarity: number;
    confidence?: number;
    risk_level?: string;
  } | null>(null);

  const [isFaceVerifying, setIsFaceVerifying] = useState(false);

  const [faceError, setFaceError] = useState("");

  const [documents, setDocuments] = useState<VerificationDocument[]>([]);

  const [caseId, setCaseId] = useState(
    `CASE-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
  );

  const [caseCreated, setCaseCreated] = useState(false);

  const [caseStatus, setCaseStatus] = useState<CaseStatus>("CREATED");

  const [caseResult, setCaseResult] = useState<CaseResult | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [showHistory, setShowHistory] = useState(false);

  const [historyItems] = useState<HistoryItem[]>([
    {
      caseId: "CASE-1001",
      passenger: "Aditi Sharma",
      documents: 3,
      risk: "LOW",
      status: "Completed",
    },
    {
      caseId: "CASE-1002",
      passenger: "Rahul Mehta",
      documents: 2,
      risk: "MEDIUM",
      status: "Manual Review",
    },
    {
      caseId: "CASE-1003",
      passenger: "Arjun Patel",
      documents: 3,
      risk: "HIGH",
      status: "Escalated",
    },
  ]);

  /*
   * ---------------------------------------------------------
   * START NEW CASE
   * ---------------------------------------------------------
   */

  const startNewCase = () => {
    if (isProcessing) {
      return;
    }

    const newCaseId = `CASE-${new Date().getFullYear()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    setCaseId(newCaseId);
    setDocuments([]);
    setCaseCreated(false);
    setCaseStatus("CREATED");
    setCaseResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */

  const handleLogout = () => {
    if (isProcessing) {
      return;
    }

    navigate("/login");
  };

  /*
   * ---------------------------------------------------------
   * DOCUMENT TYPE
   * ---------------------------------------------------------
   */

  const getDocumentType = (file: File) => {
    const name = file.name.toLowerCase();

    if (name.includes("passport")) return "Passport";
    if (name.includes("visa")) return "Visa";
    if (name.includes("national")) return "National ID";
    if (name.includes("residence")) return "Residence Permit";
    if (name.includes("travel")) return "Travel Permit";

    return "Unknown";
  };

  /*
   * ---------------------------------------------------------
   * DOCUMENT UPLOAD
   * ---------------------------------------------------------
   */

  const handleDocumentUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    setCaseCreated(true);
    setCaseStatus("CREATED");
    setCaseResult(null);

    const newDocuments: VerificationDocument[] = selectedFiles.map(
      (file) => ({
        id: crypto.randomUUID(),
        file,
        documentType: getDocumentType(file),
        status: "WAITING",
        progress: 0,
      })
    );

    setDocuments((currentDocuments) => [
      ...currentDocuments,
      ...newDocuments,
    ]);

    event.target.value = "";
  };

  /*
   * ---------------------------------------------------------
   * REMOVE DOCUMENT
   * ---------------------------------------------------------
   */

  const removeDocument = (index: number) => {
    if (isProcessing) {
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.filter(
        (_, documentIndex) => documentIndex !== index
      )
    );
  };

  /*
   * ---------------------------------------------------------
   * START PROCESSING
   * ---------------------------------------------------------
   */

  const handleFaceVerification = async () => {
    setFaceError("");

    if (!selfie) {
      setFaceError("Please select a passenger selfie first.");
      return;
    }

    if (documents.length === 0) {
      setFaceError(
        "Please upload at least one identity document first."
      );
      return;
    }

    const sourceDocument =
      documents.find(
        (document) =>
          document.documentType === "Passport"
      ) ?? documents[0];

    if (!sourceDocument) {
      setFaceError(
        "No document is available for face comparison."
      );
      return;
    }

    try {
      setIsFaceVerifying(true);

      const result = await api.verifyFace(
        sourceDocument.file,
        selfie
      );

      console.log("Face Verification:", result);

      setFaceResult(result);
    } catch (error) {
      console.error(
        "Face Verification Error:",
        error
      );

      setFaceError(
        "Face verification failed. Please check that the backend is running and try again."
      );
    } finally {
      setIsFaceVerifying(false);
    }
  };

  const startProcessing = async () => {
    if (documents.length === 0 || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setCaseStatus("PROCESSING");
    setCaseResult(null);

    const processedResults: VerificationResult[] = [];

    try {
      for (const document of documents) {
        setDocuments((currentDocuments) =>
          currentDocuments.map((item) =>
            item.id === document.id
              ? { ...item, status: "PROCESSING", progress: 10 }
              : item
          )
        );

        try {
          const result = (await api.extractOCR(document.file)) as VerificationResult;
          console.log("OCR Result:", result);

          if (result?.status === "completed") {
            processedResults.push(result);
          }

          setDocuments((currentDocuments) =>
            currentDocuments.map((item) =>
              item.id === document.id
                ? {
                    ...item,
                    status: result?.status === "completed" ? "COMPLETED" : "FAILED",
                    progress: 100,
                    result: result?.status === "completed" ? result : undefined,
                  }
                : item
            )
          );
        } catch (error) {
          console.error("OCR Error:", error);
          setDocuments((currentDocuments) =>
            currentDocuments.map((item) =>
              item.id === document.id
                ? { ...item, status: "FAILED", progress: 100 }
                : item
            )
          );
        }
      }

      if (processedResults.length > 0) {
        const response = await api.verifyCase(processedResults);
        console.log("Case Verification:", response);

        // Backend returns { case_id, status, documents, verification }.
        const verification = response?.verification ?? response;

        if (response?.case_id) {
          setCaseId(response.case_id);
        }

        setCaseResult(verification as CaseResult);
      }

      setCaseStatus("COMPLETED");
    } catch (error) {
      console.error("Case Processing Error:", error);
      setCaseStatus("COMPLETED");
    } finally {
      setIsProcessing(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * VIEW VERIFICATION
   * ---------------------------------------------------------
   */

  const handleViewVerification = (
    document: VerificationDocument
  ) => {
    if (!document.result) {
      return;
    }

    const completedResults = documents
      .filter((item) => item.result)
      .map((item) => item.result);

    navigate(`/verification/${document.id}`, {
      state: {
        results: completedResults,
        result: document.result,
        caseResult,
        caseId,
        faceResult,
      },
    });
  };

  /*
   * ---------------------------------------------------------
   * STATUS
   * ---------------------------------------------------------
   */

  const getStatusClass = (status: DocumentStatus) => {
    switch (status) {
      case "PROCESSING":
        return "bg-[#E8F0FE] text-[#1769E0]";

      case "COMPLETED":
        return "bg-[#EAF7EF] text-[#16803C]";

      case "WARNING":
        return "bg-[#FFF7E5] text-[#A15C00]";

      case "FAILED":
        return "bg-[#FFF1F1] text-[#B42318]";

      default:
        return "bg-[#F1F5F9] text-[#64748B]";
    }
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172033]">
      {/* =====================================================
          TOP APP BAR
      ====================================================== */}

      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:px-7 lg:px-9">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1F3A] text-white shadow-sm">
              <span className="text-xs font-bold">ASAP</span>
            </div>

            <div>
              <h1 className="text-sm font-bold tracking-tight text-[#0B1F3A] sm:text-base">
                AI Document Screening
              </h1>

              <p className="hidden text-xs text-[#64748B] sm:block">
                Officer Screening Console
              </p>
            </div>
          </div>

          {/* Officer Controls */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[#172033]">
                Officer
              </p>

              <p className="text-[11px] text-[#64748B]">
                Secure Session
              </p>
            </div>

            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-xs font-bold text-[#1769E0] sm:flex">
              OF
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isProcessing}
              className="rounded-xl border border-[#D7DEE9] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] transition hover:border-[#B9C4D3] hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 sm:px-7 lg:px-9">
        {/* Page Heading */}

        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E8F0FE] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1769E0]" />

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1769E0]">
                Screening Console
              </span>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-[#0B1F3A] sm:text-3xl">
              Screening Dashboard
            </h2>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
              Create passenger cases, upload identity documents,
              process verification, and review screening results.
            </p>
          </div>

          {/* New Case */}

          <button
            type="button"
            onClick={startNewCase}
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259BD] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            New Screening Case
          </button>
        </section>

        {/* =====================================================
            STATISTICS
        ====================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            title="Passengers Screened"
            value="128"
            icon="P"
          />

          <StatCard
            title="Documents Verified"
            value="346"
            icon="D"
          />

          <StatCard
            title="Valid Documents"
            value="312"
            icon="✓"
          />

          <StatCard
            title="Suspicious Documents"
            value="21"
            icon="!"
          />

          <StatCard
            title="High-Risk Cases"
            value="7"
            icon="R"
          />

          <StatCard
            title="Currently Processing"
            value={isProcessing ? "1" : "0"}
            icon="…"
          />
        </section>
        

        {/* =====================================================
            PRIMARY WORKSPACE
        ====================================================== */}

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          {/* =================================================
              UPLOAD / CASE
          ================================================== */}

          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.035)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1769E0]">
                  Step 01
                </p>

                <h3 className="mt-1 text-lg font-semibold text-[#172033]">
                  Passenger Documents
                </h3>

                <p className="mt-1 text-sm leading-6 text-[#64748B]">
                  Upload one or more identity or travel documents
                  for this passenger.
                </p>
              </div>

              {caseCreated && (
                <span className="rounded-full bg-[#EAF7EF] px-3 py-1.5 text-[11px] font-semibold text-[#16803C]">
                  Case Active
                </span>
              )}
            </div>

            {/* Hidden File Input */}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleDocumentUpload}
              className="hidden"
            />

            {/* Case Information */}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoTile
                label="Case ID"
                value={caseId}
              />

              <InfoTile
                label="Status"
                value={caseStatus}
              />

              <InfoTile
                label="Documents"
                value={String(documents.length)}
              />
            </div>

            {/* Upload Area */}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="group mt-5 flex min-h-[150px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#FBFCFE] px-5 text-center transition hover:border-[#1769E0] hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#1769E0] transition group-hover:scale-105">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4" />
                  <polyline points="7 9 12 4 17 9" />
                  <path d="M5 20h14" />
                </svg>
              </div>

              <p className="mt-3 text-sm font-semibold text-[#172033]">
                Upload Documents
              </p>

              <p className="mt-1 text-xs text-[#64748B]">
                JPG, JPEG, PNG or PDF
              </p>
            </button>

            {/* Supported Documents */}

            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                Supported Documents
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Passport",
                  "Visa",
                  "National ID",
                  "Residence Permit",
                  "Travel Permit",
                ].map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#475569]"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            {/* Selected Documents */}

            {documents.length > 0 && (
              <div className="mt-6 border-t border-[#E2E8F0] pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#172033]">
                    Selected Documents
                  </h4>

                  <span className="text-xs text-[#64748B]">
                    {documents.length} file
                    {documents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {documents.map((document, index) => {
                    const file = document.file;

                    return (
                      <div
                        key={document.id}
                        className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3"
                      >
                        {/* Preview */}

                        <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1F5F9]">
                          {file.type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <span className="text-[10px] font-bold text-[#64748B]">
                                PDF
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Information */}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#172033]">
                            {file.name}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#E8F0FE] px-2 py-1 text-[10px] font-semibold text-[#1769E0]">
                              {getDocumentType(file)}
                            </span>

                            <span className="text-[10px] text-[#64748B]">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>

                        {/* Status */}

                        <span
                          className={`hidden rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-block ${getStatusClass(
                            document.status
                          )}`}
                        >
                          {document.status}
                        </span>

                        {/* Remove */}

                        <button
                          type="button"
                          onClick={() => removeDocument(index)}
                          disabled={isProcessing}
                          className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#B42318] transition hover:bg-[#FFF1F1] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Process Buttons */}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 rounded-xl border border-[#D7DEE9] bg-white px-4 py-3 text-sm font-semibold text-[#334155] transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add More Documents
              </button>

              <button
                type="button"
                onClick={startProcessing}
                disabled={
                  documents.length === 0 ||
                  isProcessing
                }
                className="flex-1 rounded-xl bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259BD] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing
                  ? "Processing..."
                  : "Start Processing"}
              </button>
            </div>
          </div>

          
          {/* Face Verification */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#172033]">
                  Face Verification
                </h3>

                <p className="mt-1 text-sm text-[#64748B]">
                  Compare the face from the uploaded identity document with the
                  passenger selfie.
                </p>
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1769E0]">
                Document + Selfie
              </div>
            </div>

            {/* Reference Document */}
            <div className="mt-6 rounded-lg border border-[#D9E2EF] bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-[#1769E0]">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M13 9h4M13 13h4M7 16h10" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                    Reference Document
                  </p>

                  {documents.length > 0 ? (
                    <>
                      <p className="mt-1 truncate text-sm font-semibold text-[#172033]">
                        {
                          (
                            documents.find(
                              (document) =>
                                document.documentType === "Passport"
                            ) ?? documents[0]
                          ).file.name
                        }
                      </p>

                      <p className="mt-0.5 text-xs text-green-600">
                        ✓ Automatically selected from uploaded documents
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-red-500">
                      Upload an identity document first
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Selfie Upload */}
            <div className="mt-4 rounded-lg border border-[#D9E2EF] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#475569]">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="8" r="3" />
                    <path d="M5 21a7 7 0 0 1 14 0" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                    Passenger Selfie
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#172033]">
                    {selfie ? selfie.name : "No selfie selected"}
                  </p>
                </div>
              </div>

              <input
                ref={selfieInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    setSelfie(file);
                    setFaceResult(null);
                    setFaceError("");
                  }

                  event.target.value = "";
                }}
              />

              <button
                type="button"
                onClick={() => selfieInputRef.current?.click()}
                className="mt-4 w-full rounded-lg border border-[#1769E0] px-4 py-3 text-sm font-semibold text-[#1769E0] transition hover:bg-blue-50"
              >
                {selfie ? "Change Passenger Selfie" : "Select Passenger Selfie"}
              </button>
            </div>

            {/* Verification Button */}
            <button
              type="button"
              disabled={!selfie || documents.length === 0 || isFaceVerifying}
              onClick={async () => {
                setFaceError("");

                if (!selfie) {
                  setFaceError("Please select a passenger selfie first.");
                  return;
                }

                if (documents.length === 0) {
                  setFaceError(
                    "Please upload an identity document first."
                  );
                  return;
                }

                const sourceDocument =
                  documents.find(
                    (document) =>
                      document.documentType === "Passport"
                  ) ?? documents[0];

                if (!sourceDocument) {
                  setFaceError(
                    "No document is available for face comparison."
                  );
                  return;
                }

                try {
                  setIsFaceVerifying(true);

                  // Backend receives:
                  // document = already uploaded identity document
                  // selfie   = passenger selfie
                  const result = await api.verifyFace(
                    sourceDocument.file,
                    selfie
                  );

                  console.log("Face Verification:", result);

                  setFaceResult(result);
                } catch (error) {
                  console.error(
                    "Face Verification Error:",
                    error
                  );

                  setFaceError(
                    "Face verification failed. Please check that the backend is running and try again."
                  );
                } finally {
                  setIsFaceVerifying(false);
                }
              }}
              className="mt-4 w-full rounded-lg bg-[#1769E0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1258BD] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFaceVerifying
                ? "Verifying Face..."
                : "Verify Face"}
            </button>

            {/* Error */}
            {faceError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {faceError}
              </div>
            )}

            {/* Result */}
            {faceResult && (
              <div className="mt-5 rounded-lg border border-[#D9E2EF] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#172033]">
                    Face Verification Result
                  </h4>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      faceResult.match
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {faceResult.match
                      ? "MATCH"
                      : "NO MATCH"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[#64748B]">
                      Similarity
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#172033]">
                      {typeof faceResult.similarity === "number"
                        ? `${(faceResult.similarity * 100).toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#64748B]">
                      Confidence
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#172033]">
                      {typeof faceResult.confidence === "number"
                        ? `${faceResult.confidence.toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-[#64748B]">
                    Risk Level
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#172033]">
                    {faceResult.risk_level ?? "UNKNOWN"}
                  </p>
                </div>
              </div>
            )}
          </div>

        {/* =====================================================
            PROCESSING QUEUE
        ====================================================== */}

        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.035)] sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1769E0]">
                Processing
              </p>

              <h3 className="mt-1 text-lg font-semibold text-[#172033]">
                Processing Queue
              </h3>

              <p className="mt-1 text-sm text-[#64748B]">
                Documents currently being analyzed.
              </p>
            </div>

            <span className="rounded-full bg-[#F1F5F9] px-3 py-1.5 text-xs font-semibold text-[#64748B]">
              {documents.length} document
              {documents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#FBFCFE] p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#64748B]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>

                <p className="mt-3 text-sm font-semibold text-[#172033]">
                  No active processing
                </p>

                <p className="mt-1 text-xs text-[#64748B]">
                  Upload documents to begin screening.
                </p>
              </div>
            ) : (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-[#E2E8F0] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#172033]">
                        {document.file.name}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusClass(
                            document.status
                          )}`}
                        >
                          {document.status}
                        </span>

                        <span className="text-xs text-[#64748B]">
                          {getDocumentType(document.file)}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-[#1769E0]">
                      {document.progress}%
                    </span>
                  </div>

                  {/* Progress */}

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div
                      className="h-full rounded-full bg-[#1769E0] transition-all duration-300"
                      style={{
                        width: `${document.progress}%`,
                      }}
                    />
                  </div>

                  {/* Verification Button */}

                  {document.status === "COMPLETED" &&
                    document.result && (
                      <button
                        type="button"
                        onClick={() =>
                          handleViewVerification(document)
                        }
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1769E0] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1259BD]"
                      >
                        View Verification

                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line
                            x1="5"
                            y1="12"
                            x2="19"
                            y2="12"
                          />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* =====================================================
            CASE RESULT
        ====================================================== */}

        {caseResult && (
          <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.035)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1769E0]">
                  Case Result
                </p>

                <h3 className="mt-1 text-lg font-semibold text-[#172033]">
                  Unified Verification
                </h3>

                <p className="mt-1 text-sm text-[#64748B]">
                  Case {caseId}
                </p>
              </div>

              <span
                className={`rounded-full px-4 py-2 text-xs font-bold ${
                  caseResult.valid
                    ? "bg-[#EAF7EF] text-[#16803C]"
                    : "bg-[#FFF1F1] text-[#B42318]"
                }`}
              >
                {caseResult.valid
                  ? "VERIFICATION PASSED"
                  : "REVIEW REQUIRED"}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <ResultMetric
                label="Score"
                value={`${caseResult.score ?? 0}`}
              />

              <ResultMetric
                label="Passed Checks"
                value={`${caseResult.passed_checks ?? 0}/${caseResult.total_checks ?? 0}`}
              />

              <ResultMetric
                label="Issues"
                value={`${caseResult.issues?.length ?? 0}`}
              />
            </div>

            {(caseResult.issues?.length ?? 0) > 0 && (
              <div className="mt-5 rounded-2xl border border-[#F2C4C4] bg-[#FFF8F8] p-4">
                <p className="text-xs font-semibold text-[#B42318]">
                  Issues detected
                </p>

                <ul className="mt-2 space-y-1">
                  {(caseResult.issues ?? []).map((issue, index) => (
                    <li
                      key={`${issue}-${index}`}
                      className="text-xs leading-5 text-[#7A271A]"
                    >
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* =====================================================
            PASSENGER HISTORY
        ====================================================== */}

        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.035)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1769E0]">
                Records
              </p>

              <h3 className="mt-1 text-lg font-semibold text-[#172033]">
                Passenger History
              </h3>

              <p className="mt-1 text-sm text-[#64748B]">
                Recently completed verification cases.
              </p>
            </div>

            {/* THIS BUTTON IS NOW FUNCTIONAL */}

            <button
              type="button"
              onClick={() =>
                setShowHistory((value) => !value)
              }
              className="rounded-xl border border-[#D7DEE9] bg-white px-4 py-2.5 text-sm font-semibold text-[#1769E0] transition hover:bg-[#E8F0FE]"
            >
              {showHistory
                ? "Hide History"
                : "View History"}
            </button>
          </div>

          {/* History appears after clicking View History */}

          {showHistory && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-[#E2E8F0]">
              {/* Desktop */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F7F9FC]">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                        Case ID
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                        Passenger
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                        Documents
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                        Risk
                      </th>

                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {historyItems.map((item) => (
                      <HistoryRow
                        key={item.caseId}
                        {...item}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}

              <div className="divide-y divide-[#E2E8F0] md:hidden">
                {historyItems.map((item) => (
                  <HistoryCard
                    key={item.caseId}
                    {...item}
                  />
                ))}
              </div>
            </div>
          )}
          </section>
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.025)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-5 text-[#64748B]">
          {title}
        </p>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-xs font-bold text-[#1769E0]">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#0B1F3A]">
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   INFO TILE
============================================================ */

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F7F9FC] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-[#172033]">
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   PIPELINE ITEM
============================================================ */

function PipelineItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  const ready = status === "Ready";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            ready
              ? "bg-[#16803C]"
              : "bg-[#CBD5E1]"
          }`}
        />

        <span className="text-xs text-[#475569]">
          {label}
        </span>
      </div>

      <span
        className={`text-[10px] font-semibold ${
          ready
            ? "text-[#16803C]"
            : "text-[#94A3B8]"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

/* ============================================================
   RESULT METRIC
============================================================ */

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F7F9FC] p-4">
      <p className="text-xs text-[#64748B]">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-[#0B1F3A]">
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   HISTORY ROW
============================================================ */

function HistoryRow({
  caseId,
  passenger,
  documents,
  risk,
  status,
}: HistoryItem) {
  const riskClass =
    risk === "LOW"
      ? "bg-[#EAF7EF] text-[#16803C]"
      : risk === "MEDIUM"
      ? "bg-[#FFF7E5] text-[#A15C00]"
      : "bg-[#FFF1F1] text-[#B42318]";

  return (
    <tr className="border-t border-[#E2E8F0]">
      <td className="px-4 py-4 font-semibold text-[#172033]">
        {caseId}
      </td>

      <td className="px-4 py-4 text-[#475569]">
        {passenger}
      </td>

      <td className="px-4 py-4 text-[#475569]">
        {documents}
      </td>

      <td className="px-4 py-4">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${riskClass}`}
        >
          {risk}
        </span>
      </td>

      <td className="px-4 py-4 text-[#64748B]">
        {status}
      </td>
    </tr>
  );
}

/* ============================================================
   HISTORY CARD — MOBILE
============================================================ */

function HistoryCard({
  caseId,
  passenger,
  documents,
  risk,
  status,
}: HistoryItem) {
  const riskClass =
    risk === "LOW"
      ? "bg-[#EAF7EF] text-[#16803C]"
      : risk === "MEDIUM"
      ? "bg-[#FFF7E5] text-[#A15C00]"
      : "bg-[#FFF1F1] text-[#B42318]";

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#172033]">
            {passenger}
          </p>

          <p className="mt-1 text-xs text-[#64748B]">
            {caseId}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${riskClass}`}
        >
          {risk}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">
            Documents
          </p>

          <p className="mt-1 text-sm font-semibold text-[#334155]">
            {documents}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">
            Status
          </p>

          <p className="mt-1 text-sm font-semibold text-[#334155]">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;