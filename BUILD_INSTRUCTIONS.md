# Build & Installation Instructions (Android)

Follow these steps to build a standalone APK for your Android device.

## Prerequisites
1.  **Expo Account**: You need an account at [expo.dev](https://expo.dev/signup).
2.  **EAS CLI**: Install the EAS CLI globally if you haven't already:
    ```bash
    npm install -g eas-cli
    ```
3.  **Login**: Log in to your Expo account via the terminal:
    ```bash
    eas login
    ```

## 1. Configure EAS Build
Run the following command to initialize the project with EAS:
```bash
eas build:configure
```
- Select **Android** when prompted.
- This will create a file named `eas.json`.

## 2. Generate the APK (Preview Build)
To create an installable APK that you can drag and drop onto your phone (without needing the Play Store), run:

```bash
eas build -p android --profile preview
```

- This command will start the build process in the cloud.
- It may take 10-20 minutes.
- Once complete, it will provide a **Download Link** or a **QR Code**.

## 3. Install on Device
1.  **Download**: Open the link on your Android device to download the `.apk` file.
2.  **Install**: Tap the downloaded file.
    - You may need to enable **"Install Unknown Apps"** in your phone settings if prompted.
3.  **Run**: Open "Heartfolio" from your app drawer!

---

## Alternative: Expo Go (Quick Testing)
If you just want to test changes quickly without building a full app file:
1.  Install **Expo Go** from the Play Store.
2.  Run `npx expo start` in your terminal.
3.  Scan the QR code with the Expo Go app.
