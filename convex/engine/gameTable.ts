import { DatabaseReader, DatabaseWriter } from '../_generated/server';
import { Doc, Id, TableNames } from '../_generated/dataModel';
import { FieldPaths, WithoutSystemFields } from 'convex/server';

/**
 * 抽象类 GameTable 提供了一个通用的接口来管理游戏相关的数据表。
 * 它处理数据的插入、删除、查询和更新，并维护数据的活跃状态。
 */
export abstract class GameTable<T extends TableNames> {
  abstract table: T;
  abstract db: DatabaseWriter;

  data: Map<Id<T>, Doc<T>> = new Map();
  modified: Set<Id<T>> = new Set();
  deleted: Set<Id<T>> = new Set();

  /**
   * 判断给定的数据文档是否处于活跃状态。
   * @param doc 要判断的文档。
   * @returns 如果文档活跃返回 true，否则返回 false。
   */
  abstract isActive(doc: Doc<T>): boolean;

  /**
   * 构造函数，用于初始化数据表管理类。
   * @param rows 初始化时加载的文档数组。
   */
  constructor(rows: Doc<T>[]) {
    for (const row of rows) {
      this.data.set(row._id, row);
    }
  }

  /**
   * 插入一个新的文档到数据表中。
   * @param row 要插入的文档，不包含系统字段。
   * @returns 插入文档后分配的 ID。
   */
  async insert(row: WithoutSystemFields<Doc<T>>): Promise<Id<T>> {
    const id = await this.db.insert(this.table, row);
    const withSystemFields = await this.db.get(id);
    if (!withSystemFields) {
      throw new Error(`Failed to db.get() inserted row`);
    }
    this.data.set(id, withSystemFields);
    return id;
  }

  /**
   * 删除指定 ID 的文档。
   * @param id 要删除的文档的 ID。
   */
  delete(id: Id<T>) {
    if (this.data.delete(id)) {
      this.deleted.add(id);
    }
  }

  /**
   * 根据 ID 查找文档，并确保文档是活跃的。
   * @param id 要查找的文档的 ID。
   * @returns 查找到的文档。
   * @throws 如果文档无效或不活跃，抛出错误。
   */
  lookup(id: Id<T>): Doc<T> {
    const row = this.data.get(id);
    if (!row) {
      throw new Error(`Invalid ID: ${id}`);
    }
    if (!this.isActive(row)) {
      throw new Error(`ID is inactive: ${id}`);
    }
    const handlers = {
      defineProperty: (target: any, key: any, descriptor: any) => {
        this.markModified(id);
        return Reflect.defineProperty(target, key, descriptor);
      },
      get: (target: any, prop: any, receiver: any) => {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'object') {
          return new Proxy<Doc<T>>(value, handlers);
        } else {
          return value;
        }
      },
      set: (obj: any, prop: any, value: any) => {
        this.markModified(id);
        return Reflect.set(obj, prop, value);
      },
      deleteProperty: (target: any, prop: any) => {
        this.markModified(id);
        return Reflect.deleteProperty(target, prop);
      },
    };
    return new Proxy<Doc<T>>(row, handlers);
  }

  /**
   * 查找满足给定条件的第一个文档。
   * @param f 用于判断文档是否满足条件的函数。
   * @returns 满足条件的文档，如果找不到则返回 null。
   */
  find(f: (doc: Doc<T>) => boolean): Doc<T> | null {
    for (const id of this.allIds()) {
      const doc = this.lookup(id);
      if (f(doc)) {
        return doc;
      }
    }
    return null;
  }

  /**
   * 过滤出所有满足给定条件的文档。
   * @param f 用于判断文档是否满足条件的函数。
   * @returns 包含所有满足条件的文档的数组。
   */
  filter(f: (doc: Doc<T>) => boolean): Array<Doc<T>> {
    const out = [];
    for (const id of this.allIds()) {
      const doc = this.lookup(id);
      if (f(doc)) {
        out.push(doc);
      }
    }
    return out;
  }

  /**
   * 返回所有文档的 ID。
   * @returns 包含所有文档 ID 的数组。
   */
  allIds(): Array<Id<T>> {
    const ids = [];
    for (const [id, doc] of this.data.entries()) {
      if (!this.isActive(doc)) {
        continue;
      }
      ids.push(id);
    }
    return ids;
  }

  /**
   * 返回所有文档。
   * @returns 包含所有文档的数组。
   */
  allDocuments(): Array<Doc<T>> {
    return this.allIds().map((id) => this.lookup(id));
  }

  /**
   * 标记给定 ID 的文档为已修改。
   * @param id 被修改的文档的 ID。
   */
  private markModified(id: Id<T>) {
    const data = this.data.get(id);
    if (!data) {
      console.warn(`Modifying deleted id ${id}`);
      return;
    }
    if (!this.isActive(data)) {
      console.warn(`Modifying inactive id ${id}`);
      return;
    }
    this.modified.add(id);
  }

  /**
   * 保存所有修改和删除到数据库。
   */
  async save() {
    for (const id of this.deleted) {
      await this.db.delete(id);
    }
    for (const id of this.modified) {
      const row = this.data.get(id);
      if (!row) {
        throw new Error(`Invalid modified id: ${id}`);
      }
      await this.db.replace(id, row as any);
    }
    this.modified.clear();
    this.deleted.clear();
  }
}