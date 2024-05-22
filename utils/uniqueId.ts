import { customAlphabet } from "nanoid";

const alphabet = "123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const uniqueId = (length: number = 13) => customAlphabet(alphabet, length)();

export { uniqueId };
