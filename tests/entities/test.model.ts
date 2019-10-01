import { Entity, IEntity, PrimaryKey, Property } from '../../lib';

@Entity()
export class Test {

  @PrimaryKey({ type: 'ObjectId' })
  _id: any;

  @Property({ type: 'string' })
  name: any;

  @Property({ hidden: true })
  hiddenField = Date.now();

  constructor(props: Partial<Test> = {}) {
    this._id = props._id;
    this.name = props.name;

    if (props.hiddenField) {
      this.hiddenField = props.hiddenField;
    }
  }

  static create(name: string) {
    const t = new Test();
    t.name = name;

    return t;
  }

}

export interface Test extends IEntity<string> { }
