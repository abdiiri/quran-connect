export interface ArabicLetter {
  id: number;
  letter: string;
  name: string;
  transliteration: string;
  exampleWord: string;
  exampleMeaning: string;
}

export const arabicAlphabet: ArabicLetter[] = [
  { id: 1, letter: "ا", name: "Alif", transliteration: "a", exampleWord: "أَسَد", exampleMeaning: "Lion" },
  { id: 2, letter: "ب", name: "Ba", transliteration: "b", exampleWord: "بَاب", exampleMeaning: "Door" },
  { id: 3, letter: "ت", name: "Ta", transliteration: "t", exampleWord: "تُفَّاح", exampleMeaning: "Apple" },
  { id: 4, letter: "ث", name: "Tha", transliteration: "th", exampleWord: "ثَعْلَب", exampleMeaning: "Fox" },
  { id: 5, letter: "ج", name: "Jim", transliteration: "j", exampleWord: "جَمَل", exampleMeaning: "Camel" },
  { id: 6, letter: "ح", name: "Ha", transliteration: "ḥ", exampleWord: "حِصَان", exampleMeaning: "Horse" },
  { id: 7, letter: "خ", name: "Kha", transliteration: "kh", exampleWord: "خُبْز", exampleMeaning: "Bread" },
  { id: 8, letter: "د", name: "Dal", transliteration: "d", exampleWord: "دَار", exampleMeaning: "House" },
  { id: 9, letter: "ذ", name: "Dhal", transliteration: "dh", exampleWord: "ذَهَب", exampleMeaning: "Gold" },
  { id: 10, letter: "ر", name: "Ra", transliteration: "r", exampleWord: "رَجُل", exampleMeaning: "Man" },
  { id: 11, letter: "ز", name: "Zay", transliteration: "z", exampleWord: "زَهْرَة", exampleMeaning: "Flower" },
  { id: 12, letter: "س", name: "Sin", transliteration: "s", exampleWord: "سَمَاء", exampleMeaning: "Sky" },
  { id: 13, letter: "ش", name: "Shin", transliteration: "sh", exampleWord: "شَمْس", exampleMeaning: "Sun" },
  { id: 14, letter: "ص", name: "Sad", transliteration: "ṣ", exampleWord: "صَبَاح", exampleMeaning: "Morning" },
  { id: 15, letter: "ض", name: "Dad", transliteration: "ḍ", exampleWord: "ضَوْء", exampleMeaning: "Light" },
  { id: 16, letter: "ط", name: "Taa", transliteration: "ṭ", exampleWord: "طَائِر", exampleMeaning: "Bird" },
  { id: 17, letter: "ظ", name: "Dhaa", transliteration: "ẓ", exampleWord: "ظِلّ", exampleMeaning: "Shadow" },
  { id: 18, letter: "ع", name: "Ayn", transliteration: "ʿ", exampleWord: "عَيْن", exampleMeaning: "Eye" },
  { id: 19, letter: "غ", name: "Ghayn", transliteration: "gh", exampleWord: "غُرَاب", exampleMeaning: "Crow" },
  { id: 20, letter: "ف", name: "Fa", transliteration: "f", exampleWord: "فِيل", exampleMeaning: "Elephant" },
  { id: 21, letter: "ق", name: "Qaf", transliteration: "q", exampleWord: "قَمَر", exampleMeaning: "Moon" },
  { id: 22, letter: "ك", name: "Kaf", transliteration: "k", exampleWord: "كِتَاب", exampleMeaning: "Book" },
  { id: 23, letter: "ل", name: "Lam", transliteration: "l", exampleWord: "لَيْل", exampleMeaning: "Night" },
  { id: 24, letter: "م", name: "Mim", transliteration: "m", exampleWord: "مَاء", exampleMeaning: "Water" },
  { id: 25, letter: "ن", name: "Nun", transliteration: "n", exampleWord: "نَجْم", exampleMeaning: "Star" },
  { id: 26, letter: "ه", name: "Ha", transliteration: "h", exampleWord: "هِلَال", exampleMeaning: "Crescent" },
  { id: 27, letter: "و", name: "Waw", transliteration: "w", exampleWord: "وَرْد", exampleMeaning: "Rose" },
  { id: 28, letter: "ي", name: "Ya", transliteration: "y", exampleWord: "يَدّ", exampleMeaning: "Hand" },
];
