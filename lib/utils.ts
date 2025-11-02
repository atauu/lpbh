/**
 * İsim girişlerini normalize et - Baş harfler büyük, gerisi küçük
 * Örnek: "jOHN dOE" -> "John Doe"
 * Örnek: "İBRAHİM" -> "İbrahim"
 * Örnek: "ahmet mehmet" -> "Ahmet Mehmet"
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  if (!trimmed) return null;
  
  // Kelimelere ayır
  const words = trimmed.split(/\s+/);
  
  // Her kelimenin ilk harfini büyük, gerisini küçük yap
  const normalized = words.map(word => {
    if (!word) return '';
    
    // İlk harf büyük, gerisi küçük
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  // Kelimeleri tekrar birleştir
  return normalized.join(' ');
}

/**
 * String'i capitalize et - Sadece ilk harfi büyük yap
 */
export function capitalize(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}


