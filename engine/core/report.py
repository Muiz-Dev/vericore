import datetime
import logging
import platform

logger = logging.getLogger('ReportGenerator')

class ReportGenerator:
    def generate(self, collected_data: dict, scores: dict, inconsistencies: list) -> dict:
        report = {
            "timestamp": datetime.datetime.now().isoformat(),
            "vericore_version": "1.0.0",
            "scan_duration_note": "Deep hardware inspection",
            "scores": scores,
            "system_summary": self._extract_summary(collected_data),
            "components": collected_data,
            "inconsistencies": inconsistencies,
            "recommendations": self.generate_recommendations(collected_data, inconsistencies, scores),
            "verdict": self._compute_verdict(scores, inconsistencies)
        }
        return report

    def _compute_verdict(self, scores: dict, inconsistencies: list) -> dict:
        auth = scores.get("authenticity_score", 100)
        health = scores.get("health_score", 100)
        criticals = sum(1 for i in inconsistencies if i.get("severity") == "critical")

        if criticals > 0 or auth < 60:
            return {"label": "AT RISK", "color": "danger", "icon": "alert",
                    "detail": "Critical hardware inconsistencies detected. Manual verification required."}
        elif auth < 85 or health < 65:
            return {"label": "FLAGGED", "color": "warning", "icon": "warning",
                    "detail": "Minor hardware mismatches or component degradation detected."}
        else:
            return {"label": "VERIFIED", "color": "success", "icon": "shield",
                    "detail": "All hardware components passed identity and health checks."}

    def _extract_summary(self, data: dict) -> dict:
        smbios = data.get('smbios', {}) or {}
        bios   = data.get('bios', {}) or {}
        cpu    = data.get('cpu', {}) or {}
        os_info = platform.uname()

        return {
            "manufacturer":   smbios.get('system_manufacturer') or bios.get('system_manufacturer') or 'Unknown',
            "model":          smbios.get('system_product') or bios.get('system_model') or 'Unknown',
            "serial":         smbios.get('system_serial') or bios.get('serial_number') or 'Unknown',
            "bios_version":   bios.get('version') or smbios.get('bios_version') or 'Unknown',
            "uuid":           smbios.get('system_uuid') or 'Unknown',
            "os":             f"{os_info.system} {os_info.release}",
            "hostname":       os_info.node,
            "cpu_name":       cpu.get('brand') or cpu.get('wmi_name') or 'Unknown',
        }

    def generate_recommendations(self, data: dict, inconsistencies: list, scores: dict) -> list:
        recs = []

        # --- Critical: Inconsistencies ---
        criticals = [i for i in inconsistencies if i.get('severity') == 'critical']
        warnings  = [i for i in inconsistencies if i.get('severity') == 'warning']

        for inc in criticals:
            recs.append({
                "severity": "critical",
                "title": f"Hardware Spoofing Risk: {inc.get('field', 'Unknown')}",
                "detail": inc.get('description', 'Critical mismatch between hardware sources.'),
                "action": "Manual physical inspection required."
            })

        for inc in warnings:
            recs.append({
                "severity": "warning",
                "title": f"Hardware Mismatch: {inc.get('field', 'Unknown')}",
                "detail": inc.get('description', 'Value reported differently across sources.'),
                "action": "Verify component origin. Could indicate a replacement part."
            })

        # --- Battery ---
        bat = data.get('battery', {}) or {}
        if bat and not bat.get('failed') and bat.get('present'):
            wear = bat.get('wear_percent', 0) or 0
            cycles = bat.get('cycle_count', 'N/A')
            if wear > 30:
                recs.append({
                    "severity": "warning",
                    "title": f"Battery Wear High — {wear:.1f}% Capacity Lost",
                    "detail": f"Battery has {cycles} charge cycles. Remaining capacity is significantly degraded.",
                    "action": "Consider battery replacement for full-day usage."
                })
            elif wear > 15:
                recs.append({
                    "severity": "info",
                    "title": f"Battery Wear Normal — {wear:.1f}% Capacity Lost",
                    "detail": f"Battery has {cycles} charge cycles. Degradation is within normal range.",
                    "action": "Continue to monitor wear percentage over time."
                })
            else:
                recs.append({
                    "severity": "info",
                    "title": "Battery Health Excellent",
                    "detail": f"Only {wear:.1f}% capacity lost across {cycles} cycles.",
                    "action": "No action required."
                })

        # --- Storage SMART ---
        storage = data.get('storage', []) or []
        for i, disk in enumerate(storage):
            if not isinstance(disk, dict): continue
            smart = disk.get('smart_status', 'Unknown')
            model = disk.get('model', f'Drive {i}')
            if smart not in ('OK', None, 'Unknown', ''):
                recs.append({
                    "severity": "critical",
                    "title": f"Storage Failure Predicted — {model}",
                    "detail": f"SMART status reports: {smart}. Drive is showing signs of imminent failure.",
                    "action": "Back up all data immediately and replace the drive."
                })
            elif smart == 'OK':
                recs.append({
                    "severity": "info",
                    "title": f"Storage Health OK — {model}",
                    "detail": "SMART self-test passed. No reallocated sectors or pending errors.",
                    "action": "No action required."
                })

        # --- TPM ---
        tpm = data.get('tpm', {}) or {}
        if not tpm or not tpm.get('present'):
            recs.append({
                "severity": "warning",
                "title": "No TPM Security Chip Detected",
                "detail": "TPM is not present or not accessible. BitLocker, Windows Hello, and Secure Boot are limited.",
                "action": "Enable TPM in BIOS/UEFI if available."
            })
        elif not tpm.get('enabled') or not tpm.get('activated'):
            recs.append({
                "severity": "warning",
                "title": "TPM Present But Not Fully Active",
                "detail": f"TPM {tpm.get('version', '')} detected but is not enabled/activated.",
                "action": "Enable and activate TPM in BIOS security settings."
            })
        else:
            recs.append({
                "severity": "info",
                "title": f"TPM {tpm.get('version', '2.0')} Active & Secure",
                "detail": "Security chip is present, activated, and owned. Secure Boot ready.",
                "action": "No action required."
            })

        # --- Overall Health ---
        health = scores.get('health_score', 100)
        if health < 50:
            recs.append({
                "severity": "critical",
                "title": f"Overall Device Health Poor ({health}%)",
                "detail": "Multiple hardware components have degraded below acceptable thresholds.",
                "action": "Comprehensive hardware servicing recommended."
            })
        elif health < 75:
            recs.append({
                "severity": "warning",
                "title": f"Device Health Fair ({health}%)",
                "detail": "Some hardware components show wear or are unavailable.",
                "action": "Monitor affected components and consider servicing."
            })

        if not recs:
            recs.append({
                "severity": "info",
                "title": "All Systems Nominal",
                "detail": "Hardware passes all baseline identity and health checks. No anomalies detected.",
                "action": "No action required."
            })

        return recs
