import winreg
import wmi
import logging

logger = logging.getLogger('DisplayCollector')

class DisplayCollector:
    def collect(self) -> list:
        displays = []
        
        # We will cross-reference WMI DesktopMonitor with Registry EDID
        wmi_monitors = {}
        try:
            c = wmi.WMI()
            for mon in c.Win32_DesktopMonitor():
                # Store by PnPDeviceID if possible, else generic
                pid = getattr(mon, "PNPDeviceID", "Unknown")
                wmi_monitors[pid] = getattr(mon, "Name", getattr(mon, "Description", "Unknown"))
        except Exception as e:
            logger.debug(f"WMI Monitor read failed: {e}")
            
        # Read EDID from registry
        try:
            enum_key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Enum\DISPLAY")
            
            # Iterate DISPLAY subkeys
            for i in range(10): # max 10 displays
                try:
                    display_id = winreg.EnumKey(enum_key, i)
                    disp_key = winreg.OpenKey(enum_key, display_id)
                    
                    # Iterate instances
                    for j in range(5):
                        try:
                            inst_id = winreg.EnumKey(disp_key, j)
                            inst_key = winreg.OpenKey(disp_key, inst_id)
                            
                            device_desc = ""
                            try:
                                device_desc, _ = winreg.QueryValueEx(inst_key, "DeviceDesc")
                                device_desc = device_desc.split(';')[-1] # Remove @display.inf...
                            except: pass
                            
                            dev_param_key = winreg.OpenKey(inst_key, "Device Parameters")
                            edid, _ = winreg.QueryValueEx(dev_param_key, "EDID")
                            
                            # Parse basic EDID info
                            if edid and len(edid) >= 128:
                                parsed = self._parse_edid(edid)
                                parsed["wmi_name"] = wmi_monitors.get(f"DISPLAY\\{display_id}\\{inst_id}", device_desc or "Generic PnP Monitor")
                                parsed["consistency_issues"] = []
                                
                                if parsed["wmi_name"] and parsed["monitor_name"]:
                                    if parsed["monitor_name"] not in parsed["wmi_name"] and "Generic" in parsed["wmi_name"]:
                                        parsed["consistency_issues"].append({
                                            "severity": "info",
                                            "description": f"Windows uses a generic driver name ('{parsed['wmi_name']}'), but EDID contains specific model data ('{parsed['monitor_name']}')."
                                        })
                                
                                displays.append(parsed)
                                
                        except EnvironmentError:
                            break # No more instances
                except EnvironmentError:
                    break # No more displays
                    
        except Exception as e:
            logger.error(f"Failed to read display EDID: {e}")
            
        return displays

    def _parse_edid(self, edid: bytes) -> dict:
        data = {
            "source": "edid_registry",
            "trust_level": "HIGH"
        }
        
        # PNP ID (bytes 8-9)
        # 5 bits per char, offset from 'A' (1)
        pnp = (edid[8] << 8) | edid[9]
        c1 = chr(((pnp >> 10) & 31) + 64)
        c2 = chr(((pnp >> 5) & 31) + 64)
        c3 = chr((pnp & 31) + 64)
        data["manufacturer_id"] = f"{c1}{c2}{c3}"
        
        # Manuf Year
        data["manufacture_year"] = edid[17] + 1990
        
        # Monitor Name from descriptor blocks (bytes 54-125)
        # Block type 0xFC is monitor name
        monitor_name = ""
        for i in range(4):
            offset = 54 + (i * 18)
            if edid[offset] == 0 and edid[offset+1] == 0 and edid[offset+3] == 0xFC:
                name_bytes = edid[offset+5:offset+18]
                # stop at \n or 0
                for b in name_bytes:
                    if b == 0x0A or b == 0x00: break
                    if 32 <= b <= 126: monitor_name += chr(b)
        
        data["monitor_name"] = monitor_name.strip() if monitor_name else f"Unknown Panel ({data['manufacturer_id']})"
        
        return data
