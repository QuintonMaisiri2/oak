import { partners, type Partner } from "./data";

// Until the directory migration is applied, use the reviewed import file.
export async function getPartners(): Promise<Partner[]> {
  return partners;
}
