// 导入引擎相关的表结构定义
import { engineTables } from '../engine/schema';
// 导入玩家相关表结构定义
import { players } from './players';
// 导入地点相关表结构定义
import { locations } from './locations';
// 导入对话相关表结构定义
import { conversations } from './conversations';
// 导入对话参与成员相关表结构定义
import { conversationMembers } from './conversationMembers';

// 定义游戏相关的所有表结构的集合
// 包含玩家、地点、对话及其成员等表结构，以及引擎相关的表结构
export const gameTables = {
  players: players,
  locations: locations,
  conversations: conversations,
  conversationMembers: conversationMembers,
  ...engineTables,
};