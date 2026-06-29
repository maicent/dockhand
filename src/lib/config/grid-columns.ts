import type { ColumnConfig, GridId } from '$lib/types';
import * as m from '$lib/paraglide/messages';

// Container grid columns
export const containerColumns: ColumnConfig[] = [
	{ id: 'select', label: '', fixed: 'start', width: 32, resizable: false },
	{ id: 'name', get label() { return m.containers_col_name(); }, sortable: true, sortField: 'name', width: 140, minWidth: 80, grow: true },
	{ id: 'image', get label() { return m.containers_col_image(); }, sortable: true, sortField: 'image', width: 180, minWidth: 100, grow: true },
	{ id: 'state', get label() { return m.containers_col_state(); }, sortable: true, sortField: 'state', width: 90, minWidth: 70, noTruncate: true },
	{ id: 'health', get label() { return m.containers_col_health(); }, sortable: true, sortField: 'health', width: 55, minWidth: 40 },
	{ id: 'uptime', get label() { return m.containers_col_uptime(); }, sortable: true, sortField: 'uptime', width: 80, minWidth: 60 },
	{ id: 'restartCount', get label() { return m.containers_col_restarts(); }, width: 70, minWidth: 50 },
	{ id: 'cpu', get label() { return m.containers_col_cpu(); }, sortable: true, sortField: 'cpu', width: 50, minWidth: 40, align: 'right' },
	{ id: 'memory', get label() { return m.containers_col_memory(); }, sortable: true, sortField: 'memory', width: 95, minWidth: 70, align: 'right' },
	{ id: 'networkIO', get label() { return m.containers_col_network_io(); }, width: 85, minWidth: 70, align: 'right' },
	{ id: 'diskIO', get label() { return m.containers_col_disk_io(); }, width: 85, minWidth: 70, align: 'right' },
	{ id: 'ip', get label() { return m.containers_col_ip(); }, sortable: true, sortField: 'ip', width: 100, minWidth: 80 },
	{ id: 'ports', get label() { return m.containers_col_ports(); }, sortable: true, sortField: 'ports', width: 120, minWidth: 60 },
	{ id: 'autoUpdate', get label() { return m.containers_col_auto_update(); }, width: 95, minWidth: 70 },
	{ id: 'stack', get label() { return m.containers_col_stack(); }, sortable: true, sortField: 'stack', width: 100, minWidth: 60 },
	{ id: 'actions', label: '', fixed: 'end', width: 200, minWidth: 150, resizable: true }
];

// Image grid columns
export const imageColumns: ColumnConfig[] = [
	{ id: 'select', label: '', fixed: 'start', width: 32, resizable: false },
	{ id: 'expand', label: '', fixed: 'start', width: 24, resizable: false },
	{ id: 'image', label: 'Image', sortable: true, sortField: 'name', width: 220, minWidth: 120, grow: true },
	{ id: 'tags', label: 'Tags', sortable: true, sortField: 'tags', width: 80, minWidth: 50 },
	{ id: 'size', label: 'Size', sortable: true, sortField: 'size', width: 80, minWidth: 60 },
	{ id: 'updated', label: 'Updated', sortable: true, sortField: 'created', width: 140, minWidth: 100 },
	{ id: 'actions', label: '', fixed: 'end', width: 120, resizable: false }
];

// Image tags grid columns (nested inside expanded image row)
export const imageTagColumns: ColumnConfig[] = [
	{ id: 'tag', label: 'Tag', width: 180, minWidth: 60 },
	{ id: 'id', label: 'ID', width: 120, minWidth: 80 },
	{ id: 'size', label: 'Size', width: 80, minWidth: 60 },
	{ id: 'created', label: 'Created', width: 140, minWidth: 100 },
	{ id: 'used', label: 'Used by', width: 100, minWidth: 70 },
	{ id: 'actions', label: '', fixed: 'end', width: 200, resizable: false }
];

