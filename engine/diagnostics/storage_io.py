import os
import time
import threading
import tempfile
import logging

logger = logging.getLogger('StorageStress')

class StorageStressTest:
    def __init__(self):
        self.is_running = False
        self.thread = None
        self.current_mbps = 0
        self.current_iops = 0

    def _io_workload(self, duration_seconds):
        # We will write and read a 10MB chunk repeatedly
        chunk_size = 10 * 1024 * 1024 
        data = os.urandom(chunk_size)
        
        temp_dir = tempfile.gettempdir()
        test_file = os.path.join(temp_dir, 'vericore_iotest.tmp')
        
        end_time = time.time() + duration_seconds
        bytes_processed = 0
        io_operations = 0
        
        last_calc_time = time.time()
        
        try:
            while time.time() < end_time and self.is_running:
                # Write
                with open(test_file, 'wb') as f:
                    f.write(data)
                    f.flush()
                    os.fsync(f.fileno())
                bytes_processed += chunk_size
                io_operations += 1
                
                # Read
                with open(test_file, 'rb') as f:
                    _ = f.read()
                bytes_processed += chunk_size
                io_operations += 1
                
                # Calculate live metrics every 0.5s
                now = time.time()
                if now - last_calc_time >= 0.5:
                    elapsed = now - last_calc_time
                    self.current_mbps = (bytes_processed / (1024 * 1024)) / elapsed
                    self.current_iops = io_operations / elapsed
                    
                    bytes_processed = 0
                    io_operations = 0
                    last_calc_time = now
                    
        except Exception as e:
            logger.error(f"IO test failed: {e}")
        finally:
            if os.path.exists(test_file):
                try:
                    os.remove(test_file)
                except:
                    pass
            self.is_running = False
            self.current_mbps = 0
            self.current_iops = 0

    def start(self, duration_seconds=10):
        if self.is_running:
            return
            
        self.is_running = True
        self.current_mbps = 0
        self.current_iops = 0
        self.thread = threading.Thread(target=self._io_workload, args=(duration_seconds,))
        self.thread.start()

    def get_metrics(self):
        return {
            "mbps": round(self.current_mbps, 2),
            "iops": int(self.current_iops)
        }

    def is_active(self):
        if self.thread and self.thread.is_alive():
            return True
        self.is_running = False
        return False

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)
