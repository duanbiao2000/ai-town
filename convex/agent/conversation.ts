/**
 * 根据玩家和其他代理的信息生成当前玩家代理的提示信息。
 * @param otherPlayer 另一个玩家的信息
 * @param agent 当前玩家的代理信息，可能为null
 * @param otherAgent 另一个玩家的代理信息，可能为null
 * @returns 返回一个字符串数组，包含生成的提示信息
 */
function agentPrompts(
  otherPlayer: Doc<'players'>,
  agent: Doc<'agents'> | null,
  otherAgent: Doc<'agents'> | null,
): string[] {
  const prompt = [];
  if (agent) {
    prompt.push(`关于你: ${agent.identity}`);
    prompt.push(`你在这次对话中的目标: ${agent.plan}`);
  }
  if (otherAgent) {
    prompt.push(`关于${otherPlayer.name}: ${otherAgent.identity}`);
  }
  return prompt;
}

/**
 * 生成关于两个玩家之间上次对话的提示信息，如果存在的话。
 * @param otherPlayer 另一个玩家的信息
 * @param conversation 上次对话的信息，可能为null
 * @returns 返回一个字符串数组，包含生成的提示信息
 */
function previousConversationPrompt(
  otherPlayer: Doc<'players'>,
  conversation: Doc<'conversations'> | null,
): string[] {
  const prompt = [];
  if (conversation) {
    const prev = new Date(conversation._creationTime);
    const now = new Date();
    prompt.push(
      `上一次与${otherPlayer.name}聊天是在${prev.toLocaleString()}。现在是${now.toLocaleString()}`,
    );
  }
  return prompt;
}

/**
 * 根据相关记忆生成提示信息。
 * @param otherPlayer 另一个玩家的信息
 * @param memories 相关的记忆列表
 * @returns 返回一个字符串数组，包含生成的提示信息
 */
function relatedMemoriesPrompt(otherPlayer: Doc<'players'>, memories: memory.Memory[]): string[] {
  const prompt = [];
  if (memories.length > 0) {
    prompt.push(`以下是按相关性递减顺序排列的一些相关记忆:`);
    for (const memory of memories) {
      prompt.push(' - ' + memory.description);
    }
  }
  return prompt;
}

/**
 * 异步获取之前的消息记录，并转换成LLMMessage格式。
 * @param ctx 上下文环境
 * @param player 当前玩家的信息
 * @param otherPlayer 另一个玩家的信息
 * @param conversationId 对话ID
 * @returns 返回一个LLMMessage数组，包含之前的消息记录
 */
async function previousMessages(
  ctx: ActionCtx,
  player: Doc<'players'>,
  otherPlayer: Doc<'players'>,
  conversationId: Id<'conversations'>,
) {
  const llmMessages: LLMMessage[] = [];
  const prevMessages = await ctx.runQuery(api.messages.listMessages, { conversationId });
  for (const message of prevMessages) {
    const author = message.author === player._id ? player : otherPlayer;
    const recipient = message.author === player._id ? otherPlayer : player;
    llmMessages.push({
      role: 'user',
      content: `${author.name} to ${recipient.name}: ${message.text}`,
    });
  }
  return llmMessages;
}

/**
 * 查询并返回与对话相关的玩家信息。
 * @param playerId 当前玩家ID
 * @param otherPlayerId 另一个玩家ID
 * @param conversationId 对话ID
 * @param lastConversationId 最后一次对话ID，可选
 * @returns 返回一个对象，包含玩家、另一个玩家、对话、代理等相关信息
 */
export const queryPromptData = internalQuery({
  args: {
    playerId: v.id('players'),
    otherPlayerId: v.id('players'),
    conversationId: v.id('conversations'),
    lastConversationId: v.union(v.id('conversations'), v.null()),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const otherPlayer = await ctx.db.get(args.otherPlayerId);
    if (!otherPlayer) {
      throw new Error(`Player ${args.otherPlayerId} not found`);
    }
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const agent = await ctx.db
      .query('agents')
      .withIndex('playerId', (q) => q.eq('playerId', args.playerId))
      .first();
    if (!agent) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const otherAgent = await ctx.db
      .query('agents')
      .withIndex('playerId', (q) => q.eq('playerId', args.otherPlayerId))
      .first();
    let lastConversation = null;
    if (args.lastConversationId) {
      lastConversation = await ctx.db.get(args.lastConversationId);
      if (!lastConversation) {
        throw new Error(`Conversation ${args.lastConversationId} not found`);
      }
    }
    return { player, otherPlayer, conversation, agent, otherAgent, lastConversation };
  },
});

/**
 * 查询并返回之前的对话记录。
 * @param conversationId 当前对话ID
 * @param playerId 当前玩家ID
 * @param otherPlayerId 另一个玩家ID
 * @returns 返回一个对话对象或null，表示之前的对话记录
 */
export const previousConversation = internalQuery({
  args: {
    conversationId: v.id('conversations'),
    playerId: v.id('players'),
    otherPlayerId: v.id('players'),
  },
  handler: async (ctx, args) => {
    const previousConversations = await ctx.db
      .query('conversationMembers')
      .withIndex('playerId', (q) => q.eq('playerId', args.playerId))
      .filter((q) => q.neq(q.field('conversationId'), args.conversationId))
      .collect();
    const conversations = [];
    for (const member of previousConversations) {
      const otherMember = await ctx.db
        .query('conversationMembers')
        .withIndex('conversationId', (q) =>
          q.eq('conversationId', member.conversationId).eq('playerId', args.otherPlayerId),
        )
        .first();
      if (otherMember) {
        const conversation = await ctx.db.get(member.conversationId);
        if (!conversation) {
          throw new Error(`Conversation ${member.conversationId} not found`);
        }
        if (conversation.finished) {
          conversations.push(conversation);
        }
      }
    }
    conversations.sort((a, b) => b._creationTime - a._creationTime);
    return conversations.length > 0 ? conversations[0] : null;
  },
});

/**
 * 生成LLM停止词，用于控制LLM在特定词汇出现时停止生成文本。
 * @param otherPlayer 另一个玩家的信息
 * @param player 当前玩家的信息
 * @returns 返回一个字符串数组，包含停止词
 */
function stopWords(otherPlayer: Doc<'players'>, player: Doc<'players'>) {
  // 这些是要求LLM停止的词汇。OpenAI只支持4个停止词。
  const variants = [otherPlayer.name, `${otherPlayer.name} to ${player.name}`];
  return variants.flatMap((stop) => [stop + ':', stop.toLowerCase() + ':']);
}
