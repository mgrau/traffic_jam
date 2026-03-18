<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import Board from './lib/components/Board.svelte';
  import { createInitialState, isWinningState, moveVehicle } from './lib/puzzle/game';
  import { levelLoadErrors, levels } from './lib/puzzle/levels';
  import type { GameState, Vehicle } from './lib/puzzle/types';

  const STORAGE_KEY = 'traffic-jam-progress-v1';
  const AUTO_ADVANCE_DELAY_MS = 2000;

  interface SavedProgress {
    completed: string[];
    currentLevelId?: string;
  }

  let levelIndex = 0;
  let level = levels[levelIndex] ?? null;
  let state: GameState | null = level ? createInitialState(level) : null;
  let history: Vehicle[][] = [];
  let completed = new Set<string>();
  let solvedOverlayVisible = false;
  let autoAdvanceHandle: number | null = null;

  function clearAutoAdvance(): void {
    if (autoAdvanceHandle !== null) {
      window.clearTimeout(autoAdvanceHandle);
      autoAdvanceHandle = null;
    }
  }

  function scheduleAutoAdvance(): void {
    clearAutoAdvance();
    solvedOverlayVisible = true;
    autoAdvanceHandle = window.setTimeout(() => {
      advanceFromSolvedOverlay();
    }, AUTO_ADVANCE_DELAY_MS);
  }

  function advanceFromSolvedOverlay(): void {
    clearAutoAdvance();
    solvedOverlayVisible = false;
    goToNextLevel();
  }

  function handleSolvedOverlayKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    advanceFromSolvedOverlay();
  }

  function persistProgress(): void {
    const payload: SavedProgress = {
      completed: Array.from(completed),
      currentLevelId: levels[levelIndex]?.id
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadLevel(index: number): void {
    if (levels.length === 0) {
      return;
    }

    levelIndex = index;
    level = levels[levelIndex];
    state = createInitialState(level);
    history = [];
    solvedOverlayVisible = false;
    clearAutoAdvance();
    persistProgress();
  }

  function commitMove(index: number, coordinate: number): void {
    if (!state || !level) {
      return;
    }

    const vehicle = state.vehicles[index];

    if (!vehicle) {
      return;
    }

    const currentCoordinate = vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;

    if (coordinate === currentCoordinate) {
      return;
    }

    history = [...history, state.vehicles.map((entry) => ({ ...entry }))];

    const nextVehicles = moveVehicle(state.vehicles, index, coordinate);
    const won = isWinningState(nextVehicles);
    state = {
      vehicles: nextVehicles,
      moves: state.moves + 1,
      won
    };

    if (won) {
      completed = new Set([...completed, level.id]);
      persistProgress();
      scheduleAutoAdvance();
    }
  }

  function resetLevel(): void {
    if (!level) {
      return;
    }

    clearAutoAdvance();
    solvedOverlayVisible = false;
    state = createInitialState(level);
    history = [];
  }

  function undoMove(): void {
    if (!state) {
      return;
    }

    const previous = history.at(-1);

    if (!previous) {
      return;
    }

    clearAutoAdvance();
    solvedOverlayVisible = false;
    history = history.slice(0, -1);
    state = {
      vehicles: previous.map((vehicle) => ({ ...vehicle })),
      moves: Math.max(0, state.moves - 1),
      won: false
    };
  }

  function goToNextLevel(): void {
    if (levels.length === 0) {
      return;
    }

    loadLevel((levelIndex + 1) % levels.length);
  }

  function goToPreviousLevel(): void {
    if (levels.length === 0) {
      return;
    }

    loadLevel((levelIndex - 1 + levels.length) % levels.length);
  }

  type DifficultyTone = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'unrated';

  function normalizeDifficulty(difficulty: string | undefined): DifficultyTone {
    const normalized = difficulty?.trim().toLowerCase();

    switch (normalized) {
      case 'easy':
      case 'beginner':
        return 'beginner';
      case 'medium':
      case 'intermediate':
        return 'intermediate';
      case 'hard':
      case 'advanced':
        return 'advanced';
      case 'expert':
        return 'expert';
      default:
        return 'unrated';
    }
  }

  function difficultyLabel(difficulty: string | undefined): string {
    const tone = normalizeDifficulty(difficulty);

    switch (tone) {
      case 'beginner':
        return 'Beginner';
      case 'intermediate':
        return 'Intermediate';
      case 'advanced':
        return 'Advanced';
      case 'expert':
        return 'Expert';
      default:
        return difficulty?.trim() || 'Unrated';
    }
  }

  function difficultyChipClasses(difficulty: string | undefined): string {
    const tone = normalizeDifficulty(difficulty);

    switch (tone) {
      case 'beginner':
        return 'border-emerald-300/80 bg-emerald-100/90 text-emerald-900';
      case 'intermediate':
        return 'border-orange-300/80 bg-orange-100/90 text-orange-900';
      case 'advanced':
        return 'border-sky-300/80 bg-sky-100/90 text-sky-900';
      case 'expert':
        return 'border-rose-300/80 bg-rose-100/90 text-rose-900';
      default:
        return 'border-stone-300 bg-stone-100 text-stone-700';
    }
  }

  function levelButtonClasses(isCurrent: boolean, difficulty: string | undefined): string {
    const tone = normalizeDifficulty(difficulty);
    const tintClasses =
      tone === 'beginner'
        ? 'border-emerald-200/80 bg-emerald-50/80'
        : tone === 'intermediate'
          ? 'border-orange-200/80 bg-orange-50/80'
          : tone === 'advanced'
            ? 'border-sky-200/80 bg-sky-50/80'
            : tone === 'expert'
              ? 'border-rose-200/80 bg-rose-50/80'
              : 'border-stone-300 bg-white';

    return [
      'border text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-stone-900/20',
      `${tintClasses} text-stone-700`,
      isCurrent ? 'border-stone-900 ring-2 ring-stone-900/20 shadow-[0_10px_22px_rgba(28,25,23,0.10)]' : ''
    ].join(' ');
  }

  function levelNumberClasses(isCurrent: boolean, completedState: boolean): string {
    if (isCurrent) {
      return 'text-stone-900';
    }

    if (completedState) {
      return 'text-stone-500';
    }

    return 'text-stone-400';
  }

  function levelTitleClasses(isCurrent: boolean, completedState: boolean): string {
    if (isCurrent) {
      return 'text-stone-900';
    }

    if (completedState) {
      return 'text-stone-700';
    }

    return 'text-stone-700';
  }

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const payload = JSON.parse(saved) as SavedProgress;
      completed = new Set(payload.completed ?? []);

      if (payload.currentLevelId) {
        const savedIndex = levels.findIndex((entry) => entry.id === payload.currentLevelId);

        if (savedIndex >= 0) {
          loadLevel(savedIndex);
          return;
        }
      }

      if (level) {
        state = createInitialState(level);
      }
    } catch {
      if (level) {
        state = createInitialState(level);
      }
    }
  });

  onDestroy(() => {
    clearAutoAdvance();
  });

  $: progressCount = completed.size;
  $: canUndo = history.length > 0 && !state?.won;
  $: nextButtonLabel = levelIndex === levels.length - 1 ? 'Back to start' : 'Next level';
