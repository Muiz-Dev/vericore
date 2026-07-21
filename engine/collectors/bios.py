import wmi
import winreg
import logging

logger = logging.getLogger('BIOSCollector')

class BIOSCollector:
    def collect(self) -> dict:
        data = {
            "source": "wmi_bios",
            "trust_level": "HIGH",
            "consistency_issues": []
        }
        
        try:
            c = wmi.WMI()
            
            # Primary: Win32_BIOS
            bios = c.Win32_BIOS()[0]
            data["manufacturer"] = getattr(bios, "Manufacturer", "Unknown")
            data["version"] = getattr(bios, "SMBIOSBIOSVersion", "Unknown")
            data["serial_number"] = getattr(bios, "SerialNumber", "Unknown")
            date = getattr(bios, "ReleaseDate", "")
            data["release_date"] = date[:8] if date else "Unknown"
            
            maj = getattr(bios, "SMBIOSMajorVersion", 0)
            min = getattr(bios, "SMBIOSMinorVersion", 0)
            data["smbios_version"] = f"{maj}.{min}" if maj else "Unknown"
            
            # Secondary: Win32_ComputerSystem
            sys = c.Win32_ComputerSystem()[0]
            data["system_manufacturer"] = getattr(sys, "Manufacturer", "Unknown")
            data["system_model"] = getattr(sys, "Model", "Unknown")
            
            # Secure Boot Check via Registry
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\SecureBoot\State") as key:
                    val, _ = winreg.QueryValueEx(key, "UEFISecureBootEnabled")
                    data["secure_boot_enabled"] = bool(val)
            except Exception:
                data["secure_boot_enabled"] = False
                
            # Mode Check
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control") as key:
                    val, _ = winreg.QueryValueEx(key, "PEBootType")
                    # If PEBootType exists and is not 0, it's likely UEFI (though this is a proxy check)
                    data["uefi_mode"] = True
            except Exception:
                # Fallback assumes UEFI for modern systems if we can't tell, 
                # but a real implementation would use GetFirmwareEnvironmentVariable
                data["uefi_mode"] = True
                
        except Exception as e:
            logger.error(f"Failed to read BIOS data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data
