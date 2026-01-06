// Data Model
class OverlegApp {
    constructor() {
        this.overleggen = [];
        this.currentOverleg = null;
        this.editingOverleg = null;
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.render();
        this.checkAndScheduleNotifications();
        
        // Register service worker voor PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker geregistreerd'))
                .catch(err => console.log('Service Worker registratie mislukt:', err));
        }
    }

    // Data Management
    loadData() {
        const saved = localStorage.getItem('overleggen');
        if (saved) {
            this.overleggen = JSON.parse(saved);
            // Converteer datum strings terug naar Date objecten
            this.overleggen.forEach(o => {
                if (o.datum) o.datum = new Date(o.datum);
            });
        }
    }

    saveData() {
        localStorage.setItem('overleggen', JSON.stringify(this.overleggen));
        this.render();
    }

    addOverleg(overleg) {
        overleg.id = this.generateId();
        this.overleggen.push(overleg);
        this.saveData();
        this.scheduleNotification(overleg);
    }

    updateOverleg(id, updates) {
        const index = this.overleggen.findIndex(o => o.id === id);
        if (index !== -1) {
            this.overleggen[index] = { ...this.overleggen[index], ...updates };
            this.saveData();
            this.scheduleNotification(this.overleggen[index]);
        }
    }

    deleteOverleg(id) {
        this.overleggen = this.overleggen.filter(o => o.id !== id);
        this.saveData();
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
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notificatie permissie verleend');
            }
        }
    }

    scheduleNotification(overleg) {
        if (!overleg.datum || !('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        // Bereken de dag ervoor om 09:00
        const datum = new Date(overleg.datum);
        const dagErvoor = new Date(datum);
        dagErvoor.setDate(dagErvoor.getDate() - 1);
        dagErvoor.setHours(9, 0, 0, 0);

        const now = new Date();
        const timeUntilNotification = dagErvoor.getTime() - now.getTime();

        // Cancel oude notificatie
        this.cancelNotification(overleg.id);

        // Plan nieuwe notificatie alleen als die in de toekomst ligt
        if (timeUntilNotification > 0) {
            const timeoutId = setTimeout(() => {
                this.showNotification(overleg);
            }, timeUntilNotification);

            // Sla timeout ID op
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
        // Herplan alle toekomstige notificaties bij laden
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

        // Click outside modal to close
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        // Datum checkbox
        document.getElementById('heeftDatum').addEventListener('change', (e) => {
            const datumGroup = document.getElementById('datumGroup');
            datumGroup.style.display = e.target.checked ? 'block' : 'none';
            
            // Set default datetime to tomorrow at 10:00
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
        
        // Reset form
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
            
            // Clear and add agendapunten
            document.getElementById('agendapuntenContainer').innerHTML = '';
            overleg.agendapunten.forEach(ap => {
                this.addAgendapuntInput(ap.tekst);
            });
        } else {
            modalTitle.textContent = 'Nieuw Overleg';
            this.addAgendapuntInput(); // Add one empty agendapunt
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
            // Update existing
            this.updateOverleg(this.editingOverleg.id, overlegData);
        } else {
            // Add new
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

        // Add checkbox event listeners
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

        // Add click event listeners to cards
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

    // Helper function voor datetime-local input
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
