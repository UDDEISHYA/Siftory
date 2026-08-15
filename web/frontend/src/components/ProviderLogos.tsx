/**
 * Inline SVG brand logos for database providers.
 * Avoids external image requests (CSP-safe).
 */

interface LogoProps {
  size?: number;
}

export function SnowflakeLogo({ size = 40 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="#29B5E8">
        {/* Center dot */}
        <circle cx="32" cy="32" r="4" />
        {/* 6 arms radiating outward */}
        <rect x="30" y="8" width="4" height="20" rx="2" />
        <rect x="30" y="36" width="4" height="20" rx="2" />
        <rect x="30" y="8" width="4" height="20" rx="2" transform="rotate(60 32 32)" />
        <rect x="30" y="36" width="4" height="20" rx="2" transform="rotate(60 32 32)" />
        <rect x="30" y="8" width="4" height="20" rx="2" transform="rotate(120 32 32)" />
        <rect x="30" y="36" width="4" height="20" rx="2" transform="rotate(120 32 32)" />
        {/* Branch tips */}
        <circle cx="32" cy="10" r="3" />
        <circle cx="32" cy="54" r="3" />
        <circle cx="12.94" cy="21" r="3" />
        <circle cx="51.06" cy="43" r="3" />
        <circle cx="12.94" cy="43" r="3" />
        <circle cx="51.06" cy="21" r="3" />
        {/* Short cross-branches */}
        <rect x="30" y="14" width="4" height="8" rx="2" transform="rotate(30 32 18)" />
        <rect x="30" y="14" width="4" height="8" rx="2" transform="rotate(-30 32 18)" />
        <rect x="30" y="42" width="4" height="8" rx="2" transform="rotate(30 32 46)" />
        <rect x="30" y="42" width="4" height="8" rx="2" transform="rotate(-30 32 46)" />
      </g>
    </svg>
  );
}

export function DatabricksLogo({ size = 40 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g fill="#FF3621">
        {/* Stacked diamond shape inspired by Databricks logo */}
        <path d="M32 6L54 20V28L32 42L10 28V20L32 6Z" opacity="0.9" />
        <path d="M10 28L32 42L54 28V36L32 50L10 36V28Z" opacity="0.7" />
        <path d="M10 36L32 50L54 36V44L32 58L10 44V36Z" opacity="0.5" />
      </g>
    </svg>
  );
}

export function PostgresLogo({ size = 40 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        {/* Elephant head shape — simplified PostgreSQL logo */}
        <path
          d="M44 18C44 12.48 38.63 8 32 8C25.37 8 20 12.48 20 18C20 20.5 21 22.8 22.7 24.5C21.5 26.3 20 29 20 32C20 38 24 42 28 44L28 52C28 54.2 29.8 56 32 56C34.2 56 36 54.2 36 52L36 46C38 45 40 43.5 41.5 41.5C43 39.5 44 37 44 34C44 31 43 28.5 41.5 26.5C43 24.8 44 22.5 44 20V18Z"
          fill="#336791"
        />
        {/* Eye */}
        <circle cx="30" cy="18" r="2.5" fill="white" />
        <circle cx="30" cy="18" r="1.2" fill="#336791" />
        {/* Trunk curve */}
        <path
          d="M36 26C38 28 39 30 39 33C39 36 37 38.5 35 40"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Ear */}
        <path
          d="M38 14C40 12 43 12 44 14C45 16 44 18 42 19"
          stroke="#336791"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="#2A5A7B"
        />
      </g>
    </svg>
  );
}
