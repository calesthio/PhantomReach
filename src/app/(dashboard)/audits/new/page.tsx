"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutocompleteInput, type AutocompleteSuggestion } from "@/components/ui/autocomplete-input";
import { Search, MapPin, Globe, MessageSquare } from "lucide-react";

/** Generate a UUID v4 for Google Places session tokens */
function generateSessionToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function NewAuditPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    businessName: "",
    city: "",
    state: "",
    url: "",
    googleMapsUrl: "",
    customDirection: "",
  });

  // Session tokens for Google Places API cost optimization
  // Each autocomplete → place details flow shares one token
  const businessSessionToken = useRef(generateSessionToken());
  const citySessionToken = useRef(generateSessionToken());

  // Business name autocomplete fetcher
  const fetchBusinessSuggestions = useCallback(
    async (query: string): Promise<AutocompleteSuggestion[]> => {
      try {
        const params = new URLSearchParams({
          q: query,
          sessionToken: businessSessionToken.current,
        });
        if (formData.city) params.set("city", formData.city);

        const res = await fetch(`/api/autocomplete/business?${params}`);
        if (!res.ok) return [];
        const data = await res.json();

        return (data.suggestions || []).map(
          (s: {
            name: string;
            address?: string;
            rating?: number;
            reviewCount?: number;
            category?: string;
            city?: string;
            state?: string;
            website?: string;
            phone?: string;
            googleMapsUrl?: string;
            placeId?: string;
          }) => ({
            label: s.name,
            sublabel: [
              s.address,
              s.rating ? `${s.rating}★ (${s.reviewCount || 0} reviews)` : null,
              s.category,
            ]
              .filter(Boolean)
              .join(" · "),
            data: {
              city: s.city,
              state: s.state,
              website: s.website,
              phone: s.phone,
              googleMapsUrl: s.googleMapsUrl,
              placeId: s.placeId,
              rating: s.rating,
              reviewCount: s.reviewCount,
              category: s.category,
              address: s.address,
            },
          })
        );
      } catch {
        return [];
      }
    },
    [formData.city]
  );

  // City autocomplete fetcher
  const fetchCitySuggestions = useCallback(
    async (query: string): Promise<AutocompleteSuggestion[]> => {
      try {
        const params = new URLSearchParams({
          q: query,
          sessionToken: citySessionToken.current,
        });
        const res = await fetch(`/api/autocomplete/city?${params}`);
        if (!res.ok) return [];
        const data = await res.json();

        return (data.suggestions || []).map(
          (s: { city: string; stateCode: string; state: string }) => ({
            label: `${s.city}, ${s.stateCode}`,
            sublabel: s.state,
            data: { city: s.city, stateCode: s.stateCode },
          })
        );
      } catch {
        return [];
      }
    },
    []
  );

  // When a business is selected — fetch place details for website/phone
  async function handleBusinessSelect(suggestion: AutocompleteSuggestion) {
    const d = suggestion.data || {};
    const placeId = d.placeId as string;

    // Immediately fill what we have from autocomplete
    setFormData((prev) => ({
      ...prev,
      businessName: suggestion.label,
      city: (d.city as string) || prev.city,
      state: (d.state as string) || prev.state,
      url: (d.website as string) || prev.url,
      googleMapsUrl: (d.googleMapsUrl as string) || prev.googleMapsUrl,
    }));

    // If we have a placeId, fetch full details (website, phone, etc.)
    if (placeId) {
      try {
        const params = new URLSearchParams({
          placeId,
          sessionToken: businessSessionToken.current,
        });
        const res = await fetch(`/api/autocomplete/place-details?${params}`);
        if (res.ok) {
          const { details } = await res.json();
          if (details) {
            setFormData((prev) => ({
              ...prev,
              city: details.city || prev.city,
              state: details.state || prev.state,
              url: details.website || prev.url,
              googleMapsUrl: details.googleMapsUrl || prev.googleMapsUrl,
            }));
          }
        }
      } catch (err) {
        console.error("Place details fetch failed:", err);
      }

      // Rotate session token after place details call (billing session complete)
      businessSessionToken.current = generateSessionToken();
    }
  }

  // When a city is selected from autocomplete
  function handleCitySelect(suggestion: AutocompleteSuggestion) {
    const d = suggestion.data || {};
    setFormData((prev) => ({
      ...prev,
      city: (d.city as string) || suggestion.label.split(",")[0],
      state: (d.stateCode as string) || prev.state,
    }));
    // Rotate city session token
    citySessionToken.current = generateSessionToken();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.businessName.trim()) return;

    // Redirect instantly to loading page — no API wait
    const params = new URLSearchParams();
    params.set("businessName", formData.businessName.trim());
    if (formData.city) params.set("city", formData.city);
    if (formData.state) params.set("state", formData.state);
    if (formData.url) params.set("url", formData.url);
    if (formData.googleMapsUrl) params.set("googleMapsUrl", formData.googleMapsUrl);
    if (formData.customDirection) params.set("customDirection", formData.customDirection);

    router.push(`/audits/loading?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Business Audit</h1>
        <p className="text-muted-foreground mt-1">
          Start typing a business name — we&apos;ll find it on Google Maps and auto-fill the details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Business Details</CardTitle>
          <CardDescription>
            Search for a business or enter details manually. The more info you provide, the better the audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name — Autocomplete */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="businessName">
                Business Name <span className="text-destructive">*</span>
              </label>
              <AutocompleteInput
                id="businessName"
                placeholder="Start typing a business name..."
                value={formData.businessName}
                onChange={(val) => setFormData({ ...formData, businessName: val })}
                onSelect={handleBusinessSelect}
                fetchSuggestions={fetchBusinessSuggestions}
                icon={<Search className="h-4 w-4" />}
                required
                debounceMs={350}
                minChars={2}
              />
              <p className="text-xs text-muted-foreground">
                Select a result to auto-fill city, state, and website.
              </p>
            </div>

            {/* City + State */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="city">
                  City
                </label>
                <AutocompleteInput
                  id="city"
                  placeholder="e.g., Seattle"
                  value={formData.city}
                  onChange={(val) => setFormData({ ...formData, city: val })}
                  onSelect={handleCitySelect}
                  fetchSuggestions={fetchCitySuggestions}
                  icon={<MapPin className="h-4 w-4" />}
                  debounceMs={250}
                  minChars={2}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="state">
                  State
                </label>
                <Input
                  id="state"
                  placeholder="e.g., WA"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="url">
                Website URL <span className="text-muted-foreground text-xs">(auto-filled or enter manually)</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  className="pl-10"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
            </div>

            {/* Custom Direction */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="customDirection">
                Custom Research Direction <span className="text-muted-foreground text-xs">(Pro/Agency)</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="customDirection"
                  placeholder="e.g., Focus on their hiring patterns and growth signals..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent pl-10 pr-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.customDirection}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData({ ...formData, customDirection: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Auto-filled preview */}
            {(formData.city || formData.url) && formData.businessName && (
              <div className="rounded-lg bg-secondary/30 p-4 text-sm space-y-1">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Auto-filled Details
                </p>
                {formData.businessName && (
                  <p><span className="text-muted-foreground">Business:</span> {formData.businessName}</p>
                )}
                {formData.city && (
                  <p><span className="text-muted-foreground">Location:</span> {formData.city}{formData.state ? `, ${formData.state}` : ""}</p>
                )}
                {formData.url && (
                  <p><span className="text-muted-foreground">Website:</span> {formData.url}</p>
                )}
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={!formData.businessName.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Run Business Audit
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Uses 1 audit credit. Powered by Google Places and AI analysis.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
