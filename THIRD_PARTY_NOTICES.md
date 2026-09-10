# Third-Party Notices

The Windows package includes the unmodified official scrcpy 4.1 Windows x64 distribution from <https://github.com/Genymobile/scrcpy/releases/tag/v4.1>.

That distribution includes scrcpy, Android Debug Bridge, FFmpeg libraries, SDL, libusb, and their runtime files. Scrcpy is distributed under the Apache License 2.0. Its upstream `LICENSE.txt` is packaged at `resources/bin/LICENSE.txt`; upstream dependency notices remain part of the unmodified distribution.

The Windows package also includes the shared LGPL FFmpeg 8.0.1 x64 build `ffmpeg-n8.0.1-17-g27a297f186-win64-lgpl-shared-8.0` from <https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2025-11-30-12-53>. FFmpeg is distributed under the GNU Lesser General Public License; source and build information are available from that release and <https://ffmpeg.org/>.

The Windows package also includes a native virtual-camera media source derived from [OverlayCamera](https://github.com/AyaMoke/OverlayCamera) by AyaMoke and VCamSample by Simon Mourier. Both are distributed under the MIT License. Their license texts are packaged at `resources/native-vcam/LICENSE-OverlayCamera.txt` and `resources/native-vcam/LICENSE-VCamSample.txt`.
