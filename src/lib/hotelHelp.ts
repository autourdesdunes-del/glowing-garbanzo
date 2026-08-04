import { HotelReference } from "@/lib/types";

export function matchHotel(hotelName: string, hotels: HotelReference[]): HotelReference | null {
  const clean = hotelName.trim().toLowerCase();
  if (!clean) return null;
  return hotels.find((h) => h.nom.trim().toLowerCase() === clean) || null;
}
