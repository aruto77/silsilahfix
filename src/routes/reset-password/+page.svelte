<script>
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabase";
    import { onMount } from "svelte";

    let newPassword = $state("");
    let confirmPassword = $state("");
    let loading = $state(false);
    let error = $state("");
    let success = $state(false);

    onMount(async () => {
        // Check if user has a valid recovery session
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            // No valid session, redirect to login
            goto("/login");
        }
    });

    async function handleSubmit() {
        if (newPassword !== confirmPassword) {
            error = "Kata sandi tidak cocok";
            return;
        }

        if (newPassword.length < 6) {
            error = "Kata sandi minimal 6 karakter";
            return;
        }

        loading = true;
        error = "";

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                error = updateError.message;
            } else {
                success = true;
                // Sign out after successful password reset
                await supabase.auth.signOut();
                // Clear the session cookie
                document.cookie =
                    "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                // Redirect to login page after 2 seconds (user needs to re-login with new password)
                setTimeout(() => {
                    goto("/login");
                }, 2000);
            }
        } catch (err) {
            error = "Terjadi kesalahan yang tidak terduga";
        } finally {
            loading = false;
        }
    }
</script>

<div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <svg
            class="mx-auto h-10 w-auto text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
        </svg>
        <h2
            class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white"
        >
            Atur Ulang Kata Sandi
        </h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {#if success}
            <div
                class="rounded-md bg-green-500/10 p-4 border border-green-500/20"
            >
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg
                            class="h-5 w-5 text-green-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium text-green-300">
                            Kata sandi berhasil diubah! Silakan masuk kembali
                            dengan kata sandi baru Anda...
                        </p>
                    </div>
                </div>
            </div>
        {:else}
            <form
                class="space-y-6"
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
            >
                <div>
                    <label
                        for="new-password"
                        class="block text-sm/6 font-medium text-gray-100"
                        >Kata sandi baru</label
                    >
                    <div class="mt-2">
                        <input
                            type="password"
                            name="new-password"
                            id="new-password"
                            required
                            bind:value={newPassword}
                            class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div>
                    <label
                        for="confirm-password"
                        class="block text-sm/6 font-medium text-gray-100"
                        >Konfirmasi kata sandi</label
                    >
                    <div class="mt-2">
                        <input
                            type="password"
                            name="confirm-password"
                            id="confirm-password"
                            required
                            bind:value={confirmPassword}
                            class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {#if error}
                    <div
                        class="rounded-md bg-red-500/10 p-4 border border-red-500/20"
                    >
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg
                                    class="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm font-medium text-red-300">
                                    {error}
                                </p>
                            </div>
                        </div>
                    </div>
                {/if}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if loading}
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            Menyimpan...
                        {:else}
                            Simpan kata sandi baru
                        {/if}
                    </button>
                </div>
            </form>
        {/if}
    </div>
</div>
