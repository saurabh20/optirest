const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, 'config.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      const data = fs.readFileSync(this.path, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.log('Creating new config file with defaults');
      // Default settings
      const defaults = {
        onboarding: {
          completed: false
        },
        settings: {
          breakInterval: 20,
          breakDuration: 20,
          soundEnabled: true,
          autoStart: false,
          reminderMessage: 'Time to rest your eyes',
          postponeDuration: 5,
          workingHoursEnabled: false,
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
          // Background: 'gradient' | 'images' | 'default'
          backgroundMode: 'default',
          gradientStart: '#0a0e27',
          gradientEnd: '#0d2137',
          gradientAngle: 135,
          // Array of filenames stored in userData/backgrounds/
          backgroundImages: []
        },
        statistics: {
          totalBreaks: 0,
          skippedBreaks: 0,
          completedBreaks: 0,
          lastBreakTime: null,
          dailyStats: {}
        }
      };
      
      // Save defaults
      this.data = defaults;
      this.save();
      return defaults;
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  save() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  updateStatistic(stat, value) {
    const statistics = this.get('statistics');
    statistics[stat] = value;
    
    // Update daily stats
    const today = new Date().toDateString();
    if (!statistics.dailyStats[today]) {
      statistics.dailyStats[today] = {
        completed: 0,
        skipped: 0
      };
    }
    
    this.set('statistics', statistics);
  }

  incrementDailyStat(type) {
    const statistics = this.get('statistics');
    const today = new Date().toDateString();
    
    if (!statistics.dailyStats) {
      statistics.dailyStats = {};
    }
    
    if (!statistics.dailyStats[today]) {
      statistics.dailyStats[today] = {
        completed: 0,
        skipped: 0
      };
    }
    
    statistics.dailyStats[today][type]++;
    this.set('statistics', statistics);
  }
}

module.exports = Store;
