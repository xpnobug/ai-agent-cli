// @ts-nocheck
/**
 * PasteEvent — 粘贴事件类型
 */

export class PasteEvent {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}
