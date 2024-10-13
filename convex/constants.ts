// 定义世界处于非活跃状态的超时时间（5分钟），用于决定何时清理资源
export const IDLE_WORLD_TIMEOUT = 5 * 60 * 1000;
// 定义世界心跳检测的间隔时间（1分钟），用于检测世界的活跃状态
export const WORLD_HEARTBEAT_INTERVAL = 60 * 1000;

// 定义最大步长（10分钟），用于限制世界模拟的最大时间跨度
export const MAX_STEP = 10 * 60 * 1000;
// 定义模拟的tick间隔（16毫秒），用于控制模拟的精细程度
export const TICK = 16;
// 定义步长间隔（1秒），用于控制模拟步长的时间间隔
export const STEP_INTERVAL = 1000;

// 定义寻路超时时间（1分钟），用于防止寻路过程过长
export const PATHFINDING_TIMEOUT = 60 * 1000;
// 定义寻路失败后的重试间隔（1秒），用于管理寻路重试逻辑
export const PATHFINDING_BACKOFF = 1000;
// 定义对话距离阈值（1.3单位），用于判断角色间是否可以进行对话
export const CONVERSATION_DISTANCE = 1.3;
// 定义输入状态超时时间（15秒），用于判断角色是否处于活跃的输入状态
export const TYPING_TIMEOUT = 15 * 1000;
// 定义碰撞检测的阈值（0.75），用于判断两个对象是否发生碰撞
export const COLLISION_THRESHOLD = 0.75;