// Network grid columns
export const networkColumns: ColumnConfig[] = [
	{ id: 'select', label: '', fixed: 'start', width: 32, resizable: false },
	{ id: 'name', label: 'Name', sortable: true, sortField: 'name', width: 260, minWidth: 120, grow: true },
	{ id: 'driver', label: 'Driver', sortable: true, sortField: 'driver', width: 100, resizable: false },
	{ id: 'scope', label: 'Scope', width: 80, minWidth: 50 },
	{ id: 'subnet', label: 'Subnet', sortable: true, sortField: 'subnet', width: 160, minWidth: 100 },
	{ id: 'gateway', label: 'Gateway', sortable: true, sortField: 'gateway', width: 140, minWidth: 100 },
	{ id: 'containers', label: 'Containers', sortable: true, sortField: 'containers', width: 100, minWidth: 70 },
	{ id: 'actions', label: '', fixed: 'end', width: 160, resizable: false }
];

// Stack grid columns
export const stackColumns: ColumnConfig[] = [
	{ id: 'select', label: '', fixed: 'start', width: 32, resizable: false },
	{ id: 'expand', label: '', fixed: 'start', width: 24, resizable: false },
	{ id: 'name', label: 'Name', sortable: true, sortField: 'name', width: 180, minWidth: 100, grow: true },
	{ id: 'status', label: 'Status', sortable: true, sortField: 'status', width: 120, minWidth: 90 },
	{ id: 'source', label: 'Source', width: 100, minWidth: 100, noTruncate: true },
	{ id: 'location', label: 'Location', width: 180, minWidth: 100 },
	{ id: 'containers', label: 'Containers', sortable: true, sortField: 'containers', width: 100, minWidth: 70 },
	{ id: 'cpu', label: 'CPU', sortable: true, sortField: 'cpu', width: 60, minWidth: 50, align: 'right' },
	{ id: 'memory', label: 'Memory', sortable: true, sortField: 'memory', width: 70, minWidth: 50, align: 'right' },
	{ id: 'networkIO', label: 'Net I/O', width: 100, minWidth: 70, align: 'right' },
	{ id: 'diskIO', label: 'Disk I/O', width: 100, minWidth: 70, align: 'right' },
	{ id: 'networks', label: 'Networks', width: 80, minWidth: 60 },
	{ id: 'volumes', label: 'Volumes', width: 80, minWidth: 60 },
	{ id: 'actions', label: '', fixed: 'end', width: 180, resizable: false }
];

// Volume grid columns
export const volumeColumns: ColumnConfig[] = [
	{ id: 'select', label: '', fixed: 'start', width: 32, resizable: false },
	{ id: 'name', label: 'Name', sortable: true, sortField: 'name', width: 400, minWidth: 150, grow: true },
	{ id: 'driver', label: 'Driver', sortable: true, sortField: 'driver', width: 80, minWidth: 60 },
	{ id: 'type', label: 'Type', sortable: true, sortField: 'type', width: 80, minWidth: 60 },
	{ id: 'scope', label: 'Scope', width: 70, minWidth: 50 },
	{ id: 'stack', label: 'Stack', sortable: true, sortField: 'stack', width: 120, minWidth: 80 },
	{ id: 'usedBy', label: 'Used by', width: 150, minWidth: 80 },
	{ id: 'created', label: 'Created', sortable: true, sortField: 'created', width: 160, minWidth: 120 },
	{ id: 'actions', label: '', fixed: 'end', width: 160, resizable: false }
];

// Activity grid columns (no selection, no column reordering - simpler grid)
export const activityColumns: ColumnConfig[] = [
	{ id: 'timestamp', label: 'Timestamp', width: 160, minWidth: 140 },
	{ id: 'environment', label: 'Environment', width: 180, minWidth: 100 },
	{ id: 'action', label: 'Action', width: 60, resizable: false },
	{ id: 'container', label: 'Container', width: 240, minWidth: 120, grow: true },
	{ id: 'image', label: 'Image', width: 260, minWidth: 120 },
	{ id: 'exitCode', label: 'Exit', width: 50, minWidth: 40 },
	{ id: 'actions', label: '', fixed: 'end', width: 50, resizable: false }
];

// Audit log grid columns
export const auditColumns: ColumnConfig[] = [
	{ id: 'timestamp', label: 'Timestamp', width: 165, minWidth: 140 },
	{ id: 'environment', label: 'Environment', width: 140, minWidth: 100 },
	{ id: 'user', label: 'User', width: 120, minWidth: 80 },
	{ id: 'action', label: 'Action', width: 55, resizable: false },
	{ id: 'entity', label: 'Entity', width: 100, minWidth: 80 },
	{ id: 'name', label: 'Name', width: 200, minWidth: 100, grow: true },
	{ id: 'ip', label: 'IP address', width: 120, minWidth: 90 },
	{ id: 'actions', label: '', fixed: 'end', width: 50, resizable: false }
];

