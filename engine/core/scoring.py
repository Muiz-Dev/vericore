import logging

logger = logging.getLogger('Scorer')

class Scorer:
    def calculate_health_score(self, data: dict) -> int:
        components = self.calculate_component_scores(data)
        
        weights = {
            'storage': 0.25,
            'memory': 0.20,
            'cpu': 0.15,
            'battery': 0.15,
            'display': 0.10,
            'network': 0.05,
            'tpm': 0.10
        }
        
        total_score = 0
        total_weight = 0
        
        for comp, score in components.items():
            if comp in weights and score is not None:
                total_score += score * weights[comp]
                total_weight += weights[comp]
                
        if total_weight == 0:
            return 0
            
        return int(round(total_score / total_weight))

    def calculate_authenticity_score(self, inconsistencies: list) -> int:
        score = 100
        
        for inc in inconsistencies:
            sev = inc.get('severity', 'info')
            if sev == 'critical':
                score -= 20
            elif sev == 'warning':
                score -= 8
            elif sev == 'info':
                score -= 2
                
        return max(0, score)

    def calculate_component_scores(self, data: dict) -> dict:
        scores = {}
        
        # Storage
        storage = data.get('storage', [])
        if not storage or (isinstance(storage, dict) and storage.get('failed')):
            scores['storage'] = None
        else:
            storage_score = 100
            for disk in storage:
                if disk.get('smart_status') != 'OK' and disk.get('smart_status') is not None:
                    storage_score = 0
            scores['storage'] = storage_score
            
        # Memory
        mem = data.get('memory', {})
        if mem.get('failed'):
            scores['memory'] = None
        else:
            scores['memory'] = 95 if mem.get('total_from_slots') == mem.get('total_bytes') else 80
            
        # CPU
        cpu = data.get('cpu', {})
        scores['cpu'] = None if cpu.get('failed') else 98
        
        # Battery
        bat = data.get('battery', {})
        if bat.get('failed') or not bat.get('present'):
            scores['battery'] = None
        else:
            wear = bat.get('wear_percent', 0)
            if wear < 10: scores['battery'] = 100
            elif wear < 20: scores['battery'] = 90
            elif wear < 40: scores['battery'] = 70
            elif wear < 60: scores['battery'] = 40
            else: scores['battery'] = 10
            
        # Display
        disp = data.get('display', [])
        scores['display'] = 100 if disp else 80
        
        # Network
        net = data.get('network', {})
        scores['network'] = 100 if net.get('count', 0) > 0 else 0
        
        # TPM
        tpm = data.get('tpm', {})
        if tpm.get('present') and tpm.get('activated') and tpm.get('enabled'):
            scores['tpm'] = 100
        elif tpm.get('present'):
            scores['tpm'] = 50
        else:
            scores['tpm'] = 0
            
        # GPU
        gpu = data.get('gpu', [])
        scores['gpu'] = 100 if gpu else 80
        
        return scores

    def assign_grade(self, health: int, auth: int) -> str:
        avg = (health * 0.4) + (auth * 0.6)
        if avg >= 90: return 'A'
        if avg >= 80: return 'B'
        if avg >= 70: return 'C'
        if avg >= 60: return 'D'
        return 'F'
