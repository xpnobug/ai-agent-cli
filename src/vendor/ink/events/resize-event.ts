// @ts-nocheck
/**
 * ResizeEvent — 终端大小变化事件
 */

export class ResizeEvent {
  readonly columns: number;
  readonly rows: number;
  constructor(columns: number, rows: number) {
    this.columns = columns;
    this.rows = rows;
  }
}
