use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HWND};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationValuePattern,
    TreeScope, UIA_AutomationIdPropertyId, UIA_EditControlTypeId, UIA_ValuePatternId,
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
    domain.to_string()
}

static COM_INIT: std::sync::OnceLock<()> = std::sync::OnceLock::new();

fn ensure_com() {
    COM_INIT.get_or_init(|| {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }
    });
}

pub fn get_browser_url(hwnd: HWND) -> Option<String> {
    ensure_com();

    let automation: IUIAutomation = unsafe {
        CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).ok()?
    };

    let element: IUIAutomationElement = unsafe {
        automation.ElementFromHandle(hwnd).ok()?
    };

    let auto_id = windows::core::BSTR::from("addressEditBox");
    let condition = unsafe {
        let variant = windows::Win32::System::Variant::VARIANT::from(auto_id);
        automation.CreatePropertyCondition(UIA_AutomationIdPropertyId, &variant).ok()?
    };

    let address_bar = unsafe {
        element.FindFirst(TreeScope(4), &condition).ok()?
    };

    if let Ok(pattern) = unsafe { address_bar.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) } {
        if let Ok(bstr) = unsafe { pattern.CurrentValue() } {
            let url = bstr.to_string();
            if !url.is_empty() {
                return Some(url);
            }
        }
    }

    let variant = windows::Win32::System::Variant::VARIANT::from(UIA_EditControlTypeId.0);
    if let Ok(cond2) = unsafe { automation.CreatePropertyCondition(UIA_AutomationIdPropertyId, &variant) } {
        if let Ok(edit) = unsafe { element.FindFirst(TreeScope(4), &cond2) } {
            if let Ok(pattern) = unsafe { edit.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) } {
                if let Ok(bstr) = unsafe { pattern.CurrentValue() } {
                    let url = bstr.to_string();
                    if !url.is_empty() {
                        return Some(url);
                    }
                }
            }
        }
    }

    None
}

pub fn get_foreground_app() -> Option<ForegroundApp> {
    let hwnd: HWND = unsafe { GetForegroundWindow() };
    if hwnd.is_invalid() {
        return None;
    }

    let title = get_window_text(hwnd);
    let process_name = get_process_name(hwnd)?;
    let browser = is_browser(&process_name);
    let url = if browser { get_browser_url(hwnd) } else { None };

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
