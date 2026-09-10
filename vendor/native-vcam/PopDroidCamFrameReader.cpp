#include "pch.h"
#include "PopDroidCamFrameReader.h"

#include <fstream>

namespace
{
    constexpr int32_t FrameWidth = 1280;
    constexpr int32_t FrameHeight = 720;
    constexpr int32_t FrameStride = FrameWidth * 4;
    constexpr int32_t FramePixelBytes = FrameStride * FrameHeight;
    constexpr ULONGLONG MaximumFrameAge = 3ULL * 10'000'000ULL;

    bool IsFreshFrame(const std::wstring& path)
    {
        WIN32_FILE_ATTRIBUTE_DATA attributes{};
        if (!GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &attributes))
        {
            return false;
        }

        FILETIME currentFileTime{};
        GetSystemTimeAsFileTime(&currentFileTime);
        ULARGE_INTEGER current{};
        current.LowPart = currentFileTime.dwLowDateTime;
        current.HighPart = currentFileTime.dwHighDateTime;
        ULARGE_INTEGER modified{};
        modified.LowPart = attributes.ftLastWriteTime.dwLowDateTime;
        modified.HighPart = attributes.ftLastWriteTime.dwHighDateTime;
        return current.QuadPart <= modified.QuadPart || current.QuadPart - modified.QuadPart <= MaximumFrameAge;
    }
}

std::vector<std::wstring> PopDroidCamFrameReader::GetCandidatePaths()
{
    wchar_t publicPath[MAX_PATH]{};
    const DWORD length = ExpandEnvironmentStringsW(
        L"%PUBLIC%\\PopDroidCam\\virtual-camera-frame.dat",
        publicPath,
        MAX_PATH);
    if (length > 0 && length < MAX_PATH)
    {
        return { publicPath };
    }
    return { L"C:\\Users\\Public\\PopDroidCam\\virtual-camera-frame.dat" };
}

bool PopDroidCamFrameReader::TryReadFromPath(
    const std::wstring& path,
    std::vector<uint8_t>& pixels,
    PopDroidCamFrameHeader& header,
    std::wstring& failureReason)
{
    if (!IsFreshFrame(path))
    {
        failureReason = L"missing or stale: " + path;
        return false;
    }

    std::ifstream stream(path, std::ios::binary);
    if (!stream)
    {
        failureReason = L"missing: " + path;
        return false;
    }

    stream.read(reinterpret_cast<char*>(&header.width), sizeof(int32_t));
    stream.read(reinterpret_cast<char*>(&header.height), sizeof(int32_t));
    stream.read(reinterpret_cast<char*>(&header.stride), sizeof(int32_t));
    stream.read(reinterpret_cast<char*>(&header.sequence), sizeof(int64_t));
    stream.read(reinterpret_cast<char*>(&header.pixelBytes), sizeof(int32_t));

    if (!stream)
    {
        failureReason = L"invalid header: " + path;
        return false;
    }

    if (header.width != FrameWidth || header.height != FrameHeight ||
        header.stride != FrameStride || header.pixelBytes != FramePixelBytes)
    {
        failureReason = L"invalid dimensions: " + path;
        return false;
    }

    if (static_cast<size_t>(FramePixelBytes) > pixels.size())
    {
        pixels.resize(static_cast<size_t>(FramePixelBytes));
    }

    stream.read(reinterpret_cast<char*>(pixels.data()), header.pixelBytes);
    if (!stream)
    {
        failureReason = L"short read: " + path;
        return false;
    }

    return true;
}

bool PopDroidCamFrameReader::TryRead(
    std::vector<uint8_t>& pixels,
    PopDroidCamFrameHeader& header,
    std::wstring& failureReason)
{
    for (const auto& path : GetCandidatePaths())
    {
        if (TryReadFromPath(path, pixels, header, failureReason))
        {
            return true;
        }
    }

    if (failureReason.empty())
    {
        failureReason = L"frame file not found";
    }

    return false;
}
