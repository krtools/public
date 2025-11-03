import {action, observable} from 'mobx';

export class ItemSelector {
  public items = observable.set<number>([], {deep: false});

  /** This is anchor for shift+click selections. It is the secondary cursor (this is what is changed when the shift+arrow keys are used) */
  @observable.ref
  public anchor?: number;

  /** This is the main selected item */
  @observable.ref
  public cursor?: number;

  /** Clear the item selector. It is better to make a new ItemSelector for each new view e.g. when paginating */
  public clear = () => (this.anchor = this.cursor = void this.items.clear());

  public toArray = () => [...this.items];

  @action
  public select(item: number, opts: {ctrl: boolean; shift: boolean}) {
    const {ctrl, shift} = opts;
    const {items, cursor = 0, anchor = cursor} = this;

    // you only implicitly retain previous items when ctrl key is pressed
    if (!ctrl) items.clear();

    if (!ctrl && !shift) {
      items.add(item);
    } else if (ctrl && !shift) {
      items.has(item) ? items.delete(item) : items.add(item);
    } else if (!ctrl && shift) {
      for (let i = cursor; i <= item; i++) items.add(i);
    } else if (!ctrl && shift) {
      for (let i = cursor; i <= item; i++) {
        items.has(i) ? items.delete(i) : items.add(i);
      }
    }

    // cursor is not updated when you use shift key
    if (shift) this.anchor = item;
    else this.anchor = this.cursor = item;
  }
}
