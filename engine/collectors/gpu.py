import wmi
import logging

logger = logging.getLogger('GPUCollector')

class GPUCollector:
    def collect(self) -> list:
        gpus = []
        
        try:
            c = wmi.WMI()
            for gpu in c.Win32_VideoController():
                vram = int(getattr(gpu, "AdapterRAM", 0) or 0)
                # Some WMI providers return negative numbers for >2GB VRAM due to signed 32-bit int overflow
                if vram < 0:
                    vram = (vram & 0xFFFFFFFF)
                    
                gpu_data = {
                    "source": "wmi_video",
                    "trust_level": "MEDIUM",
                    "name": getattr(gpu, "Caption", getattr(gpu, "Name", "Unknown")).strip(),
                    "driver_version": getattr(gpu, "DriverVersion", "Unknown"),
                    "driver_date": getattr(gpu, "DriverDate", "")[:8] if getattr(gpu, "DriverDate", "") else "",
                    "vram_bytes": vram,
                    "video_processor": getattr(gpu, "VideoProcessor", "Unknown"),
                    "resolution": f"{getattr(gpu, 'CurrentHorizontalResolution', '0')}x{getattr(gpu, 'CurrentVerticalResolution', '0')}",
                    "refresh_rate": getattr(gpu, "CurrentRefreshRate", 0),
                    "consistency_issues": []
                }
                
                # A full implementation would use NVML (Nvidia) or ADL (AMD) or DXGI (Windows)
                # to get the true hardware ID, bypassing WMI.
                
                gpus.append(gpu_data)
                
        except Exception as e:
            logger.error(f"Failed to read GPU data: {e}")
            return [{"failed": True, "error": str(e)}]
            
        return gpus
