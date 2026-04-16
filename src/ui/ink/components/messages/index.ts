/**
 * 消息组件模块入口
 *
 * 导入所有消息组件（触发自注册），并 re-export 注册表
 */

// 先 re-export 注册表（无循环依赖）
export { registerMessageView, getMessageView, type MessageViewProps } from './registry.js';

// 导入所有消息组件（触发自注册）
import './UserMessageView.js';
import './AiMessageView.js';
import './ToolUseMessageView.js';
import './ToolResultMessageView.js';
import './SystemMessageView.js';
import './BannerMessageView.js';
import './DividerView.js';
import './ThinkingMessageView.js';
import './RedactedThinkingMessageView.js';
import './CompactBoundaryMessageView.js';
import './RateLimitMessageView.js';
import './ApiErrorMessageView.js';
import './UserCommandMessageView.js';
import './UserImageMessageView.js';
import './BashInputMessageView.js';
import './BashOutputMessageView.js';
import './UserPlanMessage.js';
import './PlanApprovalMessageView.js';
import './ShutdownMessageView.js';
import './HookProgressMessageView.js';
import './LocalCommandOutputMessageView.js';
import './MemoryInputMessageView.js';
