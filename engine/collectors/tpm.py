import wmi
import logging

logger = logging.getLogger('TPMCollector')

class TPMCollector:
    def collect(self) -> dict:
        data = {
            "source": "wmi_tpm",
            "trust_level": "HIGH",
            "present": False,
            "consistency_issues": []
        }
        
        try:
            # Requires Admin privileges to query root\CIMv2\Security\MicrosoftTpm
            c = wmi.WMI(namespace="root\\CIMv2\\Security\\MicrosoftTpm")
            
            # Usually only one TPM instance
            tpms = c.Win32_Tpm()
            if tpms:
                tpm = tpms[0]
                data["present"] = True
                
                # Check status
                try:
                    data["activated"] = tpm.IsActivated_InitialValue()[0]
                    data["enabled"] = tpm.IsEnabled_InitialValue()[0]
                    data["owned"] = tpm.IsOwned_InitialValue()[0]
                except Exception:
                    data["activated"] = False
                    data["enabled"] = False
                    data["owned"] = False
                    
                # Identify Manufacturer
                man_id = getattr(tpm, "ManufacturerId", 0)
                if man_id:
                    # It's an integer representing 4 ASCII characters
                    data["manufacturer_id"] = hex(man_id)
                    data["manufacturer_name"] = self._decode_manufacturer(man_id)
                else:
                    data["manufacturer_id"] = "Unknown"
                    data["manufacturer_name"] = "Unknown"
                    
                data["version"] = getattr(tpm, "ManufacturerVersion", "Unknown")
                data["spec_version"] = getattr(tpm, "SpecVersion", "Unknown")
                
        except wmi.x_wmi as e:
            # Likely access denied if not admin
            logger.debug(f"TPM query failed, likely not running as admin: {e}")
            data["error"] = "Access Denied (Requires Admin)"
            
        except Exception as e:
            logger.error(f"Failed to read TPM data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data

    def _decode_manufacturer(self, id_int: int) -> str:
        # Known TPM Vendor IDs (TCG Vendor ID Registry)
        mapping = {
            0x414D4400: "AMD",
            0x41544D4C: "Atmel",
            0x4252434D: "Broadcom",
            0x4353434F: "Cisco",
            0x48504500: "HPE",
            0x49424D00: "IBM",
            0x494E5443: "Intel",
            0x4C454E00: "Lenovo",
            0x4D534654: "Microsoft",
            0x4E534D20: "National Semiconductor",
            0x4E544300: "Nuvoton Technology",
            0x51434F4D: "Qualcomm",
            0x534D5343: "SMSC",
            0x53544D20: "STMicroelectronics",
            0x54584E00: "Texas Instruments",
            0x57454300: "Winbond",
            0x524F4343: "Fuzhou Rockchip",
            0x474F4F47: "Google",
            0x49465800: "Infineon"
        }
        
        if id_int in mapping:
            return mapping[id_int]
            
        # Try to decode as ascii string (4 bytes)
        try:
            # 32 bit int to 4 chars
            b = id_int.to_bytes(4, byteorder='big')
            decoded = "".join(chr(c) for c in b if 32 <= c <= 126).strip()
            return decoded if decoded else "Unknown"
        except:
            return "Unknown"
