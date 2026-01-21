/**
 * 模型上下文长度配置
 */

// Anthropic Claude 模型
const ANTHROPIC_MODELS: Record<string, number> = {
    'claude-opus-4-20250514': 200000,
    'claude-sonnet-4-20250514': 200000,
    'claude-3.5-sonnet': 200000,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
};

// OpenAI 模型
const OPENAI_MODELS: Record<string, number> = {
    'gpt-4': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4-0125-preview': 128000,
    'gpt-4-1106-preview': 128000,
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16384,
    'o1-preview': 128000,
    'o1-mini': 128000,
};

// Google Gemini 模型
const GEMINI_MODELS: Record<string, number> = {
    'gemini-2.0-flash-exp': 1000000,
    'gemini-1.5-pro': 2000000,
    'gemini-1.5-flash': 1000000,
    'gemini-1.0-pro': 32000,
};

/**
 * 获取模型的上下文长度
 * 
 * @param provider - AI 提供商
 * @param model - 模型名称
 * @returns 上下文长度（token 数）
 */
export function getModelContextLength(provider: string, model: string): number {
    switch (provider.toLowerCase()) {
        case 'anthropic':
            return ANTHROPIC_MODELS[model] || 200000; // 默认 200k
        case 'openai':
            return OPENAI_MODELS[model] || 128000;    // 默认 128k
        case 'gemini':
            return GEMINI_MODELS[model] || 1000000;   // 默认 1M
        default:
            return 200000; // 通用默认值
    }
}

/**
 * 获取模型的简短名称（用于显示）
 * 
 * @param model - 完整模型名称
 * @returns 简短名称
 */
export function getModelDisplayName(model: string): string {
    // 移除日期后缀
    const withoutDate = model.replace(/-\d{8}$/, '');

    // 已知的简化映射
    const displayNames: Record<string, string> = {
        'claude-opus-4': 'claude-opus-4',
        'claude-sonnet-4': 'claude-sonnet-4',
        'claude-3.5-sonnet': 'claude-3.5-sonnet',
        'gemini-2.0-flash-exp': 'gemini-2.0-flash',
        'gpt-4-turbo-preview': 'gpt-4-turbo',
    };

    return displayNames[withoutDate] || withoutDate;
}
