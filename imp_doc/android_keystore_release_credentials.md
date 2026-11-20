# Android Release Keystore & Build Environment Reference

This document outlines the configuration, environment variable mapping, verified commands, and checksums for signing and verifying production release artifacts (`.apk` and `.aab`) for the **Hierarchical Syllabus Checklist & Progress Tracker**.

> [!IMPORTANT]
> Sensitive credentials (passwords, keystore locations) are stored locally in `.env` (which is excluded from Git via `.gitignore`). Never commit plain passwords or private keystores to version control.

---

## 1. Environment Variables Configuration

Configure the following variables in your local `.env` file (or export them in your PowerShell process):

| Environment Variable | Description | Reference / Value |
| :--- | :--- | :--- |
| `ANDROID_KEYSTORE_PATH` | Path to your `.jks` keystore file | Configured in `.env` (`$env:ANDROID_KEYSTORE_PATH`) |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore | Configured in `.env` (`$env:ANDROID_KEYSTORE_PASSWORD`) |
| `ANDROID_KEY_ALIAS` | Keypair alias name | `syllabus-key` (`$env:ANDROID_KEY_ALIAS`) |
| `ANDROID_KEY_PASSWORD` | Password for the private key | Configured in `.env` (`$env:ANDROID_KEY_PASSWORD`) |
| `ANDROID_BUILD_TOOLS_DIR` | Path to Android SDK Build-Tools | `$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0` |
| `ANDROID_APK_RELEASE_DIR` | Directory containing release APKs | `frontend\android\app\build\outputs\apk\release` |
| `ANDROID_RELEASE_APK_NAME` | Final signed release APK filename | `SyllabusTracker-v1.0.0-release.apk` |
| `ANDROID_AAB_RELEASE_DIR` | Directory containing release AABs | `frontend\android\app\build\outputs\bundle\release` |
| `ANDROID_RELEASE_AAB_NAME` | Final signed release AAB filename | `SyllabusTracker-v1.0.0-release.aab` |

---

## 2. Java & Toolchain Environment Setup

Run these commands in PowerShell prior to signing or running `keytool` / `apksigner` / `jarsigner` / Gradle builds:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

To load variables from your local `.env` directly into your PowerShell session:
```powershell
Get-Content .env | Where-Object { $_ -match '^([^#=]+)=(.*)$' } | ForEach-Object {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
}
```

---

## 3. Keystore Specifications

| Property | Value / Reference |
| :--- | :--- |
| **Keystore File Location** | `$env:ANDROID_KEYSTORE_PATH` |
| **Keystore Type** | JKS / PKCS12 |
| **Key Alias** | `$env:ANDROID_KEY_ALIAS` (`syllabus-key`) |
| **Keystore Password** | `$env:ANDROID_KEYSTORE_PASSWORD` |
| **Key Password** | `$env:ANDROID_KEY_PASSWORD` |
| **Algorithm** | RSA 2048-bit (`SHA384withRSA`) |
| **Validity** | 10,000 days |
| **Certificate Owner (DN)** | `CN=Farhan Ahmad, OU=Z's Verse, O=Unknown, L=Kolkata, ST=West Bengal, C=In` |

---

## 4. Production Release APK Signing & Verification Workflow

This 3-step workflow was executed and verified for production release `v1.0.0`.

### Step 1: Align Unsigned APK on 4-Byte Boundaries (`zipalign`)
```powershell
& "$env:ANDROID_BUILD_TOOLS_DIR\zipalign.exe" -v -p 4 `
  "$env:ANDROID_APK_RELEASE_DIR\app-release-unsigned.apk" `
  "$env:ANDROID_APK_RELEASE_DIR\app-release-aligned.apk"
```

### Step 2: Sign Aligned APK with Keystore (`apksigner`)
```powershell
& "$env:ANDROID_BUILD_TOOLS_DIR\apksigner.bat" sign `
  --ks "$env:ANDROID_KEYSTORE_PATH" `
  --ks-key-alias "$env:ANDROID_KEY_ALIAS" `
  --ks-pass "pass:$env:ANDROID_KEYSTORE_PASSWORD" `
  --key-pass "pass:$env:ANDROID_KEY_PASSWORD" `
  --out "$env:ANDROID_APK_RELEASE_DIR\$env:ANDROID_RELEASE_APK_NAME" `
  "$env:ANDROID_APK_RELEASE_DIR\app-release-aligned.apk"
```
*(Alternatively, omit `--ks-pass` / `--key-pass` to enter passwords securely when prompted).*

