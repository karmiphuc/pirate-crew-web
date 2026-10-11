import type { ItemKind } from "../sim/items";

// Small original UI rasters expressed as integer SVG rectangles; no game textures.
const icons: Record<ItemKind | "cutlass", string> = {
  cutlass:
    '<path fill="#20383c" d="M22 2h4v7l-3 4h-4v4h-5v4h-3v5H6v-4H3v-5h5v-4h5V9h5V5z"/><path fill="#a7bcb7" d="M22 4h2v5l-3 3h-4v4h-5v2h-2v-4h5v-4h5V6z"/><path fill="#ead7a6" d="M5 17h4v2h3v3H9v-2H5z"/><path fill="#965d43" d="M7 21h3v3H7z"/>',
  boots:
    '<path fill="#20383c" d="M4 3h9v12h3v7H2V12h2zM17 3h9v15h2v7H15V14h2z"/><path fill="#9c6243" d="M6 5h5v12h3v3H4v-6h2zM19 5h5v15h2v3h-9v-7h2z"/><path fill="#d4a765" d="M6 6h5v2H6zM19 6h5v2h-5z"/><path fill="#465456" d="M4 20h10v2H4zM17 23h9v2h-9z"/>',
  diaper:
    '<path fill="#20383c" d="M3 4h22v11h-3v6h-3v3H9v-3H6v-6H3z"/><path fill="#e5dcb6" d="M5 6h18v8h-3v6h-3v2h-6v-2H8v-6H5z"/><path fill="#c7c4a1" d="M8 14h4v6h-2v-4H8zM16 14h4v2h-2v4h-2z"/><path fill="#87a996" d="M5 8h4v3H5zM19 8h4v3h-4z"/>',
  rum: '<path fill="#20383c" d="M10 2h8v7h4v16H6V9h4z"/><path fill="#879f86" d="M12 6h4v5h4v12H8V11h4z"/><path fill="#ad7348" d="M8 14h12v9H8z"/><path fill="#e7d5a3" d="M8 16h12v5H8zM10 2h8v3h-8z"/><path fill="#f5edc5" d="M10 11h2v3h-2z"/>',
  elixir:
    '<path fill="#20383c" d="M10 2h8v6h4v4h2v11h-3v3H7v-3H4V12h2V8h4z"/><path fill="#aac4b0" d="M12 7h4v4h4v3h2v8h-3v2H9v-2H6v-8h2v-3h4z"/><path fill="#4a9991" d="M6 16h16v6h-3v2H9v-2H6z"/><path fill="#bd6a54" d="M10 2h8v4h-8z"/><path fill="#f2e8c1" d="M8 13h3v3H8zM12 18h4v2h-4z"/>',
  boneMeal:
    '<path fill="#20383c" d="M7 3h14v5l3 8v8H4v-8l3-8z"/><path fill="#b49a66" d="M9 5h10v5l3 7v5H6v-5l3-7z"/><path fill="#e8d5a3" d="M9 14h3v2h4v-2h3v3h-3v2h-4v-2H9z"/><path fill="#735747" d="M8 8h12v2H8zM7 21h14v2H7z"/>',
  feather:
    '<path fill="#20383c" d="M18 2h8v8h-3v5h-4v4h-5v3h-4v4H6v-4h3v-5h3v-5h3V7h3z"/><path fill="#e3d4a7" d="M19 4h5v5h-3v5h-4v3h-4v3h-2v-5h3v-5h3V7h2z"/><path fill="#9fa591" d="M21 6h2v3h-3v4h-4v4h-3v3h-3v4H8v-3h3v-4h3v-4h4V9h3z"/>',
  sabre:
    '<path fill="#20383c" d="M22 2h4v6l-3 3v4h-4v4h-4v3h-4v4H6v-4H3v-4h5v-4h4v-4h4V6z"/><path fill="#b7c3b2" d="M22 4h2v4h-3v4h-4v4h-4v2h-3v-3h4v-4h4V7z"/><path fill="#f0e3bb" d="M22 4h2v2h-4v4h-4v4h-3v-2h2V8h4V5z"/><path fill="#d1a05c" d="M5 17h4v2h3v3H9v-2H5z"/><path fill="#9c6045" d="M7 21h3v3H7z"/>',
  pistol:
    '<path fill="#20383c" d="M4 8h21v9H13v3h-2v6H4v-9H2v-7h2z"/><path fill="#8ca2a0" d="M5 10h18v5H5z"/><path fill="#cfbc91" d="M6 10h15v2H6z"/><path fill="#9d6445" d="M4 16h8v3H9v5H6v-6H4z"/><path fill="#d0a25e" d="M12 16h3v3h-3z"/><path fill="#314a4c" d="M21 10h2v5h-2z"/>',
};
export function itemIcon(kind: ItemKind | "cutlass") {
  return `<svg class="item-icon" viewBox="0 0 28 28" aria-hidden="true" shape-rendering="crispEdges">${icons[kind]}</svg>`;
}
