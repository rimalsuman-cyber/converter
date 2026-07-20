export function createQrCodeUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}`;
}

export function canScanQrCodes() {
  return "BarcodeDetector" in window && "mediaDevices" in navigator;
}
