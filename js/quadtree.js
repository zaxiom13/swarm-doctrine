// Spatial index for neighbour queries. Queries are always circles.
export class Rectangle {
    constructor(x, y, w, h) {
        // Centre and half-sizes.
        this.x = x; this.y = y; this.w = w; this.h = h;
    }

    contains(point) {
        const x = point.pos.x, y = point.pos.y;
        return x >= this.x - this.w && x < this.x + this.w && y >= this.y - this.h && y < this.y + this.h;
    }
}

export class Circle {
    constructor(x, y, r) {
        this.x = x; this.y = y; this.r = r; this.rSquared = r * r;
    }

    contains(point) {
        const dx = point.pos.x - this.x, dy = point.pos.y - this.y;
        return dx * dx + dy * dy <= this.rSquared;
    }

    intersects(rect) {
        const dx = Math.abs(rect.x - this.x), dy = Math.abs(rect.y - this.y);
        if (dx > this.r + rect.w || dy > this.r + rect.h) return false;
        if (dx <= rect.w || dy <= rect.h) return true;
        return (dx - rect.w) ** 2 + (dy - rect.h) ** 2 <= this.rSquared;
    }
}

export class QuadTree {
    constructor(boundary, capacity = 4) {
        this.boundary = boundary;
        this.capacity = capacity;
        this.clear();
    }

    insert(point) {
        if (!this.boundary.contains(point)) return false;
        if (this.points.length < this.capacity) { this.points.push(point); return true; }
        if (!this.children) {
            const { x, y } = this.boundary, w = this.boundary.w / 2, h = this.boundary.h / 2;
            // Order: north-west, north-east, south-west, south-east.
            this.children = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => new QuadTree(new Rectangle(x + sx * w, y + sy * h, w, h), this.capacity));
        }
        // A point belongs to exactly one child, so pick it directly.
        const east = point.pos.x >= this.boundary.x, south = point.pos.y >= this.boundary.y;
        return this.children[(south ? 2 : 0) + (east ? 1 : 0)].insert(point);
    }

    // Indexed loops: this runs for every ship every tick, and for…of is measurably slower here.
    query(range, found = []) {
        if (!range.intersects(this.boundary)) return found;
        const points = this.points, children = this.children;
        for (let i = 0; i < points.length; i++) if (range.contains(points[i])) found.push(points[i]);
        if (children) for (let i = 0; i < 4; i++) children[i].query(range, found);
        return found;
    }

    clear() {
        this.points = [];
        this.children = null;
    }
}
