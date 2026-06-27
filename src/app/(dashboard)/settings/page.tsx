"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, HardDrive, HelpCircle, KeyRound, Settings, Trash2, Zap } from "lucide-react";

interface UserSettings {
  id: string;
  email: string;
  name?: string;
  white_label_config?: {
    company_name?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    contact_email?: string;
    contact_phone?: string;
  };
  widget_api_key?: string;
}

interface DataSource {
  key: string;
  provider: string;
  label: string;
  configured: boolean;
  maskedValue?: string;
  status: "connected" | "missing" | "invalid" | "needs_attention" | "optional";
  required: boolean;
  unlocks: string;
  source: "sqlite" | "env" | "missing";
  setup?: {
    docsUrl: string;
    envVar: string;
    steps: string[];
  };
  lastTestedAt?: string;
  lastTestMessage?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [sourceInputs, setSourceInputs] = useState<Record<string, string>>({});
  const [sourceBusy, setSourceBusy] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    company_name: "",
    logo_url: "",
    primary_color: "#8b5cf6",
    secondary_color: "#d8b4fe",
    contact_email: "",
    contact_phone: "",
  });

  const loadDataSources = async () => {
    const response = await fetch("/api/settings/data-sources");
    if (response.ok) {
      const data = await response.json();
      setDataSources(data.sources || []);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
          if (data.white_label_config) {
            setFormData({
              company_name: data.white_label_config.company_name || "",
              logo_url: data.white_label_config.logo_url || "",
              primary_color: data.white_label_config.primary_color || "#8b5cf6",
              secondary_color: data.white_label_config.secondary_color || "#d8b4fe",
              contact_email: data.white_label_config.contact_email || "",
              contact_phone: data.white_label_config.contact_phone || "",
            });
          }
        }
        await loadDataSources();
      } catch (error) {
        console.error("Failed to load settings:", error);
        setMessage({ type: "error", text: "Failed to load settings" });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const setBusy = (key: string, busy: boolean) => {
    setSourceBusy((prev) => ({ ...prev, [key]: busy }));
  };

  const saveDataSource = async (key: string) => {
    const value = sourceInputs[key]?.trim();
    if (!value) {
      setMessage({ type: "error", text: "Paste a key before saving." });
      return;
    }

    setBusy(key, true);
    try {
      const response = await fetch(`/api/settings/data-sources/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error("Save failed");
      setSourceInputs((prev) => ({ ...prev, [key]: "" }));
      await loadDataSources();
      setMessage({ type: "success", text: "Data source saved. New audits will use it immediately." });
    } catch {
      setMessage({ type: "error", text: "Could not save this data source." });
    } finally {
      setBusy(key, false);
    }
  };

  const testDataSource = async (key: string) => {
    setBusy(key, true);
    try {
      const value = sourceInputs[key]?.trim();
      const response = await fetch(`/api/settings/data-sources/${key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value ? { value } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Connection test failed.");
      await loadDataSources();
      setMessage({ type: body.status === "connected" ? "success" : "error", text: body.message });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Connection test failed." });
    } finally {
      setBusy(key, false);
    }
  };

  const deleteDataSource = async (key: string) => {
    setBusy(key, true);
    try {
      const response = await fetch(`/api/settings/data-sources/${key}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      await loadDataSources();
      setMessage({ type: "success", text: "Data source removed." });
    } catch {
      setMessage({ type: "error", text: "Could not remove this data source." });
    } finally {
      setBusy(key, false);
    }
  };

  const statusLabel = (source: DataSource) => {
    if (source.status === "connected") return "Connected";
    if (source.status === "invalid") return "Invalid";
    if (source.status === "needs_attention") return "Needs attention";
    return source.required ? "Missing" : "Optional";
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage({ type: "success", text: "Settings saved successfully" });
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to save settings" });
      }
    } catch (error) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage local workspace settings and report branding.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-900 border border-green-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Data Sources
          </CardTitle>
          <CardDescription>
            Connect the local data sources Phantom Reach uses for audits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {dataSources.filter((source) => source.status === "connected").length} connected
            </Badge>
            <Badge variant="outline">
              {dataSources.filter((source) => source.status === "missing").length} missing
            </Badge>
            <Badge variant="outline">
              {dataSources.filter((source) => source.status === "optional").length} optional
            </Badge>
          </div>

          <div className="space-y-3">
            {dataSources.map((source) => (
              <div key={source.key} className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{source.label}</h3>
                      <Badge
                        variant={
                          source.status === "connected"
                            ? "default"
                            : source.required
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {statusLabel(source)}
                      </Badge>
                      {source.source === "env" && <Badge variant="outline">Env fallback</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{source.unlocks}</p>
                    {source.setup && (
                      <details className="group max-w-2xl rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-700">
                          <HelpCircle className="h-4 w-4 text-slate-500" />
                          How to get this key
                        </summary>
                        <div className="mt-3 space-y-3 text-slate-600">
                          <ol className="list-decimal space-y-1 pl-5">
                            {source.setup.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {source.setup.envVar}
                            </Badge>
                            <a
                              href={source.setup.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-slate-900 underline-offset-4 hover:underline"
                            >
                              Open setup page
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </details>
                    )}
                    {source.configured && (
                      <p className="text-xs text-muted-foreground">
                        Saved key: <span className="font-mono">{source.maskedValue}</span>
                      </p>
                    )}
                    {source.lastTestMessage && (
                      <p className="text-xs text-muted-foreground">{source.lastTestMessage}</p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 lg:w-[390px]">
                    <Input
                      type="password"
                      value={sourceInputs[source.key] || ""}
                      onChange={(event) =>
                        setSourceInputs((prev) => ({ ...prev, [source.key]: event.target.value }))
                      }
                      placeholder={source.configured ? "Paste a replacement key" : "Paste key"}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveDataSource(source.key)}
                        disabled={sourceBusy[source.key]}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => testDataSource(source.key)}
                        disabled={sourceBusy[source.key]}
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Test
                      </Button>
                      {source.configured && source.source === "sqlite" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteDataSource(source.key)}
                          disabled={sourceBusy[source.key]}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Local profile and runtime information.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-lg font-medium mt-1">{settings?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-lg font-medium mt-1">{settings?.name || "Local Workspace"}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Database</label>
            <div className="mt-2">
              <Badge className="gap-1.5">
                <HardDrive className="h-3 w-3" />
                SQLite
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Run Mode</label>
            <div className="mt-2">
              <Badge variant="secondary">Local only</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Report Branding
          </CardTitle>
          <CardDescription>
            Customize widgets and reports generated from this local workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleInputChange("company_name", e.target.value)}
                  placeholder="Your Company"
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Logo URL</label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => handleInputChange("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Primary Color</label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange("primary_color", e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => handleInputChange("primary_color", e.target.value)}
                    placeholder="#8b5cf6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Secondary Color</label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => handleInputChange("secondary_color", e.target.value)}
                    placeholder="#d8b4fe"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Contact Email</label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleInputChange("contact_email", e.target.value)}
                  placeholder="support@example.com"
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Phone</label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => handleInputChange("contact_phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="mt-2"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Branding Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Widget Key</CardTitle>
          <CardDescription>
            Local key for the embeddable audit widget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Widget API Key</label>
            <p className="text-sm text-mono bg-muted p-2 rounded mt-2 break-all">
              {settings?.widget_api_key || "Not generated"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
