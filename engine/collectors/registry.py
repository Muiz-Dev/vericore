import winreg
import logging

logger = logging.getLogger('RegistryCollector')

class RegistryCollector:
    def collect(self) -> dict:
        data = {
            "source": "registry",
            "trust_level": "LOW",
        }
        
        # 1. BIOS/System info
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\BIOS") as key:
                data["SystemManufacturer"] = self._get_value(key, "SystemManufacturer")
                data["SystemProductName"] = self._get_value(key, "SystemProductName")
                data["SystemSKU"] = self._get_value(key, "SystemSKU")
                data["SystemFamily"] = self._get_value(key, "SystemFamily")
                data["BIOSVendor"] = self._get_value(key, "BIOSVendor")
                data["BIOSVersion"] = self._get_value(key, "BIOSVersion")
                data["BIOSReleaseDate"] = self._get_value(key, "BIOSReleaseDate")
        except Exception as e:
            logger.debug(f"Failed to read BIOS registry key: {e}")

        # 2. Additional System Information
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\SystemInformation") as key:
                sys_man = self._get_value(key, "SystemManufacturer")
                if sys_man and "SystemManufacturer" not in data:
                    data["SystemManufacturer"] = sys_man
                    
                sys_prod = self._get_value(key, "SystemProductName")
                if sys_prod and "SystemProductName" not in data:
                    data["SystemProductName"] = sys_prod
                    
                data["ComputerHardwareId"] = self._get_value(key, "ComputerHardwareId")
        except Exception as e:
            logger.debug(f"Failed to read SystemInformation registry key: {e}")

        # 3. CPU Info
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0") as key:
                data["ProcessorNameString"] = self._get_value(key, "ProcessorNameString")
                data["ProcessorVendorIdentifier"] = self._get_value(key, "VendorIdentifier")
        except Exception as e:
            logger.debug(f"Failed to read CPU registry key: {e}")

        return data

    def _get_value(self, key, name):
        try:
            val, _ = winreg.QueryValueEx(key, name)
            return str(val).strip()
        except FileNotFoundError:
            return None
