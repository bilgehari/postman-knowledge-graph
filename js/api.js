// Postman API Connection Module
class PostmanAPI {
    constructor() {
        this.baseURL = 'https://api.getpostman.com';
        this.apiKey = null;
        this.headers = {};
    }

    // Set API Key
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.headers = {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    // Generic API request method
    async makeRequest(endpoint) {
        if (!this.apiKey) {
            throw new Error('API Key not set');
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Get all workspaces
    async getWorkspaces() {
        try {
            const data = await this.makeRequest('/workspaces');
            return data.workspaces || [];
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            throw error;
        }
    }

    // Get specific workspace details
    async getWorkspace(workspaceId) {
        try {
            const data = await this.makeRequest(`/workspaces/${workspaceId}`);
            return data.workspace || {};
        } catch (error) {
            console.error('Error fetching workspace details:', error);
            throw error;
        }
    }

    // Get all collections
    async getCollections() {
        try {
            const data = await this.makeRequest('/collections');
            return data.collections || [];
        } catch (error) {
            console.error('Error fetching collections:', error);
            throw error;
        }
    }

    // Get specific collection details
    async getCollection(collectionId) {
        try {
            const data = await this.makeRequest(`/collections/${collectionId}`);
            return data.collection || {};
        } catch (error) {
            console.error('Error fetching collection details:', error);
            throw error;
        }
    }

    // Get all environments
    async getEnvironments() {
        try {
            const data = await this.makeRequest('/environments');
            return data.environments || [];
        } catch (error) {
            console.error('Error fetching environments:', error);
            throw error;
        }
    }

    // Get specific environment details
    async getEnvironment(environmentId) {
        try {
            const data = await this.makeRequest(`/environments/${environmentId}`);
            return data.environment || {};
        } catch (error) {
            console.error('Error fetching environment details:', error);
            throw error;
        }
    }

    // Get user information
    async getUser() {
        try {
            const data = await this.makeRequest('/me');
            return data.user || {};
        } catch (error) {
            console.error('Error fetching user info:', error);
            throw error;
        }
    }

    // Comprehensive data fetcher for knowledge graph
    async getAllData() {
        try {
            console.log('🔄 Fetching comprehensive Postman data...');
            
            // Fetch all main entities
            const [workspaces, collections, environments, user] = await Promise.all([
                this.getWorkspaces(),
                this.getCollections(),
                this.getEnvironments(),
                this.getUser()
            ]);

            console.log('📊 Data fetched:', {
                workspaces: workspaces.length,
                collections: collections.length,
                environments: environments.length,
                user: user.username || 'Unknown'
            });

            // Fetch detailed collection data
            const detailedCollections = [];
            for (const collection of collections.slice(0, 5)) { // Limit to 5 for performance
                try {
                    const detailedCollection = await this.getCollection(collection.id);
                    detailedCollections.push(detailedCollection);
                } catch (error) {
                    console.warn(`Skipping collection ${collection.id}:`, error.message);
                }
            }

            return {
                user,
                workspaces,
                collections,
                detailedCollections,
                environments,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error fetching all data:', error);
            throw error;
        }
    }

    // Extract requests from collection items recursively
    extractRequests(items, parentName = '') {
        const requests = [];
        
        if (!items || !Array.isArray(items)) {
            return requests;
        }

        items.forEach(item => {
            if (item.request) {
                // This is a request
                requests.push({
                    id: item.id || `req_${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name,
                    method: item.request?.method || 'GET',
                    url: typeof item.request?.url === 'string' ? 
                         item.request.url : 
                         item.request?.url?.raw || 'No URL',
                    parentFolder: parentName
                });
            } else if (item.item) {
                // This is a folder with sub-items
                const folderRequests = this.extractRequests(item.item, item.name);
                requests.push(...folderRequests);
            }
        });

        return requests;
    }

    // Generate JSON-LD (Linked Data) format
    generateJsonLD(data) {
        const jsonLD = {
            "@context": {
                "@vocab": "http://schema.org/",
                "postman": "http://postman.com/schema/",
                "workspace": "postman:workspace",
                "collection": "postman:collection",
                "request": "postman:request",
                "environment": "postman:environment"
            },
            "@type": "Dataset",
            "name": "Postman Workspace Knowledge Graph",
            "description": "Linked data representation of Postman workspaces, collections, and requests",
            "dateCreated": data.timestamp,
            "creator": {
                "@type": "Person",
                "name": data.user?.username || "Unknown User"
            },
            "hasPart": []
        };

        // Add workspaces
        data.workspaces.forEach(workspace => {
            jsonLD.hasPart.push({
                "@type": "workspace",
                "@id": `postman:workspace:${workspace.id}`,
                "name": workspace.name,
                "description": workspace.description || "",
                "type": workspace.type
            });
        });

        // Add collections with their requests
        data.detailedCollections.forEach(collection => {
            const requests = this.extractRequests(collection.item);
            
            const collectionLD = {
                "@type": "collection",
                "@id": `postman:collection:${collection.info?.id}`,
                "name": collection.info?.name,
                "description": collection.info?.description || "",
                "hasPart": []
            };

            // Add requests to collection
            requests.forEach(request => {
                collectionLD.hasPart.push({
                    "@type": "request",
                    "@id": `postman:request:${request.id}`,
                    "name": request.name,
                    "method": request.method,
                    "url": request.url,
                    "parentFolder": request.parentFolder
                });
            });

            jsonLD.hasPart.push(collectionLD);
        });

        // Add environments
        data.environments.forEach(environment => {
            jsonLD.hasPart.push({
                "@type": "environment",
                "@id": `postman:environment:${environment.id}`,
                "name": environment.name
            });
        });

        return jsonLD;
    }
}

// Create global instance
const postmanAPI = new PostmanAPI();
