"""Archive Cryptography Service.

Provides AES-256-GCM encryption and authenticated decryption for portable Schema 2.2
syllabus archives using PBKDF2-HMAC-SHA256 key derivation.
"""

import base64
import json
import os
from typing import Any, Dict

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

FORMAT_IDENTIFIER = "syllabus-tracker-encrypted-archive"
CURRENT_VERSION = "1.0"
KDF_IDENTIFIER = "PBKDF2-HMAC-SHA256"
CIPHER_IDENTIFIER = "AES-256-GCM"
REQUIRED_ITERATIONS = 600_000
DERIVED_KEY_LENGTH = 32  # 256 bits
SALT_LENGTH = 16  # 16 bytes
NONCE_LENGTH = 12  # 96 bits recommended for AES-GCM
TAG_LENGTH = 16  # 128-bit authentication tag

MIN_PASSPHRASE_LENGTH = 4
MAX_PASSPHRASE_LENGTH = 1024
MAX_CIPHERTEXT_SIZE = 50 * 1024 * 1024  # 50 MB defensive limit


class ArchiveDecryptionError(Exception):
    """Raised when archive decryption fails due to invalid passphrase, tampering, or malformed envelope."""
    pass


def build_authenticated_data(format_id: str, version: str, kdf: str, iterations: int, cipher: str) -> bytes:
    """Build canonical Associated Authenticated Data (AAD) for AES-GCM verification."""
    canonical_aad = f"{format_id}|{version}|{kdf}|{iterations}|{cipher}"
    return canonical_aad.encode("utf-8")


def is_encrypted_archive(payload: Any) -> bool:
    """Check whether a dictionary payload matches the encrypted archive envelope contract."""
    if not isinstance(payload, dict):
        return False
    return (
        payload.get("format") == FORMAT_IDENTIFIER
        and "ciphertext_b64" in payload
        and "salt_b64" in payload
        and "nonce_b64" in payload
    )


