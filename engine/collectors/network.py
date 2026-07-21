import wmi
import logging

logger = logging.getLogger('NetworkCollector')

class NetworkCollector:
    def collect(self) -> dict:
        data = {
            "source": "wmi_network",
            "trust_level": "MEDIUM",
            "adapters": [],
            "wifi_adapters": 0,
            "ethernet_adapters": 0,
            "bluetooth_adapters": 0,
            "count": 0,
            "consistency_issues": []
        }
        
        try:
            c = wmi.WMI()
            
            # PhysicalAdapter=True filters out most virtual VPN/VMware adapters
            for adapter in c.Win32_NetworkAdapter(PhysicalAdapter=True):
                name = getattr(adapter, "Name", "Unknown").strip()
                
                # Simple categorization based on name
                name_lower = name.lower()
                is_wifi = 'wi-fi' in name_lower or 'wireless' in name_lower or 'wlan' in name_lower or '802.11' in name_lower
                is_bt = 'bluetooth' in name_lower
                
                type_cat = "Unknown"
                if is_wifi:
                    type_cat = "WiFi"
                    data["wifi_adapters"] += 1
                elif is_bt:
                    type_cat = "Bluetooth"
                    data["bluetooth_adapters"] += 1
                else:
                    type_cat = "Ethernet"
                    data["ethernet_adapters"] += 1
                    
                speed_bps = int(getattr(adapter, "Speed", 0) or 0)
                speed_mbps = int(speed_bps / 1000000) if speed_bps else None
                
                data["adapters"].append({
                    "name": name,
                    "mac": getattr(adapter, "MACAddress", "Unknown"),
                    "type": type_cat,
                    "manufacturer": getattr(adapter, "Manufacturer", "Unknown"),
                    "speed": speed_mbps
                })
                
            data["count"] = len(data["adapters"])
            
        except Exception as e:
            logger.error(f"Failed to read network data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data
