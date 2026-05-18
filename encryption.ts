/**
 * End-to-End Encryption utility using Web Crypto API.
 */

class EncryptionService {
  private keyPair: CryptoKeyPair | null = null;

  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      "spki",
      this.keyPair.publicKey
    );
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      "pkcs8",
      this.keyPair.privateKey
    );

    return {
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))),
      privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer))),
    };
  }

  async importPublicKey(keyBase64: string): Promise<CryptoKey> {
    const binary = atob(keyBase64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return window.crypto.subtle.importKey(
      "spki",
      buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
  }

  async importPrivateKey(keyBase64: string): Promise<CryptoKey> {
    const binary = atob(keyBase64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return window.crypto.subtle.importKey(
      "pkcs8",
      buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
  }

  async encrypt(message: string, publicKeyBase64: string): Promise<string> {
    const publicKey = await this.importPublicKey(publicKeyBase64);
    const enc = new TextEncoder();
    const encodedMessage = enc.encode(message);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      encodedMessage
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  async decrypt(encryptedBase64: string, privateKey: CryptoKey): Promise<string> {
    const binary = atob(encryptedBase64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      buffer
    );
    return new TextDecoder().decode(decrypted);
  }
}

export const encryptionService = new EncryptionService();
