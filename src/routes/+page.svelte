<script>
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabase";
    import { onMount } from "svelte";
    import FamilyTree from "$lib/components/FamilyTree.svelte";
    import PersonModal from "$lib/components/PersonModal.svelte";
    import {
        familyData,
        canvases,
        loadCanvases,
        addCanvas,
        addPerson,
        loadFamilyData,
        deleteCanvas,
        updatePerson,
        deletePerson,
    } from "$lib/stores/familyStore";

    /**
     * @typedef {Object} User
     * @property {string} id
     * @property {string} email
     */

    /**
     * @typedef {Object} FamilyNode
     * @property {string} id
     * @property {string} [parentId]
     * @property {string} name
     * @property {"L" | "P"} sex
     * @property {string} [spouseId]
     * @property {string} [spouseName]
     * @property {string} [notes]
     */

    /**
     * @typedef {Object} Family
     * @property {string} id
     * @property {string} title
     */

    /** @type {User | null} */
    let user = $state(null);
    let loading = $state(true);

    /** @type {FamilyNode[]} */
    let nodes = $state([]);
    /** @type {Family} */
    let family = $state({ id: "", title: "" });
    let lastSync = $state(new Date());
    /** @type {"default" | "expand" | "collapse"} */
    let nodesView = $state("default");

    let openEditor = $state(false);
    /** @type {FamilyNode | null} */
    let editingNode = $state(null);

    /** @type {FamilyTree | null} */
    let familyTreeRef = $state(null);

    /** @type {number | null} */
    let selectedCanvasId = $state(null);
    let showCreateCanvasModal = $state(false);
    let newCanvasName = $state("");
    let newPersonName = $state("");
    let showMenuPopup = $state(false);
    let showDeleteCanvasModal = $state(false);
    let selectedCanvasesToDelete = $state(/** @type {number[]} */ ([]));

    // Available parents and spouses for dropdown
    let availableParents = $state(
        /** @type {Array<{id: string, name: string}>} */ ([]),
    );
    let availableSpouses = $state(
        /** @type {Array<{id: string, name: string}>} */ ([]),
    );

    // Session timeout: 1 day in milliseconds
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    let sessionCheckInterval = $state(
        /** @type {ReturnType<typeof setInterval> | null} */ (null),
    );

    onMount(async () => {
        const {
            data: { user: currentUser },
        } = await supabase.auth.getUser();
        user = /** @type {User} */ (currentUser);
        loading = false;

        if (!user) {
            goto("/login");
        } else {
            await loadCanvases();
            if ($canvases.length > 0) {
                selectedCanvasId = $canvases[0].id;
                family = {
                    id: selectedCanvasId.toString(),
                    title: $canvases[0].name,
                };
                await loadFamilyData(selectedCanvasId);
            }

            // Start session timeout check
            startSessionTimeoutCheck();
        }
    });

    /**
     * Check if session has expired and auto-logout if needed
     */
    function checkSessionTimeout() {
        const loginTimestamp = localStorage.getItem("loginTimestamp");
        if (!loginTimestamp) {
            // No login timestamp found, logout
            handleAutoLogout();
            return;
        }

        const elapsed = Date.now() - parseInt(loginTimestamp, 10);
        if (elapsed >= SESSION_TIMEOUT) {
            // Session expired, logout
            handleAutoLogout();
        }
    }

    /**
     * Start periodic session timeout check
     */
    function startSessionTimeoutCheck() {
        // Check immediately
        checkSessionTimeout();

        // Check every minute
        sessionCheckInterval = setInterval(() => {
            checkSessionTimeout();
        }, 60000); // Check every minute
    }

    /**
     * Handle auto-logout when session expires
     */
    async function handleAutoLogout() {
        // Clear interval
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }

        // Clear login timestamp
        localStorage.removeItem("loginTimestamp");

        // Sign out from Supabase
        await supabase.auth.signOut();

        // Clear session cookie
        document.cookie =
            "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

        // Show alert and redirect
        alert("Sesi Anda telah berakhir. Silakan masuk kembali.");
        goto("/login");
    }

    $effect(() => {
        const data = $familyData;
        if (data && data.persons) {
            nodes = convertToFamilyNodes(
                data.persons || [],
                data.relationships || [],
            );

            // Update available parents and spouses
            availableParents = data.persons.map((p) => ({
                id: p.id.toString(),
                name: p.name,
            }));

            availableSpouses = data.persons.map((p) => ({
                id: p.id.toString(),
                name: p.name,
            }));
        }
    });

    /**
     * @param {any[]} persons
     * @param {any[]} relationships
     * @returns {FamilyNode[]}
     */
    function convertToFamilyNodes(persons, relationships) {
        if (!persons || persons.length === 0) return [];

        /** @type {Map<string, FamilyNode>} */
        const personMap = new Map();

        persons.forEach((p) => {
            personMap.set(p.id.toString(), {
                id: p.id.toString(),
                name: p.name,
                sex: "P",
                parentId: undefined,
                spouseId: undefined,
                spouseName: undefined,
                notes: undefined,
            });
        });

        relationships.forEach((rel) => {
            if (rel.type === "child") {
                const childNode = personMap.get(rel.child_id.toString());
                if (childNode) {
                    childNode.parentId = rel.parent_id.toString();
                }
            } else if (rel.type === "partner") {
                const parentNode = personMap.get(rel.parent_id.toString());
                const partnerNode = personMap.get(rel.child_id.toString());
                if (parentNode && partnerNode) {
                    parentNode.spouseId = partnerNode.id;
                    parentNode.spouseName = partnerNode.name;
                    // Also set reverse relationship
                    partnerNode.spouseId = parentNode.id;
                    partnerNode.spouseName = parentNode.name;
                }
            }
        });

        return Array.from(personMap.values());
    }

    async function signOut() {
        // Clear session check interval
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }

        // Clear login timestamp
        localStorage.removeItem("loginTimestamp");

        await supabase.auth.signOut();
        document.cookie =
            "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        goto("/login");
    }

    async function createNewCanvas() {
        if (!newCanvasName.trim() || !newPersonName.trim()) {
            alert("Please enter both canvas name and first person name");
            return;
        }

        try {
            const newCanvas = await addCanvas({ name: newCanvasName });
            await addPerson(
                { name: newPersonName, position: { x: 100, y: 100 } },
                newCanvas.id,
            );

            selectedCanvasId = newCanvas.id;
            family = { id: newCanvas.id.toString(), title: newCanvasName };
            showCreateCanvasModal = false;
            newCanvasName = "";
            newPersonName = "";
            lastSync = new Date();

            await loadFamilyData(selectedCanvasId);
        } catch (error) {
            console.error("Error creating canvas:", error);
            alert("Failed to create canvas");
        }
    }

    /**
     * @param {FamilyNode} node
     */
    function handleNodeClick(node) {
        editingNode = node;
        openEditor = true;
    }

    /**
     * @typedef {Object} PersonInput
     * @property {string} [id]
     * @property {string} name
     * @property {"L" | "P"} sex
     * @property {string} [parentId]
     * @property {string} [spouseId]
     */

    /**
     * @param {PersonInput} person
     */
    async function handleSavePerson(person) {
        if (!selectedCanvasId) return;

        try {
            if (person.id) {
                // Update existing person
                await updatePerson(
                    parseInt(person.id),
                    { name: person.name, sex: person.sex },
                    selectedCanvasId,
                );
            } else {
                // Add new person
                await addPerson(
                    {
                        name: person.name,
                        sex: person.sex,
                        parentId: person.parentId,
                        spouseId: person.spouseId,
                    },
                    selectedCanvasId,
                );
            }

            openEditor = false;
            editingNode = null;
            await loadFamilyData(selectedCanvasId);
            lastSync = new Date();
        } catch (error) {
            console.error("Error saving person:", error);
            alert("Gagal menyimpan data");
        }
    }

    /**
     * @param {string} personId
     */
    async function handleDeletePerson(personId) {
        if (!selectedCanvasId) return;

        try {
            await deletePerson(parseInt(personId), selectedCanvasId);
            openEditor = false;
            editingNode = null;
            await loadFamilyData(selectedCanvasId);
            lastSync = new Date();
        } catch (error) {
            console.error("Error deleting person:", error);
            alert("Gagal menghapus data");
        }
    }

    function handleAddNew() {
        // If no canvas is selected or no family data, open create canvas modal
        if (!selectedCanvasId || !family.id) {
            showCreateCanvasModal = true;
        } else {
            // Otherwise, add new family member
            editingNode = null;
            openEditor = true;
        }
    }

    function handleToggleNodesView() {
        nodesView =
            nodesView === "expand" || nodesView === "default"
                ? "collapse"
                : "expand";
        if (familyTreeRef) {
            familyTreeRef.toggleNodesView();
        }
    }

    function handleFitView() {
        if (familyTreeRef) {
            familyTreeRef.fitView();
        }
    }

    function handleExportImage() {
        if (familyTreeRef) {
            familyTreeRef.exportImage();
        }
    }

    function handleLoadLocal() {
        const localData = localStorage.getItem("nodes");
        if (localData) {
            nodes = JSON.parse(localData);
        }
    }

    function handleNewCanvas() {
        showCreateCanvasModal = true;
    }

    /**
     * @param {number} canvasId
     */
    function handleSelectCanvas(canvasId) {
        selectedCanvasId = canvasId;
        const canvas = $canvases.find((c) => c.id === canvasId);
        if (canvas) {
            family = { id: canvas.id.toString(), title: canvas.name };
            loadFamilyData(canvasId);
        }
    }

    /**
     * @param {FamilyNode[]} newNodes
     */
    function setNodes(newNodes) {
        nodes = newNodes;
        lastSync = new Date();
    }

    /**
     * @param {Family} newFamily
     */
    function setFamily(newFamily) {
        family = newFamily;
    }

    /**
     * @param {Date} date
     */
    function setLastSync(date) {
        lastSync = date;
    }

    function toggleMenuPopup() {
        showMenuPopup = !showMenuPopup;
    }

    function closeMenuPopup() {
        showMenuPopup = false;
    }

    function openDeleteCanvasModal() {
        selectedCanvasesToDelete = [];
        showDeleteCanvasModal = true;
    }

    function closeDeleteCanvasModal() {
        showDeleteCanvasModal = false;
        selectedCanvasesToDelete = [];
    }

    /**
     * @param {number} canvasId
     */
    function toggleCanvasSelection(canvasId) {
        if (selectedCanvasesToDelete.includes(canvasId)) {
            selectedCanvasesToDelete = selectedCanvasesToDelete.filter(
                (id) => id !== canvasId,
            );
        } else {
            selectedCanvasesToDelete = [...selectedCanvasesToDelete, canvasId];
        }
    }

    async function handleDeleteSelectedCanvases() {
        if (selectedCanvasesToDelete.length === 0) {
            alert("Pilih minimal satu canvas untuk dihapus");
            return;
        }

        const canvasNames = $canvases
            .filter((c) => selectedCanvasesToDelete.includes(c.id))
            .map((c) => c.name)
            .join(", ");

        const confirmed = confirm(
            `Apakah Anda yakin ingin menghapus ${selectedCanvasesToDelete.length} canvas berikut?\n\n${canvasNames}\n\nSemua data dalam canvas ini akan dihapus permanen.`,
        );

        if (!confirmed) return;

        try {
            for (const canvasId of selectedCanvasesToDelete) {
                await deleteCanvas(canvasId);
            }

            // Reset selection
            selectedCanvasId = null;
            family = { id: "", title: "" };
            nodes = [];

            // If there are other canvases, select the first one
            if ($canvases.length > 0) {
                selectedCanvasId = $canvases[0].id;
                family = {
                    id: selectedCanvasId.toString(),
                    title: $canvases[0].name,
                };
                await loadFamilyData(selectedCanvasId);
            }

            closeDeleteCanvasModal();
        } catch (error) {
            console.error("Error deleting canvases:", error);
            alert("Gagal menghapus canvas");
        }
    }
