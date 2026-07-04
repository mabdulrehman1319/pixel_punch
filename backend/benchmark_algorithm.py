import random

class BenchmarkCalculator:
    #(higher= more demanding)
    GAME_DIFFICULTY={
        "Grand Theft Auto V":0.7,
        "Red Dead Redemption 2":1.0,
        "Elden Ring":0.8,
        "Fortnite":0.5,
        "Assassin's Creed Mirage":0.75,
        "Mafia 3":0.65,
        "Forza Horizon 5":0.85,
        "Ghost of Tsushima":0.9,
        "Resident Evil 4 Remake":0.8,
        "Valorant":0.3,
        "Cyberpunk 2077":1.1,
        "The Witcher 3: Wild Hunt":0.75,
        "Minecraft":0.25,
        "Counter-Strike 2":0.35,
        "Baldur's Gate 3":0.85,
        "Hades":0.3,
        "Hogwarts Legacy":1.05,
        "Kingdom Come: Deliverance II":1.0,
        "Marvel Rivals":0.6,
        "Black Myth: Wukong":1.15,
    }

    def __init__(self, cpu_name, cpu_speed, ram_size, gpu_name, gpu_memory, game):
        self.cpu_name=cpu_name
        self.cpu_speed=cpu_speed
        self.ram_size=ram_size
        self.gpu_name=gpu_name
        self.gpu_memory=gpu_memory
        self.game = game
        self.difficulty=self.GAME_DIFFICULTY.get(game,0.7)

    def calculate_base_score(self):
        """Calculate a base performance score"""
        cpu_score=self.cpu_speed*20
        ram_score=self.ram_size*2
        gpu_score=self.gpu_memory*15

        #gpu name heuristics
        if "RTX 40" in self.gpu_name or "RX 7" in self.gpu_name:
            gpu_score*=1.5
        elif "RTX 30" in self.gpu_name or "RX 6" in self.gpu_name:
            gpu_score*=1.3
        elif "RTX 20" in self.gpu_name or "RX 5" in self.gpu_name:
            gpu_score*=1.1
        elif "GTX 16" in self.gpu_name:
            gpu_score*=0.9
        return cpu_score + ram_score + gpu_score

    def calculate_fps(self):
        """Calculate FPS estimates"""
        base_score=self.calculate_base_score()

        #Adjust for game difficulty 
        adjusted_score=base_score/self.difficulty

        #calculate average fps
        avg_fps=int(min(adjusted_score*0.8,240))

        #calculate min and max with some variance
        min_fps=int(avg_fps*0.6)
        max_fps=int(avg_fps*1.5)
        return {
            "min":max(min_fps,20),
            "avg":max(avg_fps,30),
            "max":min(max_fps,240)
        }

    def calculate_usage(self):
        """Calculate resource usage Percentages"""
        base_score=self.calculate_base_score()

        #cpu usage inversely proportional to cpu speed
        cpu_usage=int(min((self.difficulty*100)/self.cpu_speed,95))

        #gpu usage typically high in gaming
        gpu_usage=int(min(70+(self.difficulty*25),98))

        #RAM usage 
        ram_usage=int(min((self.difficulty*80)/(self.ram_size/16),85))

        return {
            "cpu":max(cpu_usage,30),
            "gpu":max(gpu_usage,60),
            "ram":max(ram_usage,25)
        }

    def calculate_temperature(self):
        """Calculate Temperature Estimates"""
        base_score=self.calculate_base_score()

        #higher difficulty = higher temp
        base_cpu_temp=50+(self.difficulty*25)
        base_gpu_temp=55+(self.difficulty*30)

        #add some variance
        avg_cpu=int(base_cpu_temp+random.randint(-5,5))
        avg_gpu=int(base_gpu_temp+random.randint(-5,5))
        max_cpu=int(avg_cpu+random.randint(10,20))
        max_gpu=int(avg_gpu+random.randint(10,15))

        return {
            "avg_cpu":min(avg_cpu,85),
            "avg_gpu":min(avg_gpu,80),
            "max_cpu":min(max_cpu,95),
            "max_gpu":min(max_gpu,88)
        }

    def get_results(self):
        """Get Complete Benchmark Results"""
        return {
            "fps": self.calculate_fps(),
            "usage": self.calculate_usage(),
            "temperature": self.calculate_temperature()
        } 
