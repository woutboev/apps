// Google API Configuration
// BELANGRIJK: Vervang dit met je eigen Client ID van Google Cloud Console
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FILENAME = 'overleggen-data.json';

// Data Model
class OverlegApp {
    constructor() {
        this.overleggen = [];
        this.currentOverleg = null;
        this.editingOverleg = null;
        this.isSignedIn = false;
        this.accessToken = null;
        this.driveFileId = null;
        this.isSyncing = false;
        this.init();
    }

    async init() {
        // Check if we need to show login or main app
        this.checkAuthState();
        this.setupEventListeners();
        this.requestNotificationPermission();
        
        // Register service worker voor PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker geregistreerd'))
                .catch(err => console.log('Service Worker registratie mislukt:', err));
        }
    }

    checkAuthState() {
        // Check if there's a stored access token
        const storedToken = localStorage.getItem('google_access_token');
        if (storedToken) {
            this.accessToken = storedToken;
            this.isSignedIn = true;
            this.showMainApp();
            this.loadFromDrive();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        this.initializeGoogleSignIn();
    }

    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.render();
    }

    initializeGoogleSignIn() {
        if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
            // Show error message if client ID not configured
            const button = document.getElementById('signInButton');
            button.innerHTML = `
                <div style="background: #FFE5E5; color: #D32F2F; padding: 16px; border-radius: 10px; text-align: left;">
                    <strong>⚠️ Configuratie vereist</strong><br>
                    <small>De app moet eerst geconfigureerd worden met een Google Client ID. 
                    Zie de README voor instructies.</small>
                </div>
            `;
            return;
        }

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this),
            auto_select: false
        });

        google.accounts.id.renderButton(
            document.getElementById('signInButton'),
            { 
                theme: 'outline', 
                size: 'large',
                text: 'continue_with',
                width: 280
            }
        );
    }

    async handleCredentialResponse(response) {
        try {
            // Decode JWT to get user info
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            
            // Store user info
            localStorage.setItem('user_name', payload.name);
            localStorage.setItem('user_email', payload.email);
            localStorage.setItem('user_picture', payload.picture);
            
            // Get access token for Drive API
            await this.getAccessToken(response.credential);
            
            this.isSignedIn = true;
            this.showMainApp();
            await this.loadFromDrive();
            
        } catch (error) {
            console.error('Sign-in error:', error);
            alert('Inloggen mislukt. Probeer het opnieuw.');
        }
    }

    async getAccessToken(credential) {
        // For Drive API access, we need to use OAuth 2.0 flow
        // This is a simplified approach - in production, use proper OAuth flow
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.access_token) {
                    this.accessToken = response.access_token;
                    localStorage.setItem('google_access_token', response.access_token);
                    // Token expires, so we store timestamp
                    localStorage.setItem('token_timestamp', Date.now().toString());
                }
            },
        });
        
        return new Promise((resolve) => {
            tokenClient.callback = async (response) => {
                if (response.error) {
                    console.error('Token error:', response);
                    resolve(false);
                }
                this.accessToken = response.access_token;
                localStorage.setItem('google_access_token', response.access_token);
                localStorage.setItem('token_timestamp', Date.now().toString());
                resolve(true);
            };
            tokenClient.requestAccessToken();
        });
    }

    async loadFromDrive() {
        if (!this.accessToken) return;
        
        this.showSyncStatus('Laden van Drive...', 'syncing');
        
        try {
            // Search for our data file
            const fileId = await this.findDriveFile();
            
            if (fileId) {
                this.driveFileId = fileId;
                // Download file content
                const content = await this.downloadDriveFile(fileId);
                if (content) {
                    this.overleggen = JSON.parse(content);
                    // Convert date strings back to Date objects
                    this.overleggen.forEach(o => {
                        if (o.datum) o.datum = new Date(o.datum);
                    });
                    this.render();
                    this.checkAndScheduleNotifications();
                    this.showSyncStatus('Gesynchroniseerd', 'success');
                }
            } else {
                // No file exists yet, create it
                await this.saveToDrive();
            }
        } catch (error) {
            console.error('Load error:', error);
            this.showSyncStatus('Sync mislukt', 'error');
            // Fall back to local storage
            this.loadFromLocalStorage();
        }
        
        setTimeout(() => this.hideSyncStatus(), 2000);
    }

    async findDriveFile() {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILENAME}' and trashed=false`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );
        
        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0].id : null;
    }

    async downloadDriveFile(fileId) {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            }
        );
        
        if (response.ok) {
            return await response.text();
        }
        return null;
    }

    async saveToDrive() {
        if (!this.accessToken || this.isSyncing) return;
        
        this.isSyncing = true;
        this.showSyncStatus('Opslaan naar Drive...', 'syncing');
        
        try {
            const content = JSON.stringify(this.overleggen);
            const blob = new Blob([content], { type: 'application/json' });
            
            if (this.driveFileId) {
                // Update existing file
                await this.updateDriveFile(this.driveFileId, blob);
            } else {
                // Create new file
                const fileId = await this.createDriveFile(blob);
                this.driveFileId = fileId;
            }
            
            this.showSyncStatus('Opgeslagen', 'success');
        } catch (error) {
            console.error('Save error:', error);
            this.showSyncStatus('Opslaan mislukt', 'error');
            // Fall back to local storage
            this.saveToLocalStorage();
        }
        
        this.isSyncing = false;
        setTimeout(() => this.hideSyncStatus(), 2000);
    }

    async createDriveFile(blob) {
        const metadata = {
            name: DRIVE_FILENAME,
            mimeType: 'application/json'
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        
        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            }
        );
        
        const data = await response.json();
        return data.id;
    }

    async updateDriveFile(fileId, blob) {
        await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: blob
            }
        );
    }

    // Fallback methods
    loadFromLocalStorage() {
        const saved = localStorage.getItem('overleggen');
        if (saved) {
            this.overleggen = JSON.parse(saved);
            this.overleggen.forEach(o => {
                if (o.datum) o.datum = new Date(o.datum);
            });
        }
        this.render();
        this.checkAndScheduleNotifications();
    }

    saveToLocalStorage() {
        localStorage.setItem('overleggen', JSON.stringify(this.overleggen));
    }

    showSyncStatus(text, status) {
        const syncStatus = document.getElementById('syncStatus');
        const syncStatusText = document.getElementById('syncStatusText');
        syncStatusText.textContent = text;
        syncStatus.className = `sync-status ${status}`;
        syncStatus.style.display = 'flex';
        
        const syncBtn = document.getElementById('syncBtn');
        if (status === 'syncing') {
            syncBtn.classList.add('syncing');
        } else {
            syncBtn.classList.remove('syncing');
        }
    }

    hideSyncStatus() {
        document.getElementById('syncStatus').style.display = 'none';
    }

    // Data Management
    async addOverleg(overleg) {
        overleg.id = this.generateId();
        this.overleggen.push(overleg);
        await this.saveToDrive();
        this.render();
        this.scheduleNotification(overleg);
    }

    async updateOverleg(id, updates) {
        const index = this.overleggen.findIndex(o => o.id === id);
        if (index !== -1) {
            this.overleggen[index] = { ...this.overleggen[index], ...updates };
            await this.saveToDrive();
            this.render();
            this.scheduleNotification(this.overleggen[index]);
        }
    }

    async deleteOverleg(id) {
        this.overleggen = this.overleggen.filter(o => o.id !== id);
        await this.saveToDrive();
        this.render();
        this.cancelNotification(id);
    }

    getOverleg(id) {
        return this.overleggen.find(o => o.id === id);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Notification Management
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Deze browser ondersteunt geen notificaties');
            return;
        }

        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    scheduleNotification(overleg) {
        if (!overleg.datum || !('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const datum = new Date(overleg.datum);
        const dagErvoor = new Date(datum);
        dagErvoor.setDate(dagErvoor.getDate() - 1);
        dagErvoor.setHours(9, 0, 0, 0);

        const now = new Date();
        const timeUntilNotification = dagErvoor.getTime() - now.getTime();

        this.cancelNotification(overleg.id);

        if (timeUntilNotification > 0) {
            const timeoutId = setTimeout(() => {
                this.showNotification(overleg);
            }, timeUntilNotification);

            const timeouts = JSON.parse(localStorage.getItem('notificationTimeouts') || '{}');
            timeouts[overleg.id] = timeoutId;
            localStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
        }
    }

    cancelNotification(id) {
        const timeouts = JSON.parse(localStorage.getItem('notificationTimeouts') || '{}');
        if (timeouts[id]) {
            clearTimeout(timeouts[id]);
            delete timeouts[id];
            localStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
        }
    }

    showNotification(overleg) {
        const agendapuntenText = overleg.agendapunten
            .map(a => `• ${a.tekst}`)
            .join('\n');

        new Notification(`Overleg morgen: ${overleg.naam}`, {
            body: `Agendapunten:\n${agendapuntenText}`,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            tag: overleg.id
        });
    }

    checkAndScheduleNotifications() {
        this.overleggen.forEach(overleg => {
            if (overleg.datum && !this.isPassed(overleg)) {
                this.scheduleNotification(overleg);
            }
        });
    }

    // Helper Functions
    isPassed(overleg) {
        if (!overleg.datum) return false;
        return new Date(overleg.datum) < new Date();
    }

    sortOverleggen() {
        return {
            gepland: this.overleggen
                .filter(o => o.datum)
                .sort((a, b) => new Date(a.datum) - new Date(b.datum)),
            ongepland: this.overleggen
                .filter(o => !o.datum)
                .sort((a, b) => a.naam.localeCompare(b.naam))
        };
    }

    formatDatum(datum) {
        if (!datum) return '';
        const d = new Date(datum);
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return d.toLocaleDateString('nl-NL', options);
    }

    // Event Listeners
    setupEventListeners() {
        // Sync button
        document.getElementById('syncBtn')?.addEventListener('click', async () => {
            await this.loadFromDrive();
        });

        // Account button
        document.getElementById('accountBtn')?.addEventListener('click', () => {
            this.showAccountMenu();
        });

        // Sign out
        document.getElementById('signOutBtn')?.addEventListener('click', () => {
            this.signOut();
        });

        // Close account menu when clicking outside
        document.getElementById('accountMenu')?.addEventListener('click', (e) => {
            if (e.target.id === 'accountMenu') {
                this.hideAccountMenu();
            }
        });

        // Add button
        document.getElementById('addBtn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Modal close
        document.getElementById('closeModal')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        // Datum checkbox
        document.getElementById('heeftDatum')?.addEventListener('change', (e) => {
            const datumGroup = document.getElementById('datumGroup');
            datumGroup.style.display = e.target.checked ? 'block' : 'none';
            
            if (e.target.checked && !document.getElementById('overlegDatum').value) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(10, 0, 0, 0);
                document.getElementById('overlegDatum').value = this.toDatetimeLocal(tomorrow);
            }
        });

        // Add agendapunt button
        document.getElementById('addAgendapunt')?.addEventListener('click', () => {
            this.addAgendapuntInput();
        });

        // Form submit
        document.getElementById('overlegForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Detail view buttons
        document.getElementById('backBtn')?.addEventListener('click', () => {
            this.closeDetailView();
        });

        document.getElementById('editBtn')?.addEventListener('click', () => {
            this.openModal(this.currentOverleg);
        });

        document.getElementById('deleteBtn')?.addEventListener('click', () => {
            if (confirm(`Weet je zeker dat je "${this.currentOverleg.naam}" wilt verwijderen?`)) {
                this.deleteOverleg(this.currentOverleg.id);
                this.closeDetailView();
            }
        });
    }

    showAccountMenu() {
        const menu = document.getElementById('accountMenu');
        menu.classList.add('show');
        
        // Fill in user info
        document.getElementById('userName').textContent = localStorage.getItem('user_name') || 'Gebruiker';
        document.getElementById('userEmail').textContent = localStorage.getItem('user_email') || '';
        document.getElementById('userPhoto').src = localStorage.getItem('user_picture') || 'icon-192.png';
    }

    hideAccountMenu() {
        document.getElementById('accountMenu').classList.remove('show');
    }

    signOut() {
        if (confirm('Weet je zeker dat je wilt uitloggen?')) {
            // Clear all stored data
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('token_timestamp');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_email');
            localStorage.removeItem('user_picture');
            
            // Reset state
            this.isSignedIn = false;
            this.accessToken = null;
            this.driveFileId = null;
            this.overleggen = [];
            
            // Show login screen
            this.hideAccountMenu();
            this.showLoginScreen();
        }
    }

    // Modal Management
    openModal(overleg = null) {
        this.editingOverleg = overleg;
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        
        document.getElementById('overlegForm').reset();
        document.getElementById('datumGroup').style.display = 'none';
        
        if (overleg) {
            modalTitle.textContent = 'Overleg bewerken';
            document.getElementById('overlegNaam').value = overleg.naam;
            
            if (overleg.datum) {
                document.getElementById('heeftDatum').checked = true;
                document.getElementById('datumGroup').style.display = 'block';
                document.getElementById('overlegDatum').value = this.toDatetimeLocal(new Date(overleg.datum));
            }
            
            document.getElementById('agendapuntenContainer').innerHTML = '';
            overleg.agendapunten.forEach(ap => {
                this.addAgendapuntInput(ap.tekst);
            });
        } else {
            modalTitle.textContent = 'Nieuw Overleg';
            this.addAgendapuntInput();
        }
        
        modal.classList.add('show');
    }

    closeModal() {
        document.getElementById('modal').classList.remove('show');
        this.editingOverleg = null;
    }

    addAgendapuntInput(value = '') {
        const container = document.getElementById('agendapuntenContainer');
        const div = document.createElement('div');
        div.className = 'agendapunt-input';
        div.innerHTML = `
            <input type="text" placeholder="Agendapunt" value="${value}" required>
            <button type="button" class="remove-agendapunt" aria-label="Verwijderen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </button>
        `;
        
        div.querySelector('.remove-agendapunt').addEventListener('click', () => {
            if (container.children.length > 1) {
                div.remove();
            } else {
                alert('Je moet minimaal één agendapunt hebben');
            }
        });
        
        container.appendChild(div);
    }

    async handleFormSubmit() {
        const naam = document.getElementById('overlegNaam').value.trim();
        const heeftDatum = document.getElementById('heeftDatum').checked;
        const datumValue = document.getElementById('overlegDatum').value;
        
        const agendapuntInputs = document.querySelectorAll('.agendapunt-input input');
        const agendapunten = Array.from(agendapuntInputs)
            .map(input => input.value.trim())
            .filter(text => text.length > 0)
            .map(text => ({
                id: this.generateId(),
                tekst: text,
                afgevinkt: false
            }));

        if (agendapunten.length === 0) {
            alert('Voeg minimaal één agendapunt toe');
            return;
        }

        const overlegData = {
            naam,
            datum: heeftDatum ? new Date(datumValue) : null,
            agendapunten
        };

        if (this.editingOverleg) {
            await this.updateOverleg(this.editingOverleg.id, overlegData);
        } else {
            await this.addOverleg(overlegData);
        }

        this.closeModal();
    }

    // Detail View
    showDetailView(overleg) {
        this.currentOverleg = overleg;
        const detailView = document.getElementById('detailView');
        const detailTitle = document.getElementById('detailTitle');
        const detailContent = document.getElementById('detailContent');

        detailTitle.textContent = overleg.naam;

        let html = `
            <div class="detail-section">
                <h3>Details</h3>
                <div class="detail-row">
                    <span class="label">Naam</span>
                    <span class="value">${overleg.naam}</span>
                </div>
        `;

        if (overleg.datum) {
            html += `
                <div class="detail-row">
                    <span class="label">Datum</span>
                    <span class="value ${this.isPassed(overleg) ? 'text-gray' : ''}">${this.formatDatum(overleg.datum)}</span>
                </div>
            `;
        } else {
            html += `
                <div class="detail-row">
                    <span class="label">Status</span>
                    <span class="value" style="color: var(--warning-color);">Nog in te plannen</span>
                </div>
            `;
        }

        html += `</div>`;

        html += `
            <div class="detail-section">
                <h3>Agendapunten</h3>
        `;

        overleg.agendapunten.forEach(ap => {
            html += `
                <div class="agendapunt-item ${ap.afgevinkt ? 'checked' : ''}" data-id="${ap.id}">
                    <input type="checkbox" ${ap.afgevinkt ? 'checked' : ''}>
                    <span class="agendapunt-text">${ap.tekst}</span>
                </div>
            `;
        });

        html += `</div>`;

        detailContent.innerHTML = html;

        detailContent.querySelectorAll('.agendapunt-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const apId = item.dataset.id;
            
            checkbox.addEventListener('change', async () => {
                const agendapunt = overleg.agendapunten.find(a => a.id === apId);
                if (agendapunt) {
                    agendapunt.afgevinkt = checkbox.checked;
                    await this.updateOverleg(overleg.id, { agendapunten: overleg.agendapunten });
                    item.classList.toggle('checked', checkbox.checked);
                }
            });
        });

        detailView.classList.add('show');
    }

    closeDetailView() {
        document.getElementById('detailView').classList.remove('show');
        this.currentOverleg = null;
    }

    // Render
    render() {
        const container = document.getElementById('overleggenList');
        const { gepland, ongepland } = this.sortOverleggen();

        let html = '';

        if (gepland.length > 0) {
            html += `
                <div class="section">
                    <div class="section-header">Geplande overleggen</div>
            `;

            gepland.forEach(overleg => {
                const passed = this.isPassed(overleg);
                html += `
                    <div class="overleg-card ${passed ? 'passed' : ''}" data-id="${overleg.id}">
                        <div class="overleg-title">${overleg.naam}</div>
                        <div class="overleg-date">${this.formatDatum(overleg.datum)}</div>
                        <div class="overleg-count">${overleg.agendapunten.length} agendapunt(en)</div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        if (ongepland.length > 0) {
            html += `
                <div class="section">
                    <div class="section-header">Nog in te plannen</div>
            `;

            ongepland.forEach(overleg => {
                html += `
                    <div class="overleg-card" data-id="${overleg.id}">
                        <div class="overleg-title">${overleg.naam}</div>
                        <div class="overleg-date unpinned">Nog in te plannen</div>
                        <div class="overleg-count">${overleg.agendapunten.length} agendapunt(en)</div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        if (this.overleggen.length === 0) {
            html = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <p>Geen overleggen</p>
                    <p style="font-size: 15px; margin-top: 8px;">Tik op + om te beginnen</p>
                </div>
            `;
        }

        container.innerHTML = html;

        document.querySelectorAll('.overleg-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const overleg = this.getOverleg(id);
                if (overleg) {
                    this.showDetailView(overleg);
                }
            });
        });
    }

    toDatetimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new OverlegApp();
});
