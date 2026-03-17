<script lang="ts">
  import { onMount } from 'svelte';
  import { BOARD_SIZE, type MoveRange, type Vehicle } from '../puzzle/types';
  import { getMoveRange } from '../puzzle/game';

  export let vehicles: Vehicle[] = [];
  export let disabled = false;
  export let onCommitMove: (index: number, coordinate: number) => void;

  interface DragState {
    vehicleIndex: number;
    pointerId: number;
    startX: number;
    startY: number;
    startCoordinate: number;
    currentCoordinate: number;
    range: MoveRange;
    orientation: Vehicle['orientation'];
  }

  let boardElement: HTMLDivElement | null = null;
  let playfieldElement: HTMLDivElement | null = null;
  let boardPixels = 0;
  let drag: DragState | null = null;

  const percent = 100 / BOARD_SIZE;
  const frameThickness = '0.62rem';
  const exitCoverWidth = `calc(${frameThickness} + 2px)`;
  const exitOffset = '1.4rem';
  const exitLaneStart = `${2 * percent}%`;
  const exitLaneSize = `${percent}%`;

  function updateBoardPixels(): void {
    boardPixels = playfieldElement?.clientWidth ?? 0;
  }

  onMount(() => {
    updateBoardPixels();

    if (!boardElement || !playfieldElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateBoardPixels();
    });

    observer.observe(boardElement);
    observer.observe(playfieldElement);

    return () => observer.disconnect();
  });

  function getDisplayCoordinate(vehicle: Vehicle, index: number): number {
    if (drag?.vehicleIndex === index) {
      return drag.currentCoordinate;
    }

    return vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;
  }

  function getCoordinateFromEvent(event: PointerEvent, currentDrag: DragState): number {
    if (boardPixels === 0) {
      return currentDrag.startCoordinate;
    }

    const deltaPixels =
      currentDrag.orientation === 'horizontal'
        ? event.clientX - currentDrag.startX
        : event.clientY - currentDrag.startY;
    const deltaCells = deltaPixels / (boardPixels / BOARD_SIZE);

    return Math.max(
      currentDrag.range.min,
      Math.min(currentDrag.range.max, currentDrag.startCoordinate + deltaCells)
    );
  }

  function getReleaseCoordinate(event: PointerEvent, currentDrag: DragState): number {
    const rawCoordinate = getCoordinateFromEvent(event, currentDrag);
    const delta = rawCoordinate - currentDrag.startCoordinate;

    if (delta > 0) {
      return Math.min(currentDrag.range.max, Math.ceil(rawCoordinate));
    }

    if (delta < 0) {
      return Math.max(currentDrag.range.min, Math.floor(rawCoordinate));
    }

    return currentDrag.startCoordinate;
  }

  function getReleaseCoordinateFromCurrentDrag(currentDrag: DragState): number {
    const delta = currentDrag.currentCoordinate - currentDrag.startCoordinate;

    if (delta > 0) {
      return Math.min(currentDrag.range.max, Math.ceil(currentDrag.currentCoordinate));
    }

    if (delta < 0) {
      return Math.max(currentDrag.range.min, Math.floor(currentDrag.currentCoordinate));
    }

    return currentDrag.startCoordinate;
  }

  function vehicleClasses(index: number): string {
    const dragging = drag?.vehicleIndex === index;

    return [
      'absolute flex items-center justify-center rounded-[1rem] border border-black/10 px-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_20px_42px_rgba(15,23,42,0.30),0_8px_16px_rgba(15,23,42,0.18)] outline-none transition-transform duration-150 focus-visible:ring-4 focus-visible:ring-stone-700/25',
      disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      dragging ? 'ring-4 ring-white/60' : ''
    ].join(' ');
  }

  function wheelOffsets(vehicle: Vehicle): number[] {
    return vehicle.length === 3 ? [24, 76] : [26, 74];
  }

  function vehicleLabel(vehicle: Vehicle, index: number): string {
    if (index === 0) {
      return 'target car';
    }

    return vehicle.length === 3 ? `truck ${index}` : `car ${index}`;
  }

  function startDrag(event: PointerEvent, vehicle: Vehicle, index: number): void {
    if (disabled) {
      return;
    }

    const range = getMoveRange(vehicles, index);
    const startCoordinate = vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;

    if (range.min === range.max) {
      return;
    }

    drag = {
      vehicleIndex: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCoordinate,
      currentCoordinate: startCoordinate,
      range,
      orientation: vehicle.orientation
    };

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function updateDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId || boardPixels === 0) {
      return;
    }

    drag = {
      ...drag,
      currentCoordinate: getCoordinateFromEvent(event, drag)
    };
  }

  function endDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const finalCoordinate = getReleaseCoordinate(event, drag);
    const changed = finalCoordinate !== drag.startCoordinate;
    const vehicleIndex = drag.vehicleIndex;

    drag = null;

    if (changed) {
      onCommitMove(vehicleIndex, finalCoordinate);
    }
  }

  function cancelDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag = null;
  }

  function finalizeDragFromCaptureLoss(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const finalCoordinate = getReleaseCoordinateFromCurrentDrag(drag);
    const changed = finalCoordinate !== drag.startCoordinate;
    const vehicleIndex = drag.vehicleIndex;

    drag = null;

    if (changed) {
      onCommitMove(vehicleIndex, finalCoordinate);
    }
  }

  function nudgeVehicle(vehicle: Vehicle, index: number, direction: -1 | 1): void {
    if (disabled) {
      return;
    }

    const range = getMoveRange(vehicles, index);
    const currentCoordinate = vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;
    const nextCoordinate = Math.max(range.min, Math.min(range.max, currentCoordinate + direction));

    if (nextCoordinate !== currentCoordinate) {
      onCommitMove(index, nextCoordinate);
    }
  }

  function handleKeydown(event: KeyboardEvent, vehicle: Vehicle, index: number): void {
    if (vehicle.orientation === 'horizontal') {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeVehicle(vehicle, index, -1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeVehicle(vehicle, index, 1);
      }
    }

    if (vehicle.orientation === 'vertical') {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeVehicle(vehicle, index, -1);
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeVehicle(vehicle, index, 1);
      }
    }
  }