### Step 3: Verify Signatures & Compute SHA-256 Checksum
```powershell
# Verify multi-scheme signatures
& "$env:ANDROID_BUILD_TOOLS_DIR\apksigner.bat" verify --verbose `
  "$env:ANDROID_APK_RELEASE_DIR\$env:ANDROID_RELEASE_APK_NAME"

# Compute Release SHA-256 Checksum
Get-FileHash -Algorithm SHA256 "$env:ANDROID_APK_RELEASE_DIR\$env:ANDROID_RELEASE_APK_NAME"
```

---

## 5. Production Release App Bundle (AAB) Signing & Verification Workflow

Google Play submissions require the Android App Bundle format signed using `jarsigner`.

### Step 1: Prepare Release Bundle Target
```powershell
Copy-Item "$env:ANDROID_AAB_RELEASE_DIR\app-release.aab" `
  "$env:ANDROID_AAB_RELEASE_DIR\$env:ANDROID_RELEASE_AAB_NAME" -Force
```

### Step 2: Sign App Bundle (`jarsigner`)
```powershell
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
  -keystore "$env:ANDROID_KEYSTORE_PATH" `
  -storepass "$env:ANDROID_KEYSTORE_PASSWORD" `
  -keypass "$env:ANDROID_KEY_PASSWORD" `
  "$env:ANDROID_AAB_RELEASE_DIR\$env:ANDROID_RELEASE_AAB_NAME" `
  "$env:ANDROID_KEY_ALIAS"
```
*(Alternatively, omit `-storepass` / `-keypass` to enter passwords interactively).*

### Step 3: Verify Bundle Signatures & Certificates
```powershell
# Verify signature integrity and certificate chain
jarsigner -verify -verbose -certs `
  "$env:ANDROID_AAB_RELEASE_DIR\$env:ANDROID_RELEASE_AAB_NAME"

# Compute Release SHA-256 Checksum
Get-FileHash -Algorithm SHA256 "$env:ANDROID_AAB_RELEASE_DIR\$env:ANDROID_RELEASE_AAB_NAME"
```

---

## 6. Verified Release Artifacts Integrity Matrix (v1.0.0)

| Metadata Attribute | Production APK (`.apk`) | Production App Bundle (`.aab`) |
| :--- | :--- | :--- |
| **Release Artifact** | `SyllabusTracker-v1.0.0-release.apk` | `SyllabusTracker-v1.0.0-release.aab` |
| **Output Directory** | `frontend\android\app\build\outputs\apk\release` | `frontend\android\app\build\outputs\bundle\release` |
| **File Size** | 3,424,726 bytes (~3.27 MB) | 3,260,605 bytes (~3.11 MB) |
| **SHA-256 Checksum** | `7AEF56A68D9F24A433787B8A72F6854BD5E7B43ED6A6B8288EA69F2A7943AC59` | `1CF210D9B2516BB888344A15C12321039B51A32E2FAAA06BBEFB4D65059FABA4` |
| **Signing Tool** | `apksigner` (v1, v2, v3 schemes) | `jarsigner` (`SHA256withRSA` / `SHA-256`) |
| **Signature Status** | `Verified (v1=true, v2=true, v3=true)` | `jar verified.` |
| **Target Distribution** | Direct sideload / GitHub Releases | Google Play Store Console |
| **Signer Identity** | `CN=Farhan Ahmad, OU=Z's Verse, O=Unknown, L=Kolkata, ST=West Bengal, C=In` | `CN=Farhan Ahmad, OU=Z's Verse, O=Unknown, L=Kolkata, ST=West Bengal, C=In` |
| **Certificate Validity** | 10,000 days (Expires 2054) | 10,000 days (Expires 2054) |
