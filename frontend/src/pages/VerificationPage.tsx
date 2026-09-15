import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type VerificationResult = {
  filename?: string;
  status?: string;
  text?: string;

  parsed_data?: {
    fullName?: string;
    dateOfBirth?: string;
    nationality?: string;
    documentNumber?: string;
    expiryDate?: string;
  };

  mrz?: string[];

  mrz_validation?: {
    valid?: boolean;
    checks?: {
      passport_number?: boolean;
      birth_date?: boolean;
      expiry_date?: boolean;
      personal_number?: boolean;
      overall?: boolean;
    };
    error?: string;
  };

  cross_verification?: {
    valid?: boolean;
    match_count?: number;
    total_checks?: number;
    score?: number;
    checks?: Record<string, boolean>;
    mrz_data?: {
      name?: string;
      documentNumber?: string;
      dateOfBirth?: string;
      expiryDate?: string;
      nationality?: string;
    };
  };

  document_validation?: {
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
  };

  tampering?: {
    status?: string;
    tampering_detected?: boolean;
    risk_level?: string;
    confidence?: number;
    explanation?: string;
    analysis?: {
      image_format?: string;
      width?: number;
      height?: number;
      noise_mean?: number;
      noise_std?: number;
      edge_ratio?: number;
    };
    outputs?: {
      original?: string;
      rgb_anomaly?: string;
      noise_residual?: string;
      tampering_heatmap?: string;
    };
  };

  face_verification?: {
    status?: string;
    match?: boolean;
    confidence?: number;
    similarity?: number;
    risk_level?: string;
    explanation?: string;
  };

  risk?: {
    score?: number;
    level?: string;
    reasons?: string[];
  };

  documentType?: string;
  documentId?: string;
};


