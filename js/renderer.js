// Renderer - Handles all canvas drawing
import { CONFIG } from './config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.time = 0;
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Regenerate stars on resize
        this.starsCanvas = null;
        this.vignetteGradient = null;
    }
    
    clear(screenShake = 0) {
        this.ctx.save();
        
        // Apply screen shake
        if (screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * screenShake * 10;
            const shakeY = (Math.random() - 0.5) * screenShake * 10;
            this.ctx.translate(shakeX, shakeY);
        }
        
        // Clear canvas to transparent to let CSS background show
        this.ctx.clearRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
    }
    
    drawGrid() {
        // Grid is now handled by CSS on the body element for consistency
    }
    
    drawMouseInfluence(mousePos, mouseDown, rightMouseDown, scatterActive) {
        if (!mouseDown && !rightMouseDown) return;
        
        const radius = CONFIG.influenceRadius * (scatterActive ? 1.5 : 1);
        const color = mouseDown ? (scatterActive ? '0, 255, 136' : '0, 255, 255') : '255, 100, 100';
        
        // Outer ring with expanding animation when scatter is active
        this.ctx.beginPath();
        this.ctx.arc(mousePos.x, mousePos.y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${color}, 0.3)`;
        this.ctx.lineWidth = scatterActive ? 4 : 2;
        this.ctx.stroke();
        
        // Radial gradient for scatter effect
        if (scatterActive) {
            const gradient = this.ctx.createRadialGradient(
                mousePos.x, mousePos.y, 0,
                mousePos.x, mousePos.y, radius
            );
            gradient.addColorStop(0, `rgba(${color}, 0.4)`);
            gradient.addColorStop(0.5, `rgba(${color}, 0.1)`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(mousePos.x, mousePos.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            // Expanding rings
            for (let i = 0; i < 3; i++) {
                const ringPhase = (this.time * 3 + i * 0.3) % 1;
                const ringRadius = radius * ringPhase;
                const ringAlpha = (1 - ringPhase) * 0.3;
                
                this.ctx.beginPath();
                this.ctx.arc(mousePos.x, mousePos.y, ringRadius, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(${color}, ${ringAlpha})`;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        }
        
        // Pulsing center
        const pulse = Math.sin(Date.now() / 100) * 5 + 10;
        this.ctx.beginPath();
        this.ctx.arc(mousePos.x, mousePos.y, pulse, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(${color}, 0.5)`;
        this.ctx.fill();
    }
    
    drawBoids(boids, powerupManager, playerTeam) {
        // Draw shield effect around player boids if shield is active
        const hasShield = powerupManager && powerupManager.isShielded();
        
        for (const boid of boids) {
            // Draw shield glow for player boids
            if (hasShield && boid.team === playerTeam) {
                this.ctx.beginPath();
                this.ctx.arc(boid.pos.x, boid.pos.y, 12, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(68, 136, 255, 0.15)';
                this.ctx.fill();
            }
            boid.draw(this.ctx);
        }
    }
    
    drawVignette() {
        // Cache vignette gradient
        if (!this.vignetteGradient) {
            this.vignetteGradient = this.ctx.createRadialGradient(
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3,
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.9
            );
            this.vignetteGradient.addColorStop(0, 'transparent');
            this.vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        }
        
        this.ctx.fillStyle = this.vignetteGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawStars() {
        // Static starfield for atmosphere - cached as image for performance
        if (!this.starsCanvas) {
            this.starsCanvas = document.createElement('canvas');
            this.starsCanvas.width = this.canvas.width;
            this.starsCanvas.height = this.canvas.height;
            const starCtx = this.starsCanvas.getContext('2d');
            
            for (let i = 0; i < 80; i++) { // Fewer stars
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                const size = Math.random() * 1.5;
                const alpha = Math.random() * 0.4 + 0.2;
                
                starCtx.beginPath();
                starCtx.arc(x, y, size, 0, Math.PI * 2);
                starCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                starCtx.fill();
            }
        }
        
        this.ctx.drawImage(this.starsCanvas, 0, 0);
    }
    
    drawParticles(particles) {
        for (const p of particles) {
            const alpha = p.life / p.maxLife;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${p.colorRgb}, ${alpha})`;
            this.ctx.fill();
        }
    }
    
    drawPowerups(powerupManager) {
        if (powerupManager) {
            powerupManager.draw(this.ctx);
        }
    }
    
    drawScatterCooldown(cooldown, maxCooldown) {
        // Draw cooldown bar in bottom right
        const barWidth = 120;
        const barHeight = 8;
        const padding = 20;
        const x = this.canvas.width - barWidth - padding;
        const y = this.canvas.height - barHeight - padding - 30;
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
        
        // Border
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
        
        // Fill based on cooldown
        const fillRatio = 1 - (cooldown / maxCooldown);
        const fillWidth = barWidth * fillRatio;
        
        // Gradient fill
        const gradient = this.ctx.createLinearGradient(x, y, x + barWidth, y);
        if (fillRatio >= 1) {
            gradient.addColorStop(0, '#00ff88');
            gradient.addColorStop(1, '#00ffff');
        } else {
            gradient.addColorStop(0, '#ff4444');
            gradient.addColorStop(fillRatio, '#ffaa00');
            gradient.addColorStop(1, '#ffaa00');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y, fillWidth, barHeight);
        
        // Glow effect when ready
        if (fillRatio >= 1) {
            this.ctx.shadowColor = '#00ff88';
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(x, y, fillWidth, barHeight);
            this.ctx.shadowBlur = 0;
        }
        
        // Label
        this.ctx.font = "11px 'Orbitron', sans-serif";
        this.ctx.fillStyle = fillRatio >= 1 ? '#00ff88' : '#ffaa00';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SCATTER', x + barWidth / 2, y - 6);
    }
    
    drawActiveEffects(powerupManager) {
        if (!powerupManager) return;
        
        const effects = powerupManager.getActiveEffects();
        if (effects.length === 0) return;
        
        const x = this.canvas.width - 140;
        let y = this.canvas.height - 80;
        
        for (const effect of effects) {
            const barWidth = 100;
            const barHeight = 6;
            const fillRatio = effect.remaining / effect.data.duration;
            
            // Background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(x, y, barWidth, barHeight);
            
            // Fill
            this.ctx.fillStyle = effect.data.color;
            this.ctx.fillRect(x, y, barWidth * fillRatio, barHeight);
            
            // Label
            this.ctx.font = "10px 'Rajdhani', sans-serif";
            this.ctx.fillStyle = effect.data.color;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${effect.data.icon} ${effect.data.name}`, x, y - 4);
            
            y -= 24;
        }
    }
    
    drawObstacles(obstacleManager) {
        if (obstacleManager) {
            obstacleManager.draw(this.ctx);
        }
    }
    
    render(boids, mousePos, mouseDown, rightMouseDown, gameState, powerupManager, particles, screenShake, scatterCooldown, scatterCooldownMax, scatterActive, playerTeam, obstacleManager) {
        this.time += 0.016;
        this.clear(screenShake);
        this.drawStars();
        this.drawGrid();
        
        if (gameState === 'playing') {
            // Draw obstacles behind everything else
            this.drawObstacles(obstacleManager);
            this.drawMouseInfluence(mousePos, mouseDown, rightMouseDown, scatterActive);
            this.drawPowerups(powerupManager);
            this.drawParticles(particles || []);
        }
        
        this.drawBoids(boids, powerupManager, playerTeam);
        
        if (gameState === 'playing') {
            this.drawScatterCooldown(scatterCooldown || 0, scatterCooldownMax || 1.2);
            this.drawActiveEffects(powerupManager);
        }
        
        this.drawVignette();
        
        this.ctx.restore(); // Restore from screen shake
    }
}
