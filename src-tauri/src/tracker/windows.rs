use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HWND};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::System::Variant::{VariantToStringAlloc, VARIANT};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, TreeScope_Children,
    TreeScope_Descendants, TreeScope_Subtree, UIA_AccessKeyPropertyId,
    UIA_AutomationIdPropertyId, UIA_ControlTypePropertyId, UIA_ValueValuePropertyId,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};

pub struct ForegroundApp {
    pub process_name: String,
    pub window_title: String,
    pub is_browser: bool,
    pub browser_url: Option<String>,
}

const BROWSERS: &[&str] = &[
    "msedge.exe",
    "chrome.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
    "arc.exe",
];

pub fn is_browser(app_name: &str) -> bool {
    BROWSERS.iter().any(|b| app_name.eq_ignore_ascii_case(b))
}

pub fn extract_domain(url: &str) -> String {
    let without_proto = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    let domain = without_proto.split('/').next().unwrap_or(without_proto);
    let domain = domain.split(':').next().unwrap_or(domain);
    let domain = domain.strip_prefix("www.").unwrap_or(domain);
    domain.to_string()
}

fn decode_variant_string(variant: &VARIANT) -> String {
    unsafe {
        match VariantToStringAlloc(variant) {
            Ok(value) => value.to_string().unwrap_or_default(),
            Err(_) => String::new(),
        }
    }
}

fn get_url_from_automation_id(
    automation: &IUIAutomation,
    element: &IUIAutomationElement,
    automation_id: &str,
) -> Option<String> {
    let variant = VARIANT::from(windows::core::BSTR::from(automation_id));
    let condition = unsafe {
        automation
            .CreatePropertyCondition(UIA_AutomationIdPropertyId, &variant)
            .ok()?
    };
    let found = unsafe { element.FindFirst(TreeScope_Subtree, &condition).ok()? };
    let value_variant = unsafe { found.GetCurrentPropertyValue(UIA_ValueValuePropertyId).ok()? };
    if value_variant.is_empty() {
        return None;
    }
    let url = decode_variant_string(&value_variant);
    if url.is_empty() {
        None
    } else {
        Some(url)
    }
}

fn search_url_chromium(
    automation: &IUIAutomation,
    element: &IUIAutomationElement,
) -> Option<String> {
    let variant = VARIANT::from(0xC36E_i32);
    let condition = unsafe {
        automation
            .CreatePropertyCondition(UIA_ControlTypePropertyId, &variant)
            .ok()?
    };
    let found = unsafe {
        let first = element.FindFirst(TreeScope_Children, &condition);
        if first.is_ok() {
            first
        } else {
            element.FindFirst(TreeScope_Descendants, &condition)
        }
        .ok()?
    };
    let value_variant = unsafe { found.GetCurrentPropertyValue(UIA_ValueValuePropertyId).ok()? };
    if value_variant.is_empty() {
        return None;
    }
    let url = decode_variant_string(&value_variant);
    if url.is_empty() {
        None
    } else {
        Some(url)
    }
}

fn get_url_chromium_fallback(
    automation: &IUIAutomation,
    element: &IUIAutomationElement,
) -> Option<String> {
    let type_variant = VARIANT::from(0xC354_i32);
    let access_variant = VARIANT::from(windows::core::BSTR::from("Ctrl+L"));
    let condition = unsafe {
        let c1 = automation
            .CreatePropertyCondition(UIA_ControlTypePropertyId, &type_variant)
            .ok()?;
        let c2 = automation
            .CreatePropertyCondition(UIA_AccessKeyPropertyId, &access_variant)
            .ok()?;
        automation.CreateAndCondition(&c1, &c2).ok()?
    };
    let found = unsafe { element.FindFirst(TreeScope_Subtree, &condition).ok()? };
    let value_variant = unsafe { found.GetCurrentPropertyValue(UIA_ValueValuePropertyId).ok()? };
    if value_variant.is_empty() {
        return None;
    }
    let url = decode_variant_string(&value_variant);
    if url.is_empty() {
        None
    } else {
        Some(url)
    }
}

pub fn get_browser_url(hwnd: HWND, process_name: &str) -> Option<String> {
    if unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_err() {
        return None;
    }

    let result = (|| -> Option<String> {
        let automation: IUIAutomation =
            unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).ok()? };
        let element = unsafe { automation.ElementFromHandle(hwnd).ok()? };
        let name = process_name.to_lowercase();

        if name.contains("firefox") {
            get_url_from_automation_id(&automation, &element, "urlbar-input")
        } else if name.contains("msedge") {
            get_url_from_automation_id(&automation, &element, "view_1022")
                .or_else(|| get_url_from_automation_id(&automation, &element, "view_1020"))
                .or_else(|| search_url_chromium(&automation, &element))
                .or_else(|| get_url_chromium_fallback(&automation, &element))
        } else {
            search_url_chromium(&automation, &element)
                .or_else(|| get_url_chromium_fallback(&automation, &element))
        }
    })();

    unsafe { CoUninitialize() };
    result
}

pub fn get_foreground_app() -> Option<ForegroundApp> {
    let hwnd: HWND = unsafe { GetForegroundWindow() };
    if hwnd.is_invalid() {
        return None;
    }

    let title = get_window_text(hwnd);
    let process_name = get_process_name(hwnd)?;
    let browser = is_browser(&process_name);
    let url = if browser {
        get_browser_url(hwnd, &process_name)
    } else {
        None
    };

    Some(ForegroundApp {
        process_name,
        window_title: title,
        is_browser: browser,
        browser_url: url,
    })
}

fn get_window_text(hwnd: HWND) -> String {
    let mut buf = [0u16; 512];
    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };
    if len == 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..len as usize])
}

fn get_process_name(hwnd: HWND) -> Option<String> {
    let mut pid: u32 = 0;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    if pid == 0 {
        return None;
    }

    let process =
        unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()? };

    let mut len: u32 = 512;
    let mut buf = [0u16; 512];
    let ok = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        )
    };
    if ok.is_err() {
        unsafe {
            let _ = CloseHandle(process);
        }
        return None;
    }

    unsafe {
        let _ = CloseHandle(process);
    }

    let full_path = String::from_utf16_lossy(&buf[..len as usize]);
    let name = std::path::Path::new(&full_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or(full_path);

    Some(name)
}
