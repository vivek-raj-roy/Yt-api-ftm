import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class Encoder {
  static ALGORITHM = 'aes-256-gcm';
  static SECRET_KEY = process.env.ENCRYPTION_SECRET || 'ytmp3-converter-secret-key-2024';
  
  static getKey() {
    return createHash('sha256').update(this.SECRET_KEY).digest();
  }

  static enc({ data, method }) {
    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
      const key = this.getKey();
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine iv + authTag + encrypted data
      const combined = iv.toString('hex') + authTag.toString('hex') + encrypted;
      const uuid = Buffer.from(JSON.stringify({ data: combined, method })).toString('base64');
      
      return { uuid };
    } catch (error) {
      console.error('[ERROR] Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  static dec({ uuid, method }) {
    try {
      const decoded = JSON.parse(Buffer.from(uuid, 'base64').toString('utf8'));
      const combined = decoded.data;
      
      // Extract iv (32 chars), authTag (32 chars), and encrypted data
      const iv = Buffer.from(combined.slice(0, 32), 'hex');
      const authTag = Buffer.from(combined.slice(32, 64), 'hex');
      const encrypted = combined.slice(64);
      
      const key = this.getKey();
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const parsedData = JSON.parse(decrypted);
      return { text: parsedData };
    } catch (error) {
      console.error('[ERROR] Decryption failed:', error);
      throw new Error('Invalid or corrupted task ID');
    }
  }
}

export default Encoder;