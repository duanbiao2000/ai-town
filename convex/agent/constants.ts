// 定义对话冷却时间常量，避免在对话结束后立即进行下一次对话
export const CONVERATION_COOLDOWN = 15000;

// 定义针对玩家的对话冷却时间，以避免频繁与同一玩家对话
export const PLAYER_CONVERSATION_COOLDOWN = 60000;

// 设置接受来自其他代理的邀请的概率，以控制参与度
export const INVITE_ACCEPT_PROBABILITY = 0.8;

// 设置邀请接受的等待时间上限，以避免长时间等待回复
export const INVITE_TIMEOUT = 60000;

// 定义在加入对话前的等待时间，以避免在他人对话未完时打断
export const AWKWARD_CONVERSATION_TIMEOUT = 20000;

// 设置参与对话的最大持续时间，以防止对话过长
export const MAX_CONVERSATION_DURATION = 120 * 1000;

// 设置对话中消息数量的上限，以保持对话简洁
export const MAX_CONVERSATION_MESSAGES = 8;

// 在发送输入到引擎后等待一段时间，以确保输入被正确处理
export const INPUT_DELAY = 1000;

// 设置与对话层交互时的请求超时时间，以防止长时间无响应
export const ACTION_TIMEOUT = 60 * 1000;

// 设置发送消息之间的最小间隔时间，以避免消息刷屏
export const MESSAGE_COOLDOWN = 2000;
