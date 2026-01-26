// api.js - API Communication Layer

const CONFIG = {
    // This will be set by the user in settings
    HV_GAS_URL: localStorage.getItem('hv_gas_url') || 'https://script.google.com/macros/s/AKfycbzKCvkaQ8sDBoYCTWd9K4Rt9L4MPK3p1llGZwDT5nd5E33NeRen1l973EtFQyI42FvQ/exec',
    P1_GAS_URL: localStorage.getItem('p1_gas_url') || 'https://script.google.com/macros/s/AKfycbxJ0bG4MEptJCL_4057PM1UkFXrVSp5Vyydrq4ZvAUzGt3-gqyGq4aV1UhRpi90tszK/exec'
};

const API = {
    saveSettings: (hvUrl, p1Url) => {
        CONFIG.HV_GAS_URL = hvUrl;
        CONFIG.P1_GAS_URL = p1Url;
        localStorage.setItem('hv_gas_url', hvUrl);
        localStorage.setItem('p1_gas_url', p1Url);
    },

    // Fetch local patients
    getPatients: async () => {
        if (!CONFIG.HV_GAS_URL) {
            console.warn("No Backend URL set");
            return []; // Return empty or mock
        }
        try {
            const res = await fetch(CONFIG.HV_GAS_URL);
            return await res.json();
        } catch (e) {
            console.error("Fetch failed", e);
            throw e;
        }
    },

    // Register new patient
    registerPatient: async (data) => {
        if (!CONFIG.HV_GAS_URL) throw new Error("Backend URL not configured");

        const payload = {
            action: 'register',
            data: data
        };

        return await fetch(CONFIG.HV_GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // Update patient (Quick Visit / Died)
    updatePatient: async (id, updates) => {
        if (!CONFIG.HV_GAS_URL) throw new Error("Backend URL not configured");

        const payload = {
            action: 'update',
            id: id,
            updates: updates
        };

        return await fetch(CONFIG.HV_GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    // Transfer to p1
    transferToP1: async (patient) => {
        if (!CONFIG.P1_GAS_URL) throw new Error("P1 URL not configured");

        // Transform Data
        const p1Patient = {
            name: patient['Pt Name'],
            code: patient['Pt file Num.'],
            age: patient['Age'],
            gender: patient['Gender'],
            phone: patient['phone No.'],
            ward: 'Home Visits', // CRITICAL: Force this ward
            room: 'Home',
            diagnosis: patient['Diagnosis'],
            provider: patient['Primary Physicien'],
            // Combine extra info into notes
            notes: `Specific: ${patient['Specific Diagnosis'] || 'N/A'}\nAddress: ${patient['Home Address '] || ''} - ${patient['Adress'] || ''}\nPriority: ${patient['priority'] || ''}`,
            treatment: patient['Intent of care'] || '',
            medications: patient['opioid '] === 'Yes' ? 'Opioids: Yes' : ''
        };

        const payload = {
            action: 'import',
            patients: [p1Patient]
        };

        console.log("Transferring to p1:", payload);

        return await fetch(CONFIG.P1_GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
};
