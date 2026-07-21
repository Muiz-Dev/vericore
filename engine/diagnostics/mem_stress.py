import threading
import time
import logging
import gc

logger = logging.getLogger('MemoryStress')

class MemoryStressTest:
    def __init__(self):
        self.blocks = []
        self.is_running = False
        self.thread = None

    def _allocate_workload(self, target_mb, duration_seconds):
        """Allocates memory block by block to avoid immediate OOM kill, then holds it."""
        try:
            # Allocate in 100MB chunks
            chunk_size = 100 * 1024 * 1024
            chunks_needed = target_mb // 100
            
            logger.info(f"Allocating {target_mb}MB in {chunks_needed} chunks...")
            
            for _ in range(chunks_needed):
                if not self.is_running:
                    break
                # Create a byte array of random-ish data (just 'A's to be fast, but large)
                self.blocks.append(bytearray(b'A' * chunk_size))
                time.sleep(0.05) # Small pause to let OS breathe
                
            # Hold memory for the duration
            end_time = time.time() + duration_seconds
            while time.time() < end_time and self.is_running:
                time.sleep(0.5)
                
        except MemoryError:
            logger.warning("Hit memory limit during allocation.")
        except Exception as e:
            logger.error(f"Memory stress test error: {e}")
        finally:
            self._free()

    def start(self, target_mb=2048, duration_seconds=10):
        if self.is_running:
            return
            
        self.is_running = True
        self.thread = threading.Thread(target=self._allocate_workload, args=(target_mb, duration_seconds))
        self.thread.start()

    def is_active(self):
        if self.thread and self.thread.is_alive():
            return True
        self.is_running = False
        return False

    def _free(self):
        self.blocks = []
        gc.collect()
        self.is_running = False

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)
        self._free()
        logger.info("Memory stress test stopped.")