</script>

<svelte:head>
  <title>Traffic Jam</title>
  <meta
    name="description"
    content="A touch-friendly traffic puzzle game inspired by sliding block escape puzzles."
  />
</svelte:head>

<main class="min-h-screen bg-[radial-gradient(circle_at_top,#fff8eb_0%,#f4ecdf_40%,#e8ddcc_100%)] px-4 py-6 text-stone-900 sm:px-6 sm:py-10">
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
    <section class="flex-1 rounded-[2rem] border border-white/70 bg-white/55 p-5 shadow-[0_20px_80px_rgba(120,93,49,0.16)] backdrop-blur md:p-7">
      {#if levelLoadErrors.length > 0}
        <div class="mb-5 rounded-[1.4rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p class="font-semibold uppercase tracking-[0.18em] text-amber-800">Level warnings</p>
          <p class="mt-1">Invalid level files were skipped instead of crashing the app.</p>
        </div>
      {/if}

      {#if !level || !state}
        <div class="rounded-[1.6rem] border border-red-300 bg-red-50 px-5 py-4 text-red-950">
          <p class="font-semibold uppercase tracking-[0.18em] text-red-800">No playable levels</p>
          <p class="mt-2 text-sm">
            The YAML level pack could not be loaded. Check the files in `levels/`.
          </p>
        </div>
      {:else}
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div class="flex flex-col items-center gap-4">
          <div class="relative w-full max-w-[30rem]">
            <Board vehicles={state.vehicles} disabled={state.won} onCommitMove={commitMove} />

            {#if solvedOverlayVisible}
              <div
                class="absolute inset-0 z-30 flex items-center justify-center rounded-[2rem] bg-emerald-950/24 p-4 backdrop-blur-[2px]"
                role="button"
                tabindex="0"
                aria-label="Continue to the next level"
                transition:fade={{ duration: 180 }}
                on:click={advanceFromSolvedOverlay}
                on:keydown={handleSolvedOverlayKeydown}
              >
                <div
                  class="w-full rounded-[1.6rem] border border-emerald-300/70 bg-emerald-50/95 px-5 py-6 text-center shadow-[0_24px_60px_rgba(6,95,70,0.28)]"
                  transition:scale={{ start: 0.92, duration: 220 }}
                >
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_10px_26px_rgba(16,185,129,0.35)]">
                    <svg viewBox="0 0 24 24" class="h-7 w-7" aria-hidden="true">
                      <path
                        d="M20 6 9 17l-5-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.8"
                      />
                    </svg>
                  </div>
                  <p class="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                    Level solved
                  </p>
                  <p class="mt-2 text-2xl font-black tracking-tight text-emerald-950">
                    {level.title} cleared in {state.moves} moves
                  </p>
                  <p class="mt-2 text-sm text-emerald-900/80">
                    Loading the next puzzle... Click to continue now.
                  </p>
                  <div class="mt-4 h-2 overflow-hidden rounded-full bg-emerald-200">
                      <div
                        class="h-full rounded-full bg-emerald-500"
                        style={`animation: level-progress ${AUTO_ADVANCE_DELAY_MS}ms linear forwards;`}
                      ></div>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div class="grid w-full max-w-[30rem] grid-cols-3 gap-2 rounded-[1.2rem] border border-stone-300/80 bg-stone-50/90 px-3 py-3 text-center text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div>
              <div class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Moves</div>
              <div class="mt-1 text-2xl font-black">{state.moves}</div>
            </div>
            <div>
              <div class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Optimal</div>
              <div class="mt-1 text-2xl font-black">{level.optimalMoves}</div>
            </div>
            <div>
              <div class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Solved</div>
              <div class="mt-1 text-2xl font-black">{progressCount}/{levels.length}</div>
            </div>
          </div>

          <div class="flex w-full max-w-[30rem] flex-wrap items-center justify-center gap-3">
            <button
              class="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
              on:click={undoMove}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              class="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
              on:click={resetLevel}
              disabled={solvedOverlayVisible}
            >
              Reset
            </button>
          </div>

          <div class="w-full max-w-[30rem] rounded-[1.6rem] border border-stone-300/70 bg-stone-50/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">How to play</p>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-stone-600">
              <li>Drag a car or truck only in the direction it already faces.</li>
              <li>The red goal car always escapes through the opening on the right.</li>
              <li>Use undo to inspect different lines without restarting the board.</li>
            </ul>
          </div>
        </div>

        <aside class="flex flex-col gap-4">
          <div class="rounded-[1.6rem] border border-stone-300/70 bg-stone-50/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p class="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
              Current level
            </p>
            <h2 class="mt-2 text-2xl font-black tracking-tight text-stone-900">{level.title}</h2>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
              Difficulty
            </p>
            <div class="mt-2">
              <span class={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${difficultyChipClasses(level.difficulty)}`}>
                {difficultyLabel(level.difficulty)}
              </span>
            </div>
            <p class="mt-3 text-xs uppercase tracking-[0.24em] text-stone-500">
              Level {levelIndex + 1} of {levels.length}
            </p>
          </div>

          <div class="rounded-[1.6rem] border border-stone-300/70 bg-stone-50/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">Levels</p>
              <div class="flex items-center gap-2">
                <button
                  class="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
                  on:click={goToPreviousLevel}
                  disabled={solvedOverlayVisible}
                >
                  Prev
                </button>
                <button
                  class="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600 shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-45"
                  on:click={goToNextLevel}
                  disabled={solvedOverlayVisible}
                >
                  Next
                </button>
              </div>
            </div>
            <div class="mt-3 max-h-[17.5rem] space-y-1.5 overflow-y-auto pr-1">
              {#each levels as entry, index (entry.id)}
                {@const isCurrent = entry.id === level?.id}
                {@const isCompleted = completed.has(entry.id)}
                <button
                  class={`${levelButtonClasses(isCurrent, entry.difficulty)} flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2`}
                  on:click={() => loadLevel(index)}
                  disabled={solvedOverlayVisible}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span class="min-w-0 flex flex-1 items-center text-left text-sm">
                    <span
                      class={`mr-2 inline-block w-6 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] ${levelNumberClasses(isCurrent, isCompleted)}`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span class={`block min-w-0 truncate ${levelTitleClasses(isCurrent, isCompleted)}`}>
                      {entry.title}
                    </span>
                  </span>
                  <span class={`shrink-0 rounded-full border px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${difficultyChipClasses(entry.difficulty)}`}>
                    {difficultyLabel(entry.difficulty)}
                  </span>
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {#if isCompleted}
                      <span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_16px_rgba(16,185,129,0.24)]">
                        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" aria-hidden="true">
                          <path
                            d="M20 6 9 17l-5-5"
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2.8"
                          />
                        </svg>
                      </span>
                    {:else}
                      <span class="h-2.5 w-2.5 rounded-full bg-stone-300"></span>
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        </aside>
      </div>
      {/if}
    </section>
  </div>
</main>
