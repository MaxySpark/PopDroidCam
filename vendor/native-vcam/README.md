# PopDroidCam Native Virtual Camera Source

This directory vendors the native media-source implementation from
[AyaMoke/OverlayCamera](https://github.com/AyaMoke/OverlayCamera) revision
`96f563e1a8a51e0839db28a9a85543c01618963e`.

PopDroidCam changes the shared-frame path to
`%PUBLIC%\PopDroidCam\virtual-camera-frame.dat` and uses a minimal Release x64
projects, including a native endpoint registrar. Run
`pnpm run build:native:camera` from the repository root to compile and stage
the installer payload.

`PopDroidCamCameraRegistrar.exe` supports `register`, `remove`, and `status`.

See `LICENSE-OverlayCamera.txt` and `LICENSE-VCamSample.txt` for attribution and
license terms.
