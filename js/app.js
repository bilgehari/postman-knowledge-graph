// Main Application Controller
class PostmanKnowledgeApp {
    constructor() {
        this.apiKeyInput = document.getElementById('api-key');
        this.loadButton = document.getElementById('load-data');
        this.statusDiv = document.getElementById('status');
        this.jsonOutput = document.getElementById('json-ld-output');
        
        this.currentData = null;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing Postman Knowledge Graph App...');
        
        // Bind event listeners
        this.loadButton.addEventListener('click', () => this.loadData());
        this.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadData();
            }
        });
        
        // Auto-resize graph on window resize
        window.addEventListener('resize', this.debounce(() => {
            if (knowledgeGraph) {
                knowledgeGraph.resize();
            }
        }, 250));
        
        // Show initial message
        this.updateStatus('Enter your Postman API Key to start loading data...', 'info');
        this.showInitialMessage();
    }

    // Show initial message in graph area
    showInitialMessage() {
        const graphContainer = document.getElementById('knowledge-graph');
        graphContainer.innerHTML = `
            <div style="text-align: center; color: #6c757d;">
                <div style="font-size: 24px; margin-bottom: 10px;">🔗</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
                    Postman Knowledge Graph
                </div>
                <div style="font-size: 14px;">
                    Enter your API key and click "Load Data" to visualize your Postman workspace
                </div>
            </div>
        `;
    }

    // Main data loading function
    async loadData() {
        const apiKey = this.apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.updateStatus('Please enter your Postman API Key', 'error');
            this.apiKeyInput.focus();
            return;
        }

        if (this.isLoading) {
            this.updateStatus('Already loading data...', 'warning');
            return;
        }

        try {
            this.isLoading = true;
            this.loadButton.disabled = true;
            this.loadButton.textContent = 'Loading...';
            
            this.updateStatus('🔄 Connecting to Postman API...', 'loading');
            
            // Set API key
            postmanAPI.setApiKey(apiKey);
            
            // Test connection first
            this.updateStatus('🔍 Testing API connection...', 'loading');
            await postmanAPI.getUser();
            
            // Load all data
            this.updateStatus('📥 Fetching workspace data...', 'loading');
            this.currentData = await postmanAPI.getAllData();
            
            // Process and visualize data
            this.updateStatus('🎨 Processing data for visualization...', 'loading');
            await this.processAndVisualize();
            
            // Generate and display JSON-LD
            this.updateStatus('📄 Generating Linked Data...', 'loading');
            this.generateJsonLD();
            
            this.updateStatus('✅ Data loaded and visualized successfully!', 'success');
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.handleError(error);
        } finally {
            this.isLoading = false;
            this.loadButton.disabled = false;
            this.loadButton.textContent = 'Load Data';
        }
    }

    // Process data and create visualization
    async processAndVisualize() {
        if (!this.currentData) {
            throw new Error('No data to process');
        }

        // Log data summary
        console.log('📊 Data Summary:', {
            user: this.currentData.user?.username || 'Unknown',
            workspaces: this.currentData.workspaces?.length || 0,
            collections: this.currentData.collections?.length || 0,
            detailedCollections: this.currentData.detailedCollections?.length || 0,
            environments: this.currentData.environments?.length || 0
        });

        // Check if we have enough data to visualize
        const totalNodes = (this.currentData.workspaces?.length || 0) + 
                          (this.currentData.collections?.length || 0) + 
                          (this.currentData.environments?.length || 0);

        if (totalNodes === 0) {
            this.updateStatus('⚠️ No workspaces, collections, or environments found', 'warning');
            knowledgeGraph.showMessage('No data available to visualize');
            return;
        }

        // Process data for graph
        knowledgeGraph.processData(this.currentData);
        
        // Render the graph
        await new Promise(resolve => {
            setTimeout(() => {
                knowledgeGraph.render();
                resolve();
            }, 100);
        });
    }

    // Generate JSON-LD output
    generateJsonLD() {
        if (!this.currentData) {
            this.jsonOutput.textContent = 'No data available';
            return;
        }

        try {
            const jsonLD = postmanAPI.generateJsonLD(this.currentData);
            this.jsonOutput.textContent = JSON.stringify(jsonLD, null, 2);
            
            // Add copy button functionality
            this.addCopyButton();
            
        } catch (error) {
            console.error('Error generating JSON-LD:', error);
            this.jsonOutput.textContent = 'Error generating JSON-LD: ' + error.message;
        }
    }

    // Add copy button for JSON-LD
    addCopyButton() {
        const panel = document.querySelector('.data-panel h3');
        
        // Remove existing copy button
        const existingButton = panel.querySelector('.copy-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Add new copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '📋 Copy JSON-LD';
        copyButton.style.cssText = `
            margin-left: 10px;
            padding: 5px 10px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(this.jsonOutput.textContent)
                .then(() => {
                    copyButton.innerHTML = '✅ Copied!';
                    setTimeout(() => {
                        copyButton.innerHTML = '📋 Copy JSON-LD';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    copyButton.innerHTML = '❌ Failed';
                });
        });
        
        panel.appendChild(copyButton);
    }

    // Update status message
    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status ${type}`;
        
        // Add loading spinner for loading state
        if (type === 'loading') {
            this.statusDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="loading-spinner"></div>
                    <span>${message}</span>
                </div>
            `;
        }
    }

    // Handle errors
    handleError(error) {
        let errorMessage = 'An unexpected error occurred';
        
        if (error.message) {
            if (error.message.includes('Invalid API Key')) {
                errorMessage = '❌ Invalid API Key. Please check your key and try again.';
            } else if (error.message.includes('Network')) {
                errorMessage = '🌐 Network error. Please check your connection.';
            } else if (error.message.includes('rate limit')) {
                errorMessage = '⏳ Rate limit exceeded. Please wait and try again.';
            } else {
                errorMessage = `❌ ${error.message}`;
            }
        }
        
        this.updateStatus(errorMessage, 'error');
        
        // Show error in graph area
        knowledgeGraph.showMessage('Error loading data. Check the status message above.');
    }

    // Utility: Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Export current data
    exportData() {
        if (!this.currentData) {
            alert('No data to export. Please load data first.');
            return;
        }

        const jsonLD = postmanAPI.generateJsonLD(this.currentData);
        const dataStr = JSON.stringify(jsonLD, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `postman-knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Get statistics about current data
    getDataStats() {
        if (!this.currentData) {
            return null;
        }

        const stats = {
            user: this.currentData.user?.username || 'Unknown',
            workspaces: this.currentData.workspaces?.length || 0,
            collections: this.currentData.collections?.length || 0,
            environments: this.currentData.environments?.length || 0,
            totalRequests: 0,
            requestMethods: {}
        };

        // Count requests and methods
        this.currentData.detailedCollections?.forEach(collection => {
            const requests = postmanAPI.extractRequests(collection.item);
            stats.totalRequests += requests.length;
            
            requests.forEach(request => {
                const method = request.method || 'UNKNOWN';
                stats.requestMethods[method] = (stats.requestMethods[method] || 0) + 1;
            });
        });

        return stats;
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 Starting Postman Knowledge Graph Application...');
    
    // Initialize the main application
    window.postmanApp = new PostmanKnowledgeApp();
    
    // Add some global utility functions
    window.exportData = () => {
        if (window.postmanApp) {
            window.postmanApp.exportData();
        }
    };
    
    window.getStats = () => {
        if (window.postmanApp) {
            const stats = window.postmanApp.getDataStats();
            if (stats) {
                console.table(stats);
                return stats;
            }
        }
        return null;
    };
    
    console.log('✅ Application initialized successfully!');
    console.log('💡 Tip: Use getStats() in console to see data statistics');
    console.log('💡 Tip: Use exportData() in console to download JSON-LD file');
});

// Handle any unhandled errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.postmanApp) {
        window.postmanApp.updateStatus('An unexpected error occurred', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.postmanApp) {
        window.postmanApp.updateStatus('An unexpected error occurred', 'error');
    }
});
