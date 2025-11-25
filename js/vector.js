// 2D Vector Class - Optimized with mutable operations
export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    // Immutable operations (return new Vector)
    add(v) {
        return new Vector(this.x + v.x, this.y + v.y);
    }
    
    sub(v) {
        return new Vector(this.x - v.x, this.y - v.y);
    }
    
    mult(n) {
        return new Vector(this.x * n, this.y * n);
    }
    
    div(n) {
        return n !== 0 ? new Vector(this.x / n, this.y / n) : new Vector();
    }
    
    // Mutable operations (modify in place, return this for chaining)
    addMut(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    
    subMut(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    
    multMut(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    
    divMut(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
        }
        return this;
    }
    
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    
    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    
    magSq() {
        return this.x * this.x + this.y * this.y;
    }
    
    normalize() {
        const m = this.mag();
        return m > 0 ? this.div(m) : new Vector();
    }
    
    normalizeMut() {
        const m = this.mag();
        if (m > 0) {
            this.x /= m;
            this.y /= m;
        }
        return this;
    }
    
    limit(max) {
        const magSq = this.magSq();
        if (magSq > max * max) {
            const m = Math.sqrt(magSq);
            return new Vector(this.x * max / m, this.y * max / m);
        }
        return new Vector(this.x, this.y);
    }
    
    limitMut(max) {
        const magSq = this.magSq();
        if (magSq > max * max) {
            const m = Math.sqrt(magSq);
            this.x = this.x * max / m;
            this.y = this.y * max / m;
        }
        return this;
    }
    
    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    distSq(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }
    
    heading() {
        return Math.atan2(this.y, this.x);
    }
    
    static random() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
}
