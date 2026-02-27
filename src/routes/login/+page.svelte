<script>
    import { goto } from "$app/navigation";
    import { supabase } from "$lib/supabase";
    import { onMount } from "svelte";

    let email = $state("");
    let password = $state("");
    let loading = $state(false);
    let error = $state("");
    let isSignUp = $state(false);
    let isForgotPassword = $state(false);

    // Session timeout: 1 day in milliseconds
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

    async function handleSubmit() {
        if (isForgotPassword) {
            await forgotPassword();
        } else if (isSignUp) {
            await signUp();
        } else {
            await signIn();
        }
    }

    async function signIn() {
        loading = true;
        error = "";

        try {
            const { data, error: authError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (authError) {
                error = authError.message;
            } else {
                // Store session in cookies for server-side access with 1-day expiration
                if (data.session) {
                    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT);
                    document.cookie = `sb-access-token=${JSON.stringify(data.session)}; path=/; expires=${expiresAt.toUTCString()}`;

                    // Store login timestamp for client-side session tracking
                    localStorage.setItem(
                        "loginTimestamp",
                        Date.now().toString(),
                    );
                }
                goto("/");
            }
        } catch (err) {
            error = "Terjadi kesalahan yang tidak terduga";
        } finally {
            loading = false;
        }
    }

    async function signUp() {
        loading = true;
        error = "";

        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) {
                error = authError.message;
            } else {
                error = "Periksa email Anda untuk tautan konfirmasi";
            }
        } catch (err) {
            error = "Terjadi kesalahan yang tidak terduga";
        } finally {
            loading = false;
        }
    }

    async function forgotPassword() {
        loading = true;
        error = "";

        try {
            const { data, error: resetError } =
                await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });

            if (resetError) {
                error = resetError.message;
            } else {
                error = "Tautan reset kata sandi telah dikirim ke email Anda";
            }
        } catch (err) {
            error = "Terjadi kesalahan yang tidak terduga";
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        // Check if user is already logged in
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user) {
            goto("/");
        }
    });
</script>

<div
    class="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8"
>
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
                {isForgotPassword
                    ? "Reset Kata Sandi"
                    : isSignUp
                      ? "Buat Akun Baru"
                      : "Masuk ke Silsilah"}
            </h2>
            <p class="mt-2 text-center text-sm text-gray-400">
                {isForgotPassword
                    ? "Masukkan email Anda untuk menerima tautan reset"
                    : isSignUp
                      ? "Daftar untuk mulai membuat silsilah keluarga"
                      : "Silahkan masuk untuk melanjutkan"}
            </p>
        </div>

        <form
            class="mt-8 space-y-6"
            onsubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
        >
            <div class="space-y-4">
                <div>
                    <label for="email-address" class="sr-only"
                        >Alamat email</label
                    >
                    <input
                        id="email-address"
                        name="email"
                        type="email"
                        required
                        bind:value={email}
                        class="appearance-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                        placeholder="Alamat email"
                    />
                </div>
                {#if !isForgotPassword}
                    <div>
                        <label for="password" class="sr-only">Kata sandi</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            bind:value={password}
                            class="appearance-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                            placeholder="Kata sandi"
                        />
                        {#if !isSignUp}
                            <div class="mt-2 text-right">
                                <button
                                    type="button"
                                    onclick={() => (isForgotPassword = true)}
                                    class="text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                                >
                                    Lupa kata sandi?
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            {#if error}
                <div
                    class="text-sm text-center {error.includes('konfirmasi') ||
                    error.includes('reset')
                        ? 'text-green-400'
                        : 'text-red-400'}"
                >
                    {error}
                </div>
            {/if}

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {isForgotPassword
                            ? "Mengirim..."
                            : isSignUp
                              ? "Mendaftar..."
                              : "Masuk..."}
                    {:else}
                        {isForgotPassword
                            ? "Kirim tautan reset"
                            : isSignUp
                              ? "Daftar"
                              : "Masuk"}
                    {/if}
                </button>
            </div>
        </form>

        <p class="mt-10 text-center text-sm/6 text-gray-400">
            {#if isForgotPassword}
                <button
                    type="button"
                    onclick={() => (isForgotPassword = false)}
                    class="font-semibold text-indigo-400 hover:text-indigo-300"
                >
                    Kembali ke halaman masuk
                </button>
            {:else}
                {isSignUp ? "Sudah punya akun?" : "Belum punya akun?"}
                <button
                    type="button"
                    onclick={() => (isSignUp = !isSignUp)}
                    class="font-semibold text-indigo-400 hover:text-indigo-300"
                >
                    {isSignUp ? "Masuk di sini" : "Daftar sekarang"}
                </button>
            {/if}
        </p>
    </div>
</div>
