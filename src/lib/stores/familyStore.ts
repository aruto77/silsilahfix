import { writable, type Writable } from 'svelte/store';
import { supabase } from '$lib/supabase';

interface Person {
    id: number;
    canvas_id: number;
    user_id: string;
    name: string;
    sex?: "L" | "P";
    birth_date?: string;
    position?: any;
    created_at: string;
    updated_at: string;
}


interface Relationship {
    id: number;
    user_id: string;
    parent_id: number;
    child_id: number;
    type: string;
    created_at: string;
}

interface Canvas {
    id: number;
    user_id: string;
    name: string;
    created_at: string;
}

interface UIState {
    selectedPerson: Person | null;
    selectedCanvas: Canvas | null;
    isLoading: boolean;
    error: string | null;
}

interface FamilyData {
    persons: Person[];
    relationships: Relationship[];
}

// Store for canvases
export const canvases: Writable<Canvas[]> = writable([]);

// Store for family data
export const familyData: Writable<FamilyData> = writable({
    persons: [],
    relationships: []
});

// Store for UI state
export const uiState: Writable<UIState> = writable({
    selectedPerson: null,
    selectedCanvas: null,
    isLoading: false,
    error: null
});

// Load family data for the current user and canvas
export async function loadFamilyData(canvasId: number | null = null) {
    uiState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        let personsQuery = supabase
            .from('persons')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        let relationshipsQuery = supabase
            .from('relationships')
            .select('*')
            .eq('user_id', user.id);

        if (canvasId) {
            personsQuery = personsQuery.eq('canvas_id', canvasId);
            // Relationships are filtered by persons, but since relationships don't have canvas_id,
            // we need to filter by persons in the canvas
            const { data: canvasPersons } = await supabase
                .from('persons')
                .select('id')
                .eq('canvas_id', canvasId);

            if (canvasPersons && canvasPersons.length > 0) {
                const personIds = canvasPersons.map(p => p.id);
                relationshipsQuery = relationshipsQuery
                    .in('parent_id', personIds)
                    .in('child_id', personIds);
            }
        }

        const [personsResult, relationshipsResult] = await Promise.all([
            personsQuery,
            relationshipsQuery
        ]);

        if (personsResult.error) throw personsResult.error;
        if (relationshipsResult.error) throw relationshipsResult.error;

        familyData.set({
            persons: personsResult.data || [],
            relationships: relationshipsResult.data || []
        });

        uiState.update(state => ({ ...state, isLoading: false }));
    } catch (error) {
        uiState.update(state => ({
            ...state,
            isLoading: false,
            error: (error as Error).message
        }));
        console.error('Error loading family data:', error);
    }
}

// Add a new person
export async function addPerson(
    personData: Omit<Person, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'canvas_id'> & { parentId?: string; spouseId?: string },
    canvasId: number
) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Extract relationship data
        const { parentId, spouseId, ...personRecord } = personData;

        // Insert person
        const { data, error } = await supabase
            .from('persons')
            .insert({
                ...personRecord,
                canvas_id: canvasId!,
                user_id: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // Add parent relationship if specified
        if (parentId && data) {
            await addRelationship({
                parent_id: parseInt(parentId),
                child_id: data.id,
                type: 'child'
            }, canvasId);
        }

        // Add spouse relationship if specified
        if (spouseId && data) {
            await addRelationship({
                parent_id: data.id,
                child_id: parseInt(spouseId),
                type: 'partner'
            }, canvasId);
        }

        // Reload family data for the canvas
        await loadFamilyData(canvasId);

        return data;
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error adding person:', error);
        throw error;
    }
}


// Add a relationship
export async function addRelationship(relationshipData: Omit<Relationship, 'id' | 'user_id' | 'created_at'>, canvasId: number | null = null) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('relationships')
            .insert({
                ...relationshipData,
                user_id: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // Reload family data for the canvas
        await loadFamilyData(canvasId);

        return data;
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error adding relationship:', error);
        throw error;
    }
}

// Update a person
export async function updatePerson(personId: number, updates: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at'>>, canvasId: number | null = null) {
    try {
        const { data, error } = await supabase
            .from('persons')
            .update(updates)
            .eq('id', personId)
            .select()
            .single();

        if (error) throw error;

        // Reload family data for the canvas
        await loadFamilyData(canvasId);

        return data;
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error updating person:', error);
        throw error;
    }
}

// Delete a person and their relationships
export async function deletePerson(personId: number, canvasId: number | null = null) {
    try {
        // Delete relationships first
        await supabase
            .from('relationships')
            .delete()
            .or(`parent_id.eq.${personId},child_id.eq.${personId}`);

        // Delete person
        const { error } = await supabase
            .from('persons')
            .delete()
            .eq('id', personId);

        if (error) throw error;

        // Reload family data for the canvas
        await loadFamilyData(canvasId);
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error deleting person:', error);
        throw error;
    }
}

// Load canvases for the current user
export async function loadCanvases() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('canvases')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        canvases.set(data || []);
        return data || [];
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error loading canvases:', error);
        throw error;
    }
}

// Add a new canvas
export async function addCanvas(canvasData: Omit<Canvas, 'id' | 'user_id' | 'created_at'>) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('canvases')
            .insert({
                ...canvasData,
                user_id: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // Reload canvases
        await loadCanvases();

        return data;
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error adding canvas:', error);
        throw error;
    }
}

// Delete a canvas and all its associated data
export async function deleteCanvas(canvasId: number) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // First, get all persons in this canvas to delete their relationships
        const { data: canvasPersons } = await supabase
            .from('persons')
            .select('id')
            .eq('canvas_id', canvasId)
            .eq('user_id', user.id);

        if (canvasPersons && canvasPersons.length > 0) {
            const personIds = canvasPersons.map(p => p.id);

            // Delete relationships involving these persons
            await supabase
                .from('relationships')
                .delete()
                .in('parent_id', personIds)
                .eq('user_id', user.id);

            await supabase
                .from('relationships')
                .delete()
                .in('child_id', personIds)
                .eq('user_id', user.id);
        }

        // Delete all persons in the canvas
        await supabase
            .from('persons')
            .delete()
            .eq('canvas_id', canvasId)
            .eq('user_id', user.id);

        // Finally, delete the canvas
        const { error } = await supabase
            .from('canvases')
            .delete()
            .eq('id', canvasId)
            .eq('user_id', user.id);

        if (error) throw error;

        // Reload canvases
        await loadCanvases();
    } catch (error) {
        uiState.update(state => ({ ...state, error: (error as Error).message }));
        console.error('Error deleting canvas:', error);
        throw error;
    }
}
