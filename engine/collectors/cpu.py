import wmi
import platform
import logging
import subprocess
import threading

logger = logging.getLogger('CPUCollector')

def _get_cpuinfo_with_timeout(result_container, timeout=10):
    """Run cpuinfo in a thread with a timeout to prevent hangs."""
    def _run():
        try:
            import cpuinfo
            result_container['info'] = cpuinfo.get_cpu_info()
        except Exception as e:
            result_container['error'] = str(e)

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=timeout)
    return result_container.get('info', None)

class CPUCollector:
    def collect(self) -> dict:
        data = {
            "source": "wmi_cpuid",
            "trust_level": "VERY_HIGH",
            "consistency_issues": []
        }

        # --- Primary: WMI (fast, reliable) ---
        try:
            c = wmi.WMI()
            wmi_cpu = c.Win32_Processor()[0]
            data["brand"]             = getattr(wmi_cpu, "Name", "").strip()
            data["wmi_name"]          = data["brand"]
            data["wmi_manufacturer"]  = getattr(wmi_cpu, "Manufacturer", "").strip()
            data["core_count_physical"] = getattr(wmi_cpu, "NumberOfCores", 0)
            data["core_count_logical"]  = getattr(wmi_cpu, "NumberOfLogicalProcessors", 0)
            data["hz_advertised"]     = f"{getattr(wmi_cpu, 'MaxClockSpeed', 0)} MHz"
            data["hz_actual"]         = data["hz_advertised"]
            data["architecture"]      = platform.machine()
            data["vendor_id"]         = data["wmi_manufacturer"]
            logger.info("CPU WMI data collected successfully.")
        except Exception as e:
            logger.error(f"WMI CPU collection failed: {e}")
            data["failed"] = True
            data["error"] = str(e)
            return data

        # --- Secondary: py-cpuinfo (optional, with timeout guard) ---
        try:
            result_container = {}
            info = _get_cpuinfo_with_timeout(result_container, timeout=8)
            if info:
                data["vendor_id"]     = info.get("vendor_id_raw", data.get("vendor_id", ""))
                data["hz_advertised"] = info.get("hz_advertised_friendly", data.get("hz_advertised", ""))
                data["hz_actual"]     = info.get("hz_actual_friendly", data.get("hz_actual", ""))
                data["l2_cache"]      = info.get("l2_cache_size", "")
                data["l3_cache"]      = info.get("l3_cache_size", "")
                data["flags"]         = info.get("flags", [])
                logger.info("CPU cpuinfo data collected successfully.")
            else:
                logger.warning("cpuinfo timed out — using WMI data only.")
                data["l2_cache"] = "N/A"
                data["l3_cache"] = "N/A"
        except Exception as e:
            logger.warning(f"cpuinfo secondary collection failed (non-critical): {e}")
            data["l2_cache"] = "N/A"
            data["l3_cache"] = "N/A"

        # --- Cross-Validation ---
        if data.get("wmi_name") and data.get("brand"):
            if data["wmi_name"].strip() != data["brand"].strip():
                data["consistency_issues"].append(
                    "Minor naming difference between WMI and CPUID instruction."
                )

        return data
