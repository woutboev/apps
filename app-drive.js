// Google Drive Configuration
const GOOGLE_CLIENT_ID = '496253904370-0fktgc00rn6ch2sgp2jep4o5bpius311.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'overleggen-data.json';

// Data Model
class OverlegApp {
    constructor() {
        this.overleggen = [];
        this.currentOverleg = null;
        this.editingOverleg = null;
        this.user = null;
        this.accessToken = null;
        this.driveFileId = null;
        this.isSyncing = false;
        this.init();
    }

    init() {
        this.setupGoogleSignIn();
        this.setupEventListeners();
        this.requestNotificationPermission();
        
        // Register service worker voor PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker geregistreerd'))
                .catch(err => console.log('Service Worker registratie mislukt:', err));
        }
    }

    // Google Sign-In
    setupGoogleSignIn() {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this)
        });

        google.accounts.id.renderButton(
            document.getElementById('googleSignInButton'),
            { 
                theme: 'outline', 
                size: 'large',
                text: 'signin_with',
                locale: 'nl'
            }
        );

        // Check if already logged in
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('accessToken');
        if (savedUser && savedToken) {
            this.user = JSON.parse(savedUser);
            this.accessToken = savedToken;
            this.showMainApp();
        }
    }

    async handleCredentialResponse(response) {
        try {
            // Decode JWT token
            const payload = this.parseJwt(response.credential);
            
            this.user = {
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            };

            // Request access token
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: async (tokenResponse) => {
                    if (tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        localStorage.setItem('user', JSON.stringify(this.user));
                        localStorage.setItem('accessToken', this.accessToken);
                        
                        await this.loadFromDrive();
                        this.showMainApp();
                    }
                }
            });

            tokenClient.requestAccessToken();
        } catch (error) {
            console.error('Login error:', error);
            alert('Er ging iets mis bij het inloggen. Probeer het opnieuw.');
        }
    }

    parseJwt(token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    }

    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Set profile image
        document.getElementById('profileImage').src = this.user.picture;
        document.getElementById('profileImageLarge').src = this.user.picture;
        document.getElementById('profileName').textContent = this.user.name;
        document.getElementById('profileEmail').textContent = this.user.email;
        
        this.render();
        this.checkAndScheduleNotifications();
    }

    logout() {
        if (confirm('Weet je zeker dat je wilt uitloggen?')) {
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            google.accounts.id.disableAutoSelect();
            location.reload();
        }
    }

    // Google Drive Integration
    async loadFromDrive() {
        try {
            this.showSyncStatus('Laden...', 'syncing');
            
            // Search for existing file
            const searchResponse = await fetch(
                `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    }
                }
            );

            const searchData = await searchResponse.json();
            
            if (searchData.files && searchData.files.length > 0) {
                // File exists, load it
                this.driveFileId = searchData.files[0].id;
                
                const fileResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.driveFileId}?alt=media`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`
                        }
                    }
                );

                const data = await fileResponse.json();
                this.overleggen = data.overleggen || [];
                
                // Convert date strings back to Date objects
                this.overleggen.forEach(o => {
                    if (o.datum) o.datum = new Date(o.datum);
                });
                
                this.updateLastSyncTime();
                this.showSyncStatus('Geladen', 'success');
            } else {
                // No file exists yet
                this.overleggen = [];
                this.showSyncStatus('Geen data gevonden', 'success');
            }
            
            setTimeout(() => this.hideSyncStatus(), 2000);
        } catch (error) {
            console.error('Error loading from Drive:', error);
            this.showSyncStatus('Fout bij laden', 'error');
            setTimeout(() => this.hideSyncStatus(), 3000);
            
            // Fallback to local storage
            this.loadFromLocalStorage();
        }
    }

    async saveToDrive() {
        if (this.isSyncing) return;
        
        try {
            this.isSyncing = true;
            this.showSyncStatus('Synchroniseren...', 'syncing');
            document.getElementById('syncBtn').classList.add('syncing');
            
            const data = {
                overleggen: this.overleggen,
                lastModified: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const metadata = {
                name: DRIVE_FILE_NAME,
                mimeType: 'application/json',
                parents: ['appDataFolder']
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const url = this.driveFileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${this.driveFileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

            const method = this.driveFileId ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            const result = await response.json();
            
            if (!this.driveFileId) {
                this.driveFileId = result.id;
            }

            this.updateLastSyncTime();
            this.showSyncStatus('Gesynchroniseerd', 'success');
            
            // Also save locally as backup
            this.saveToLocalStorage();
            
            setTimeout(() => this.hideSyncStatus(), 2000);
        } catch (error) {
            console.error('Error saving to Drive:', error);
            this.showSyncStatus('Sync mislukt', 'error');
            
            // Save locally as fallback
            this.saveToLocalStorage();
            
            setTimeout(() => this.hideSyncStatus(), 3000);
        } finally {
            this.isSyncing = false;
            document.getElementById('syncBtn').classList.remove('syncing');
        }
    }

    async manualSync() {
        await this.loadFromDrive();
        this.render();
    }

    // Local Storage Fallback
    loadFromLocalStorage() {
        const saved = localStorage.getItem('overleggen');
        if (saved) {
            this.overleggen = JSON.parse(saved);
            this.overleggen.forEach(o => {
                if (o.datum) o.datum = new Date(o.datum);
            });
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('overleggen', JSON.stringify(this.overleggen));
    }

    // Sync Status UI
    showSyncStatus(message, type) {
        const status = document.getElementById('syncStatus');
        status.textContent = message;
        status.className = `sync-status show ${type}`;
    }

    hideSyncStatus() {
        const status = document.getElementById('syncStatus');
        status.classList.remove('show');
    }

    updateLastSyncTime() {
        const now = new Date();
        const time = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('lastSyncTime').textContent = time;
    }

    // Data Management
    addOverleg(overleg) {
        overleg.id = this.generateId();
        this.overleggen.push(overleg);
        this.saveToDrive();
        this.render();
        this.scheduleNotification(overleg);
    }

    updateOverleg(id, updates) {
        const index = this.overleggen.findIndex(o => o.id === id);
        if (index !== -1) {
            this.overleggen[index] = { ...this.overleggen[index], ...updates };
            this.saveToDrive();
            this.render();
            this.scheduleNotification(this.overleggen[index]);
        }
    }

    deleteOverleg(id) {
        this.overleggen = this.overleggen.filter(o => o.id !== id);
        this.saveToDrive();
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
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.manualSync();
        });

        // Profile button
        document.getElementById('profileBtn').addEventListener('click', () => {
            document.getElementById('profileModal').classList.add('show');
        });

        document.getElementById('closeProfileModal').addEventListener('click', () => {
            document.getElementById('profileModal').classList.remove('show');
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Add button
        document.getElementById('addBtn').addEventListener('click', () => {
            this.openModal();
        });

        // Modal close
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        document.getElementById('profileModal').addEventListener('click', (e) => {
            if (e.target.id === 'profileModal') {
                document.getElementById('profileModal').classList.remove('show');
            }
        });

        // Datum checkbox
        document.getElementById('heeftDatum').addEventListener('change', (e) => {
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
        document.getElementById('addAgendapunt').addEventListener('click', () => {
            this.addAgendapuntInput();
        });

        // Form submit
        document.getElementById('overlegForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Detail view back button
        document.getElementById('backBtn').addEventListener('click', () => {
            this.closeDetailView();
        });

        // Detail view edit button
        document.getElementById('editBtn').addEventListener('click', () => {
            this.openModal(this.currentOverleg);
        });

        // Detail view delete button
        document.getElementById('deleteBtn').addEventListener('click', () => {
            if (confirm(`Weet je zeker dat je "${this.currentOverleg.naam}" wilt verwijderen?`)) {
                this.deleteOverleg(this.currentOverleg.id);
                this.closeDetailView();
            }
        });
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

    handleFormSubmit() {
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
            this.updateOverleg(this.editingOverleg.id, overlegData);
        } else {
            this.addOverleg(overlegData);
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
            
            checkbox.addEventListener('change', () => {
                const agendapunt = overleg.agendapunten.find(a => a.id === apId);
                if (agendapunt) {
                    agendapunt.afgevinkt = checkbox.checked;
                    this.updateOverleg(overleg.id, { agendapunten: overleg.agendapunten });
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
