// Knowledge Graph Visualization Module using D3.js
class KnowledgeGraph {
    constructor(containerId) {
        this.container = d3.select(`#${containerId}`);
        this.width = 0;
        this.height = 0;
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        
        this.colors = {
            workspace: '#667eea',
            collection: '#28a745',
            request: '#ffc107',
            environment: '#dc3545',
            user: '#6f42c1'
        };
        
        this.nodeRadius = {
            workspace: 25,
            collection: 20,
            request: 15,
            environment: 18,
            user: 30
        };
        
        this.init();
    }

    init() {
        // Clear container and set up SVG
        this.container.selectAll('*').remove();
        
        // Get container dimensions
        const containerNode = this.container.node();
        this.width = containerNode.clientWidth || 800;
        this.height = containerNode.clientHeight || 500;
        
        // Create SVG with zoom capability
        this.svg = this.container
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
            
        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3])
            .on('zoom', (event) => {
                this.svg.select('.graph-group')
                    .attr('transform', event.transform);
            });
            
        this.svg.call(zoom);
        
        // Create main group for graph elements
        this.graphGroup = this.svg.append('g').attr('class', 'graph-group');
        
        // Add background for zoom/pan
        this.svg.insert('rect', ':first-child')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('fill', 'transparent')
            .style('cursor', 'move');
    }

    // Convert API data to graph format
    processData(data) {
        this.nodes = [];
        this.links = [];
        
        console.log('🔄 Processing data for graph visualization...');
        
        // Add user node as central node
        if (data.user && data.user.username) {
            this.nodes.push({
                id: `user_${data.user.id || 'main'}`,
                name: data.user.username,
                type: 'user',
                fullName: data.user.fullName || data.user.username,
                email: data.user.email || ''
            });
        }
        
        // Add workspace nodes
        data.workspaces.forEach(workspace => {
            this.nodes.push({
                id: `workspace_${workspace.id}`,
                name: workspace.name,
                type: 'workspace',
                description: workspace.description || '',
                workspaceType: workspace.type
            });
            
            // Link workspace to user
            if (data.user && data.user.username) {
                this.links.push({
                    source: `user_${data.user.id || 'main'}`,
                    target: `workspace_${workspace.id}`,
                    type: 'owns'
                });
            }
        });
        
        // Add collection nodes
        data.collections.forEach(collection => {
            this.nodes.push({
                id: `collection_${collection.id}`,
                name: collection.name,
                type: 'collection',
                description: collection.description || '',
                requestCount: 0 // Will be updated later
            });
        });
        
        // Add detailed collection data with requests
        data.detailedCollections.forEach(collection => {
            const collectionId = `collection_${collection.info?.id}`;
            
            // Update collection node with more details
            const collectionNode = this.nodes.find(n => n.id === collectionId);
            if (collectionNode) {
                const requests = postmanAPI.extractRequests(collection.item);
                collectionNode.requestCount = requests.length;
                collectionNode.folders = this.extractFolders(collection.item);
            }
            
            // Extract and add request nodes
            const requests = postmanAPI.extractRequests(collection.item);
            requests.forEach(request => {
                this.nodes.push({
                    id: `request_${request.id}`,
                    name: request.name,
                    type: 'request',
                    method: request.method,
                    url: request.url,
                    parentFolder: request.parentFolder
                });
                
                // Link request to collection
                this.links.push({
                    source: collectionId,
                    target: `request_${request.id}`,
                    type: 'contains'
                });
            });
        });
        
        // Add environment nodes
        data.environments.forEach(environment => {
            this.nodes.push({
                id: `environment_${environment.id}`,
                name: environment.name,
                type: 'environment'
            });
            
            // Link environments to user
            if (data.user && data.user.username) {
                this.links.push({
                    source: `user_${data.user.id || 'main'}`,
                    target: `environment_${environment.id}`,
                    type: 'manages'
                });
            }
        });
        
        console.log('📊 Graph data processed:', {
            nodes: this.nodes.length,
            links: this.links.length
        });
    }

    // Extract folder structure from collection items
    extractFolders(items) {
        const folders = [];
        if (!items || !Array.isArray(items)) return folders;
        
        items.forEach(item => {
            if (item.item && !item.request) { // This is a folder
                folders.push(item.name);
                folders.push(...this.extractFolders(item.item));
            }
        });
        
        return [...new Set(folders)]; // Remove duplicates
    }

    // Create the graph visualization
    render() {
        if (this.nodes.length === 0) {
            this.showMessage('No data to visualize');
            return;
        }
        
        console.log('🎨 Rendering knowledge graph...');
        
        // Create force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(d => this.nodeRadius[d.type] + 5));

        // Create links
        const link = this.graphGroup.selectAll('.link')
            .data(this.links)
            .enter().append('line')
            .attr('class', 'link')
            .style('stroke', '#999')
            .style('stroke-opacity', 0.6)
            .style('stroke-width', 2);

        // Create nodes
        const node = this.graphGroup.selectAll('.node')
            .data(this.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));

        // Add circles to nodes
        node.append('circle')
            .attr('r', d => this.nodeRadius[d.type])
            .style('fill', d => this.colors[d.type])
            .style('stroke', d => d3.rgb(this.colors[d.type]).darker())
            .style('stroke-width', 2);

        // Add labels to nodes
        node.append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('fill', '#333')
            .style('pointer-events', 'none')
            .text(d => this.truncateText(d.name, d.type));

        // Add hover effects
        node.on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => this.nodeClicked(event, d));

        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });

        this.addLegend();
    }

    // Truncate text based on node type
    truncateText(text, type) {
        const maxLength = {
            user: 12,
            workspace: 10,
            collection: 8,
            request: 6,
            environment: 8
        };
        
        if (text.length <= maxLength[type]) return text;
        return text.substring(0, maxLength[type]) + '...';
    }

    // Show tooltip on hover
    showTooltip(event, d) {
        const tooltip = d3.select('body').selectAll('.graph-tooltip').data([0]);
        
        const tooltipEnter = tooltip.enter().append('div')
            .attr('class', 'graph-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');
        
        const tooltipMerge = tooltipEnter.merge(tooltip);
        
        let content = `<strong>${d.name}</strong><br>Type: ${d.type}`;
        
        if (d.type === 'request') {
            content += `<br>Method: ${d.method}<br>URL: ${d.url}`;
        } else if (d.type === 'collection') {
            content += `<br>Requests: ${d.requestCount || 0}`;
        } else if (d.type === 'user') {
            content += `<br>Email: ${d.email || 'N/A'}`;
        }
        
        tooltipMerge
            .html(content)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 1);
    }

    // Hide tooltip
    hideTooltip() {
        d3.select('body').selectAll('.graph-tooltip')
            .style('opacity', 0)
            .remove();
    }

    // Handle node click
    nodeClicked(event, d) {
        console.log('Node clicked:', d);
        // You can add more interactivity here
    }

    // Add legend
    addLegend() {
        const legend = this.svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(20, 20)');

        const legendData = [
            { type: 'user', label: 'User' },
            { type: 'workspace', label: 'Workspace' },
            { type: 'collection', label: 'Collection' },
            { type: 'request', label: 'Request' },
            { type: 'environment', label: 'Environment' }
        ];

        const legendItem = legend.selectAll('.legend-item')
            .data(legendData)
            .enter().append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 25})`);

        legendItem.append('circle')
            .attr('r', 8)
            .style('fill', d => this.colors[d.type]);

        legendItem.append('text')
            .attr('x', 15)
            .attr('y', 4)
            .style('font-size', '12px')
            .style('fill', '#333')
            .text(d => d.label);
    }

    // Drag functions
    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Show message when no data
    showMessage(message) {
        this.container.selectAll('*').remove();
        this.container.append('div')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('height', '100%')
            .style('color', '#6c757d')
            .style('font-size', '18px')
            .text(message);
    }

    // Resize handler
    resize() {
        const containerNode = this.container.node();
        const newWidth = containerNode.clientWidth || 800;
        const newHeight = containerNode.clientHeight || 500;
        
        if (newWidth !== this.width || newHeight !== this.height) {
            this.width = newWidth;
            this.height = newHeight;
            
            if (this.svg) {
                this.svg.attr('width', this.width).attr('height', this.height);
                if (this.simulation) {
                    this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
                    this.simulation.alpha(0.3).restart();
                }
            }
        }
    }
}

// Create global instance
let knowledgeGraph = null;

// Initialize graph when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    knowledgeGraph = new KnowledgeGraph('knowledge-graph');
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (knowledgeGraph) {
            knowledgeGraph.resize();
        }
    });
});
