/**
 * Utility functions for data conversion and helpers
 */

export interface FamilyNode {
    id: string;
    parentId?: string;
    name: string;
    sex: "L" | "P";
    spouse?: string;
    notes?: string;
}

export interface Person {
    id: number;
    canvas_id: number;
    user_id: string;
    name: string;
    birth_date?: string;
    position?: { x: number; y: number };
    created_at: string;
    updated_at: string;
}

export interface Relationship {
    id: number;
    user_id: string;
    parent_id: number;
    child_id: number;
    type: string;
    created_at: string;
}


/**
 * Convert relational data (persons + relationships) to hierarchical FamilyNode format
 */
export function convertToFamilyNodes(persons: Person[], relationships: Relationship[]): FamilyNode[] {
    if (!persons || persons.length === 0) return [];

    // Create a map of person IDs to their data
    const personMap = new Map<string, FamilyNode>();

    persons.forEach((p) => {
        personMap.set(p.id.toString(), {
            id: p.id.toString(),
            name: p.name,
            sex: "P", // Default, could be extended in schema
            parentId: undefined,
            spouse: undefined,
            notes: undefined
        });
    });

    // Build parent-child and partner relationships
    relationships.forEach((rel) => {
        if (rel.type === "child") {
            const childNode = personMap.get(rel.child_id.toString());
            if (childNode) {
                childNode.parentId = rel.parent_id.toString();
            }
        } else if (rel.type === "partner") {
            const parentNode = personMap.get(rel.parent_id.toString());
            const childNode = personMap.get(rel.child_id.toString());
            if (parentNode && childNode) {
                parentNode.spouse = childNode.name;
            }
        }
    });

    return Array.from(personMap.values());
}


/**
 * Convert hierarchical FamilyNode format back to relational data
 */
export function convertFromFamilyNodes(familyNodes: FamilyNode[], canvasId: number) {
    const persons: Omit<Person, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [];
    const relationships: Omit<Relationship, 'id' | 'user_id' | 'created_at'>[] = [];

    familyNodes.forEach((node) => {
        // Add person
        persons.push({
            canvas_id: canvasId,
            name: node.name,
            birth_date: null as unknown as string,
            position: { x: 0, y: 0 }
        });

        // Add parent relationship if exists
        if (node.parentId) {
            relationships.push({
                parent_id: parseInt(node.parentId),
                child_id: parseInt(node.id),
                type: "child"
            });
        }
    });

    return { persons, relationships };
}


/**
 * Get children names for a parent node
 */
export function getChildrenNames(allNodes: FamilyNode[], parentId: string): string {
    const children = allNodes
        .filter((node) => node.parentId === parentId)
        .map((child) => child.name);

    return children.length > 0 ? children.join(", ") : "-";
}


/**
 * Find root nodes (nodes without parents) in a family tree
 * @param {FamilyNode[]} nodes
 * @returns {FamilyNode[]}
 */
export function findRootNodes(nodes: FamilyNode[]): FamilyNode[] {
    return nodes.filter((node: FamilyNode) => !node.parentId);

}

/**
 * Build a tree structure from flat nodes
 * @param {FamilyNode[]} nodes
 * @param {string | null} [parentId]
 * @returns {Array<FamilyNode & {children?: FamilyNode[]}>}
 */
export function buildTree(nodes: FamilyNode[], parentId: string | null = null): Array<FamilyNode & { children?: FamilyNode[] }> {
    return nodes
        .filter((node: FamilyNode) => node.parentId === parentId)
        .map((node: FamilyNode) => ({
            ...node,
            children: buildTree(nodes, node.id)
        }));

}

/**
 * Format date to Indonesian locale string
 */
export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/**
 * Generate a short ID for display
 */
export function getShortId(fullId: string | null | undefined): string {
    if (!fullId) return "-";
    return fullId.split("-")[0];
}


/**
 * Debounce function to limit how often a function can fire
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            func(...args);
        };
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}



/**
 * Check if code is running in browser environment
 * @returns {boolean}
 */
export function isBrowser() {
    return typeof window !== "undefined";
}

/**
 * Save data to local storage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveToLocalStorage(key: string, data: any): void {
    if (isBrowser()) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
        }
    }
}


/**
 * Load data from local storage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadFromLocalStorage(key: string): any | null {
    if (isBrowser()) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error("Error loading from localStorage:", e);
            return null;
        }
    }
    return null;
}


/**
 * Remove data from local storage
 */
export function removeFromLocalStorage(key: string): void {
    if (isBrowser()) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error("Error removing from localStorage:", e);
        }
    }
}