type CaseVerificationResult = {
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

  type CaseResponse = {
    case_id?: string;
    verification?: CaseVerificationResult;
  };

function VerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as
    | {
        results?: VerificationResult[];
        result?: VerificationResult;
        caseResult?: CaseVerificationResult | CaseResponse | null;
        faceResult?: VerificationResult["face_verification"];
        caseId?: string;
      }
    | undefined;

  const results: VerificationResult[] =
    state?.results && state.results.length > 0
      ? state.results
      : state?.result
        ? [state.result]
        : [];

  const rawCaseResult = state?.caseResult ?? null;
  const caseResult: CaseVerificationResult | null =
    rawCaseResult && "verification" in rawCaseResult
      ? rawCaseResult.verification ?? null
      : rawCaseResult
        ? (rawCaseResult as CaseVerificationResult)
        : null;
  const faceResult = state?.faceResult;
  const caseId = state?.caseId ?? (rawCaseResult && "case_id" in rawCaseResult ? rawCaseResult.case_id : undefined);

  const [selectedIndex, setSelectedIndex] = useState(0);

  if (results.length === 0) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] text-[#101828]">
        <div className="flex min-h-screen">
          <aside className="hidden w-[76px] flex-col items-center border-r border-[#EAECF0] bg-white py-5 lg:flex">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1769E0] text-lg font-black text-white">
              ASAP
            </div>
            <div className="mt-8 rounded-2xl bg-[#EEF4FF] px-3 py-3 text-[#1769E0]">
              ✓
            </div>
          </aside>

          <main className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-3xl border border-[#EAECF0] bg-white p-8 shadow-[0_8px_30px_rgba(16,24,40,0.06)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF3F2] text-xl text-[#D92D20]">
                !
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
                Verification workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">
                Verification results not found
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                Open this page from a completed passenger case in the Screening
                Dashboard.
              </p>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-7 rounded-2xl bg-[#1769E0] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1259BD]"
              >
                Back to dashboard
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(selectedIndex, results.length - 1);
  const result = results[safeIndex];
  const parsed = result.parsed_data ?? {};
  const mrzChecks = result.mrz_validation?.checks ?? {};
  const mrzLines = (result.mrz ?? []).map((line) => line.trim());
  const mrzLine1 = mrzLines[0] ?? "";
  const mrzLine2 = mrzLines[1] ?? "";

  const decodeMrzName = (line: string) => {
    if (!line.startsWith("P<")) return { surname: "", givenNames: "" };
    const namePart = line.slice(2).split("<<<<", 1)[0];
    const parts = namePart.split("<<", 2);
    return {
      surname: (parts[0] ?? "").replace(/</g, " ").replace(/\s+/g, " ").trim(),
      givenNames: (parts[1] ?? "").replace(/</g, " ").replace(/\s+/g, " ").trim(),
    };
  };

  const mrzName = decodeMrzName(mrzLine1);
  const mrzDocumentNumber = mrzLine2.length >= 9 ? mrzLine2.slice(0, 9).replace(/</g, "") : "";
  const mrzNationality = mrzLine2.length >= 13 ? mrzLine2.slice(10, 13).replace(/</g, "") : "";
  const mrzBirthRaw = mrzLine2.length >= 19 ? mrzLine2.slice(13, 19) : "";
  const mrzExpiryRaw = mrzLine2.length >= 27 ? mrzLine2.slice(21, 27) : "";

  const formatMrzDate = (value: string) => {
    if (!/^\d{6}$/.test(value)) return "Not available";
    const year = Number(value.slice(0, 2));
    const fullYear = year >= 50 ? 1900 + year : 2000 + year;
    return `${value.slice(4, 6)}/${value.slice(2, 4)}/${fullYear}`;
  };

  const decodedMrz = {
    surname: mrzName.surname,
    givenNames: mrzName.givenNames,
    documentNumber: mrzDocumentNumber || result.cross_verification?.mrz_data?.documentNumber || "",
    nationality: mrzNationality || result.cross_verification?.mrz_data?.nationality || "",
    dateOfBirth: formatMrzDate(mrzBirthRaw) !== "Not available"
      ? formatMrzDate(mrzBirthRaw)
      : formatMrzDate(result.cross_verification?.mrz_data?.dateOfBirth ?? ""),
    expiryDate: formatMrzDate(mrzExpiryRaw) !== "Not available"
      ? formatMrzDate(mrzExpiryRaw)
      : formatMrzDate(result.cross_verification?.mrz_data?.expiryDate ?? ""),
  };

  const validation = result.document_validation;
  const tampering = result.tampering;
  const face = faceResult ?? result.face_verification;

  const riskScore = caseResult?.score ?? result.risk?.score ?? 0;
  const riskLevel = caseResult?.level ?? result.risk?.level ?? "UNKNOWN";
  const riskReasons =
    caseResult?.issues && caseResult.issues.length > 0
      ? caseResult.issues
      : result.risk?.reasons ?? [];

  const riskTone =
    riskLevel === "LOW"
      ? "green"
      : riskLevel === "MEDIUM"
        ? "amber"
        : "red";

  const formatValue = (value?: string) =>
    !value || value.trim() === "" ? "Not available" : value;

  const similarity =
    face?.similarity !== undefined
      ? face.similarity * 100
      : face?.confidence !== undefined
        ? face.confidence
        : null;

  const selectedFilename = result.filename ?? "";
  const selectedDocumentRisk = caseResult?.document_risks?.find(
    (item) => item.filename === selectedFilename
  );

  const crossChecks = caseResult?.checks ?? {};
  const crossCheckEntries = Object.entries(crossChecks);
  const hasCrossDocumentData =
    results.length >= 2 &&
    caseResult?.identity_score !== null &&
    caseResult?.identity_score !== undefined &&
    crossCheckEntries.length > 0;

  const pipeline = [
    ["OCR Extraction", Boolean(result.text)],
    ["MRZ Processing", Boolean(result.mrz?.length)],
    ["Document Validation", Boolean(validation)],
    ["Tampering Detection", tampering?.status?.toLowerCase() === "completed"],
    ["Face Verification", Boolean(face)],
  ] as const;

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#101828]">
      <div className="flex min-h-screen">
        {/* Material-style navigation rail */}
        <aside className="hidden w-[82px] shrink-0 flex-col items-center border-r border-[#EAECF0] bg-white py-5 lg:flex">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1769E0] text-sm font-black text-white shadow-sm"
            aria-label="Dashboard"
          >
            AI
          </button>

          <div className="mt-10 flex w-full flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF4FF] text-lg font-bold text-[#1769E0]">
              ⌂
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1769E0] text-lg font-bold text-white">
              ✓
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg text-[#667085]">
              ◷
            </div>
          </div>

          <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EEF7] text-xs font-bold text-[#344054]">
            OF
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Top app bar */}
          <header className="sticky top-0 z-20 border-b border-[#EAECF0] bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
                  AI Document Screening
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                    Passenger verification
                  </h1>
                  {caseId && (
                    <span className="hidden rounded-lg bg-[#F2F4F7] px-2.5 py-1 text-[11px] font-bold text-[#475467] sm:inline-flex">
                      {caseId}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-bold text-[#344054] transition hover:bg-[#F9FAFB]"
              >
                ← Dashboard
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-[1480px] space-y-5 px-5 py-6 sm:px-7 sm:py-8">
            {/* Case header */}
            <section className="overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-[0_4px_18px_rgba(16,24,40,0.04)]">
              <div className="grid lg:grid-cols-[1fr_auto]">
                <div className="p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1769E0]">
                      Unified case verification
                    </span>
                    <span className="rounded-full bg-[#F2F4F7] px-3 py-1 text-[11px] font-bold text-[#667085]">
                      {results.length} document{results.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                    {formatValue(parsed.fullName)}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                    AI-assisted screening combines document validation, identity
                    consistency, forensic analysis and face verification.
                  </p>

                  {riskReasons.length > 0 && (
                    <div className="mt-5 rounded-2xl bg-[#F8F9FC] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">Risk reasons</p>
                        <span className="text-xs font-semibold text-[#667085]">
                          {riskReasons.length} finding{riskReasons.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {riskReasons.map((reason, index) => (
                          <div
                            key={`${reason}-${index}`}
                            className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-xs text-[#475467]"
                          >
                            <span className="mt-0.5 text-[#D92D20]">●</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex min-w-[230px] flex-col justify-center border-t p-6 lg:border-l lg:border-t-0 ${
                  riskTone === "green"
                    ? "border-[#D1FADF] bg-[#F6FEF9]"
                    : riskTone === "amber"
                      ? "border-[#FEDF89] bg-[#FFFAEB]"
                      : "border-[#FECDCA] bg-[#FFF8F7]"
                }`}>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                    Overall case risk
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-black tracking-tight">{riskScore}</span>
                    <span className="pb-2 text-sm font-semibold text-[#667085]">/ 100</span>
                  </div>
                  <RiskBadge level={riskLevel} />
                  <p className="mt-3 text-xs leading-5 text-[#667085]">
                    Screening score for the complete passenger case.
                  </p>
                </div>
              </div>
            </section>

            {/* Document selector */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="Documents"
                title="Case documents"
                description="Select a document to inspect its extracted data and forensic evidence."
                count={`${results.length} uploaded`}
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {results.map((item, index) => {
                  const itemRisk = caseResult?.document_risks?.find(
                    (riskItem) => riskItem.filename === item.filename
                  );
                  const isSelected = index === safeIndex;
                  const tamperDetected = item.tampering?.tampering_detected;

                  return (
                    <button
                      key={`${item.filename ?? "document"}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`group rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[#1769E0] bg-[#F5F8FF] shadow-[0_0_0_3px_rgba(23,105,224,0.08)]"
                          : "border-[#EAECF0] hover:border-[#B2CCF8] hover:bg-[#FCFCFD]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-sm font-black text-[#1769E0]">
                            DOC
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">
                              {item.documentType ?? `Document ${index + 1}`}
                            </p>
                            <p className="mt-1 truncate text-sm font-bold">
                              {formatValue(item.filename)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            tamperDetected
                              ? "bg-[#FEF3F2] text-[#B42318]"
                              : "bg-[#ECFDF3] text-[#027A48]"
                          }`}
                        >
                          {tamperDetected ? "TAMPER RISK" : "CLEAR"}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-[#EAECF0] pt-3 text-xs">
                        <span
                          className={
                            item.document_validation?.valid
                              ? "font-bold text-[#027A48]"
                              : "font-bold text-[#B42318]"
                          }
                        >
                          {item.document_validation?.valid ? "Validation pass" : "Validation fail"}
                        </span>
                        <span className="font-bold text-[#667085]">
                          Risk {itemRisk?.score ?? item.risk?.score ?? "—"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Pipeline */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="Pipeline"
                title="Verification progress"
                description="Current processing state for the selected document."
              />
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {pipeline.map(([label, complete], index) => (
                  <div
                    key={label}
                    className={`relative rounded-2xl border p-4 ${
                      complete
                        ? "border-[#D1FADF] bg-[#F6FEF9]"
                        : "border-[#FEDF89] bg-[#FFFAEB]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#667085]">0{index + 1}</span>
                      <span className={`text-xs font-black ${complete ? "text-[#027A48]" : "text-[#B54708]"}`}>
                        {complete ? "✓" : "!"}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-bold">{label}</p>
                    <p className={`mt-1 text-[11px] font-semibold ${complete ? "text-[#027A48]" : "text-[#B54708]"}`}>
                      {complete ? "Complete" : "Pending"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Identity + OCR */}
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
                <SectionHeading
                  eyebrow="Identity"
                  title="Passenger information"
                  description="Fields extracted from the selected document."
                  right={<StatusBadge label={validation?.valid ? "DOCUMENT VALID" : "DOCUMENT CHECK"} passed={Boolean(validation?.valid)} />}
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoCard label="Full name" value={parsed.fullName} />
                  <InfoCard label="Date of birth" value={parsed.dateOfBirth} />
                  <InfoCard label="Nationality" value={parsed.nationality} />
                  <InfoCard label="Document number" value={parsed.documentNumber} />
                  <InfoCard label="Expiry date" value={parsed.expiryDate} />
                  <InfoCard label="Document type" value={result.documentType} />
                </div>
              </section>

              <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
                <SectionHeading
                  eyebrow="OCR"
                  title="Extracted text"
                  description="Raw text returned by OCR."
                />
                <pre className="mt-5 max-h-[270px] overflow-auto rounded-2xl bg-[#101828] p-4 font-mono text-[11px] leading-5 text-[#F2F4F7]">
                  {result.text || "No OCR text available."}
                </pre>
              </section>
            </div>

            {/* MRZ */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="MRZ"
                title="Machine-readable zone"
                description="Decoded passport data from the machine-readable zone, followed by technical checksum evidence."
                right={
                  <StatusBadge
                    label={result.mrz_validation?.valid ? "ALL CHECKS PASS" : "CHECK FAILED"}
                    passed={Boolean(result.mrz_validation?.valid)}
                  />
                }
              />

              {result.mrz && result.mrz.length > 0 ? (
                <>
                  <div className="mt-5 rounded-2xl border border-[#D6E4FF] bg-[#F5F8FF] p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1769E0]">Decoded MRZ information</p>
                        <p className="mt-1 text-sm text-[#667085]">Human-readable values extracted from the two MRZ lines.</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#667085]">TD3 / Passport MRZ</span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoCard label="Surname" value={decodedMrz.surname} />
                      <InfoCard label="Given names" value={decodedMrz.givenNames} />
                      <InfoCard label="Passport number" value={decodedMrz.documentNumber} />
                      <InfoCard label="Nationality" value={decodedMrz.nationality} />
                      <InfoCard label="Date of birth (MRZ)" value={decodedMrz.dateOfBirth} />
                      <InfoCard label="Expiry date (MRZ)" value={decodedMrz.expiryDate} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">OCR ↔ MRZ comparison</p>
                        <p className="mt-1 text-xs text-[#667085]">Checks whether the visible OCR fields agree with the decoded MRZ values.</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                        result.cross_verification?.valid ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"
                      }`}>
                        {result.cross_verification?.valid ? "MATCH" : "MISMATCH / REVIEW"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <MrzComparisonRow label="Name" ocr={parsed.fullName} mrz={`${decodedMrz.givenNames} ${decodedMrz.surname}`.trim()} passed={result.cross_verification?.checks?.name} />
                      <MrzComparisonRow label="Passport number" ocr={parsed.documentNumber} mrz={decodedMrz.documentNumber} passed={result.cross_verification?.checks?.documentNumber} />
                      <MrzComparisonRow label="Date of birth" ocr={parsed.dateOfBirth} mrz={decodedMrz.dateOfBirth} passed={result.cross_verification?.checks?.dateOfBirth} />
                      <MrzComparisonRow label="Expiry date" ocr={parsed.expiryDate} mrz={decodedMrz.expiryDate} passed={result.cross_verification?.checks?.expiryDate} />
                      <MrzComparisonRow label="Nationality" ocr={parsed.nationality} mrz={decodedMrz.nationality} passed={result.cross_verification?.checks?.nationality} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <CheckCard label="Passport number" passed={mrzChecks.passport_number} />
                    <CheckCard label="Birth date" passed={mrzChecks.birth_date} />
                    <CheckCard label="Expiry date" passed={mrzChecks.expiry_date} />
                    <CheckCard label="Personal number" passed={mrzChecks.personal_number} />
                    <CheckCard label="Overall" passed={mrzChecks.overall} />
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Raw MRZ</p>
                        <p className="mt-1 text-xs text-[#667085]">Technical two-line value returned by MRZ extraction.</p>
                      </div>
                      <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[10px] font-bold text-[#667085]">{result.mrz.length} lines</span>
                    </div>
                    <pre className="overflow-auto rounded-2xl bg-[#101828] p-5 font-mono text-xs leading-7 text-[#F2F4F7]">{result.mrz.join("\n")}</pre>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm font-semibold text-[#B54708]">
                  MRZ was not detected reliably. No decoded MRZ fields are available.
                </div>
              )}
            </section>

            {/* Cross document */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="Consistency"
                title="Cross-document verification"
                description="Case-level identity consistency across uploaded documents."
                right={
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#667085]">Identity consistency</p>
                    <p className="mt-1 text-2xl font-black">
                      {hasCrossDocumentData ? `${caseResult?.identity_score ?? 0}%` : "N/A"}
                    </p>
                  </div>
                }
              />

              {!hasCrossDocumentData ? (
                <div className="mt-5 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm text-[#B54708]">
                  Insufficient data for cross-document comparison. At least two completed
                  documents with comparable identity data are required.
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {crossCheckEntries.map(([field, value]) => (
                      <CheckCard
                        key={field}
                        label={field}
                        passed={value === "PASS"}
                      />
                    ))}
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#EAECF0]">
                    <div className="grid grid-cols-[180px_1fr] bg-[#F8F9FC] px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#667085]">
                      <span>Field</span>
                      <span>Case verification result</span>
                    </div>
                    {crossCheckEntries.map(([field, value]) => (
                      <div
                        key={`${field}-detail`}
                        className="grid grid-cols-[180px_1fr] border-t border-[#EAECF0] px-4 py-4 text-sm"
                      >
                        <span className="font-bold capitalize">{field.split("_").join(" ")}</span>
                        <span className={value === "PASS" ? "font-semibold text-[#027A48]" : "font-semibold text-[#B42318]"}>
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Document validation */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="Validation"
                title="Document validation"
                description="Expiry and internal consistency checks for the selected document."
                right={<StatusBadge label={validation?.valid ? "VALID" : "INVALID"} passed={Boolean(validation?.valid)} />}
              />

              {validation?.errors && validation.errors.length > 0 && (
                <FindingList title="Errors" items={validation.errors} tone="red" />
              )}

              {validation?.warnings && validation.warnings.length > 0 && (
                <FindingList title="Warnings" items={validation.warnings} tone="amber" />
              )}

              {!validation && (
                <div className="mt-5 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm font-semibold text-[#B54708]">
                  Document validation result is not available.
                </div>
              )}
            </section>

            {/* Primary forensic module */}
            <section className="overflow-hidden rounded-3xl border-2 border-[#1769E0] bg-white shadow-[0_8px_30px_rgba(23,105,224,0.08)]">
              <div className="border-b border-[#D6E4FF] bg-[#F5F8FF] p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#1769E0] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                        Primary forensic module
                      </span>
                      <span className="text-[11px] font-bold text-[#667085]">Evidence view</span>
                    </div>
                    <h3 className="mt-3 text-xl font-black tracking-tight">Tampering detection</h3>
                    <p className="mt-1 text-sm leading-6 text-[#667085]">
                      RGB anomaly, noise residual and image-forensic analysis for the selected document.
                    </p>
                  </div>

                  <StatusBadge
                    label={tampering?.tampering_detected ? "POTENTIAL TAMPERING" : "NO TAMPERING DETECTED"}
                    passed={!tampering?.tampering_detected}
                  />
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Risk level" value={tampering?.risk_level ?? "UNKNOWN"} />
                  <MetricCard
                    label="Confidence"
                    value={tampering?.confidence !== undefined ? `${tampering.confidence}%` : "N/A"}
                  />
                  <MetricCard label="Analysis status" value={tampering?.status ?? "UNKNOWN"} />
                </div>

                {tampering?.analysis && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="Image" value={`${tampering.analysis.width ?? 0} × ${tampering.analysis.height ?? 0}`} />
                    <MetricCard label="Noise mean" value={String(tampering.analysis.noise_mean ?? "N/A")} />
                    <MetricCard label="Noise std" value={String(tampering.analysis.noise_std ?? "N/A")} />
                    <MetricCard label="Edge ratio" value={String(tampering.analysis.edge_ratio ?? "N/A")} />
                  </div>
                )}

                {tampering?.explanation && (
                  <div className="mt-4 rounded-2xl border border-[#D6E4FF] bg-[#F8FAFF] p-4 text-sm leading-6 text-[#475467]">
                    <span className="font-bold text-[#101828]">Analysis:</span>{" "}
                    {tampering.explanation}
                  </div>
                )}

                {tampering?.outputs ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {tampering.outputs.original && (
                      <ForensicImage title="Original RGB image" src={tampering.outputs.original} />
                    )}
                    {tampering.outputs.rgb_anomaly && (
                      <ForensicImage title="RGB anomaly" src={tampering.outputs.rgb_anomaly} />
                    )}
                    {tampering.outputs.noise_residual && (
                      <ForensicImage title="Noise residual analysis" src={tampering.outputs.noise_residual} />
                    )}
                    {tampering.outputs.tampering_heatmap && (
                      <ForensicImage title="Tamper heatmap" src={tampering.outputs.tampering_heatmap} />
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm font-semibold text-[#B54708]">
                    Tampering forensic outputs are not available for this document.
                  </div>
                )}

                <div className="mt-5 rounded-2xl bg-[#F8F9FC] p-4 text-xs leading-5 text-[#667085]">
                  Forensic outputs are screening evidence and should not be treated as definitive proof of document fraud.
                  If image quality is insufficient, noise residual analysis should be treated as unreliable rather than as evidence.
                </div>
              </div>
            </section>

            {/* Face */}
            <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
              <SectionHeading
                eyebrow="Biometric"
                title="Face verification"
                description="Document face compared with the passenger selfie."
                right={
                  <StatusBadge
                    label={face ? (face.match ? "FACE MATCH" : "FACE MISMATCH") : "NOT RUN"}
                    passed={Boolean(face?.match)}
                  />
                }
              />

              {face ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Match" value={face.match ? "YES" : "NO"} />
                  <MetricCard label="Similarity" value={similarity !== null ? `${similarity.toFixed(2)}%` : "N/A"} />
                  <MetricCard label="Risk" value={face.risk_level ?? "UNKNOWN"} />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm text-[#B54708]">
                  Face verification has not been associated with this case. Run Face Verification from the Dashboard.
                </div>
              )}

              {face?.explanation && (
                <div className="mt-4 rounded-2xl bg-[#F8F9FC] p-4 text-sm leading-6 text-[#667085]">
                  {face.explanation}
                </div>
              )}
            </section>

            {/* Case summary + decision */}
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
                <SectionHeading
                  eyebrow="Summary"
                  title="Case decision summary"
                  description="Key signals supporting the officer review."
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Documents" value={String(results.length)} />
                  <MetricCard
                    label="Identity consistency"
                    value={
                      caseResult?.identity_score !== null && caseResult?.identity_score !== undefined
                        ? `${caseResult.identity_score}%`
                        : "N/A"
                    }
                  />
                  <MetricCard
                    label="Document risk"
                    value={
                      caseResult?.document_risk_score !== undefined
                        ? String(caseResult.document_risk_score)
                        : selectedDocumentRisk?.score !== undefined
                          ? String(selectedDocumentRisk.score)
                          : "N/A"
                    }
                  />
                  <MetricCard label="Recommended action" value={caseResult?.recommended_action ?? "Officer Review"} />
                </div>
              </section>

              <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-[0_4px_18px_rgba(16,24,40,0.04)] sm:p-6">
                <SectionHeading
                  eyebrow="Human review"
                  title="Officer decision"
                  description="AI assists screening; the officer makes the final decision."
                />

                {caseResult?.recommended_action && (
                  <div className="mt-5 rounded-2xl border border-[#B2CCF8] bg-[#F5F8FF] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1769E0]">
                      AI recommendation
                    </p>
                    <p className="mt-2 text-lg font-black text-[#101828]">
                      {caseResult.recommended_action}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="mt-5 w-full rounded-2xl bg-[#1769E0] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1259BD]"
                >
                  Return to dashboard
                </button>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  count,
  right,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#667085]">
            {eyebrow}
          </span>
          {count && (
            <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[10px] font-bold text-[#667085]">
              {count}
            </span>
          )}
        </div>
        <h3 className="mt-1 text-lg font-black tracking-tight">{title}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-[#667085]">{description}</p>
      </div>
      {right}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#101828]">
        {value && value.trim() ? value : "Not available"}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#EAECF0] bg-[#F8F9FC] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-[#101828]">{value}</p>
    </div>
  );
}

function CheckCard({ label, passed }: { label: string; passed?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        passed
          ? "border-[#D1FADF] bg-[#F6FEF9]"
          : "border-[#FECDCA] bg-[#FFF8F7]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#667085]">
          {label.split("_").join(" ")}
        </p>
        <span
          className={`text-sm font-black ${
            passed ? "text-[#027A48]" : "text-[#B42318]"
          }`}
        >
          {passed ? "✓" : "!"}
        </span>
      </div>
      <p
        className={`mt-3 text-sm font-black ${
          passed ? "text-[#027A48]" : "text-[#B42318]"
        }`}
      >
        {passed ? "PASS" : "FAIL"}
      </p>
    </div>
  );
}

function MrzComparisonRow({
  label,
  ocr,
  mrz,
  passed,
}: {
  label: string;
  ocr?: string;
  mrz?: string;
  passed?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#EAECF0] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#344054]">{label}</p>
        <span className={`text-[10px] font-black ${passed ? "text-[#027A48]" : "text-[#B42318]"}`}>
          {passed ? "MATCH" : "CHECK"}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2 sm:gap-3">
        <p><span className="font-bold text-[#667085]">OCR:</span> {ocr || "Not available"}</p>
        <p><span className="font-bold text-[#667085]">MRZ:</span> {mrz || "Not available"}</p>
      </div>
    </div>
  );
}

function StatusBadge({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-[10px] font-black tracking-wide ${
        passed
          ? "bg-[#ECFDF3] text-[#027A48]"
          : "bg-[#FEF3F2] text-[#B42318]"
      }`}
    >
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const classes =
    level === "LOW"
      ? "bg-[#ECFDF3] text-[#027A48]"
      : level === "MEDIUM"
        ? "bg-[#FFFAEB] text-[#B54708]"
        : "bg-[#FEF3F2] text-[#B42318]";

  return (
    <span className={`mt-3 inline-flex w-fit rounded-full px-3 py-1.5 text-[10px] font-black tracking-wide ${classes}`}>
      {level} RISK
    </span>
  );
}

function FindingList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "red" | "amber";
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 ${
        tone === "red"
          ? "border-[#FECDCA] bg-[#FFF8F7]"
          : "border-[#FEDF89] bg-[#FFFAEB]"
      }`}
    >
      <p className={`text-sm font-black ${tone === "red" ? "text-[#B42318]" : "text-[#B54708]"}`}>
        {title}
      </p>
      <ul className={`mt-2 space-y-1 text-sm ${tone === "red" ? "text-[#B42318]" : "text-[#B54708]"}`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ForensicImage({ title, src }: { title: string; src: string }) {
  const imageSrc = src.startsWith("http") ? src : `http://localhost:8000${src}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#D0D5DD] bg-[#101828]">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs font-black text-white">{title}</p>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold text-[#D0D5DD]">
          FORENSIC OUTPUT
        </span>
      </div>
      <div className="flex min-h-[250px] items-center justify-center bg-[#F2F4F7] p-3">
        <img
          src={imageSrc}
          alt={title}
          className="max-h-[440px] w-full rounded-xl object-contain"
        />
      </div>
    </div>
  );
}

export default VerificationPage;