</script>

{#if loading}
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-lg">Loading...</div>
    </div>
{:else if user}
    <div id="wrapper" class="h-screen flex flex-col">
        <!-- Simple Header -->
        <div
            class="flex-none p-4 bg-white border-b border-gray-200 flex items-center justify-between"
        >
            <div class="flex items-center gap-4">
                <button
                    onclick={handleAddNew}
                    class="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow"
                    aria-label="Tambah data"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <div>
                    <h1 class="text-xl font-semibold text-gray-900">
                        {family.title !== ""
                            ? family.title
                            : "Silsilah Keluarga"}
                    </h1>
                    <p class="text-xs text-gray-500">
                        {family.id
                            ? `ID: ${family.id.split("-")[0]} | Sinkronisasi: ${lastSync.toLocaleString()}`
                            : "Belum disimpan"}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-600 hidden sm:inline"
                    >{user.email}</span
                >
                <button
                    onclick={signOut}
                    class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                    Keluar
                </button>
            </div>
        </div>

        <!-- Main Content Area with Sidebar -->
        <div class="flex-1 relative overflow-hidden flex">
            <!-- Sidebar with Canvas List (always visible when canvases exist) -->
            {#if $canvases.length > 0}
                <div
                    class="w-64 flex-none bg-white border-r border-gray-200 p-4 overflow-y-auto"
                >
                    <h3
                        class="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide"
                    >
                        Canvas Tersimpan
                    </h3>
                    <div class="space-y-2">
                        {#each $canvases as canvas}
                            <button
                                type="button"
                                onclick={() => handleSelectCanvas(canvas.id)}
                                class="w-full text-left px-3 py-2 rounded-md text-sm {selectedCanvasId ===
                                canvas.id
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'} flex items-center justify-between"
                            >
                                <span class="font-medium truncate"
                                    >{canvas.name}</span
                                >
                                <svg
                                    class="w-4 h-4 flex-none"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    ></path>
                                </svg>
                            </button>
                        {/each}
                    </div>

                    <!-- Menu Button in Sidebar -->
                    <button
                        onclick={toggleMenuPopup}
                        class="w-full mt-4 bg-white rounded-lg shadow-md border border-gray-200 p-3 hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium text-sm"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="19" cy="12" r="1"></circle>
                            <circle cx="5" cy="12" r="1"></circle>
                        </svg>
                        Menu Lainnya
                    </button>
                </div>
            {/if}

            <!-- Main Content -->
            <div class="flex-1 relative overflow-hidden">
                {#if nodes.length > 0}
                    <FamilyTree
                        {nodes}
                        onNodeClick={handleNodeClick}
                        onAddChild={handleNodeClick}
                        onAddSpouse={handleNodeClick}
                        onDeleteNode={handleNodeClick}
                        bind:this={familyTreeRef}
                    />
                {:else}
                    <div
                        class="w-full h-full flex flex-col justify-center items-center p-8"
                    >
                        <div class="text-center max-w-md">
                            <div class="mb-6">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="64"
                                    height="64"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    class="mx-auto text-gray-300 mb-4"
                                >
                                    <rect
                                        x="2"
                                        y="3"
                                        width="20"
                                        height="14"
                                        rx="2"
                                        ry="2"
                                    ></rect>
                                    <line x1="8" y1="21" x2="16" y2="21"></line>
                                    <line x1="12" y1="17" x2="12" y2="21"
                                    ></line>
                                </svg>
                                <p class="text-lg text-gray-600 mb-2">
                                    Belum ada data silsilah
                                </p>
                                <p class="text-sm text-gray-500 mb-6">
                                    Klik tombol <strong>+</strong> di header untuk
                                    mulai menambahkan data
                                </p>
                            </div>

                            <!-- Menu Button (only show if no sidebar) -->
                            {#if $canvases.length === 0}
                                <button
                                    onclick={toggleMenuPopup}
                                    class="w-full bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:bg-gray-50 flex items-center justify-center gap-2 text-gray-700 font-medium"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <circle cx="19" cy="12" r="1"></circle>
                                        <circle cx="5" cy="12" r="1"></circle>
                                    </svg>
                                    Menu Lainnya
                                </button>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <PersonModal
            isOpen={openEditor}
            isEdit={editingNode !== null}
            person={editingNode}
            {availableParents}
            {availableSpouses}
            onSave={handleSavePerson}
            onClose={() => {
                openEditor = false;
                editingNode = null;
            }}
            onDelete={handleDeletePerson}
        />
    </div>
{:else}
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-lg">Redirecting to login...</div>
    </div>
{/if}

<!-- Menu Popup Modal -->
{#if showMenuPopup}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onclick={closeMenuPopup}
        onkeydown={(e) => e.key === "Escape" && closeMenuPopup()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-label="Menu popup"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="bg-white rounded-lg shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
            role="document"
        >
            <div
                class="p-4 border-b border-gray-200 flex items-center justify-between"
            >
                <h3 class="text-lg font-semibold text-gray-900">Menu</h3>
                <button
                    onclick={closeMenuPopup}
                    class="p-1 hover:bg-gray-100 rounded"
                    aria-label="Tutup menu"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="p-4 space-y-2">
                <div
                    class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
                >
                    Berkas
                </div>

                <button
                    onclick={() => {
                        handleNewCanvas();
                        closeMenuPopup();
                    }}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        ></path>
                    </svg>
                    Silsilah baru
                </button>

                <button
                    onclick={() => {
                        openDeleteCanvasModal();
                        closeMenuPopup();
                    }}
                    disabled={$canvases.length === 0}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                    </svg>
                    Hapus Canvas Tersimpan
                </button>

                <button
                    onclick={() => {
                        handleLoadLocal();
                        closeMenuPopup();
                    }}
                    disabled={nodes.length === 0}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        ></path>
                    </svg>
                    Lihat versi lokal
                </button>

                <button
                    onclick={() => {
                        handleExportImage();
                        closeMenuPopup();
                    }}
                    disabled={nodes.length === 0}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        ></path>
                    </svg>
                    Simpan gambar (PNG)
                </button>

                <div
                    class="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2"
                >
                    Kontrol
                </div>

                <button
                    onclick={() => {
                        handleToggleNodesView();
                        closeMenuPopup();
                    }}
                    disabled={nodes.length === 0}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        ></path>
                    </svg>
                    Buka / tutup semua
                </button>

                <button
                    onclick={() => {
                        handleFitView();
                        closeMenuPopup();
                    }}
                    disabled={nodes.length === 0}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        ></path>
                    </svg>
                    Sesuaikan dengan layar
                </button>

                <div
                    class="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2"
                >
                    Lainnya
                </div>

                <button
                    onclick={() => {
                        window.open(
                            "https://github.com/famasya/silsilah",
                            "_blank",
                        );
                        closeMenuPopup();
                    }}
                    class="w-full text-left px-4 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                        ></path>
                    </svg>
                    Kode sumber
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Canvas Modal -->
{#if showDeleteCanvasModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onclick={closeDeleteCanvasModal}
        onkeydown={(e) => e.key === "Escape" && closeDeleteCanvasModal()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="delete-canvas-title"
    >
        <div
            class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="dialog"
            tabindex="-1"
        >
            <div class="p-4 border-b border-gray-200">
                <h3
                    id="delete-canvas-title"
                    class="text-lg font-semibold text-gray-900"
                >
                    Hapus Canvas
                </h3>
                <p class="text-sm text-gray-500 mt-1">
                    Pilih satu atau lebih canvas yang ingin dihapus
                </p>
            </div>

            <div class="p-4">
                {#if $canvases.length === 0}
                    <p class="text-center text-gray-500 py-4">
                        Tidak ada canvas tersimpan
                    </p>
                {:else}
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        {#each $canvases as canvas}
                            <label
                                class="flex items-center gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer {selectedCanvasesToDelete.includes(
                                    canvas.id,
                                )
                                    ? 'bg-red-50 border-red-200'
                                    : ''}"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCanvasesToDelete.includes(
                                        canvas.id,
                                    )}
                                    onchange={() =>
                                        toggleCanvasSelection(canvas.id)}
                                    class="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span
                                    class="flex-1 text-sm font-medium text-gray-700"
                                >
                                    {canvas.name}
                                </span>
                                <span class="text-xs text-gray-400">
                                    {new Date(
                                        canvas.created_at,
                                    ).toLocaleDateString()}
                                </span>
                            </label>
                        {/each}
                    </div>
                {/if}
            </div>

            <div
                class="p-4 border-t border-gray-200 flex justify-end space-x-3"
            >
                <button
                    type="button"
                    onclick={closeDeleteCanvasModal}
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                    Batal
                </button>
                <button
                    type="button"
                    onclick={handleDeleteSelectedCanvases}
                    disabled={selectedCanvasesToDelete.length === 0}
                    class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Hapus {selectedCanvasesToDelete.length > 0
                        ? `(${selectedCanvasesToDelete.length})`
                        : ""}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Create Canvas Modal -->
{#if showCreateCanvasModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onclick={() => (showCreateCanvasModal = false)}
        onkeydown={(e) => e.key === "Escape" && (showCreateCanvasModal = false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="create-canvas-title"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="bg-white rounded-lg shadow-xl w-full max-w-sm"
            onclick={(e) => e.stopPropagation()}
            role="document"
        >
            <div class="p-4 border-b border-gray-200">
                <h3
                    id="create-canvas-title"
                    class="text-lg font-semibold text-gray-900"
                >
                    Nama keluarga
                </h3>
            </div>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    createNewCanvas();
                }}
                class="p-4 space-y-4"
            >
                <div>
                    <label
                        for="canvas-name"
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Nama Keluarga
                    </label>
                    <input
                        id="canvas-name"
                        type="text"
                        bind:value={newCanvasName}
                        placeholder="Misal: Bani Djojoredjo"
                        required
                        class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label
                        for="first-person-name"
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Nama Orang Pertama
                    </label>
                    <input
                        id="first-person-name"
                        type="text"
                        bind:value={newPersonName}
                        placeholder="Nama orang pertama"
                        required
                        class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div class="flex justify-end space-x-3">
                    <button
                        type="button"
                        onclick={() => (showCreateCanvasModal = false)}
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                    >
                        Simpan
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
