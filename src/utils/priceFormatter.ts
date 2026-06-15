// crteate price formatter
export const priceFormatter = (price: number, currency?: "UZS" | "USD") => {
    return price.toLocaleString("uz-Latn-UZ") + " " + (currency || "UZS");
}