</script>

<div
  bind:this={boardElement}
  class="relative aspect-square w-full max-w-[30rem] overflow-visible rounded-[2rem] border border-stone-300/80 bg-[linear-gradient(135deg,#f9f3ea_0%,#efe5d5_100%)] shadow-[0_24px_80px_rgba(120,93,49,0.18)]"
  aria-label="Traffic puzzle board"
>
  <div bind:this={playfieldElement} class="absolute inset-3">
    <div class="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-0">
      {#each Array.from({ length: BOARD_SIZE * BOARD_SIZE }) as _, index}
        <div
          class="rounded-[0.8rem] border border-stone-300/70 bg-white/45"
          style="box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);"
        ></div>
      {/each}
    </div>

    <div class="pointer-events-none absolute inset-0 z-0 overflow-visible">
      <div
        class="absolute inset-0 rounded-[1.45rem] bg-transparent"
        style={`box-shadow: 0 0 0 ${frameThickness} rgba(68, 64, 60, 0.88), 0 14px 28px rgba(0,0,0,0.18);`}
      ></div>
      <div
        class="absolute bg-[linear-gradient(135deg,#f9f3ea_0%,#efe5d5_100%)]"
        style:right={`calc(-1 * ${frameThickness} - 1px)`}
        style:top={`calc(${exitLaneStart} - 1px)`}
        style:height={`calc(${exitLaneSize} + 2px)`}
        style:width={exitCoverWidth}
      ></div>
      <div
        class="absolute z-10 flex items-center justify-center text-[0.72rem] font-black uppercase tracking-[0.22em] text-stone-700"
        style:right={`calc(-1 * ${exitOffset})`}
        style:top={exitLaneStart}
        style:height={exitLaneSize}
        style:writing-mode="vertical-rl"
        style:text-orientation="mixed"
      >
        Exit
      </div>
    </div>

    <div class="absolute inset-0 z-10">
      {#each vehicles as vehicle, index (index)}
        <div
          role="button"
          tabindex={disabled ? -1 : 0}
          aria-label={`Move ${vehicleLabel(vehicle, index)}`}
          class={vehicleClasses(index)}
          style="touch-action: none;"
          style:left={`${(vehicle.orientation === 'horizontal' ? getDisplayCoordinate(vehicle, index) : vehicle.x) * percent}%`}
          style:top={`${(vehicle.orientation === 'vertical' ? getDisplayCoordinate(vehicle, index) : vehicle.y) * percent}%`}
          style:width={`${(vehicle.orientation === 'horizontal' ? vehicle.length : 1) * percent}%`}
          style:height={`${(vehicle.orientation === 'vertical' ? vehicle.length : 1) * percent}%`}
          style:background={`${vehicle.color}`}
          style:transform={drag?.vehicleIndex === index ? 'scale(1.02)' : 'scale(1)'}
          on:pointerdown={(event) => startDrag(event, vehicle, index)}
          on:pointermove={updateDrag}
          on:pointerup={endDrag}
          on:pointercancel={cancelDrag}
          on:lostpointercapture={finalizeDragFromCaptureLoss}
          on:keydown={(event) => handleKeydown(event, vehicle, index)}
        >
          <div
            class="pointer-events-none absolute inset-[4%] rounded-[0.9rem] opacity-80"
            style="background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.06) 38%, rgba(0,0,0,0.1) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -10px 18px rgba(0,0,0,0.12);"
          ></div>

          <div
            class="pointer-events-none absolute inset-x-[10%] top-[8%] h-[22%] rounded-full bg-white/22 blur-[1px]"
          ></div>

          {#if vehicle.orientation === 'horizontal'}
            <div
              class="pointer-events-none absolute right-[11%] top-[20%] rounded-[0.65rem] border border-white/20 bg-slate-900/20"
              style:width={`${vehicle.length === 3 ? 26 : 30}%`}
              style:height={`${vehicle.length === 3 ? 60 : 54}%`}
            ></div>

            {#if vehicle.length === 3}
              <div
                class="pointer-events-none absolute left-[10%] top-[18%] rounded-[0.65rem] border border-white/14 bg-black/8"
                style:width="34%"
                style:height="64%"
              ></div>
            {/if}

            <div class="pointer-events-none absolute inset-y-[16%] right-[6%] flex flex-col items-center justify-between">
              <div class="h-[0.48rem] w-[0.3rem] rounded-full bg-amber-100/95 shadow-[0_0_10px_rgba(255,251,235,0.85)]"></div>
              <div class="h-[0.48rem] w-[0.3rem] rounded-full bg-amber-100/95 shadow-[0_0_10px_rgba(255,251,235,0.85)]"></div>
            </div>

            <div class="pointer-events-none absolute inset-y-[18%] left-[38%] w-[1px] bg-white/16"></div>
            <div class="pointer-events-none absolute inset-y-[18%] left-[58%] w-[1px] bg-white/16"></div>

            {#each wheelOffsets(vehicle) as offset}
              <div
                class="pointer-events-none absolute top-[8%] h-[12%] w-[16%] -translate-x-1/2 rounded-full bg-stone-700/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_1px_3px_rgba(0,0,0,0.18)]"
                style:left={`${offset}%`}
              ></div>
              <div
                class="pointer-events-none absolute bottom-[8%] h-[12%] w-[16%] -translate-x-1/2 rounded-full bg-stone-700/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_1px_3px_rgba(0,0,0,0.18)]"
                style:left={`${offset}%`}
              ></div>
            {/each}
          {:else}
            <div
              class="pointer-events-none absolute bottom-[11%] left-[20%] rounded-[0.65rem] border border-white/20 bg-slate-900/20"
              style:width={`${vehicle.length === 3 ? 60 : 54}%`}
              style:height={`${vehicle.length === 3 ? 26 : 30}%`}
            ></div>

            {#if vehicle.length === 3}
              <div
                class="pointer-events-none absolute left-[18%] top-[10%] rounded-[0.65rem] border border-white/14 bg-black/8"
                style:width="64%"
                style:height="34%"
              ></div>
            {/if}

            <div class="pointer-events-none absolute bottom-[6%] inset-x-[16%] flex items-center justify-between">
              <div class="h-[0.3rem] w-[0.48rem] rounded-full bg-amber-100/95 shadow-[0_0_10px_rgba(255,251,235,0.85)]"></div>
              <div class="h-[0.3rem] w-[0.48rem] rounded-full bg-amber-100/95 shadow-[0_0_10px_rgba(255,251,235,0.85)]"></div>
            </div>

            <div class="pointer-events-none absolute left-[18%] top-[38%] h-[1px] w-[64%] bg-white/16"></div>
            <div class="pointer-events-none absolute left-[18%] top-[58%] h-[1px] w-[64%] bg-white/16"></div>

            {#each wheelOffsets(vehicle) as offset}
              <div
                class="pointer-events-none absolute left-[8%] h-[16%] w-[12%] -translate-y-1/2 rounded-full bg-stone-700/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_1px_3px_rgba(0,0,0,0.18)]"
                style:top={`${offset}%`}
              ></div>
              <div
                class="pointer-events-none absolute right-[8%] h-[16%] w-[12%] -translate-y-1/2 rounded-full bg-stone-700/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_1px_3px_rgba(0,0,0,0.18)]"
                style:top={`${offset}%`}
              ></div>
            {/each}
          {/if}

        </div>
      {/each}
    </div>
  </div>
</div>
