import type { AppSettings } from '../models/types';

export type ShopPrintProfile = {
  shopName: string;
  shopLogo?: string;
  shopPhone?: string;
  shopAddress?: string;
};

type AuthShopSource = {
  shopName?: string;
  phone?: string;
} | null | undefined;

export function resolveShopPrintProfile(
  settings?: Partial<AppSettings> | null,
  authUser?: AuthShopSource,
): ShopPrintProfile {
  return {
    shopName: settings?.shopName?.trim() || authUser?.shopName?.trim() || 'Chai Khata',
    shopLogo: settings?.shopLogo,
    shopPhone: settings?.shopPhone?.trim() || authUser?.phone?.trim(),
    shopAddress: settings?.shopAddress?.trim(),
  };
}

export function formatShopContact(profile: ShopPrintProfile): string {
  return [profile.shopPhone, profile.shopAddress].filter(Boolean).join(' · ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPrintHeaderHtml(profile: ShopPrintProfile): string {
  const contact = formatShopContact(profile);
  const logo = profile.shopLogo
    ? `<img src="${profile.shopLogo}" alt="" class="print-logo" />`
    : '';
  return `<div class="print-header">
  ${logo}
  <div class="print-header-text">
    <h1>${escapeHtml(profile.shopName)}</h1>
    ${contact ? `<p class="print-contact">${escapeHtml(contact)}</p>` : ''}
  </div>
</div>`;
}

export function logoImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'PNG';
}
