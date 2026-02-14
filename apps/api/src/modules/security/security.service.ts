import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

// Interface compatível com o campo 'credentials' (Json) do Prisma
export interface EncryptedData {
  ciphertext: string;  // O token do MP cifrado
  encryptedDek: string; // A chave que cifrou o token, cifrada pela Master Key
  iv: string; // Vetor de inicialização (único por cifragem)
  tag: string; // Auth Tag do AES-GCM
  version: string; // Para rotação de chaves futura (v1)
}

@Injectable()
export class SecurityService implements OnModuleInit {
  private masterKey: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const keyHex = this.configService.get<string>('MASTER_KEY');
    
    if (!keyHex) {
      throw new Error('CRITICAL: MASTER_KEY environment variable is missing.');
    }

    if (keyHex.length !== 64) {
      throw new Error('CRITICAL: MASTER_KEY must be a 64-character hex string (32 bytes).');
    }

    this.masterKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Cifra um segredo usando Envelope Encryption.
   * 1. Gera uma DEK efêmera.
   * 2. Cifra o segredo com a DEK.
   * 3. Cifra a DEK com a KEK (Master Key).
   */
  encrypt(plaintext: string): EncryptedData {
    // 1. Gerar DEK (Data Encryption Key) - 32 bytes
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16); // IV para o payload

    // 2. Cifrar o payload com a DEK
    const cipher = crypto.createCipheriv(this.ALGORITHM, dek, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    // 3. Cifrar a DEK com a Master Key (KEK)
    // Usamos um novo IV para a DEK para maximizar a entropia, embora um IV fixo para KEK seja aceitável em alguns modelos, 
    // aqui optamos por aleatório para robustez total.
    const ivDek = crypto.randomBytes(16);
    const cipherDekBuffer = crypto.createCipheriv(this.ALGORITHM, this.masterKey, ivDek);
    
    // CORREÇÃO AQUI: Concatenamos os Buffers primeiro, depois convertemos para string
    const encryptedDekBuffer = Buffer.concat([
      cipherDekBuffer.update(dek),
      cipherDekBuffer.final()
    ]);
    
    const encryptedDekHex = encryptedDekBuffer.toString('hex');
    const dekTag = cipherDekBuffer.getAuthTag().toString('hex');
    // Formato de armazenamento da DEK cifrada: IV + TAG + Ciphertext (Concatenados para simplificar storage ou separado?)
    // O Blueprint pede campos separados no JSON[cite: 314], mas para a DEK interna, vamos compactar para caber em 'encryptedDek'.
    // Formato encryptedDek: iv(32hex):tag(32hex):ciphertext
    const packedEncryptedDek = `${ivDek.toString('hex')}:${dekTag}:${encryptedDekHex}`;

    return {
      ciphertext,
      encryptedDek: packedEncryptedDek,
      iv: iv.toString('hex'),
      tag,
      version: 'v1',
    };
  }

  /**
   * Decifra o segredo revertendo o processo.
   */
  decrypt(data: EncryptedData): string {
    // 1. Desempacotar e Decifrar a DEK
    const [ivDekHex, dekTagHex, encryptedDekHex] = data.encryptedDek.split(':');
    
    if (!ivDekHex || !dekTagHex || !encryptedDekHex) {
      throw new Error('SecurityService: Invalid Encrypted DEK format');
    }

    const decipherDek = crypto.createDecipheriv(this.ALGORITHM, this.masterKey, Buffer.from(ivDekHex, 'hex'));
    decipherDek.setAuthTag(Buffer.from(dekTagHex, 'hex'));
    
    const dekBuffer = Buffer.concat([
      decipherDek.update(Buffer.from(encryptedDekHex, 'hex')),
      decipherDek.final(),
    ]);

    // 2. Decifrar o payload usando a DEK recuperada
    const decipher = crypto.createDecipheriv(this.ALGORITHM, dekBuffer, Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

    let plaintext = decipher.update(data.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}