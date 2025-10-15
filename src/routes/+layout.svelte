<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import type { LayoutData } from "./$types";

  let {
    data,
    children,
  }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  let user = $derived(data?.user);
</script>

<nav>
  {#if user}
    <span>Привет, {user.userId}!</span>
    <form action="/auth/logout" method="post">
      <button type="submit">Выйти</button>
    </form>
  {:else}
    <a href="/auth/login">Войти</a>
  {/if}
</nav>

<main>
  {@render children?.()}
</main>
