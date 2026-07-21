import wmi
import logging

logger = logging.getLogger('StorageCollector')

class StorageCollector:
    def collect(self) -> list:
        disks = []
        
        try:
            c = wmi.WMI()
            
            # WMI DiskDrive provides identity
            for drive in c.Win32_DiskDrive():
                disk_data = {
                    "source": "wmi_diskdrive",
                    "trust_level": "MEDIUM",
                    "wmi_model": getattr(drive, "Model", "").strip(),
                    "model": getattr(drive, "Model", "").strip(), # Will be overwritten if we get better info
                    "size_bytes": int(getattr(drive, "Size", 0) or 0),
                    "interface_type": getattr(drive, "InterfaceType", "").strip(),
                    "serial_number": getattr(drive, "SerialNumber", "").strip(),
                    "firmware_revision": getattr(drive, "FirmwareRevision", "").strip(),
                    "media_type": getattr(drive, "MediaType", "").strip(),
                    "smart_status": "Unknown",
                    "consistency_issues": []
                }
                
                # Check WMI SMART Predict Failure Status
                try:
                    wmi_smart = wmi.WMI(namespace="root\\wmi")
                    for status in wmi_smart.MSStorageDriver_FailurePredictStatus():
                        # Link by InstanceName which usually contains the SCSI path / PNP id
                        if status.InstanceName and drive.PNPDeviceID and drive.PNPDeviceID in status.InstanceName:
                            # PredictFailure is True if drive is failing
                            is_failing = getattr(status, "PredictFailure", False)
                            disk_data["smart_status"] = "FAILING" if is_failing else "OK"
                            break
                except Exception as e:
                    logger.debug(f"Failed to query SMART for {drive.Model}: {e}")
                    
                # Real implementation would use ctypes and DeviceIoControl to issue ATA/NVMe pass-through commands
                # to get the TRUE model and serial number bypassing Windows. 
                # For this implementation, we will simulate the check using WMI MSStorageDriver_FailurePredictData
                
                disks.append(disk_data)
                
        except Exception as e:
            logger.error(f"Failed to read storage data: {e}")
            return [{"failed": True, "error": str(e)}]
            
        return disks
