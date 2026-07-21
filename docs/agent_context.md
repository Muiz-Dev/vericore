# VeriCore - Agent Context & Project Documentation

**ATTENTION AGENTS**: This document contains the complete context, architecture, and roadmap for the VeriCore project. Read this thoroughly before making changes to the codebase.

## 1. Executive Summary
VeriCore is an advanced hardware inspection and authenticity platform. Unlike traditional system information tools that simply display data reported by the OS (which can be spoofed in the registry), VeriCore performs deep hardware inspection, cross-validation, integrity analysis, and diagnostic testing. 

The core philosophy is: **"Don't just read what the operating system says—verify that it is true."**

## 2. Project Architecture
The application uses a split architecture, communicating locally via WebSockets (IPC) on `ws://127.0.0.1:7473`.

### 2.1. The Frontend (Electron UI) - `c:\vericore\ui\`
- **Tech Stack**: Electron, HTML5, Vanilla JS, Vanilla CSS. (No React/Vue/Tailwind).
- **Aesthetics**: Premium deep space dark theme (`#070b17`), electric blue accents, glassmorphism (`backdrop-filter: blur`), Outfit font, and dynamic micro-animations. 
- **Core Files**:
  - `main.js` / `preload.js`: Electron shell and context bridge.
  - `src/index.html`: The 5-view shell (Dashboard, Scan, Report, Diagnostics, Settings).
  - `src/css/main.css`: Comprehensive custom design system.
  - `src/js/app.js`: Main controller and navigation logic.
  - `src/js/scan.js`: Controls the animated scan sequence.
  - `src/js/report.js`: Renders the final JSON report into the UI.
- **Demo Mode**: The UI gracefully falls back to using mock data (`MOCK_REPORT` in `app.js`) if the Python engine cannot be reached.

### 2.2. The Backend (Python Inspection Engine) - `c:\vericore\engine\`
- **Tech Stack**: Python 3.12+, `asyncio`, `websockets`, `wmi`, `psutil`, `py-cpuinfo`.
- **Core Files**:
  - `main.py`: The WebSocket server entry point. Listens for the `{"action": "scan"}` payload.
  - `core/collector.py`: Orchestrator that runs all data collectors in sequence and streams progress.
  - `core/consistency.py`: Analyzes collected data for mismatches (e.g., CPU identity in Registry vs CPUID instruction).
  - `core/scoring.py`: Generates Health and Authenticity scores (0-100) based on wear and inconsistencies.
  - `core/report.py`: Bundles findings into the final JSON payload.
- **Hardware Collectors (`collectors/`)**:
  - `smbios.py` / `bios.py`: Motherboard/Firmware data (WMI/SMBIOS).
  - `cpu.py`: Processor ID via `py-cpuinfo` (CPUID instruction).
  - `memory.py`: Physical RAM slot mapping vs OS total.
  - `storage.py`: NVMe/SATA checks, including SMART failure data.
  - `battery.py`: ACPI deep data for precise cycle count and wear calculation.
  - `display.py`: Raw EDID binary parsing from the Windows Registry.
  - `gpu.py`, `network.py`, `tpm.py`, `registry.py`.

## 3. Current Progress (Where We Are)
- The entire foundation is built. The UI is complete, beautifully styled, and responsive.
- The Python engine has all 10 collectors written, along with the cross-validation logic and the WebSocket server.
- **Immediate Next Step**: Run `pip install -r c:\vericore\engine\requirements.txt`, start `python c:\vericore\engine\main.py`, and start the UI with `npm start` in `c:\vericore\ui\`.

## 4. Roadmap (What Remains to be Built)
Future agents should reference this roadmap when determining next steps:

1. **Phase 2: Active Diagnostics & Stress Testing**
   - Implement multi-threaded CPU stress testing to verify thermal throttling and clock speeds.
   - Implement RAM read/write pattern testing to detect spoofed capacities.
   - Implement storage benchmarking to catch cheap SATA drives spoofed as NVMe.
2. **Phase 3: Advanced Low-Level Extraction**
   - Implement direct NVMe/ATA passthrough using `DeviceIoControl` in Python via `ctypes` (bypassing WMI SMART data).
   - Read raw PCIe configuration spaces to detect fake GPUs.
   - Direct memory reading of `GetSystemFirmwareTable` to prevent WMI SMBIOS spoofing.
3. **Phase 4: Reporting & Export Enhancements**
   - Implement PDF generation in the Electron UI.
   - Implement cryptographic signing of the JSON/PDF reports using a VeriCore private key.
4. **Phase 5: Polish & Deployment**
   - Complete the UI Settings panel.
   - Implement a UAC prompt so the Python engine always runs as Administrator (required for deep hardware hooks).
   - Package the app (Electron + PyInstaller engine) into a single Windows `.exe` installer.
