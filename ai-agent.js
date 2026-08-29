/**
 * AI Agent for Rare Candy Reserve Website Editing
 * Integrates with Claude API to provide intelligent editing assistance
 * Works with Cloudflare and Lumo for website management
 */

class RareCandyAIAgent {
    constructor() {
        this.apiKey = localStorage.getItem('claude_api_key') || '';
        this.websiteUrl = 'https://rarecandyreserve.org';
        this.cloudflareConfig = JSON.parse(localStorage.getItem('cloudflare_config') || '{}');
        this.conversationHistory = [];
        this.isProcessing = false;
    }

    /**
     * Initialize AI Agent with API key
     */
    async initialize(apiKey) {
        if (!apiKey) {
            console.error('API key is required');
            return false;
        }

        this.apiKey = apiKey;
        localStorage.setItem('claude_api_key', apiKey);
        
        try {
            // Verify API key works
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 100,
                    messages: [{
                        role: 'user',
                        content: 'Test connection'
                    }]
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to initialize AI Agent:', error);
            return false;
        }
    }

    /**
     * Process website editing task with AI assistance
     */
    async processEditTask(task) {
        if (!this.apiKey) {
            return {
                success: false,
                error: 'AI Agent not initialized. Please set your Claude API key.'
            };
        }

        this.isProcessing = true;
        const prompt = this.buildEditPrompt(task);

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 2000,
                    system: this.getSystemPrompt(),
                    messages: [...this.conversationHistory, {
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API request failed');
            }

            const assistantMessage = data.content[0].text;
            
            // Store conversation history
            this.conversationHistory.push({
                role: 'user',
                content: prompt
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: assistantMessage
            });

            // Keep conversation history manageable (last 10 exchanges)
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return {
                success: true,
                suggestion: assistantMessage,
                task: task,
                timestamp: new Date().toLocaleString()
            };

        } catch (error) {
            console.error('Error processing edit task:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Get editing suggestions for a specific category
     */
    async getSuggestions(category) {
        const prompt = `
            The user needs help editing their Pokémon collectibles website (rarecandyreserve.org).
            They need suggestions for ${category} edits.
            
            Provide 3-5 specific, actionable suggestions they can implement immediately.
            Format as a clear list with brief explanations.
        `;

        return this.processEditTask({
            text: prompt,
            category: category
        });
    }

    /**
     * Generate optimized CSS for styling tasks
     */
    async generateCSS(description) {
        const prompt = `
            The user is editing rarecandyreserve.org and needs CSS code.
            Request: ${description}
            
            Provide modern, responsive CSS that:
            - Works on mobile and desktop
            - Follows accessibility best practices
            - Is compatible with Cloudflare and Lumo hosting
            - Uses CSS Grid or Flexbox for layout
            
            Format as a code block with clear comments.
        `;

        return this.processEditTask({
            text: prompt,
            category: 'styling'
        });
    }

    /**
     * Suggest image optimizations
     */
    async suggestImageOptimizations(description) {
        const prompt = `
            The user is optimizing images for rarecandyreserve.org.
            Current scenario: ${description}
            
            Provide specific recommendations for:
            1. Image format (WEBP, PNG, JPG)
            2. Dimensions and aspect ratios
            3. File size optimization
            4. CDN optimization via Cloudflare
            5. Alt text suggestions for collectibles
            
            Be specific and actionable.
        `;

        return this.processEditTask({
            text: prompt,
            category: 'images'
        });
    }

    /**
     * Improve product descriptions
     */
    async improveProductText(description, productName) {
        const prompt = `
            The user is editing a Pokémon collectible listing on rarecandyreserve.org.
            Product: ${productName}
            Current description: ${description}
            
            Improve this description by:
            1. Making it more engaging and descriptive
            2. Highlighting key details (condition, rarity, year, etc.)
            3. Using persuasive language for collectors
            4. Keeping it concise (2-3 sentences)
            5. Adding relevant keywords for SEO
            
            Provide only the improved text without explanations.
        `;

        return this.processEditTask({
            text: prompt,
            category: 'text'
        });
    }

    /**
     * Generate layout recommendations
     */
    async suggestLayoutChanges(pageSection) {
        const prompt = `
            The user is redesigning ${pageSection} on rarecandyreserve.org.
            This is a Pokémon collectibles showcase website.
            
            Suggest modern layout improvements for:
            1. Visual hierarchy and organization
            2. Responsive grid/flex layouts
            3. Whitespace and breathing room
            4. Call-to-action placement
            5. Mobile-first design approach
            
            Consider collector psychology and e-commerce best practices.
            Provide specific, implementable suggestions.
        `;

        return this.processEditTask({
            text: prompt,
            category: 'layout'
        });
    }

    /**
     * Build prompt based on task details
     */
    buildEditPrompt(task) {
        if (typeof task === 'string') {
            return task;
        }

        return `
            Website: rarecandyreserve.org (Pokémon Collectibles)
            Hosting: Cloudflare + Lumo
            Task: ${task.text || task}
            Category: ${task.category || 'general'}
            
            Provide practical, implementable suggestions that:
            - Work with existing Cloudflare and Lumo setup
            - Maintain site performance and responsiveness
            - Align with collectibles/e-commerce best practices
            - Are specific and actionable
        `;
    }

    /**
     * System prompt defining AI agent behavior
     */
    getSystemPrompt() {
        return `You are an expert web developer and designer specializing in e-commerce websites, particularly for collectibles platforms like Pokemon card shops. 

Your role is to help edit and improve rarecandyreserve.org, a Pokémon collectibles website hosted on Cloudflare with Lumo integration.

You excel at:
- Writing clean, responsive HTML/CSS/JavaScript
- Image optimization and CDN management
- E-commerce best practices
- Collector community engagement
- Performance optimization
- Accessibility standards

When users ask for edits, provide:
1. Specific, copy-paste-ready code or suggestions
2. Explanations of why changes improve the site
3. Mobile-first, responsive design principles
4. Cloudflare-compatible solutions
5. SEO considerations for collectibles

Always ask clarifying questions if needed and provide working examples.
Be concise but thorough. Format code in markdown code blocks.`;
    }

    /**
     * Save Cloudflare configuration
     */
    setCloudflareConfig(config) {
        this.cloudflareConfig = config;
        localStorage.setItem('cloudflare_config', JSON.stringify(config));
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return this.conversationHistory;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Check if agent is processing
     */
    getProcessingStatus() {
        return this.isProcessing;
    }

    /**
     * Batch process multiple tasks
     */
    async processBatchTasks(tasks) {
        const results = [];
        
        for (const task of tasks) {
            const result = await this.processEditTask(task);
            results.push(result);
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return results;
    }

    /**
     * Export conversation as markdown
     */
    exportConversation() {
        let markdown = `# Rare Candy Reserve - AI Editing Session\nDate: ${new Date().toLocaleString()}\n\n`;
        
        for (let i = 0; i < this.conversationHistory.length; i += 2) {
            const userMsg = this.conversationHistory[i];
            const assistantMsg = this.conversationHistory[i + 1];
            
            markdown += `## User\n${userMsg.content}\n\n`;
            markdown += `## AI Agent\n${assistantMsg?.content || 'No response'}\n\n---\n\n`;
        }
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rare-candy-ai-session-${new Date().toISOString().split('T')[0]}.md`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize global AI Agent instance
const aiAgent = new RareCandyAIAgent();
