import { useLocation, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  IconArrowLeft,
  IconPlayerPlay,
  IconFileCode,
  IconPlus,
  IconTrash,
  IconArrowRight,
  IconRocket,
} from "@tabler/icons-react";

import { toast } from "sonner";
import type { Artifact, EnvironmentVariable } from "../client";
import { postV1Task } from "../client";
import { client } from "../client/client.gen";

function ParticleCanvas({ active, isDark }: { active: boolean; isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Lighter, more vivid particles in light mode; brighter in dark
    const palette = isDark
      ? ["oklch(0.85 0.17 162)", "oklch(0.70 0.20 155)", "oklch(0.60 0.18 170)", "oklch(0.75 0.22 145)", "oklch(0.55 0.15 180)"]
      : ["oklch(0.50 0.20 162)", "oklch(0.45 0.22 155)", "oklch(0.55 0.18 170)", "oklch(0.40 0.24 145)", "oklch(0.60 0.16 180)"];

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      r: number; alpha: number;
      decay: number; color: string;
      trail: { x: number; y: number }[];
    };

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const particles: Particle[] = [];

    for (let i = 0; i < 160; i++) {
      const angle = (Math.PI * 2 * i) / 160 + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 9;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.5 + Math.random() * 3,
        alpha: 0.9 + Math.random() * 0.1,
        decay: 0.012 + Math.random() * 0.018,
        color: palette[Math.floor(Math.random() * palette.length)],
        trail: [],
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive++;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        p.alpha -= p.decay;

        for (let t = 0; t < p.trail.length - 1; t++) {
          const a = p.alpha * (t / p.trail.length) * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.trail[t].x, p.trail[t].y);
          ctx.lineTo(p.trail[t + 1].x, p.trail[t + 1].y);
          ctx.strokeStyle = p.color.replace(")", ` / ${a})`);
          ctx.lineWidth = p.r * 0.6 * (t / p.trail.length);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", ` / ${p.alpha})`);
        ctx.fill();
      }
      if (alive > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, isDark]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-40 pointer-events-none"
      // "screen" brightens in dark mode; "multiply" darkens in light mode
      style={{ mixBlendMode: isDark ? "screen" : "multiply" }}
    />
  );
}


