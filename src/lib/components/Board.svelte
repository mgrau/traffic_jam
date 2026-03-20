<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { BOARD_SIZE, type MoveRange, type Vehicle } from '../puzzle/types';
  import { getMoveRange } from '../puzzle/game';

  export let vehicles: Vehicle[] = [];
  export let disabled = false;
  export let onCommitMove: (index: number, coordinate: number) => void;

  interface DragState {
    vehicleIndex: number;
    element: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    startCoordinate: number;
    currentCoordinate: number;
    currentOffsetPixels: number;
    range: MoveRange;
    orientation: Vehicle['orientation'];
  }

  let boardElement: HTMLDivElement | null = null;
  let playfieldElement: HTMLDivElement | null = null;
  let boardPixels = 0;
  let drag: DragState | null = null;

  const percent = 100 / BOARD_SIZE;
  const boardOuterRadius = '1.9rem';
  const playfieldInset = '0.75rem';
  const frameThickness = '0.54rem';
  const halfFrameThickness = '0.27rem';
  const frameRadius = `calc(${boardOuterRadius} - ${playfieldInset} - ${halfFrameThickness})`;
  const exitCoverWidth = `calc(${frameThickness} + 2px)`;
  const exitOffset = '1.4rem';
  const exitLaneStart = `${2 * percent}%`;
  const exitLaneSize = `${percent}%`;
  const SNAP_TRANSITION_MS = 160;
  const SNAP_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

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

  function getDeltaPixelsFromEvent(event: PointerEvent, currentDrag: DragState): number {
    if (boardPixels === 0) {
      return 0;
    }

    const rawDeltaPixels =
      currentDrag.orientation === 'horizontal'
        ? event.clientX - currentDrag.startX
        : event.clientY - currentDrag.startY;
    const cellPixels = boardPixels / BOARD_SIZE;
    const minOffset = (currentDrag.range.min - currentDrag.startCoordinate) * cellPixels;
    const maxOffset = (currentDrag.range.max - currentDrag.startCoordinate) * cellPixels;

    return Math.max(minOffset, Math.min(maxOffset, rawDeltaPixels));
  }

  function updateDraggedElement(currentDrag: DragState): void {
    currentDrag.element.style.transform = dragTransform(
      currentDrag.orientation,
      currentDrag.currentOffsetPixels
    );
  }

  function syncDragFromEvent(event: PointerEvent, currentDrag: DragState): void {
    const deltaPixels = getDeltaPixelsFromEvent(event, currentDrag);
    const deltaCells = boardPixels === 0 ? 0 : deltaPixels / (boardPixels / BOARD_SIZE);

    currentDrag.currentOffsetPixels = deltaPixels;
    currentDrag.currentCoordinate = currentDrag.startCoordinate + deltaCells;
    updateDraggedElement(currentDrag);
  }

  function getReleaseCoordinate(currentDrag: DragState): number {
    const delta = currentDrag.currentCoordinate - currentDrag.startCoordinate;

    if (delta > 0) {
      return Math.min(currentDrag.range.max, Math.ceil(currentDrag.currentCoordinate));
    }

    if (delta < 0) {
      return Math.max(currentDrag.range.min, Math.floor(currentDrag.currentCoordinate));
    }

    return currentDrag.startCoordinate;
  }

  function dragTransform(orientation: Vehicle['orientation'], offsetPixels: number): string {
    const x = orientation === 'horizontal' ? offsetPixels : 0;
    const y = orientation === 'vertical' ? offsetPixels : 0;

    return `translate3d(${x}px, ${y}px, 0) scale(1.02)`;
  }

  function setDraggingStyles(element: HTMLElement, dragging: boolean): void {
    element.classList.toggle('ring-4', dragging);
    element.classList.toggle('ring-white/60', dragging);
    element.style.willChange = dragging ? 'transform' : '';
    element.style.transition = dragging ? 'none' : '';
  }

  function clearVehicleTransform(element: HTMLElement): void {
    element.style.transition = '';
    element.style.transform = '';
    element.style.willChange = '';
  }

  async function animateSnapToGrid(currentDrag: DragState, finalCoordinate: number): Promise<void> {
    if (boardPixels === 0) {
      clearVehicleTransform(currentDrag.element);
      return;
    }

    const cellPixels = boardPixels / BOARD_SIZE;
    const snappedOffsetPixels = (finalCoordinate - currentDrag.startCoordinate) * cellPixels;
    const residualOffsetPixels = currentDrag.currentOffsetPixels - snappedOffsetPixels;

    if (Math.abs(residualOffsetPixels) < 0.5) {
      clearVehicleTransform(currentDrag.element);
      return;
    }

    currentDrag.element.style.transition = 'none';
    currentDrag.element.style.transform = dragTransform(
      currentDrag.orientation,
      residualOffsetPixels
    );

    await tick();

    requestAnimationFrame(() => {
      currentDrag.element.style.transition = `transform ${SNAP_TRANSITION_MS}ms ${SNAP_TRANSITION_EASING}`;
      currentDrag.element.style.transform = '';
    });

    window.setTimeout(() => {
      currentDrag.element.style.transition = '';
      currentDrag.element.style.willChange = '';
    }, SNAP_TRANSITION_MS);
  }

  function finishDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    syncDragFromEvent(event, drag);
    const currentDrag = drag;
    const finalCoordinate = getReleaseCoordinate(currentDrag);
    const changed = finalCoordinate !== currentDrag.startCoordinate;
    const vehicleIndex = currentDrag.vehicleIndex;
    const element = currentDrag.element;

    drag = null;
    setDraggingStyles(element, false);

    if (!changed) {
      clearVehicleTransform(element);
      return;
    }

    const snapAnimation = animateSnapToGrid(currentDrag, finalCoordinate);
    onCommitMove(vehicleIndex, finalCoordinate);
    void snapAnimation;
  }

  function vehicleClasses(): string {
    return [
      'absolute flex items-center justify-center rounded-[1rem] border border-black/10 px-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_20px_42px_rgba(15,23,42,0.30),0_8px_16px_rgba(15,23,42,0.18)] outline-none focus-visible:ring-4 focus-visible:ring-stone-700/25',
      disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
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

    const element = event.currentTarget as HTMLElement;
    const range = getMoveRange(vehicles, index);
    const startCoordinate = vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;

    if (range.min === range.max) {
      return;
    }

    drag = {
      vehicleIndex: index,
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCoordinate,
      currentCoordinate: startCoordinate,
      currentOffsetPixels: 0,
      range,
      orientation: vehicle.orientation
    };

    setDraggingStyles(element, true);
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function updateDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId || boardPixels === 0) {
      return;
    }

    syncDragFromEvent(event, drag);
  }

  function endDrag(event: PointerEvent): void {
    finishDrag(event);
  }

  function cancelDrag(event: PointerEvent): void {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    setDraggingStyles(drag.element, false);
    clearVehicleTransform(drag.element);
    drag = null;
  }

  function finalizeDragFromCaptureLoss(event: PointerEvent): void {
    finishDrag(event);
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
  class="relative aspect-square w-full max-w-[30rem] overflow-visible border bg-[linear-gradient(135deg,#f9f3ea_0%,#efe5d5_100%)] shadow-[0_24px_80px_rgba(120,93,49,0.18)]"
  style:border-radius={boardOuterRadius}
  style:border-color="rgba(214, 211, 209, 0.8)"
  aria-label="Traffic puzzle board"
>
  <div bind:this={playfieldElement} class="absolute" style:inset={playfieldInset}>
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
        class="absolute inset-0 bg-transparent"
        style:border-radius={frameRadius}
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
          class={vehicleClasses()}
          style="touch-action: none;"
          style:left={`${vehicle.x * percent}%`}
          style:top={`${vehicle.y * percent}%`}
          style:width={`${(vehicle.orientation === 'horizontal' ? vehicle.length : 1) * percent}%`}
          style:height={`${(vehicle.orientation === 'vertical' ? vehicle.length : 1) * percent}%`}
          style:background={`${vehicle.color}`}
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
