<script>
    import { onMount } from "svelte";

    /**
     * @typedef {Object} Person
     * @property {string} [id]
     * @property {string} name
     * @property {"L" | "P"} sex
     * @property {string} [parentId]
     * @property {string} [spouseId]
     */

    /** @type {{

     *   isOpen: boolean,
     *   isEdit: boolean,
     *   person: Person | null,
     *   availableParents: Array<{id: string, name: string}>,
     *   availableSpouses: Array<{id: string, name: string}>,
     *   onSave: (person: Person) => void,
     *   onClose: () => void,
     *   onDelete: (id: string) => void
     * }} */
    let {
        isOpen,
        isEdit,
        person,
        availableParents,
        availableSpouses,
        onSave,
        onClose,
        onDelete,
    } = $props();

    /** @type {Person} */
    let formData = $state({
        name: "",
        sex: "L",
        parentId: "",
        spouseId: "",
    });

    // Reset form when modal opens
    $effect(() => {
        if (isOpen) {
            if (person) {
                formData = {
                    name: person.name || "",
                    sex: person.sex || "L",
                    parentId: person.parentId || "",
                    spouseId: person.spouseId || "",
                };
            } else {
                formData = {
                    name: "",
                    sex: "L",
                    parentId: "",
                    spouseId: "",
                };
            }
        }
    });

    function handleSubmit() {
        if (!formData.name.trim()) {
            alert("Nama harus diisi");
            return;
        }

        const result = {
            ...(person?.id ? { id: person.id } : {}),
            name: formData.name.trim(),
            sex: formData.sex,
            parentId: formData.parentId || undefined,
            spouseId: formData.spouseId || undefined,
        };

        onSave(result);
    }

    function handleDelete() {
        if (
            person?.id &&
            confirm("Apakah Anda yakin ingin menghapus anggota keluarga ini?")
        ) {
            onDelete(person.id);
        }
    }

    function handleClose() {
        onClose();
    }
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onclick={handleClose}
        onkeydown={(e) => e.key === "Escape" && handleClose()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        aria-labelledby="modal-title"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="bg-white rounded-lg shadow-xl w-full max-w-md"
            onclick={(e) => e.stopPropagation()}
            role="document"
        >
            <div class="p-4 border-b border-gray-200">
                <h3
                    id="modal-title"
                    class="text-lg font-semibold text-gray-900"
                >
                    {isEdit
                        ? "Edit Anggota Keluarga"
                        : "Tambah Anggota Keluarga"}
                </h3>
            </div>

            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
                class="p-4 space-y-4"
            >
                <!-- Name -->
                <div>
                    <label
                        for="person-name"
                        class="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Nama
                    </label>
                    <input
                        id="person-name"
                        type="text"
                        bind:value={formData.name}
                        placeholder="Nama lengkap"
                        required
                        class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <!-- Sex -->
                <div>
                    <span class="block text-sm font-medium text-gray-700 mb-2">
                        Jenis Kelamin
                    </span>

                    <div class="flex gap-4">
                        <label class="flex items-center">
                            <input
                                type="radio"
                                name="sex"
                                value="L"
                                bind:group={formData.sex}
                                class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span class="ml-2 text-sm text-gray-700"
                                >Laki-laki</span
                            >
                        </label>
                        <label class="flex items-center">
                            <input
                                type="radio"
                                name="sex"
                                value="P"
                                bind:group={formData.sex}
                                class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <span class="ml-2 text-sm text-gray-700"
                                >Perempuan</span
                            >
                        </label>
                    </div>
                </div>

                <!-- Parent Selection (for new person) -->
                {#if !isEdit && availableParents.length > 0}
                    <div>
                        <label
                            for="parent-select"
                            class="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Orang Tua (Opsional)
                        </label>
                        <select
                            id="parent-select"
                            bind:value={formData.parentId}
                            class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">-- Pilih Orang Tua --</option>
                            {#each availableParents as parent}
                                <option value={parent.id}>{parent.name}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <!-- Spouse Selection -->
                {#if availableSpouses.length > 0}
                    <div>
                        <label
                            for="spouse-select"
                            class="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Pasangan (Opsional)
                        </label>
                        <select
                            id="spouse-select"
                            bind:value={formData.spouseId}
                            class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">-- Pilih Pasangan --</option>
                            {#each availableSpouses as spouse}
                                <option value={spouse.id}>{spouse.name}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <!-- Actions -->
                <div class="flex justify-end space-x-3 pt-4">
                    <button
                        type="button"
                        onclick={handleClose}
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                        Batal
                    </button>

                    {#if isEdit && person?.id}
                        <button
                            type="button"
                            onclick={handleDelete}
                            class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                        >
                            Hapus
                        </button>
                    {/if}

                    <button
                        type="submit"
                        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                    >
                        {isEdit ? "Simpan Perubahan" : "Tambah"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
