import wmi
import logging
import ctypes

logger = logging.getLogger('SMBIOSCollector')

class SMBIOSCollector:
    def collect(self) -> dict:
        data = {
            "source": "smbios",
            "trust_level": "HIGH",
        }
        
        # We will use WMI for SMBIOS parsing since raw ctypes parsing of GetSystemFirmwareTable is very complex
        # In a full C++ app we'd read the raw table, but WMI exposes the pre-parsed SMBIOS tables via Win32 classes.
        # This still originates from the SMBIOS structure.
        
        try:
            c = wmi.WMI()
            
            # System Info (Type 1)
            sys_info = c.Win32_ComputerSystemProduct()[0]
            data["system_manufacturer"] = getattr(sys_info, "Vendor", None)
            data["system_product"] = getattr(sys_info, "Name", None)
            data["system_serial"] = getattr(sys_info, "IdentifyingNumber", None)
            data["system_uuid"] = getattr(sys_info, "UUID", None)
            
            # BIOS Info (Type 0)
            bios_info = c.Win32_BIOS()[0]
            data["bios_vendor"] = getattr(bios_info, "Manufacturer", None)
            data["bios_version"] = getattr(bios_info, "SMBIOSBIOSVersion", None)
            data["bios_date"] = getattr(bios_info, "ReleaseDate", None)
            if data["bios_date"]:
                # WMI dates are yyyymmdd... format, try to extract just the date part
                data["bios_date"] = data["bios_date"][:8]
            
            # Baseboard Info (Type 2)
            try:
                board_info = c.Win32_BaseBoard()[0]
                data["baseboard_manufacturer"] = getattr(board_info, "Manufacturer", None)
                data["baseboard_product"] = getattr(board_info, "Product", None)
                data["baseboard_serial"] = getattr(board_info, "SerialNumber", None)
            except Exception as e:
                logger.debug(f"Could not read baseboard SMBIOS: {e}")
                
            # Chassis Info (Type 3)
            try:
                chassis = c.Win32_SystemEnclosure()[0]
                data["chassis_manufacturer"] = getattr(chassis, "Manufacturer", None)
                data["chassis_serial"] = getattr(chassis, "SerialNumber", None)
                types = getattr(chassis, "ChassisTypes", [])
                if types:
                    data["chassis_type"] = types[0]
            except Exception as e:
                logger.debug(f"Could not read chassis SMBIOS: {e}")

        except Exception as e:
            logger.error(f"Failed to read SMBIOS data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data
