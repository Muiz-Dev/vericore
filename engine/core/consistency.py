import logging
from dataclasses import dataclass, asdict

logger = logging.getLogger('ConsistencyEngine')

@dataclass
class Inconsistency:
    field: str
    source_a: str
    value_a: str
    source_b: str
    value_b: str
    severity: str  # 'critical', 'warning', 'info'
    description: str

class ConsistencyEngine:
    def __init__(self):
        self.inconsistencies = []

    def analyze(self, data: dict):
        self.inconsistencies = []
        
        smbios = data.get('smbios', {})
        bios = data.get('bios', {})
        reg = data.get('registry', {})
        cpu = data.get('cpu', {})
        storage = data.get('storage', [])
        display = data.get('display', [])
        
        # 1. Identity checks (SMBIOS vs BIOS vs Registry)
        if not smbios.get('failed') and not bios.get('failed'):
            if smbios.get('system_serial') and bios.get('serial_number'):
                if smbios['system_serial'] != bios['serial_number']:
                    self._add('Serial Number', 'SMBIOS', smbios['system_serial'], 'BIOS (WMI)', bios['serial_number'], 'critical', 'Hardware serial number mismatch between firmware tables.')
            
            if smbios.get('system_manufacturer') and bios.get('system_manufacturer'):
                if smbios['system_manufacturer'].lower() != bios['system_manufacturer'].lower():
                    self._add('System Manufacturer', 'SMBIOS', smbios['system_manufacturer'], 'BIOS (WMI)', bios['system_manufacturer'], 'warning', 'Manufacturer name differs between firmware sources.')

        if not reg.get('failed') and not smbios.get('failed'):
            if reg.get('SystemProductName') and smbios.get('system_product'):
                if reg['SystemProductName'] != smbios['system_product']:
                    self._add('Product Model', 'Windows Registry', reg['SystemProductName'], 'SMBIOS', smbios['system_product'], 'info', 'Registry product model differs from hardware firmware.')

        # 2. CPU checks
        if not cpu.get('failed'):
            wmi_name = cpu.get('wmi_name', '')
            brand = cpu.get('brand', '')
            # Fuzzy match (just check if key words like 'i7' or 'Ryzen' appear in both)
            if wmi_name and brand:
                if wmi_name.split()[0] not in brand and brand.split()[0] not in wmi_name:
                    self._add('Processor Identity', 'CPUID Instruction', brand, 'Windows WMI', wmi_name, 'warning', 'CPU identified differently by hardware instruction vs OS.')
            
            for issue in cpu.get('consistency_issues', []):
                self._add('Processor', 'Various', 'Mismatched', 'Various', 'Mismatched', 'info', issue)

        # 3. Storage checks
        for disk in storage:
            if isinstance(disk, dict) and 'error' not in disk:
                for issue in disk.get('consistency_issues', []):
                    self._add('Storage', 'WMI', 'Value A', 'SMART', 'Value B', 'warning', issue)

        # 4. Display checks
        for disp in display:
            if isinstance(disp, dict) and 'error' not in disp:
                for issue in disp.get('consistency_issues', []):
                    self._add('Monitor Identification', 'WMI', disp.get('wmi_name',''), 'EDID', disp.get('monitor_name',''), issue.get('severity', 'info'), issue.get('description',''))

        return [asdict(i) for i in self.inconsistencies]

    def _add(self, field, src_a, val_a, src_b, val_b, sev, desc):
        self.inconsistencies.append(Inconsistency(field, src_a, str(val_a), src_b, str(val_b), sev, desc))
