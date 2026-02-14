// licenses-manager.js
// À inclure dans votre page d'administration

class LicenseManager {
  constructor() {
    this.licensesUrl =
      "https://api.github.com/repos/VOTRE_USERNAME/VOTRE_REPO/contents/licenses.json";
    this.token = "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"; // À sécuriser
  }

  async getAllLicenses() {
    try {
      const response = await fetch(this.licensesUrl, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const data = await response.json();
      const content = atob(data.content);
      return JSON.parse(content);
    } catch (error) {
      console.error("Erreur chargement licences:", error);
      return null;
    }
  }

  async updateLicenses(licensesData) {
    try {
      // Récupérer d'abord le SHA du fichier
      const response = await fetch(this.licensesUrl, {
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const data = await response.json();
      const sha = data.sha;

      // Mettre à jour le fichier
      const updateResponse = await fetch(this.licensesUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Mise à jour des licences",
          content: btoa(JSON.stringify(licensesData, null, 2)),
          sha: sha,
        }),
      });

      return await updateResponse.json();
    } catch (error) {
      console.error("Erreur mise à jour:", error);
      return null;
    }
  }

  async createLicense(type = "premium", duration = 30) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData) return null;

    const newKey = this.generateLicenseKey();
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + duration);

    licensesData.licenses[newKey] = {
      created: now.toISOString(),
      expiry: expiry.toISOString(),
      status: "active",
      type: type,
      maxDevices: type === "lifetime" ? 5 : 2,
      devices: [],
    };

    const result = await this.updateLicenses(licensesData);
    if (result) {
      return newKey;
    }
    return null;
  }

  async revokeLicense(licenseKey) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData || !licensesData.licenses[licenseKey]) return false;

    licensesData.licenses[licenseKey].status = "revoked";
    const result = await this.updateLicenses(licensesData);
    return !!result;
  }

  async deleteLicense(licenseKey) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData || !licensesData.licenses[licenseKey]) return false;

    delete licensesData.licenses[licenseKey];
    const result = await this.updateLicenses(licensesData);
    return !!result;
  }

  async extendLicense(licenseKey, additionalDays) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData || !licensesData.licenses[licenseKey]) return false;

    const currentExpiry = new Date(licensesData.licenses[licenseKey].expiry);
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + additionalDays);

    licensesData.licenses[licenseKey].expiry = newExpiry.toISOString();
    const result = await this.updateLicenses(licensesData);
    return !!result;
  }

  async checkLicense(licenseKey, deviceId = null) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData) return { valid: false, reason: "system_error" };

    const license = licensesData.licenses[licenseKey];

    // Vérifications
    if (!license) return { valid: false, reason: "not_found" };
    if (license.status !== "active") return { valid: false, reason: "revoked" };

    const now = new Date();
    const expiry = new Date(license.expiry);
    if (now > expiry) return { valid: false, reason: "expired" };

    // Gestion des appareils
    if (deviceId && license.devices) {
      if (!license.devices.includes(deviceId)) {
        if (license.devices.length >= license.maxDevices) {
          return { valid: false, reason: "max_devices_reached" };
        }
        // Enregistrer le nouvel appareil
        license.devices.push(deviceId);
        await this.updateLicenses(licensesData);
      }
    }

    return {
      valid: true,
      expiry: license.expiry,
      type: license.type,
    };
  }

  generateLicenseKey() {
    const prefix = "JETX-";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let key = prefix;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      if (i < 3) key += "-";
    }

    return key;
  }

  async getActiveLicensesCount() {
    const licensesData = await this.getAllLicenses();
    if (!licensesData) return 0;

    return Object.values(licensesData.licenses).filter(
      (l) => l.status === "active" && new Date(l.expiry) > new Date(),
    ).length;
  }

  async getExpiringLicenses(daysThreshold = 7) {
    const licensesData = await this.getAllLicenses();
    if (!licensesData) return [];

    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + daysThreshold);

    return Object.entries(licensesData.licenses)
      .filter(([key, license]) => {
        const expiry = new Date(license.expiry);
        return (
          license.status === "active" && expiry > now && expiry <= threshold
        );
      })
      .map(([key, license]) => ({ key, ...license }));
  }
}

export default LicenseManager;
