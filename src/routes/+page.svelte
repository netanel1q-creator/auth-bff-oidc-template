<!-- src/routes/+page.svelte -->
<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let user = $derived(data.user);
  let error = $derived(data.error);
</script>

<svelte:head>
  <title>Авторизация</title>
</svelte:head>

<main>
  <h1>Добро пожаловать!</h1>

  {#if error}
    <div class="error-message">
      <h2>Ошибка авторизации</h2>
      <p>
        {#if error === "invalid_request"}
          Неверный запрос авторизации
        {:else if error === "invalid_state"}
          Неверный параметр state
        {:else if error === "auth_failed"}
          Ошибка при авторизации
        {:else}
          Произошла неизвестная ошибка
        {/if}
      </p>
    </div>
  {/if}

  {#if user}
    <div class="user-info">
      <h2>Вы авторизованы как: {user.userId}</h2>
      <p>Сессия активна</p>
    </div>
  {:else}
    <div class="auth-prompt">
      <h2>Для доступа к приложению необходимо авторизоваться</h2>
      <a href="/auth/login" class="login-button">Войти</a>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  .error-message {
    background: #ffe6e6;
    padding: 2rem;
    border-radius: 8px;
    margin: 2rem 0;
    color: #d00;
  }

  .user-info {
    background: #e8f5e8;
    padding: 2rem;
    border-radius: 8px;
    margin: 2rem 0;
  }

  .auth-prompt {
    background: #f0f8ff;
    padding: 2rem;
    border-radius: 8px;
    margin: 2rem 0;
  }

  .login-button {
    display: inline-block;
    background: #007bff;
    color: white;
    padding: 1rem 2rem;
    text-decoration: none;
    border-radius: 4px;
    font-weight: bold;
    margin-top: 1rem;
  }

  .login-button:hover {
    background: #0056b3;
  }
</style>
