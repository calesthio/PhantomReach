import { NextRequest, NextResponse } from "next/server";
import {
  deleteSecret,
  setSecret,
  type LocalSecretKey,
} from "@/lib/config/local-secrets";
import { getProviderDefinition } from "@/lib/config/provider-config";

interface RouteContext {
  params: Promise<{ key: string }>;
}

async function resolveDefinition(context: RouteContext) {
  const { key } = await context.params;
  const definition = getProviderDefinition(key as LocalSecretKey);
  return { key, definition };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { key, definition } = await resolveDefinition(context);
  if (!definition) {
    return NextResponse.json({ error: `Unknown data source: ${key}` }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  if (!value) {
    return NextResponse.json({ error: "Enter a key before saving." }, { status: 400 });
  }

  await setSecret(definition.key, definition.label, definition.provider, value);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { key, definition } = await resolveDefinition(context);
  if (!definition) {
    return NextResponse.json({ error: `Unknown data source: ${key}` }, { status: 404 });
  }

  await deleteSecret(definition.key);
  return NextResponse.json({ ok: true });
}
