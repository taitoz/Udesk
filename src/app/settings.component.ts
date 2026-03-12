import {ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ConfirmationService, MessageService, TreeNode} from 'primeng/api';
import {UiService} from './ui.service';
import {DOCUMENT} from '@angular/common';
import {SelectButtonChangeEvent} from "primeng/selectbutton";
import {updatePrimaryPalette, updateSurfacePalette} from '@primeuix/themes';
import {primaryColors, surfaceColors, getPrimaryDisplayColor, getSurfaceDisplayColor, PrimaryColor, SurfaceColor} from './theme-palettes';
import {DialogService} from 'primeng/dynamicdialog';
import {IconPickerComponent} from './icon-picker.component';

export enum PageActionType {
    waitElement = 'waitElement',
    typeToInput = 'typeToInput',
    clickElement = 'clickElement',
    selectElement = 'selectElement',
    delay = 'delay'
}

interface TreeNodeForm {
    id: any
    key: string
    value: string
}

@Component({
    selector: 'settings',
    standalone: false,
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss',
    encapsulation: ViewEncapsulation.Emulated,
    providers: [MessageService, ConfirmationService]
})

export class SettingsComponent implements OnInit, OnDestroy {

    activeTabIndex = '0'
    sideMenuTreeNodes: TreeNode[] = []
    selectedNode: TreeNode | null = null
    pendingDraftNode: TreeNode | null = null
    pendingInsertParentId: any | null = null
    pendingInsertIndex: number | null = null
    editingProfile: any
    treeForm: TreeNodeForm = this.createEmptyTreeForm()
    isTreeFormDirty = false
    urlError: string | null = null
    nameError: string | null = null

    theme = 'dark'
    themeOptions: any[] = [{label: 'Dark', value: 'dark'}, {label: 'Light', value: 'light'}]

    primaryColors = primaryColors
    surfaceColors = surfaceColors
    selectedPrimaryColor = 'emerald'
    selectedSurfaceColor = 'zinc'
    getPrimaryDisplayColor = getPrimaryDisplayColor
    getSurfaceDisplayColor = getSurfaceDisplayColor

    profiles: {
        _id: string;
        active: boolean;
        name: string;
        logo: string,
        homeUrl: string,
        lang: string,
        sideMenuTreeNodes: TreeNode[]
    }[]
    activeProfile: any
    showTable = true

    pageActions: {
        _id: string;
        serviceId: any;
        domain: string;
        actions: any[]
    }[]

    // Inline page action editing
    currentPageActions: any[] = []
    currentPageActionDomain: string = ''
    pageActionOptions: string[] = Object.values(PageActionType)
    editingPageAction: any = null
    selectorFocused = false
    urlSuggestions: string[] = ['http://', 'https://', 'file:///', 'http://localhost', 'http://127.0.0.1']
    filteredUrlSuggestions: string[] = []

    constructor(
        private uiService: UiService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private dialogService: DialogService,
        @Inject(DOCUMENT) private document: Document,
        private cdr: ChangeDetectorRef
    ) {
    }

    async ngOnInit() {
        // Get current theme for the toggle button state
        const currentTheme = this.uiService.ipcSendSync('settings:getTheme')
        this.theme = currentTheme || 'dark'

        // Load saved primary/surface color
        this.selectedPrimaryColor = this.uiService.ipcSendSync('settings:getPrimaryColor') || 'emerald'
        this.selectedSurfaceColor = this.uiService.ipcSendSync('settings:getSurfaceColor') || 'zinc'

        await this.loadProfiles()
        await this.loadPageActions()
    }

    ngOnDestroy(): void {
    }

    hasUnsavedChanges(): boolean {
        return !!this.editingProfile || this.isTreeFormDirty
    }

    async loadPageActions() {
        this.pageActions = await this.uiService.ipcInvoke('pageActions:get')
        this.refreshTable()
    }

