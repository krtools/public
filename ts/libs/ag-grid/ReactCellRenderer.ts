import React, { type ReactNode } from 'react';
import ReactDOM from 'react-dom';
import type { ICellRendererComp, ICellRendererParams } from 'ag-grid-community';
 
export type ReactCellRendererParams<TData = any, TValue = any> =
  ICellRendererParams<TData, TValue> & {
    render: (params: ICellRendererParams<TData, TValue>) => ReactNode;
  };
 
export class ReactCellRenderer<TData = any, TValue = any>
  implements ICellRendererComp<TData>
{
  private eGui!: HTMLElement;
  private render!: ReactCellRendererParams<TData, TValue>['render'];
 
  init(params: ReactCellRendererParams<TData, TValue>): void {
    this.eGui = document.createElement('div');
    this.render = params.render;
    ReactDOM.render(<>{this.render(params)}</>, this.eGui);
  }
 
  getGui(): HTMLElement {
    return this.eGui;
  }
 
  refresh(params: ReactCellRendererParams<TData, TValue>): boolean {
    // Pick up a new render fn if the column def was updated, otherwise
    // keep using the original.
    if (params.render) this.render = params.render;
    ReactDOM.render(<>{this.render(params)}</>, this.eGui);
    return true;
  }
 
  destroy(): void {
    ReactDOM.unmountComponentAtNode(this.eGui);
  }
}
