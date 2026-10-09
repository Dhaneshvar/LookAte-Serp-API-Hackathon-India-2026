import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Banknote, BedDouble, Beer, Building2, Cake, Church, Coffee, Dumbbell, Film, Fuel, GraduationCap, Home,
  Hospital, Landmark, MapPin, Pill, Scissors, Shirt, ShoppingBag, ShoppingCart, Store, TreePine, Utensils, Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PlaceKind {
  key: string;
  label: string;
  color: string;
  Icon: LucideIcon;
}

const K = (key: string, label: string, color: string, Icon: LucideIcon): PlaceKind => ({ key, label, color, Icon });

// Order matters: the first matching rule wins.
const RULES: [RegExp, PlaceKind][] = [
  [/petrol|gas station|fuel|filling station|\bcng\b|ev charging/, K('fuel', 'Fuel station', '#ca8a04', Fuel)],
  [/pharmacy|chemist|drug ?store|medical shop/, K('pharmacy', 'Pharmacy', '#dc2626', Pill)],
  [/hospital|clinic|medical|doctor|dental|healthcare|nursing home/, K('hospital', 'Hospital', '#dc2626', Hospital)],
  [/shopping (mall|centre|center|complex)|\bmall\b|marketcity|department store/, K('mall', 'Shopping mall', '#7c3aed', ShoppingBag)],
  [/supermarket|grocery|hypermarket|dmart|\bmart\b|convenience|kirana/, K('grocery', 'Supermarket', '#16a34a', ShoppingCart)],
  [/salon|\bspa\b|beauty|barber|parlou?r|unisex/, K('salon', 'Salon and spa', '#db2777', Scissors)],
  [/bakery|dessert|ice cream|sweet/, K('bakery', 'Bakery', '#ea580c', Cake)],
  [/cafe|coffee|tea (house|stall|shop)/, K('cafe', 'Cafe', '#b45309', Coffee)],
  [/restaurant|eatery|diner|dhaba|biryani|dosa|tiffin|food|kitchen|bhavan|canteen|pizza|burger|mess\b|grill/, K('food', 'Restaurant', '#ea580c', Utensils)],
  [/\bbar\b|\bpub\b|brewery|brewpub|lounge/, K('bar', 'Bar', '#d97706', Beer)],
  [/hotel|resort|lodg|hostel|guest ?house|\binn\b|homestay/, K('hotel', 'Hotel', '#0d9488', BedDouble)],
  [/apartment|residen|real estate|\bhouse\b|villa|\bpg\b|housing|\bflat/, K('home', 'Home', '#0284c7', Home)],
  [/church|cathedral|basilica/, K('church', 'Church', '#b45309', Church)],
  [/temple|mosque|ashram|shrine|gurudwara|monastery/, K('temple', 'Place of worship', '#b45309', Landmark)],
  [/museum|monument|heritage|\bfort\b|palace|memorial|landmark|tourist attraction|gallery/, K('landmark', 'Landmark', '#b45309', Landmark)],
  [/beach|seashore|coast/, K('beach', 'Beach', '#0891b2', Waves)],
  [/\bpark\b|garden|\blake\b|nature|\bzoo\b|trail|forest/, K('park', 'Park', '#15803d', TreePine)],
  [/school|college|university|institute|academy/, K('school', 'School or college', '#4f46e5', GraduationCap)],
  [/\bbank\b|\batm\b/, K('bank', 'Bank', '#0f766e', Banknote)],
  [/\bgym\b|fitness|yoga/, K('gym', 'Gym', '#e11d48', Dumbbell)],
  [/cinema|theatre|theater|multiplex|\bpvr\b/, K('cinema', 'Cinema', '#6d28d9', Film)],
  [/clothing|apparel|boutique|fashion|saree|tailor|garment/, K('clothes', 'Clothing store', '#c026d3', Shirt)],
  [/store|shop|market|bazaar|showroom|retail|supplier/, K('shop', 'Shop', '#c026d3', Store)],
  [/office|company|business|corporate/, K('office', 'Business', '#475569', Building2)],
];

const DEFAULT_KIND = K('place', 'Place', '#2563eb', MapPin);

function match(text: string): PlaceKind | null {
  for (const [re, kind] of RULES) if (re.test(text)) return kind;
  return null;
}

export function kindOf(place: { category?: string; title?: string }, hint = ''): PlaceKind {
  const own = `${place.category || ''} ${place.title || ''}`.toLowerCase();
  return match(own) || (hint && match(hint.toLowerCase())) || DEFAULT_KIND;
}

const svgCache = new Map<string, string>();

export function kindSvg(kind: PlaceKind, size = 18): string {
  const key = `${kind.key}-${size}`;
  let svg = svgCache.get(key);
  if (!svg) {
    svg = renderToStaticMarkup(<kind.Icon size={size} color="#ffffff" strokeWidth={2.4} />);
    svgCache.set(key, svg);
  }
  return svg;
}
