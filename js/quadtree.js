// QuadTree for spatial partitioning optimization
export class Rectangle {
    constructor(x, y, w, h) {
        this.x = x; // center x
        this.y = y; // center y
        this.w = w; // half width
        this.h = h; // half height
    }

    contains(point) {
        return (
            point.pos.x >= this.x - this.w &&
            point.pos.x < this.x + this.w &&
            point.pos.y >= this.y - this.h &&
            point.pos.y < this.y + this.h
        );
    }

    intersects(range) {
        return !(
            range.x - range.w > this.x + this.w ||
            range.x + range.w < this.x - this.w ||
            range.y - range.h > this.y + this.h ||
            range.y + range.h < this.y - this.h
        );
    }
}

export class Circle {
    constructor(x, y, r) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.rSquared = r * r;
    }

    contains(point) {
        const dx = point.pos.x - this.x;
        const dy = point.pos.y - this.y;
        return (dx * dx + dy * dy) <= this.rSquared;
    }

    intersects(range) {
        const xDist = Math.abs(range.x - this.x);
        const yDist = Math.abs(range.y - this.y);

        const r = this.r;
        const w = range.w;
        const h = range.h;

        const edges = Math.pow(xDist - w, 2) + Math.pow(yDist - h, 2);

        // No intersection
        if (xDist > (r + w) || yDist > (r + h)) return false;
        // Intersection within the circle
        if (xDist <= w || yDist <= h) return true;
        // Intersection on the edge of the circle
        return edges <= this.rSquared;
    }
}

export class QuadTree {
    constructor(boundary, capacity = 4) {
        this.boundary = boundary;
        this.capacity = capacity;
        this.points = [];
        this.divided = false;
        this.northeast = null;
        this.northwest = null;
        this.southeast = null;
        this.southwest = null;
    }

    subdivide() {
        const x = this.boundary.x;
        const y = this.boundary.y;
        const w = this.boundary.w / 2;
        const h = this.boundary.h / 2;

        const ne = new Rectangle(x + w, y - h, w, h);
        this.northeast = new QuadTree(ne, this.capacity);

        const nw = new Rectangle(x - w, y - h, w, h);
        this.northwest = new QuadTree(nw, this.capacity);

        const se = new Rectangle(x + w, y + h, w, h);
        this.southeast = new QuadTree(se, this.capacity);

        const sw = new Rectangle(x - w, y + h, w, h);
        this.southwest = new QuadTree(sw, this.capacity);

        this.divided = true;
    }

    insert(point) {
        if (!this.boundary.contains(point)) {
            return false;
        }

        if (this.points.length < this.capacity) {
            this.points.push(point);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
        }

        return (
            this.northeast.insert(point) ||
            this.northwest.insert(point) ||
            this.southeast.insert(point) ||
            this.southwest.insert(point)
        );
    }

    query(range, found = []) {
        if (!this.boundary.intersects(range)) {
            return found;
        }

        for (const p of this.points) {
            if (range.contains(p)) {
                found.push(p);
            }
        }

        if (this.divided) {
            this.northwest.query(range, found);
            this.northeast.query(range, found);
            this.southwest.query(range, found);
            this.southeast.query(range, found);
        }

        return found;
    }

    clear() {
        this.points = [];
        this.divided = false;
        this.northeast = null;
        this.northwest = null;
        this.southeast = null;
        this.southwest = null;
    }
}
