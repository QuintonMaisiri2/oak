import entries from "./partners.json";

export interface Partner {
  id: string;
  name: string;
  description: string;
  website: string;
  logo?: string;
  programmes?: {
    area: string;
    subprogrammes: string[];
  }[];
  contacts?: {
    id: string;
    name: string;
    role: string;
    email: string;
    phone?: string;
  }[];
}

export const partners: Partner[] = entries;
