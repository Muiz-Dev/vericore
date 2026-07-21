import psutil
import wmi
import logging

logger = logging.getLogger('BatteryCollector')

class BatteryCollector:
    def collect(self) -> dict:
        data = {
            "source": "acpi_wmi",
            "trust_level": "HIGH",
            "present": False,
            "consistency_issues": []
        }
        
        try:
            # 1. Basic OS Battery Status
            battery = psutil.sensors_battery()
            if not battery:
                return data
                
            data["present"] = True
            data["percent"] = battery.percent
            data["is_charging"] = battery.power_plugged
            
            # 2. ACPI Deep Data via WMI
            c = wmi.WMI()
            wmi_bats = c.Win32_Battery()
            
            if wmi_bats:
                wmi_bat = wmi_bats[0]
                data["status"] = getattr(wmi_bat, "BatteryStatus", "Unknown")
                data["chemistry"] = getattr(wmi_bat, "Chemistry", "Unknown")
                data["design_capacity_mwh"] = int(getattr(wmi_bat, "DesignCapacity", 0) or 0)
                data["current_capacity_mwh"] = int(getattr(wmi_bat, "FullChargeCapacity", 0) or 0)
                data["manufacturer"] = getattr(wmi_bat, "SystemName", getattr(wmi_bat, "Name", "Unknown"))
                
                # Try wmi root\wmi for BatteryStaticData (usually requires Admin)
                try:
                    c_wmi = wmi.WMI(namespace="root\\wmi")
                    static = c_wmi.BatteryStaticData()
                    if static:
                        data["manufacturer"] = getattr(static[0], "ManufactureName", data["manufacturer"])
                        data["serial"] = getattr(static[0], "SerialNumber", "Unknown")
                        data["chemistry"] = getattr(static[0], "Chemistry", data["chemistry"])
                        data["cycle_count"] = getattr(static[0], "CycleCount", 0)
                except Exception as e:
                    logger.debug(f"root\\wmi BatteryStaticData failed (requires Admin): {e}")
                    
                # Calculate Wear
                dc = data.get("design_capacity_mwh", 0)
                cc = data.get("current_capacity_mwh", 0)
                if dc > 0 and cc > 0:
                    wear = (1 - (cc / dc)) * 100
                    data["wear_percent"] = max(0, wear)
                else:
                    data["wear_percent"] = 0
                    
        except Exception as e:
            logger.error(f"Failed to read battery data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data
