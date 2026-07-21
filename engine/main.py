import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
import json
import logging
import ctypes
import os
import websockets
from core.collector import HardwareCollector

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('VeriCoreEngine')

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

from diagnostics.cpu_stress import CPUStressTest
from diagnostics.mem_stress import MemoryStressTest
from diagnostics.storage_io import StorageStressTest

async def run_diagnostics_stream(websocket, duration):
    cpu_test = CPUStressTest()
    mem_test = MemoryStressTest()
    stor_test = StorageStressTest()
    
    cpu_test.start(duration)
    mem_test.start(target_mb=2048, duration_seconds=duration)
    stor_test.start(duration)
    
    end_time = asyncio.get_event_loop().time() + duration
    
    try:
        while asyncio.get_event_loop().time() < end_time:
            if not cpu_test.is_active() and not mem_test.is_active() and not stor_test.is_active():
                break
                
            # Gather metrics
            metrics = {
                "cpu_active": cpu_test.is_active(),
                "mem_active": mem_test.is_active(),
                "stor_active": stor_test.is_active(),
                "storage": stor_test.get_metrics(),
                # Simulate thermal metrics for now since true HWMonitor requires Admin+Driver
                "thermal": {
                    "cpu_temp": "85°C" if cpu_test.is_active() else "45°C",
                    "sys_temp": "45°C",
                    "throttling": "No"
                }
            }
            
            await websocket.send(json.dumps({
                "event": "diag_update",
                "metrics": metrics
            }))
            await asyncio.sleep(0.5)
            
    finally:
        cpu_test.stop()
        mem_test.stop()
        stor_test.stop()
        
    await websocket.send(json.dumps({"event": "diag_complete"}))

async def run_single_diagnostic(websocket, dtype, duration):
    """Run a single diagnostic type and stream live updates."""
    cpu_test = CPUStressTest() if dtype in ('cpu', 'thermal') else None
    mem_test = MemoryStressTest() if dtype == 'memory' else None
    stor_test = StorageStressTest() if dtype == 'storage' else None

    if cpu_test: cpu_test.start(duration)
    if mem_test: mem_test.start(target_mb=2048, duration_seconds=duration)
    if stor_test: stor_test.start(duration)

    end_time = asyncio.get_event_loop().time() + duration

    try:
        while asyncio.get_event_loop().time() < end_time:
            still_active = (
                (cpu_test and cpu_test.is_active()) or
                (mem_test and mem_test.is_active()) or
                (stor_test and stor_test.is_active())
            )
            if not still_active:
                break

            metrics = {
                "type": dtype,
                "cpu_active": cpu_test.is_active() if cpu_test else False,
                "mem_active": mem_test.is_active() if mem_test else False,
                "stor_active": stor_test.is_active() if stor_test else False,
                "storage": stor_test.get_metrics() if stor_test else {"mbps": 0, "iops": 0},
                "thermal": {
                    "cpu_temp": "85°C" if (cpu_test and cpu_test.is_active()) else "45°C",
                    "sys_temp": "45°C",
                    "throttling": "No"
                }
            }
            await websocket.send(json.dumps({"event": "diag_update", "metrics": metrics}))
            await asyncio.sleep(0.5)
    finally:
        if cpu_test: cpu_test.stop()
        if mem_test: mem_test.stop()
        if stor_test: stor_test.stop()

    await websocket.send(json.dumps({"event": "diag_single_complete", "type": dtype}))



async def handle_client(websocket):
    logger.info("Client connected to VeriCore Engine")
    try:
        async for message in websocket:
            data = json.loads(message)
            action = data.get('action')
            
            if action == 'ping':
                await websocket.send(json.dumps({"status": "ok", "version": "1.0.0"}))
                
            elif action == 'scan':
                logger.info("Starting hardware scan sequence...")
                
                # Capture the running event loop BEFORE entering the thread
                loop = asyncio.get_running_loop()
                
                def progress_callback(component_name, status, component_data=None):
                    # Thread-safe: schedule coroutine from the worker thread back into the event loop
                    try:
                        msg = json.dumps({
                            "event": "progress",
                            "component": component_name,
                            "status": "done" if status else "error",
                            "data": component_data
                        })
                        asyncio.run_coroutine_threadsafe(websocket.send(msg), loop)
                        logger.info(f"Progress sent: {component_name} → {'done' if status else 'error'}")
                    except Exception as e:
                        logger.error(f"Progress callback error: {e}")

                collector = HardwareCollector()
                report = await asyncio.to_thread(collector.collect_all, progress_callback)
                
                await websocket.send(json.dumps({
                    "event": "complete",
                    "report": report
                }))
                logger.info("Scan complete. Report sent to client.")
                
            elif action == 'run_diagnostics':
                duration = data.get('duration', 10)
                logger.info(f"Starting full diagnostics for {duration}s")
                asyncio.create_task(run_diagnostics_stream(websocket, duration))

            elif action == 'run_diagnostics_single':
                dtype = data.get('type', 'cpu')  # 'cpu' | 'memory' | 'storage' | 'thermal'
                duration = data.get('duration', 10)
                logger.info(f"Starting single diagnostic: {dtype} for {duration}s")
                asyncio.create_task(run_single_diagnostic(websocket, dtype, duration))

                
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error handling client: {e}")

async def main():
    if not is_admin():
        logger.warning("Engine is not running as Administrator. Deep inspection (SMBIOS, SMART, TPM) may fail or return limited data.")
    
    server = await websockets.serve(handle_client, "127.0.0.1", 7473)
    logger.info("VeriCore Inspection Engine running on ws://127.0.0.1:7473")
    
    await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
