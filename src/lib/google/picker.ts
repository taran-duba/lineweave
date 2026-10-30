'use client';

import { getDriveToken } from './auth';
import { DRAWIO_MIME } from './drive';
import { loadScript } from './loadScript';

/* Minimal typings for the parts of the Google Picker API we use. */
interface PickerDoc {
  id: string;
  name: string;
}
interface PickerResult {
  action: string;
  docs?: PickerDoc[];
}
interface DocsView {
  setMimeTypes(m: string): DocsView;
  setQuery(q: string): DocsView;
  setOwnedByMe(v: boolean): DocsView;
  setIncludeFolders(v: boolean): DocsView;
  setMode(m: unknown): DocsView;
  setLabel(l: string): DocsView;
}
interface PickerApi {
  DocsView: new (viewId?: unknown) => DocsView;
  ViewId: { DOCS: unknown };
  DocsViewMode: { LIST: unknown };
  Action: { PICKED: string; CANCEL: string };
  PickerBuilder: new () => PickerBuilder;
}
interface PickerBuilder {
  addView(v: DocsView): PickerBuilder;
  setOAuthToken(t: string): PickerBuilder;
  setDeveloperKey(k: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(t: string): PickerBuilder;
  setCallback(fn: (r: PickerResult) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}
declare global {
  interface Window {
    gapi?: { load(name: string, cb: () => void): void };
  }
}

async function pickerApi(): Promise<PickerApi> {
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => window.gapi!.load('picker', resolve));
  return (window.google as unknown as { picker: PickerApi }).picker;
}

/**
 * Opens the Google Drive picker. Picking a file is what grants this app
 * (which only has the drive.file scope) access to files others shared.
 */
export async function pickDiagram(): Promise<PickerDoc | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER;
  if (!apiKey || !appId) throw new Error('Google Picker is not configured (NEXT_PUBLIC_GOOGLE_API_KEY / NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER).');
  const [picker, token] = await Promise.all([pickerApi(), getDriveToken()]);
  const mine = new picker.DocsView(picker.ViewId.DOCS).setQuery('.drawio').setIncludeFolders(false).setMode(picker.DocsViewMode.LIST);
  const shared = new picker.DocsView(picker.ViewId.DOCS)
    .setQuery('.drawio')
    .setOwnedByMe(false)
    .setMode(picker.DocsViewMode.LIST)
    .setLabel('Shared with me');
  const byType = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(DRAWIO_MIME).setLabel('All diagrams');

  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .addView(mine)
      .addView(shared)
      .addView(byType)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setTitle('Open a diagram')
      .setCallback((r) => {
        if (r.action === picker.Action.PICKED && r.docs?.[0]) resolve(r.docs[0]);
        else if (r.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