    async loadProfiles() {
        this.profiles = await this.uiService.ipcInvoke('profiles:get')
        this.profiles.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateA - dateB
        })
        this.profiles.forEach(profile => {
            // Migrate old PNG logo to Boxicon class
            if (!profile.logo || !profile.logo.startsWith('bx ')) {
                profile.logo = 'bx bx-desktop'
            }
            if (profile.active) {
                this.activeProfile = profile
                this.sideMenuTreeNodes = profile.sideMenuTreeNodes || []
                this.applyTreeMetadata(this.sideMenuTreeNodes)
            }
        })
        if (!this.activeProfile) {
            this.sideMenuTreeNodes = []
        }
        this.refreshTable()
        if (this.selectedNode) {
            const restored = this.findNodeById(this.selectedNode.data?.id, this.sideMenuTreeNodes)
            this.selectedNode = restored || null
            this.syncFormWithSelection()
        }
    }

    startProfileKeyEdit(profile: any) {
        profile.sideMenuTreeNodes?.forEach((node: TreeNode<any>) => this.stripTreeParents(node));
        //delete profile['_id']
        this.editingProfile = profile;
    }

    saveProfileKeyEdit() {
        this.uiService.ipcInvoke('profile:update', this.editingProfile).then(() => {
            this.loadProfiles()
            this.uiService.profilesListChange.emit()
        })
        this.editingProfile = null;
    }

    openIconPicker() {
        const ref = this.dialogService.open(IconPickerComponent, {
            header: 'Choose Icon',
            width: '500px',
            modal: true,
            closable: true,
            dismissableMask: true
        });
        ref.onClose.subscribe((iconClass: string) => {
            if (iconClass && this.editingProfile) {
                this.editingProfile.logo = iconClass;
                this.cdr.detectChanges();
            }
        });
    }

    cancelProfileKeyEdit() {
        this.loadProfiles()
        this.editingProfile = null;
    }

    exportProfile(profileId: string) {
        this.uiService.ipcInvoke('profile:export', profileId).then(result => {
            this.messageService.add(result)
        })
    }

    importProfile() {
        this.uiService.ipcInvoke('profile:import').then(result => {
            this.loadProfiles()
            this.uiService.profilesListChange.emit()
            this.messageService.add(result)
        })
    }

    refreshTable() {
        //angular change outside context fix
        this.showTable = false
        this.cdr.detectChanges()
        this.showTable = true
        this.cdr.detectChanges()
    }

    async addProfile() {
        await this.uiService.ipcInvoke('profiles:add').then(() => {
            this.loadProfiles()
            this.uiService.profilesListChange.emit()
        })
    }

    deleteProfile(profileId: string) {
        if (this.profiles.length === 1) {
            this.messageService.add({severity: 'info', summary: 'last profile cannot be deleted.'})
            return
        }
        this.confirmationService.confirm({
            header: 'Confirmation',
            message: 'Delete?',
            acceptLabel: 'Yes',
            rejectLabel: 'No',
            icon: 'bx bx-exclamation-triangle',
            accept: async () => {
                // let index = this.profilesFlat.findIndex(item => item.name === profileName)
                // console.log(index)
                await this.uiService.ipcInvoke('profiles:delete', profileId).then(() => {
                    this.loadProfiles()
                    this.setActiveProfile(this.profiles[0]._id)
                    this.uiService.profilesListChange.emit()
                })
                //this.messageService.add({severity: 'success', summary: 'Deleted'});
            },
            reject: () => {
            }
        });
    }

    setActiveProfile(profileId: string) {
        this.uiService.ipcInvoke('profiles:setActive', profileId).then(() => {
            this.loadProfiles()
            //this.refreshTable()
            //this.messageService.add({severity: 'success', summary: 'Profile selected', detail: profileId.toString()})
        })
    }


    onSelect(event: any) {
        if (event.node != null) {
            this.clearPendingDraft()
            this.selectedNode = event.node
            this.syncFormWithSelection()
        }
    }

    onNodeUnselect() {
        this.selectedNode = null
        this.clearPendingDraft()
        this.treeForm = this.createEmptyTreeForm()
        this.isTreeFormDirty = false
        this.currentPageActions = []
        this.currentPageActionDomain = ''
        this.editingPageAction = null
    }

    async servicesMenuDataSave(preserveSelection = true) {
        const selectedId = preserveSelection ? this.selectedNode?.data?.id : null
        this.sideMenuTreeNodes.forEach(node => this.stripTreeParents(node))
        this.activeProfile.sideMenuTreeNodes = this.sideMenuTreeNodes
        await this.uiService.ipcInvoke('profile:update', this.activeProfile)
        await this.loadProfiles()
        if (selectedId) {
            const restoredNode = this.findNodeById(selectedId, this.sideMenuTreeNodes)
            this.selectedNode = restoredNode || null
        }
        this.syncFormWithSelection()
    }

    stripTreeParents(obj: TreeNode) {
        obj.parent = null
        obj.label = obj.data?.key ?? obj.label
        obj.children?.forEach((item: TreeNode) => {
            try {
                this.stripTreeParents(item)
            } catch {
            }
        })
    }

    deleteNodeByData(data: any, nodes: TreeNode[]) {
        let i: number;
        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].data === data) {
                nodes.splice(i, 1);
                return;
            }
            if (nodes[i].children) {
                this.deleteNodeByData(data, nodes[i].children);
            }
        }
    }

    deleteItem(selectedNode: TreeNode) {
        if (this.sideMenuTreeNodes.length === 1 && selectedNode.parent === null) {
            this.messageService.add({severity: 'error', summary: 'Unable to delete last element'});
            return;
        }
        this.confirmationService.confirm({
            header: 'Confirmation',
            message: 'Delete?',
            acceptLabel: 'Yes',
            rejectLabel: 'No',
            icon: 'bx bx-exclamation-triangle',
            accept: async () => {
                // Delete page actions: only remove from DB if no other service in profile uses the same domain
                const serviceId = selectedNode.data?.id
                const deletedDomain = this.parseDomain(selectedNode.data?.value)
                if (serviceId) {
                    // Check if any other service in the tree uses the same domain
                    const domainUsedElsewhere = deletedDomain && this.isDomainUsedByOtherNode(deletedDomain, serviceId, this.sideMenuTreeNodes)
                    if (domainUsedElsewhere) {
                        // Just unlink — delete the page action record for this serviceId only
                        await this.uiService.ipcInvoke('pageAction:delete', serviceId)
                    } else {
                        // No other service uses this domain — delete from DB
                        await this.uiService.ipcInvoke('pageAction:delete', serviceId)
                    }
                }
                this.deleteNodeByData(selectedNode.data, this.sideMenuTreeNodes);
                this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
                this.onNodeUnselect()
                await this.servicesMenuDataSave(false)
                await this.loadPageActions()
            },
            reject: () => {
            }
        });
    }

    getNodeByData(data: any, nodes: TreeNode[]) {
        for (let node of nodes) {
            if (node.data === data) {
                return node;
            }
            if (node.children) {
                let matchedNode = this.getNodeByData(data, node.children);
                if (matchedNode) {
                    return matchedNode;
                }
            }
        }
    }

    newNode(id: any): TreeNode {
        return {
            data: {id: id, key: '', value: '', pageActions: []},
            label: '',
            children: []
        };
    }

    // addItem(selectedNodeData: any, asChild: boolean) {
    //     const newId = Date.now();
    //     const createdNode = this.newNode(newId);
    //
    //     if (asChild) {
    //         if (!selectedNodeData) {
    //             return;
    //         }
    //         let node = this.getNodeByData(selectedNodeData, this.sideMenuTreeNodes);
    //         node.children = node.children || [];
    //         node.children.push(createdNode);
    //         node.expanded = true;
    //     } else {
    //         if (!selectedNodeData) {
    //             this.sideMenuTreeNodes.push(createdNode);
    //         } else {
    //             let node = this.getNodeByData(selectedNodeData, this.sideMenuTreeNodes);
    //             const siblings = node.parent ? node.parent.children : this.sideMenuTreeNodes;
    //             const nodeIndex = siblings.findIndex(child => child === node);
    //             const insertIndex = nodeIndex >= 0 ? nodeIndex + 1 : siblings.length;
    //             siblings.splice(insertIndex, 0, createdNode);
    //             createdNode.parent = node.parent ?? null;
    //         }
    //     }
    //
    //     this.applyTreeMetadata(this.sideMenuTreeNodes)
    //     this.selectedNode = createdNode
    //     this.syncFormWithSelection()
    //     this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
    //     this.servicesMenuDataSave()
    // }

    startAddService() {
        const referenceNode = this.selectedNode ? this.findNodeById(this.selectedNode.data?.id, this.sideMenuTreeNodes) ?? this.selectedNode : null
        const parent = referenceNode ? (referenceNode.parent ?? null) : null
        const siblings = parent ? parent.children : this.sideMenuTreeNodes
        const nodeIndex = referenceNode ? siblings.findIndex(node => node.data?.id === referenceNode.data?.id) : -1

        this.pendingInsertParentId = parent?.data?.id ?? null
        this.pendingInsertIndex = nodeIndex >= 0 ? nodeIndex + 1 : siblings.length
        this.pendingDraftNode = this.newNode(Date.now())
        this.selectedNode = this.pendingDraftNode
        this.treeForm = this.createEmptyTreeForm()
        this.treeForm.id = this.pendingDraftNode.data.id
        this.isTreeFormDirty = false
        this.currentPageActions = []
        this.currentPageActionDomain = ''
        this.editingPageAction = null
    }

    toggleTheme(event: SelectButtonChangeEvent) {
        this.uiService.toggleTheme(this.document, this.theme)
        this.uiService.ipcSend('settings:toggleTheme', this.theme)
    }

    setPrimaryColor(color: PrimaryColor) {
        this.selectedPrimaryColor = color.name
        updatePrimaryPalette(color.palette as any)
        this.uiService.ipcSend('settings:setPrimaryColor', color.name)
    }

    setSurfaceColor(color: SurfaceColor) {
        this.selectedSurfaceColor = color.name
        updateSurfacePalette(color.palette as any)
        this.uiService.ipcSend('settings:setSurfaceColor', color.name)
    }

    parseDomain(url: string): string {
        if (!url) return ''
        try { return new URL(url).hostname } catch {
            try { return new URL('https://' + url).hostname } catch {
                return ''
            }
        }
    }

    isDomainUsedByOtherNode(domain: string, excludeServiceId: any, nodes: TreeNode[]): boolean {
        for (const node of nodes) {
            if (node.data?.id !== excludeServiceId && node.data?.value) {
                const nodeDomain = this.parseDomain(node.data.value)
                if (nodeDomain === domain) return true
            }
            if (node.children && this.isDomainUsedByOtherNode(domain, excludeServiceId, node.children)) {
                return true
            }
        }
        return false
    }

    loadCurrentPageActions() {
        const serviceId = this.selectedNode?.data?.id ?? this.treeForm.id
        this.currentPageActionDomain = this.parseDomain(this.treeForm.value)

        if (!this.currentPageActionDomain) {
            this.currentPageActions = []
            this.editingPageAction = null
            return
        }

        // Match by domain of the current URL — this ensures changing URL clears/reloads correctly
        let existing = this.pageActions?.find(pa => pa.domain === this.currentPageActionDomain)
        // Fall back to serviceId match only if domain matched too
        if (!existing && serviceId) {
            const byServiceId = this.pageActions?.find(pa => pa.serviceId === serviceId)
            if (byServiceId && byServiceId.domain === this.currentPageActionDomain) {
                existing = byServiceId
            }
        }

        if (existing) {
            this.currentPageActions = JSON.parse(JSON.stringify(existing.actions)).map((a: any) => ({
                ...a,
                _id: a._id || `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }))
        } else {
            this.currentPageActions = []
        }
        this.editingPageAction = null
    }

    startPageActionEdit(pageAction: any) {
        this.editingPageAction = JSON.parse(JSON.stringify(pageAction))
    }

    confirmPageActionEdit() {
        if (!this.editingPageAction) return
        const index = this.currentPageActions.findIndex((pa: any) => pa._id === this.editingPageAction._id)
        if (index !== -1) {
            this.currentPageActions[index] = {...this.editingPageAction}
        }
        this.editingPageAction = null
    }

    cancelPageActionEdit() {
        if (this.editingPageAction) {
            const existing = this.currentPageActions.find((pa: any) => pa._id === this.editingPageAction._id)
            if (existing && !existing.action && !existing.selector) {
                this.currentPageActions = this.currentPageActions.filter((pa: any) => pa._id !== this.editingPageAction._id)
            }
        }
        this.editingPageAction = null
    }

    addPageAction() {
        if (this.editingPageAction) {
            this.confirmPageActionEdit()
        }
        const newAction = {
            _id: `pa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            action: '',
            selector: '',
            value: null
        }
        this.currentPageActions = [...this.currentPageActions, newAction]
        this.startPageActionEdit(newAction)
    }

    deletePageAction(pageAction: any) {
        this.currentPageActions = this.currentPageActions.filter((pa: any) => pa._id !== pageAction._id)
        if (this.editingPageAction && this.editingPageAction._id === pageAction._id) {
            this.editingPageAction = null
        }
    }

    async saveAllPageActions() {
        if (!this.currentPageActionDomain) {
            this.messageService.add({severity: 'warn', summary: 'Set service link first', detail: 'A valid URL is required to save page actions'})
            return
        }

        if (this.editingPageAction) {
            this.confirmPageActionEdit()
        }

        if (this.currentPageActions.length === 0) {
            this.messageService.add({severity: 'warn', summary: 'No actions', detail: 'Add at least one action before saving'})
            return
        }

        let hasErrors = false
        for (let i = 0; i < this.currentPageActions.length; i++) {
            const pa = this.currentPageActions[i]
            if (!pa.action) {
                this.messageService.add({severity: 'error', summary: 'Validation error', detail: `Row ${i + 1}: action is required`})
                hasErrors = true
            }
            if (!pa.selector && pa.action !== PageActionType.delay) {
                this.messageService.add({severity: 'error', summary: 'Validation error', detail: `Row ${i + 1}: selector is required`})
                hasErrors = true
            }
        }
        if (hasErrors) {
            return
        }

        const serviceId = this.selectedNode?.data?.id ?? this.treeForm.id
        const fullPageAction = {
            serviceId: serviceId,
            key: this.selectedNode?.data?.key || '',
            domain: this.currentPageActionDomain,
            actions: this.currentPageActions.map(({_id, ...rest}: any) => rest)
        }

        try {
            await this.uiService.ipcInvoke('pageAction:update', fullPageAction)
            this.messageService.add({severity: 'success', summary: 'Page actions saved'})
            await this.loadPageActions()
            this.loadCurrentPageActions()
        } catch (error) {
            console.error('Failed to save page actions:', error)
        }
    }

    importPageActions() {
        // TODO: implement import
    }

    filterUrlSuggestions(event: any) {
        const query = (event.query || '').toLowerCase()
        this.filteredUrlSuggestions = this.urlSuggestions.filter(s => s.toLowerCase().startsWith(query) || query.length === 0)
    }

    onAppNameChange(newName: string) {

    }

    async onTreeNodeDrop(event: any) {
        this.sideMenuTreeNodes = [...this.sideMenuTreeNodes];
        await this.servicesMenuDataSave();
    }

    validateUrl(url: string): string | null {
        if (!url || url.trim().length === 0) {
            return null // empty URL is allowed for parent nodes
        }
        const trimmed = url.trim()

        // URLs must not contain spaces
        if (/\s/.test(trimmed)) {
            return 'URL must not contain spaces'
        }

        // file:/// (triple slash) followed by a valid path
        if (/^file:/i.test(trimmed)) {
            if (/^file:\/\/\/[a-zA-Z0-9]/.test(trimmed)) {
                return null
            }
            return 'Invalid file path (must start with file:/// e.g. file:///C:/path)'
        }

        // Valid host patterns
        const domain = '([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}'
        const ipv4 = '(\\d{1,3}\\.){3}\\d{1,3}'
        const localhost = 'localhost'
        const host = `(${domain}|${ipv4}|${localhost})`
        const port = '(:\\d{1,5})?'
        const path = '(\\/.*)?'

        // With scheme: http(s)://host[:port][/path]
        const withScheme = new RegExp(`^https?:\\/\\/${host}${port}${path}$`, 'i')
        // Without scheme: host[:port][/path] — must have dot, colon, or slash after hostname
        const withoutScheme = new RegExp(`^${host}${port}${path}$`, 'i')

        if (withScheme.test(trimmed)) {
            return null
        }
        if (withoutScheme.test(trimmed)) {
            // Bare "localhost" without port/path is too ambiguous — require more
            if (/^localhost$/i.test(trimmed)) {
                return 'Add port or scheme (e.g. localhost:80 or http://localhost)'
            }
            return null
        }
        return 'Enter a valid URL (e.g. http://example.com or example.com:8080)'
    }

    onUrlChange() {
        this.urlError = this.validateUrl(this.treeForm.value)
        this.markTreeFormDirty()
        this.loadCurrentPageActions()
    }

    onNameChange() {
        this.nameError = this.treeForm.key.trim().length === 0 ? 'Name is required' : null
        this.markTreeFormDirty()
    }

    async saveTreeForm() {
        // Trim values before validation and save
        this.treeForm.key = this.treeForm.key.trim()
        this.treeForm.value = this.treeForm.value.trim()

        // Validate name
        this.nameError = this.treeForm.key.length === 0 ? 'Name is required' : null
        this.urlError = this.validateUrl(this.treeForm.value)
        if (this.nameError || this.urlError) {
            return
        }

        if (this.pendingDraftNode) {
            const createdNode = this.pendingDraftNode
            createdNode.data.key = this.treeForm.key
            createdNode.data.value = this.treeForm.value
            createdNode.label = this.treeForm.key

            const parent = this.pendingInsertParentId ? this.findNodeById(this.pendingInsertParentId, this.sideMenuTreeNodes) : null
            const siblings = parent ? parent.children : this.sideMenuTreeNodes
            const desiredIndex = this.pendingInsertIndex ?? siblings.length
            const insertIndex = Math.min(Math.max(desiredIndex, 0), siblings.length)
            siblings.splice(insertIndex, 0, createdNode)
            createdNode.parent = parent ?? null

            this.clearPendingDraft()
            this.applyTreeMetadata(this.sideMenuTreeNodes)
            this.selectedNode = createdNode
            this.syncFormWithSelection()
            this.sideMenuTreeNodes = [...this.sideMenuTreeNodes]
            await this.servicesMenuDataSave()
            return
        }

        if (!this.selectedNode?.data || !this.isTreeFormDirty) {
            return
        }
        this.selectedNode.data.key = this.treeForm.key
        this.selectedNode.data.value = this.treeForm.value
        this.selectedNode.label = this.treeForm.key
        await this.servicesMenuDataSave()
        this.isTreeFormDirty = false
    }

    cancelTreeField(field: 'key' | 'value') {
        if (this.selectedNode?.data) {
            this.treeForm[field] = this.selectedNode.data[field] ?? ''
        } else {
            this.treeForm[field] = ''
        }
        if (field === 'key') this.nameError = null
        if (field === 'value') this.urlError = null
        this.markTreeFormDirty()
    }

    markTreeFormDirty() {
        if (this.pendingDraftNode) {
            this.isTreeFormDirty = (this.treeForm.key ?? '').length > 0 || (this.treeForm.value ?? '').length > 0
            return
        }
        if (!this.selectedNode?.data) {
            this.isTreeFormDirty = false
            return
        }
        const originalKey = this.selectedNode.data.key ?? ''
        const originalValue = this.selectedNode.data.value ?? ''
        this.isTreeFormDirty = originalKey !== this.treeForm.key || originalValue !== this.treeForm.value
    }

    private syncFormWithSelection() {
        if (this.selectedNode?.data) {
            this.treeForm = {
                id: this.selectedNode.data.id,
                key: this.selectedNode.data.key ?? '',
                value: this.selectedNode.data.value ?? ''
            }
        } else {
            this.treeForm = this.createEmptyTreeForm()
        }
        this.isTreeFormDirty = false
        this.nameError = null
        this.urlError = null
        this.loadCurrentPageActions()
    }

    private clearPendingDraft() {
        this.pendingDraftNode = null
        this.pendingInsertParentId = null
        this.pendingInsertIndex = null
    }

    private createEmptyTreeForm(): TreeNodeForm {
        return {id: null, key: '', value: ''}
    }

    private applyTreeMetadata(nodes: TreeNode[], parent: TreeNode | null = null) {
        if (!nodes) {
            return
        }
        nodes.forEach(node => {
            node.parent = parent ?? null
            node.label = node.data?.key ?? node.label ?? ''
            node.children = node.children || []
            if (node.children.length) {
                this.applyTreeMetadata(node.children, node)
            }
        })
    }

    private findNodeById(id: any, nodes: TreeNode[]): TreeNode | null {
        if (!id || !nodes) {
            return null
        }
        for (const node of nodes) {
            if (node.data?.id === id) {
                return node
            }
            if (node.children) {
                const match = this.findNodeById(id, node.children)
                if (match) {
                    return match
                }
            }
        }
        return null
    }

}
