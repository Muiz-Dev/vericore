import multiprocessing
import time
import math
import logging

logger = logging.getLogger('CPUStress')

def math_workload(duration_seconds):
    """A heavy mathematical workload to max out a single CPU core."""
    end_time = time.time() + duration_seconds
    # Spin computing squares and square roots
    while time.time() < end_time:
        for i in range(1, 10000):
            _ = math.sqrt(i ** 2)

class CPUStressTest:
    def __init__(self):
        self.processes = []
        self.is_running = False

    def start(self, duration_seconds=10):
        """Spawns a process per logical core to stress the CPU."""
        if self.is_running:
            return
            
        self.is_running = True
        core_count = multiprocessing.cpu_count()
        logger.info(f"Starting CPU stress test on {core_count} cores for {duration_seconds}s")
        
        self.processes = []
        for _ in range(core_count):
            p = multiprocessing.Process(target=math_workload, args=(duration_seconds,))
            p.start()
            self.processes.append(p)

    def is_active(self):
        if not self.processes:
            self.is_running = False
            return False
            
        active = any(p.is_alive() for p in self.processes)
        if not active:
            self.is_running = False
            
        return active

    def stop(self):
        """Forcefully terminates the stress test."""
        for p in self.processes:
            if p.is_alive():
                p.terminate()
        self.processes = []
        self.is_running = False
        logger.info("CPU stress test stopped.")