function SuccessScreen({
  taskId,
  artifactName,
  onDismiss,
}: {
  taskId: string;
  artifactName: string;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"burst" | "reveal">("burst");
  // Detect current theme by reading the html element's class
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 500);
    return () => clearTimeout(t1);
  }, []);

  // Theme-aware colour tokens
  // Dark: deep green-tinted dark background; Light: near-white with subtle green tint
  const bgGradient = isDark
    ? "radial-gradient(ellipse 120% 80% at 50% 60%, oklch(0.18 0.04 162) 0%, oklch(0.12 0.01 285) 55%, oklch(0.10 0.005 285) 100%)"
    : "radial-gradient(ellipse 120% 80% at 50% 60%, oklch(0.96 0.02 162) 0%, oklch(0.99 0.005 285) 55%, oklch(1 0 0) 100%)";

  const gridColor = isDark ? "oklch(0.7 0.15 162)" : "oklch(0.55 0.15 162)";
  const gridOpacity = isDark ? "0.035" : "0.07";

  const headlineGradient = isDark
    ? "linear-gradient(135deg, oklch(0.95 0.05 162), oklch(0.85 0.17 162), oklch(0.70 0.20 155))"
    : "linear-gradient(135deg, oklch(0.35 0.15 162), oklch(0.45 0.20 155), oklch(0.40 0.18 170))";

  const iconColor = isDark ? "oklch(0.85 0.17 162)" : "oklch(0.45 0.20 155)";
  const ringStroke = isDark ? "oklch(0.696 0.17 162.48)" : "oklch(0.50 0.20 162)";
  const taskIdColor = isDark ? "oklch(0.85 0.17 162)" : "oklch(0.40 0.20 155)";

  return (
    <>
      <ParticleCanvas active={phase === "burst" || phase === "reveal"} isDark={isDark} />

      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: bgGradient, animation: "bg-appear 0.4s ease forwards" }}
      >
        {/* Rotating conic aurora — masked to a circle so no hard rectangle edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? "conic-gradient(from 0deg at 50% 50%, transparent 0%, oklch(0.696 0.17 162.48 / 0.04) 15%, transparent 30%, oklch(0.6 0.118 184.704 / 0.03) 50%, transparent 65%, oklch(0.723 0.219 149.579 / 0.035) 80%, transparent 100%)"
              : "conic-gradient(from 0deg at 50% 50%, transparent 0%, oklch(0.55 0.18 162 / 0.03) 15%, transparent 30%, oklch(0.50 0.16 184 / 0.025) 50%, transparent 65%, oklch(0.52 0.20 149 / 0.03) 80%, transparent 100%)",
            mask: "radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)",
            WebkitMask: "radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)",
            animation: "aurora-spin 12s linear infinite",
          }}
        />

        {/* Radial bloom */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
          style={{
            background: isDark
              ? "radial-gradient(circle, oklch(0.696 0.17 162.48 / 0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, oklch(0.55 0.18 162 / 0.10) 0%, transparent 70%)",
            animation: "bloom-pulse 3s ease-in-out infinite",
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: gridOpacity,
            backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl"
          style={{
            opacity: phase === "reveal" ? 1 : 0,
            transform: phase === "reveal" ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Icon */}
          <div className="relative mb-8">
            <div
              className="absolute inset-0 rounded-full scale-150 pointer-events-none"
              style={{
                background: isDark
                  ? "radial-gradient(circle, oklch(0.696 0.17 162.48 / 0.25) 0%, transparent 70%)"
                  : "radial-gradient(circle, oklch(0.55 0.18 162 / 0.20) 0%, transparent 70%)",
                animation: "bloom-pulse 2.5s ease-in-out infinite",
              }}
            />
            <svg
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              width="120" height="120" viewBox="0 0 120 120"
              style={{ animation: "spin-ring 8s linear infinite" }}
            >
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={ringStroke}
                strokeWidth="1"
                strokeDasharray="8 6"
                strokeOpacity="0.5"
              />
            </svg>
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: isDark
                  ? "linear-gradient(135deg, oklch(0.696 0.17 162.48 / 0.2), oklch(0.527 0.154 150.069 / 0.3))"
                  : "linear-gradient(135deg, oklch(0.55 0.18 162 / 0.15), oklch(0.45 0.20 150 / 0.20))",
                border: isDark
                  ? "1px solid oklch(0.696 0.17 162.48 / 0.4)"
                  : "1px solid oklch(0.50 0.18 162 / 0.35)",
                boxShadow: isDark
                  ? "0 0 40px oklch(0.696 0.17 162.48 / 0.3), inset 0 1px 0 oklch(1 0 0 / 0.1)"
                  : "0 0 40px oklch(0.55 0.18 162 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.6)",
              }}
            >
              <IconRocket
                className="h-11 w-11"
                style={{
                  color: iconColor,
                  filter: isDark
                    ? "drop-shadow(0 0 12px oklch(0.696 0.17 162.48 / 0.8))"
                    : "drop-shadow(0 0 8px oklch(0.50 0.20 162 / 0.5))",
                  animation: "rocket-bob 2s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl font-bold tracking-tight mb-3"
            style={{
              background: headlineGradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: isDark
                ? "drop-shadow(0 0 20px oklch(0.696 0.17 162.48 / 0.4))"
                : "none",
            }}
          >
            Task Dispatched
          </h1>

          <p className="text-lg text-muted-foreground mb-2">
            <span className="font-mono text-foreground/80">{artifactName}</span> is now in the queue
          </p>

          {/* Task ID */}
          <div
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full mb-10 mt-2"
            style={{
              background: isDark
                ? "oklch(0.696 0.17 162.48 / 0.08)"
                : "oklch(0.50 0.18 162 / 0.07)",
              border: isDark
                ? "1px solid oklch(0.696 0.17 162.48 / 0.25)"
                : "1px solid oklch(0.50 0.18 162 / 0.25)",
            }}
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Task ID
            </span>
            <span className="font-mono text-sm" style={{ color: taskIdColor }}>
              {taskId}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              size="lg"
              className="min-w-[160px]"
              onClick={onDismiss}
            >
              Create Another
            </Button>
            <Button
              size="lg"
              className="min-w-[160px]"
              style={{
                background: "linear-gradient(135deg, oklch(0.696 0.17 162.48), oklch(0.527 0.154 150.069))",
                color: "oklch(0.982 0.018 155.826)",
                border: "none",
                boxShadow: isDark
                  ? "0 4px 24px oklch(0.696 0.17 162.48 / 0.4)"
                  : "0 4px 24px oklch(0.50 0.18 162 / 0.25)",
              }}
              onClick={() => navigate("/tasks")}
            >
              View Tasks
              <IconArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bg-appear {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes aurora-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bloom-pulse {
          0%, 100% { opacity: 1;   scale: 1;   }
          50%       { opacity: 0.7; scale: 1.1; }
        }
        @keyframes spin-ring {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes rocket-bob {
          0%, 100% { transform: translateY(0)    rotate(-10deg); }
          50%       { transform: translateY(-6px) rotate(-10deg); }
        }
      `}</style>
    </>
  );
}



export default function Task() {
  const location = useLocation();
  const navigate = useNavigate();

  const artifact = location.state?.artifact as Artifact | undefined;

  const DEFAULT_INTERFACE = "<interface>";
  const DEFAULT_FUNCTION = "<function>";

  // Build the default source string from artifact data
  const defaultSource = artifact
    ? `${artifact.namespace}:${artifact.name}/${DEFAULT_INTERFACE}/${DEFAULT_FUNCTION}@hash:${artifact.versionHash}`
    : "";

  // Form state
  const [source, setSource] = useState(defaultSource);
  const [interfaceName, setInterfaceName] = useState(DEFAULT_INTERFACE);
  const [fnName, setFnName] = useState(DEFAULT_FUNCTION);
  const [retries, setRetries] = useState<string>("");
  const [retention, setRetention] = useState("");
  const [callback, setCallback] = useState("");
  const [args, setArgs] = useState<string[]>([""]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact) return;
    const interfacePart = interfaceName.trim() || DEFAULT_INTERFACE;
    const functionPart = fnName.trim() || DEFAULT_FUNCTION;
    setSource(
      `${artifact.namespace}:${artifact.name}/${interfacePart}/${functionPart}@hash:${artifact.versionHash}`
    );
  }, [artifact, interfaceName, fnName]);

  const configureClient = useCallback(() => {
    const stored = localStorage.getItem("enclave_credentials");
    if (!stored) throw new Error("No authentication credentials found");
    client.setConfig({
      baseUrl: "/api",
      headers: { Authorization: `Basic ${stored}` },
    });
  }, []);

  if (!artifact) {
    return (
      <PageLayout title="Create Task">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <IconFileCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Artifact Selected</h3>
            <p className="text-muted-foreground mb-4">
              Please select an artifact from the artifacts page to create a task.
            </p>
            <Button onClick={() => navigate("/artifacts")}>
              <IconArrowLeft className="h-4 w-4 mr-2" />
              Back to Artifacts
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) {
      toast.error("Source is required");
      return;
    }

    setIsSubmitting(true);
    try {
      configureClient();

      // Build the source: replace placeholder function with the specified function name
      // Format: namespace:name/interface/function@hash  OR  namespace:name@hash:... (pre-filled)
      // The user edits source directly; we append the function if not already embedded
      const taskSource = source.trim();

      const env: EnvironmentVariable[] = envVars
        .filter((e) => e.key.trim())
        .map((e) => ({ key: e.key.trim(), value: e.value }));

      const taskArgs: string[] = args.filter((a) => a.trim());

      const response = await postV1Task({
        body: {
          source: taskSource,
          ...(fnName.trim() && fnName !== "main" ? {} : {}), // source includes routing
          ...(env.length > 0 ? { env } : {}),
          ...(taskArgs.length > 0 ? { args: taskArgs } : {}),
          ...(callback.trim() ? { callback: callback.trim() } : {}),
          ...(retention.trim() ? { retention: retention.trim() } : {}),
          ...(retries !== "" ? { retries: parseInt(retries, 10) } : {}),
        },
      });

      if (response.data) {
        setCreatedTaskId(response.data.id);
      } else {
        throw new Error("No task data returned");
      }
    } catch (error) {
      toast.error("Failed to create task", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissSuccess = () => {
    setCreatedTaskId(null);
    // Reset form for another task
    setRetries("");
    setRetention("");
    setCallback("");
    setArgs([""]);
    setEnvVars([{ key: "", value: "" }]);
  };

  // ── Env var helpers
  const addEnvVar = () => setEnvVars((prev) => [...prev, { key: "", value: "" }]);
  const removeEnvVar = (i: number) => setEnvVars((prev) => prev.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: "key" | "value", val: string) =>
    setEnvVars((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  // ── Arg helpers
  const addArg = () => setArgs((prev) => [...prev, ""]);
  const removeArg = (i: number) => setArgs((prev) => prev.filter((_, idx) => idx !== i));
  const updateArg = (i: number, val: string) =>
    setArgs((prev) => prev.map((a, idx) => (idx === i ? val : a)));

  return (
    <PageLayout title="Create Task">
      {/* Full-screen success takeover */}
      {createdTaskId && (
        <SuccessScreen
          taskId={createdTaskId}
          artifactName={`${artifact.namespace}/${artifact.name}`}
          onDismiss={handleDismissSuccess}
        />
      )}

      <div className="px-4 lg:px-6 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate("/artifacts")}
          >
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to Artifacts
          </Button>
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.696 0.17 162.48 / 0.15), oklch(0.6 0.118 184.704 / 0.15))",
                border: "1px solid oklch(0.696 0.17 162.48 / 0.25)",
              }}
            >
              <IconPlayerPlay
                className="h-6 w-6"
                style={{ color: "oklch(0.696 0.17 162.48)" }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create Task</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Schedule a task from artifact{" "}
                <span className="font-mono text-foreground">
                  {artifact.namespace}/{artifact.name}
                </span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source & Function */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Source</CardTitle>
              <CardDescription>
                The artifact source and entry point for this task.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source">
                  Source{" "}
                  <Badge variant="outline" className="text-xs ml-1 font-normal">
                    required
                  </Badge>
                </Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="namespace:name/interface/funciton@hash:abc123"
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Format:{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    namespace:name/interface/function@hash:&lt;hash&gt;
                  </code>{" "}
                  or{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    namespace:name/interface/function@&lt;tag&gt;
                  </code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="function">Function</Label>
                <Input
                  id="function"
                  value={fnName}
                  onChange={(e) => setFnName(e.target.value)}
                  placeholder="<function>"
                />
                <Label htmlFor="interface">Interface</Label>
                <Input
                  id="interface"
                  value={interfaceName}
                  onChange={(e) => setInterfaceName(e.target.value)}
                  placeholder="<interface>"
                />
                <p className="text-xs text-muted-foreground">
                  Entry function to invoke.
                  <code className="bg-muted px-1 py-0.5 rounded">main</code>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Execution Settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Execution Settings</CardTitle>
              <CardDescription>
                Optional runtime configuration for the task.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retries">Max Retries</Label>
                  <Input
                    id="retries"
                    type="number"
                    min="0"
                    value={retries}
                    onChange={(e) => setRetries(e.target.value)}
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Retries before the task is archived.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention">Retention</Label>
                  <Input
                    id="retention"
                    value={retention}
                    onChange={(e) => setRetention(e.target.value)}
                    placeholder="24h"
                  />
                  <p className="text-xs text-muted-foreground">
                    How long to keep the task after completion (e.g.{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">24h</code>,{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">7d</code>).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="callback">Callback URL</Label>
                <Input
                  id="callback"
                  type="url"
                  value={callback}
                  onChange={(e) => setCallback(e.target.value)}
                  placeholder="https://example.com/webhook"
                />
                <p className="text-xs text-muted-foreground">
                  URL invoked when the task completes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Arguments */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Arguments</CardTitle>
                  <CardDescription className="mt-1">
                    Positional string arguments passed to the function.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addArg}
                >
                  <IconPlus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {args.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No arguments.
                </p>
              ) : (
                <div className="space-y-2">
                  {args.map((arg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">
                        {i}
                      </span>
                      <Input
                        value={arg}
                        onChange={(e) => updateArg(i, e.target.value)}
                        placeholder={`arg ${i}`}
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeArg(i)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Environment Variables */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Environment Variables
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Key-value pairs injected into the task environment.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEnvVar}
                >
                  <IconPlus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {envVars.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No environment variables.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_1fr_2rem] gap-2 px-0">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Key
                    </span>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Value
                    </span>
                  </div>
                  {envVars.map((env, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_2rem] gap-2 items-center"
                    >
                      <Input
                        value={env.key}
                        onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                        placeholder="KEY"
                        className="font-mono text-sm"
                      />
                      <Input
                        value={env.value}
                        onChange={(e) =>
                          updateEnvVar(i, "value", e.target.value)
                        }
                        placeholder="value"
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeEnvVar(i)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/artifacts")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !source.trim()}
              className="min-w-[140px]"
              style={{
                background: isSubmitting
                  ? undefined
                  : "linear-gradient(135deg, oklch(0.696 0.17 162.48), oklch(0.527 0.154 150.069))",
                color: "oklch(0.982 0.018 155.826)",
                border: "none",
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconPlayerPlay className="h-4 w-4" />
                  Create Task
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
