// Standard 10-band EQ frequencies (Hz)
export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

export const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|flac|m4a|aac|webm)$/i;

// crypto.randomUUID is only available in secure contexts (not plain-http LAN dev access)
export const generateId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
