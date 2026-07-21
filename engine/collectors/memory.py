import psutil
import wmi
import logging

logger = logging.getLogger('MemoryCollector')

class MemoryCollector:
    def collect(self) -> dict:
        data = {
            "source": "wmi_and_psutil",
            "trust_level": "HIGH",
            "slots": [],
            "consistency_issues": []
        }
        
        try:
            # OS level usage
            vm = psutil.virtual_memory()
            data["total_bytes"] = vm.total
            data["available_bytes"] = vm.available
            data["used_percent"] = vm.percent
            
            # Hardware level (WMI)
            c = wmi.WMI()
            slots_total = 0
            
            for mem in c.Win32_PhysicalMemory():
                cap = int(getattr(mem, "Capacity", 0))
                slots_total += cap
                
                # Try to map SMBIOS memory type codes if available, or just keep raw
                mem_type = getattr(mem, "MemoryType", 0)
                smbios_type = getattr(mem, "SMBIOSMemoryType", 0)
                
                type_str = str(smbios_type) if smbios_type else str(mem_type)
                # Quick mapping for common DDR types (SMBIOS Type 17)
                if smbios_type == 26: type_str = "DDR4"
                elif smbios_type == 34: type_str = "DDR5"
                elif smbios_type == 30: type_str = "LPDDR4"
                
                data["slots"].append({
                    "bank_label": getattr(mem, "BankLabel", "Unknown"),
                    "capacity": cap,
                    "speed": getattr(mem, "Speed", 0),
                    "manufacturer": getattr(mem, "Manufacturer", "Unknown").strip(),
                    "part_number": getattr(mem, "PartNumber", "Unknown").strip(),
                    "serial_number": getattr(mem, "SerialNumber", "Unknown").strip(),
                    "memory_type": type_str
                })
                
            data["total_from_slots"] = slots_total
            
            # Cross-Validation
            # Compare WMI total to OS total. Small differences (hardware reserved) are normal, 
            # large differences indicate spoofing or failing modules.
            if slots_total > 0:
                diff = abs(slots_total - data["total_bytes"])
                # If difference is > 2GB, flag it
                if diff > 2 * 1024**3:
                    data["consistency_issues"].append("Hardware memory capacity differs significantly from OS-reported capacity.")
                    
        except Exception as e:
            logger.error(f"Failed to read memory data: {e}")
            data["failed"] = True
            data["error"] = str(e)
            
        return data
