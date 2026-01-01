<script lang="ts">
  interface Heading {
    id: string;
    text: string;
    level: number;
  }

  let headings = $state<Heading[]>([]);
  let activeId = $state<string | null>(null);
  let isScrolling = false;

  $effect(() => {
    const article = document.querySelector('.prose-docs');
    if (!article) return;

    const elements = article.querySelectorAll('h2, h3');
    const extracted: Heading[] = [];

    elements.forEach((el) => {
      const text = el.textContent?.trim() || '';
      let id = el.id;
      
      if (!id) {
        id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        el.id = id;
      }

      extracted.push({
        id,
        text,
        level: el.tagName === 'H2' ? 2 : 3,
      });
    });

    headings = extracted;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
            break;
          }
        }
      },
      {
        rootMargin: '-64px 0px -60% 0px',
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  });

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      isScrolling = true;
      activeId = id;
      const headerHeight = 48;
      const y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: y });
      setTimeout(() => { isScrolling = false; }, 100);
    }
  }
</script>

{#if headings.length > 0}
  <nav class="font-mono text-sm border-l border-stone-700 pl-4">
    <div class="text-stone-400 text-xs tracking-widest mb-3 uppercase">Contents</div>
    <ul class="flex flex-col list-none p-0 m-0">
      {#each headings as heading}
        {@const isActive = activeId === heading.id}
        {@const isH3 = heading.level === 3}
        <li>
          <button
            onclick={() => scrollTo(heading.id)}
            class="group flex items-start w-full py-1 px-1 -ml-1 bg-transparent border-none cursor-pointer text-left font-mono text-sm leading-relaxed hover:bg-stone-50 hover:text-stone-950"
            class:text-stone-100={isActive}
            class:text-stone-500={!isActive}
            class:pl-3={isH3}
          >
            <span
              class="w-4 shrink-0 group-hover:text-stone-950"
              class:text-stone-300={isActive}
              class:text-stone-500={!isActive}
            >
              {#if isActive}>{:else if isH3}·{:else}&nbsp;{/if}
            </span>
            <span class="overflow-hidden text-ellipsis whitespace-nowrap">{heading.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/if}
