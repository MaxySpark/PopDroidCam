#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct PopDroidCamFrameHeader
{
    int32_t width{};
    int32_t height{};
    int32_t stride{};
    int64_t sequence{};
    int32_t pixelBytes{};
};

class PopDroidCamFrameReader
{
public:
    static bool TryRead(std::vector<uint8_t>& pixels, PopDroidCamFrameHeader& header, std::wstring& failureReason);

private:
    static bool TryReadFromPath(const std::wstring& path, std::vector<uint8_t>& pixels, PopDroidCamFrameHeader& header, std::wstring& failureReason);
    static std::vector<std::wstring> GetCandidatePaths();
};