def derive_key(passphrase: str, salt: bytes, iterations: int = REQUIRED_ITERATIONS) -> bytes:
    """Derive a 256-bit AES key from passphrase and salt using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=SHA256(),
        length=DERIVED_KEY_LENGTH,
        salt=salt,
        iterations=iterations,
    )
    # Passphrase bytes preserved exactly without silent modification
    return kdf.derive(passphrase.encode("utf-8"))


def encrypt_archive_payload(plaintext_json: str, passphrase: str) -> Dict[str, Any]:
    """
    Encrypt a UTF-8 JSON archive string using AES-256-GCM with a PBKDF2-HMAC-SHA256 derived key.
    
    Returns a versioned, self-describing encrypted envelope dictionary.
    """
    if not isinstance(plaintext_json, str) or not plaintext_json:
        raise ValueError("Plaintext JSON payload must be a non-empty string")

    if not isinstance(passphrase, str) or not passphrase.strip():
        raise ValueError("Passphrase must not be empty or whitespace only")

    if len(passphrase.strip()) < MIN_PASSPHRASE_LENGTH:
        raise ValueError(f"Passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters")

    if len(passphrase) > MAX_PASSPHRASE_LENGTH:
        raise ValueError(f"Passphrase exceeds maximum length of {MAX_PASSPHRASE_LENGTH} characters")

    # Generate fresh cryptographically secure random salt and nonce
    salt = os.urandom(SALT_LENGTH)
    nonce = os.urandom(NONCE_LENGTH)

    # Derive key and authenticate envelope metadata
    key = derive_key(passphrase, salt, REQUIRED_ITERATIONS)
    aad = build_authenticated_data(
        format_id=FORMAT_IDENTIFIER,
        version=CURRENT_VERSION,
        kdf=KDF_IDENTIFIER,
        iterations=REQUIRED_ITERATIONS,
        cipher=CIPHER_IDENTIFIER,
    )

    aesgcm = AESGCM(key)
    plaintext_bytes = plaintext_json.encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, aad)

    return {
        "format": FORMAT_IDENTIFIER,
        "version": CURRENT_VERSION,
        "kdf": KDF_IDENTIFIER,
        "iterations": REQUIRED_ITERATIONS,
        "salt_b64": base64.b64encode(salt).decode("ascii"),
        "cipher": CIPHER_IDENTIFIER,
        "nonce_b64": base64.b64encode(nonce).decode("ascii"),
        "ciphertext_b64": base64.b64encode(ciphertext).decode("ascii"),
    }


def decrypt_archive_payload(envelope: Dict[str, Any], passphrase: str) -> str:
    """
    Authenticate and decrypt an encrypted archive envelope into its plaintext JSON string.
    
    Raises ArchiveDecryptionError on wrong passphrase, tampering, or malformed envelope.
    """
    if not isinstance(envelope, dict):
        raise ArchiveDecryptionError("Envelope must be a dictionary")

    if not isinstance(passphrase, str) or not passphrase:
        raise ArchiveDecryptionError("Passphrase is required to decrypt this archive")

    # 1. Validate envelope metadata
    format_id = envelope.get("format")
    if format_id != FORMAT_IDENTIFIER:
        raise ArchiveDecryptionError(f"Unsupported format identifier: '{format_id}'")

    version = envelope.get("version")
    if version != CURRENT_VERSION:
        raise ArchiveDecryptionError(f"Unsupported envelope version: '{version}'")

    kdf = envelope.get("kdf")
    if kdf != KDF_IDENTIFIER:
        raise ArchiveDecryptionError(f"Unsupported KDF: '{kdf}'")

    iterations = envelope.get("iterations")
    if iterations != REQUIRED_ITERATIONS:
        raise ArchiveDecryptionError(f"Unsupported iteration count: '{iterations}'")

    cipher = envelope.get("cipher")
    if cipher != CIPHER_IDENTIFIER:
        raise ArchiveDecryptionError(f"Unsupported cipher: '{cipher}'")

    salt_b64 = envelope.get("salt_b64")
    nonce_b64 = envelope.get("nonce_b64")
    ciphertext_b64 = envelope.get("ciphertext_b64")

    if not salt_b64 or not nonce_b64 or not ciphertext_b64:
        raise ArchiveDecryptionError("Envelope is missing required cryptographic fields")

    # 2. Decode Base64 fields
    try:
        salt = base64.b64decode(salt_b64, validate=True)
    except Exception:
        raise ArchiveDecryptionError("Invalid base64 encoding in salt")

    try:
        nonce = base64.b64decode(nonce_b64, validate=True)
    except Exception:
        raise ArchiveDecryptionError("Invalid base64 encoding in nonce")

    try:
        ciphertext = base64.b64decode(ciphertext_b64, validate=True)
    except Exception:
        raise ArchiveDecryptionError("Invalid base64 encoding in ciphertext")

    if len(salt) != SALT_LENGTH:
        raise ArchiveDecryptionError(f"Invalid salt length: expected {SALT_LENGTH} bytes, got {len(salt)}")

    if len(nonce) != NONCE_LENGTH:
        raise ArchiveDecryptionError(f"Invalid nonce length: expected {NONCE_LENGTH} bytes, got {len(nonce)}")

    if len(ciphertext) < TAG_LENGTH:
        raise ArchiveDecryptionError("Ciphertext too short to contain authentication tag")

    if len(ciphertext) > MAX_CIPHERTEXT_SIZE:
        raise ArchiveDecryptionError("Ciphertext exceeds maximum supported size limit")

    # 3. Derive key and reconstruct AAD
    key = derive_key(passphrase, salt, iterations)
    aad = build_authenticated_data(
        format_id=format_id,
        version=version,
        kdf=kdf,
        iterations=iterations,
        cipher=cipher,
    )

    # 4. Decrypt and authenticate
    aesgcm = AESGCM(key)
    try:
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
    except Exception:
        # Generic constant-time failure to prevent oracle attacks
        raise ArchiveDecryptionError("INVALID_PASSPHRASE_OR_CORRUPT_ARCHIVE")

    try:
        plaintext_str = plaintext_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise ArchiveDecryptionError("Decrypted payload is not valid UTF-8")

    # Validate that decrypted plaintext is valid JSON
    try:
        json.loads(plaintext_str)
    except Exception:
        raise ArchiveDecryptionError("Decrypted payload is not valid JSON")

    return plaintext_str
