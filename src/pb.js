import PocketBase from 'pocketbase';

// Используем URL из переменных окружения
const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || '/');

export default pb;