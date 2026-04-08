import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';

export interface TouchDragEvent {
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

export interface TouchDropEvent {
  clientX: number;
  clientY: number;
  dropTarget: Element | null;
}

@Directive({
  selector: '[appTouchCard]',
  standalone: true,
})
export class TouchCardDirective implements OnDestroy {
  private el = inject(ElementRef);

  @Input() touchDraggable = false;
  @Output() longPress = new EventEmitter<TouchDragEvent>();
  @Output() touchDragStart = new EventEmitter<TouchDragEvent>();
  @Output() touchDragMove = new EventEmitter<TouchDragEvent>();
  @Output() touchDragEnd = new EventEmitter<TouchDropEvent>();

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private isDragging = false;
  private longPressTriggered = false;

  private static readonly LONG_PRESS_DURATION = 500;
  private static readonly MOVE_THRESHOLD = 10;

  constructor() {
    const element = this.el.nativeElement as HTMLElement;

    element.addEventListener('touchstart', this.onTouchStart, { passive: false });
    element.addEventListener('touchmove', this.onTouchMove, { passive: false });
    element.addEventListener('touchend', this.onTouchEnd, { passive: false });
    element.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
  }

  ngOnDestroy(): void {
    this.cancelLongPress();
    const element = this.el.nativeElement as HTMLElement;
    element.removeEventListener('touchstart', this.onTouchStart);
    element.removeEventListener('touchmove', this.onTouchMove);
    element.removeEventListener('touchend', this.onTouchEnd);
    element.removeEventListener('touchcancel', this.onTouchCancel);
  }

  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isDragging = false;
    this.longPressTriggered = false;

    // Prevent default to stop iOS context menu
    event.preventDefault();

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.longPress.emit({
        clientX: this.touchStartX,
        clientY: this.touchStartY,
        target: event.target,
      });
    }, TouchCardDirective.LONG_PRESS_DURATION);
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - this.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.touchStartY);

    // If moved beyond threshold, cancel long press and start drag
    if (deltaX > TouchCardDirective.MOVE_THRESHOLD || deltaY > TouchCardDirective.MOVE_THRESHOLD) {
      this.cancelLongPress();

      if (this.touchDraggable && !this.isDragging && !this.longPressTriggered) {
        this.isDragging = true;
        this.touchDragStart.emit({
          clientX: this.touchStartX,
          clientY: this.touchStartY,
          target: event.target,
        });
      }

      if (this.isDragging) {
        event.preventDefault();
        this.touchDragMove.emit({
          clientX: touch.clientX,
          clientY: touch.clientY,
          target: event.target,
        });
      }
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    this.cancelLongPress();

    if (this.isDragging) {
      const touch = event.changedTouches[0];
      const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

      this.touchDragEnd.emit({
        clientX: touch.clientX,
        clientY: touch.clientY,
        dropTarget,
      });
    }

    this.isDragging = false;
    this.longPressTriggered = false;
  };

  private onTouchCancel = (): void => {
    this.cancelLongPress();
    this.isDragging = false;
    this.longPressTriggered = false;
  };

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
