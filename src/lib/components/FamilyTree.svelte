<script>
    // @ts-nocheck
    import { onMount, onDestroy } from "svelte";
    import { OrgChart } from "d3-org-chart";

    /**
     * @typedef {Object} FamilyNode
     * @property {string} id
     * @property {string} [parentId]
     * @property {string} name
     * @property {"L" | "P"} sex
     * @property {string} [spouseId]
     * @property {string} [spouseName]
     * @property {string} [notes]
     */

    /** @type {{
     *   nodes: FamilyNode[],
     *   onNodeClick: (node: FamilyNode) => void,
     *   onAddChild: (node: FamilyNode) => void,
     *   onAddSpouse: (node: FamilyNode) => void,
     *   onDeleteNode: (node: FamilyNode) => void
     * }} */
    let { nodes, onNodeClick, onAddChild, onAddSpouse, onDeleteNode } =
        $props();

    /** @type {OrgChart<FamilyNode> | null} */
    let chart = $state(null);
    let containerRef = $state(null);
    let nodesView = $state("default"); // 'expand' | 'collapse' | 'default'

    // Subscribe to nodes changes and update chart
    $effect(() => {
        if (chart && nodes.length > 0) {
            updateChart();
        }
    });

    /**
     * Generate node content with spouse support
     * @param {FamilyNode[]} allNodes
     * @param {FamilyNode} node
     * @returns {string}
     */
    function generateNodeContent(allNodes, node) {
        const spouse = node.spouseId
            ? allNodes.find((n) => n.id === node.spouseId)
            : null;

        if (spouse) {
            // Dual node with spouse - horizontal layout
            return `
                <div style="
                    display: flex;
                    align-items: center;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    overflow: hidden;
                    min-width: 200px;
                ">
                    <!-- Main Person -->
                    <div style="
                        padding: 12px 16px;
                        background: ${node.sex === "L" ? "#e3f2fd" : "#fce4ec"};
                        border-right: 2px solid #ddd;
                        flex: 1;
                        text-align: center;
                    ">
                        <div style="
                            font-weight: 600;
                            font-size: 14px;
                            color: #333;
                            margin-bottom: 4px;
                        ">${node.name}</div>
                        <div style="
                            font-size: 11px;
                            color: #666;
                        ">${node.sex === "L" ? "Laki-laki" : "Perempuan"}</div>
                    </div>
                    
                    <!-- Spouse -->
                    <div style="
                        padding: 12px 16px;
                        background: ${spouse.sex === "L" ? "#e3f2fd" : "#fce4ec"};
                        flex: 1;
                        text-align: center;
                    ">
                        <div style="
                            font-weight: 600;
                            font-size: 14px;
                            color: #333;
                            margin-bottom: 4px;
                        ">${spouse.name}</div>
                        <div style="
                            font-size: 11px;
                            color: #666;
                        ">${spouse.sex === "L" ? "Laki-laki" : "Perempuan"}</div>
                    </div>
                </div>
            `;
        }

        // Single node
        return `
            <div style="
                padding: 12px 16px;
                background: ${node.sex === "L" ? "#e3f2fd" : "#fce4ec"};
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                text-align: center;
                min-width: 120px;
            ">
                <div style="
                    font-weight: 600;
                    font-size: 14px;
                    color: #333;
                    margin-bottom: 4px;
                ">${node.name}</div>
                <div style="
                    font-size: 11px;
                    color: #666;
                ">${node.sex === "L" ? "Laki-laki" : "Perempuan"}</div>
            </div>
        `;
    }

    function updateChart() {
        if (!chart || !containerRef) return;

        const initialZoom = nodes.length > 10 ? 0.6 : 0.8;

        chart
            .container(containerRef)
            .data(nodes)
            .nodeWidth((d3Node) => {
                // Wider nodes for spouse pairs
                return d3Node.data.spouseId ? 220 : 140;
            })
            .nodeHeight(() => 80)
            .initialZoom(initialZoom)
            .onNodeClick((d3Node) => {
                if (onNodeClick && d3Node.data) {
                    onNodeClick(d3Node.data);
                }
            })
            .nodeContent((d3Node) => {
                return generateNodeContent(nodes, d3Node.data);
            })
            .render();
    }

    onMount(() => {
        if (containerRef) {
            chart = new OrgChart();
            if (nodes.length > 0) {
                updateChart();
            }
        }
    });

    onDestroy(() => {
        if (chart) {
            chart = null;
        }
    });

    // Export functions for parent component
    export function toggleNodesView() {
        nodesView =
            nodesView === "expand" || nodesView === "default"
                ? "collapse"
                : "expand";
        if (chart) {
            if (nodesView === "expand") {
                chart.expandAll();
            } else {
                chart.collapseAll();
            }
        }
    }

    export function fitView() {
        if (chart) {
            chart.fit();
        }
    }

    export function exportImage() {
        if (chart) {
            chart.exportImg({ backgroundColor: "#f5f5f5" });
        }
    }

    export function expandAll() {
        nodesView = "expand";
        if (chart) {
            chart.expandAll();
        }
    }

    export function collapseAll() {
        nodesView = "collapse";
        if (chart) {
            chart.collapseAll();
        }
    }
</script>

<div class="h-full w-full relative">
    {#if nodes.length === 0}
        <div class="w-full h-full flex justify-center items-center">
            <div class="text-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mx-auto text-gray-300 mb-4"
                >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <p class="text-lg text-gray-600 mb-2">Belum ada data</p>
                <p class="text-sm text-gray-500">
                    Klik tombol <strong>+ Tambah Anggota</strong> untuk mulai
                </p>
            </div>
        </div>
    {:else}
        <div bind:this={containerRef} class="h-full w-full"></div>
    {/if}
</div>

<style>
    :global(.org-chart-node) {
        cursor: pointer;
    }

    :global(.org-chart-node:hover) {
        filter: brightness(1.05);
    }
</style>