// Schedule grid columns
export const scheduleColumns: ColumnConfig[] = [
	{ id: 'expand', label: '', fixed: 'start', width: 24, resizable: false },
	{ id: 'schedule', label: 'Schedule', width: 450, minWidth: 300, grow: true },
	{ id: 'environment', label: 'Environment', width: 140, minWidth: 100 },
	{ id: 'cron', label: 'Schedule', width: 180, minWidth: 120 },
	{ id: 'lastRun', label: 'Last run', width: 160, minWidth: 120 },
	{ id: 'nextRun', label: 'Next run', width: 160, minWidth: 100 },
	{ id: 'status', label: 'Status', width: 70, resizable: false },
	{ id: 'actions', label: '', fixed: 'end', width: 100, resizable: false }
];

// Environment grid columns (dashboard list view)
// Labels use getters so the message is resolved at render time (per-request locale, SSR-safe).
export const environmentColumns: ColumnConfig[] = [
	{ id: 'status', label: '', width: 36, resizable: false },
	{ id: 'name', get label() { return m.dashboard_col_environment(); }, sortable: true, sortField: 'name', width: 180, minWidth: 100, grow: true },
	{ id: 'connection', get label() { return m.settings_env_col_connection(); }, sortable: true, sortField: 'connection', width: 110, minWidth: 80 },
	{ id: 'host', get label() { return m.settings_env_modal_host(); }, sortable: true, sortField: 'host', width: 150, minWidth: 80 },
	{ id: 'containers', get label() { return m.sidebar_containers(); }, sortable: true, sortField: 'containers', width: 100, minWidth: 70 },
	{ id: 'updates', get label() { return m.settings_env_modal_tab_updates(); }, sortable: true, sortField: 'updates', width: 75, minWidth: 55 },
	{ id: 'cpu', label: 'CPU', sortable: true, sortField: 'cpu', width: 110, minWidth: 80 },
	{ id: 'memory', get label() { return m.dashboard_memory(); }, sortable: true, sortField: 'memory', width: 110, minWidth: 80 },
	{ id: 'images', get label() { return m.sidebar_images(); }, sortable: true, sortField: 'images', width: 65, minWidth: 50 },
	{ id: 'volumes', get label() { return m.sidebar_volumes(); }, sortable: true, sortField: 'volumes', width: 70, minWidth: 50 },
	{ id: 'stacks', get label() { return m.sidebar_stacks(); }, sortable: true, sortField: 'stacks', width: 85, minWidth: 65 },
	{ id: 'events', get label() { return m.dashboard_events(); }, sortable: true, sortField: 'events', width: 65, minWidth: 50 },
	{ id: 'labels', get label() { return m.settings_env_col_labels(); }, width: 150, minWidth: 80 }
];

// Map of grid ID to column definitions
export const gridColumnConfigs: Record<GridId, ColumnConfig[]> = {
	containers: containerColumns,
	images: imageColumns,
	imageTags: imageTagColumns,
	networks: networkColumns,
	stacks: stackColumns,
	volumes: volumeColumns,
	activity: activityColumns,
	schedules: scheduleColumns,
	audit: auditColumns,
	environments: environmentColumns
};

// Get configurable columns (not fixed)
export function getConfigurableColumns(gridId: GridId): ColumnConfig[] {
	return gridColumnConfigs[gridId].filter((col) => !col.fixed);
}

// Get fixed columns at start
export function getFixedStartColumns(gridId: GridId): ColumnConfig[] {
	return gridColumnConfigs[gridId].filter((col) => col.fixed === 'start');
}

// Get fixed columns at end
export function getFixedEndColumns(gridId: GridId): ColumnConfig[] {
	return gridColumnConfigs[gridId].filter((col) => col.fixed === 'end');
}

// Get default column visibility preferences for a grid
export function getDefaultColumnPreferences(gridId: GridId): { id: string; visible: boolean }[] {
	return getConfigurableColumns(gridId).map((col) => ({
		id: col.id,
		visible: true
	}));
}

// Get all column configs (fixed + configurable in order)
export function getAllColumnConfigs(gridId: GridId): ColumnConfig[] {
	return gridColumnConfigs[gridId];
}
