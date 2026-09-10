#include <windows.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfvirtualcamera.h>
#include <wrl/client.h>

#include <cwchar>
#include <iostream>
#include <string>

using Microsoft::WRL::ComPtr;

namespace
{
    constexpr wchar_t CameraName[] = L"PopDroidCam";
    constexpr wchar_t SourceClsid[] = L"{0EF8E6A7-A53A-4DEF-A39E-29A1348CA24B}";

    void PrintUsage()
    {
        std::wcout << L"Usage: PopDroidCamCameraRegistrar.exe <register|remove|status|help>\n";
    }

    void PrintError(const wchar_t* operation, HRESULT result)
    {
        std::wcerr << operation << L" failed (HRESULT 0x" << std::hex
                   << static_cast<unsigned long>(result) << L").\n";
    }

    HRESULT CreateCamera(IMFVirtualCamera** camera)
    {
        if (camera == nullptr)
        {
            return E_POINTER;
        }

        return MFCreateVirtualCamera(
            MFVirtualCameraType_SoftwareCameraSource,
            MFVirtualCameraLifetime_System,
            MFVirtualCameraAccess_AllUsers,
            CameraName,
            SourceClsid,
            nullptr,
            0,
            camera);
    }

    HRESULT RegisterCamera()
    {
        ComPtr<IMFVirtualCamera> camera;
        HRESULT result = CreateCamera(&camera);
        if (FAILED(result))
        {
            return result;
        }

        const HRESULT actionResult = camera->Start(nullptr);
        const HRESULT shutdownResult = camera->Shutdown();
        return FAILED(actionResult) ? actionResult : shutdownResult;
    }

    HRESULT RemoveCamera()
    {
        ComPtr<IMFVirtualCamera> camera;
        HRESULT result = CreateCamera(&camera);
        if (FAILED(result))
        {
            return result;
        }

        const HRESULT actionResult = camera->Remove();
        const HRESULT shutdownResult = camera->Shutdown();
        return FAILED(actionResult) ? actionResult : shutdownResult;
    }

    HRESULT CameraExists(bool& exists)
    {
        exists = false;

        ComPtr<IMFAttributes> attributes;
        HRESULT result = MFCreateAttributes(&attributes, 1);
        if (FAILED(result))
        {
            return result;
        }

        result = attributes->SetGUID(
            MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
            MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID);
        if (FAILED(result))
        {
            return result;
        }

        IMFActivate** devices = nullptr;
        UINT32 deviceCount = 0;
        result = MFEnumDeviceSources(attributes.Get(), &devices, &deviceCount);
        if (FAILED(result))
        {
            return result;
        }

        for (UINT32 index = 0; index < deviceCount; ++index)
        {
            ComPtr<IMFActivate> device;
            device.Attach(devices[index]);
            devices[index] = nullptr;

            wchar_t* friendlyName = nullptr;
            UINT32 friendlyNameLength = 0;
            const HRESULT nameResult = device->GetAllocatedString(
                MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME,
                &friendlyName,
                &friendlyNameLength);
            if (SUCCEEDED(nameResult) && friendlyName != nullptr && _wcsnicmp(friendlyName, CameraName, std::size(CameraName) - 1) == 0)
            {
                exists = true;
                std::wcout << L"PopDroidCam virtual camera: present\n";

                wchar_t* symbolicLink = nullptr;
                UINT32 symbolicLinkLength = 0;
                if (SUCCEEDED(device->GetAllocatedString(
                        MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_SYMBOLIC_LINK,
                        &symbolicLink,
                        &symbolicLinkLength)) && symbolicLink != nullptr)
                {
                    std::wcout << L"Symbolic link: " << symbolicLink << L"\n";
                }
                CoTaskMemFree(symbolicLink);
            }
            CoTaskMemFree(friendlyName);
        }

        CoTaskMemFree(devices);
        if (!exists)
        {
            std::wcout << L"PopDroidCam virtual camera: missing\n";
        }
        return S_OK;
    }
}

int wmain(int argc, wchar_t* argv[])
{
    if (argc != 2)
    {
        PrintUsage();
        return 2;
    }

    const std::wstring command = argv[1];
    if (command == L"help" || command == L"--help" || command == L"-h")
    {
        PrintUsage();
        return 0;
    }
    if (command != L"register" && command != L"remove" && command != L"status")
    {
        PrintUsage();
        return 2;
    }

    const HRESULT comResult = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(comResult))
    {
        PrintError(L"COM initialization", comResult);
        return 1;
    }

    const HRESULT startupResult = MFStartup(MF_VERSION);
    if (FAILED(startupResult))
    {
        PrintError(L"Media Foundation initialization", startupResult);
        CoUninitialize();
        return 1;
    }

    HRESULT result = S_OK;
    bool exists = false;
    if (command == L"register")
    {
        result = RegisterCamera();
        if (SUCCEEDED(result))
        {
            std::wcout << L"PopDroidCam virtual camera registered.\n";
        }
    }
    else if (command == L"remove")
    {
        result = RemoveCamera();
        if (SUCCEEDED(result))
        {
            std::wcout << L"PopDroidCam virtual camera removed.\n";
        }
    }
    else
    {
        result = CameraExists(exists);
    }

    const HRESULT shutdownResult = MFShutdown();
    CoUninitialize();
    if (FAILED(result))
    {
        PrintError(command.c_str(), result);
        return 1;
    }
    if (FAILED(shutdownResult))
    {
        PrintError(L"Media Foundation shutdown", shutdownResult);
        return 1;
    }
    if (command == L"status" && !exists)
    {
        return 1;
    }
    return 0;
}
