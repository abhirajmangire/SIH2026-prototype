export type VerificationDocument = {
  id: string;
  file: File;
  documentType: string;
  status: "WAITING" | "PROCESSING" | "COMPLETED" | "WARNING" | "FAILED";
  progress: number;
  result?: VerificationResult;
};

export type VerificationResult = {
  filename: string;
  status: string;
  text: string;
  parsed_data: {
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    documentNumber: string;
    expiryDate: string;
  };
  mrz: string[];
  mrz_validation: {
    valid: boolean;
    checks?: {
      passport_number: boolean;
      birth_date: boolean;
      expiry_date: boolean;
      personal_number: boolean;
      overall: boolean;
    };
    error?: string;
  };
  cross_verification: {
    valid: boolean;
    match_count: number;
    total_checks: number;
    score: number;
    checks: {
      name: boolean;
      documentNumber: boolean;
      dateOfBirth: boolean;
      expiryDate: boolean;
      nationality: boolean;
    };
    mrz_data: {
      name: string;
      documentNumber: string;
      dateOfBirth: string;
      expiryDate: string;
      nationality: string;
    };
  };
  document_validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  tampering: {
    status: string;
    tampering_detected: boolean;
    risk_level: string;
    confidence: number;
    analysis?: {
      image_format: string;
      width: number;
      height: number;
      noise_mean: number;
      noise_std: number;
      edge_ratio: number;
    };
    explanation?: string;
  };
  risk: {
    score: number;
    level: string;
    reasons: string[];
  };
};

export type PassengerCase = {
  caseId: string;
  createdAt: string;
  status: "CREATED" | "PROCESSING" | "COMPLETED" | "MANUAL_REVIEW" | "APPROVED" | "REJECTED";
  documents: VerificationDocument[];
  overallRisk?: {
    score: number;
    level: string;
    reasons: string[];
  };
};
