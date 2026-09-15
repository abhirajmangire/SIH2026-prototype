import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const navigate = useNavigate();

  const [officerId, setOfficerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!officerId || !password) {
      setError("Please enter Officer ID and password.");
      return;
    }

    setIsLoading(true);

    // Temporary prototype login.
    // Real backend authentication will be added later.
    setTimeout(() => {
      setIsLoading(false);
      navigate("/dashboard");
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#172033]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left Brand Panel */}
        <section className="relative hidden overflow-hidden bg-[#0B1F3A] lg:flex">
          <div className="absolute inset-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#1769E0]/20 blur-3xl" />
            <div className="absolute -bottom-32 -right-20 h-[30rem] w-[30rem] rounded-full bg-[#4F8DF7]/10 blur-3xl" />
          </div>

          <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                <span className="text-sm font-bold">ASAP</span>
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  Document Screening
                </p>
                <p className="text-xs text-white/55">
                  Officer Security Console
                </p>
              </div>
            </div>

            {/* Main Message */}
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#63D297]" />
                <span className="text-xs font-medium text-white/75">
                  AI-assisted screening system
                </span>
              </div>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
                AI-Based Document Screening and Tamper Detection System.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-white/65">
                Analyze identity documents, validate MRZ data, detect potential
                tampering, and verify faces through one unified screening
                workflow.
              </p>

              {/* Module Indicators */}
              <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
                <Feature
                  number="01"
                  title="OCR Extraction"
                  description="Structured document data"
                />

                <Feature
                  number="02"
                  title="Validation"
                  description="MRZ and document checks"
                />

                <Feature
                  number="03"
                  title="Tampering"
                  description="Multi-forensic analysis"
                />

                <Feature
                  number="04"
                  title="Face Verification"
                  description="Identity consistency"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/10 pt-6">
              <p className="text-xs text-white/40">
                AI-assisted security screening prototype
              </p>

              <p className="text-xs text-white/40">SIH 2026</p>
            </div>
          </div>
        </section>

        {/* Login Panel */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[440px]">
            {/* Mobile Brand */}
            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F3A] text-white shadow-sm">
                  <span className="text-sm font-bold">AI</span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">
                    Document Screening
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Officer Security Console
                  </p>
                </div>
              </div>
            </div>

            {/* Login Header */}
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#1769E0]">
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>

              <h2 className="text-3xl font-semibold tracking-tight text-[#0B1F3A]">
                Officer sign in
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#64748B]">
                Sign in to access the document screening console.
              </p>
            </div>

            {/* Login Card */}
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:p-8">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Officer ID */}
                <div>
                  <label
                    htmlFor="officerId"
                    className="mb-2 block text-sm font-medium text-[#172033]"
                  >
                    Officer ID
                  </label>

                  <input
                    id="officerId"
                    type="text"
                    value={officerId}
                    onChange={(event) => setOfficerId(event.target.value)}
                    placeholder="Enter Officer ID"
                    autoComplete="username"
                    className="h-12 w-full rounded-xl border border-[#D7DEE9] bg-[#FBFCFE] px-4 text-sm text-[#172033] outline-none transition placeholder:text-[#94A3B8] hover:border-[#B9C4D3] focus:border-[#1769E0] focus:bg-white focus:ring-4 focus:ring-[#1769E0]/10"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-[#172033]"
                    >
                      Password
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="h-12 w-full rounded-xl border border-[#D7DEE9] bg-[#FBFCFE] px-4 pr-20 text-sm text-[#172033] outline-none transition placeholder:text-[#94A3B8] hover:border-[#B9C4D3] focus:border-[#1769E0] focus:bg-white focus:ring-4 focus:ring-[#1769E0]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1769E0] transition hover:bg-[#E8F0FE]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-[#F2C4C4] bg-[#FFF6F6] px-4 py-3 text-sm text-[#B42318]"
                  >
                    <svg
                      className="mt-0.5 shrink-0"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>

                    <span>{error}</span>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1769E0] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1259BD] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#1769E0]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Secure Login

                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Security Notice */}
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#F7F9FC] px-4 py-3.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FE] text-[#1769E0]">
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
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#334155]">
                    Secure officer access
                  </p>

                  <p className="mt-0.5 text-[11px] leading-5 text-[#64748B]">
                    This prototype uses temporary local authentication.
                    Production authentication will be integrated later.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Information */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#63D297]" />

              <p className="text-xs text-[#64748B]">
                AI-assisted screening prototype
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.18em] text-white/40">
          {number}
        </span>

        <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
      </div>

      <p className="text-sm font-semibold text-white">{title}</p>

      <p className="mt-1 text-xs text-white/50">{description}</p>
    </div>
  );
}

export default LoginPage;