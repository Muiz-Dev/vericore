import logging
import traceback
import time

# We'll import collectors as they are built
from collectors.registry import RegistryCollector
from collectors.smbios import SMBIOSCollector
from collectors.cpu import CPUCollector
from collectors.memory import MemoryCollector
from collectors.storage import StorageCollector
from collectors.battery import BatteryCollector
from collectors.display import DisplayCollector
from collectors.gpu import GPUCollector
from collectors.bios import BIOSCollector
from collectors.tpm import TPMCollector
from collectors.network import NetworkCollector

from core.consistency import ConsistencyEngine
from core.scoring import Scorer
from core.report import ReportGenerator

logger = logging.getLogger('HardwareCollector')

class HardwareCollector:
    def __init__(self):
        self.collectors = {
            'registry': RegistryCollector(),
            'smbios': SMBIOSCollector(),
            'bios': BIOSCollector(),
            'cpu': CPUCollector(),
            'memory': MemoryCollector(),
            'storage': StorageCollector(),
            'battery': BatteryCollector(),
            'display': DisplayCollector(),
            'gpu': GPUCollector(),
            'network': NetworkCollector(),
            'tpm': TPMCollector()
        }
        self.consistency_engine = ConsistencyEngine()
        self.scorer = Scorer()
        self.report_gen = ReportGenerator()

    def collect_all(self, progress_callback=None):
        # Initialize COM for this thread — required for all WMI calls made from a non-main thread
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except Exception as e:
            logger.warning(f"CoInitialize failed (non-critical): {e}")

        collected_data = {}
        
        # 1. Collect Data from all sources
        for name, collector in self.collectors.items():
            try:
                logger.info(f"Running collector: {name}")
                t0 = time.time()
                data = collector.collect()
                collected_data[name] = data
                t1 = time.time()
                logger.info(f"Collector {name} finished in {t1-t0:.2f}s")
                
                if progress_callback:
                    progress_callback(name, True, data)
            except Exception as e:
                logger.error(f"Collector {name} failed: {e}")
                logger.debug(traceback.format_exc())
                collected_data[name] = {"error": str(e), "source": name, "failed": True}
                if progress_callback:
                    progress_callback(name, False, None)
                    
        # 2. Run Consistency Analysis
        if progress_callback: progress_callback('consistency', True, None)
        inconsistencies = self.consistency_engine.analyze(collected_data)
        
        # 3. Score Device
        if progress_callback: progress_callback('scoring', True, None)
        scores = {
            "health_score": self.scorer.calculate_health_score(collected_data),
            "authenticity_score": self.scorer.calculate_authenticity_score(inconsistencies),
            "component_scores": self.scorer.calculate_component_scores(collected_data)
        }
        scores["grade"] = self.scorer.assign_grade(scores["health_score"], scores["authenticity_score"])
        
        # 4. Generate Final Report
        report = self.report_gen.generate(collected_data, scores, inconsistencies)
        
        return report
