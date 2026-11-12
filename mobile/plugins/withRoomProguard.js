// Release APKs are minified with R8. expo-notifications pulls in WorkManager,
// whose Room database (WorkDatabase_Impl) is created by reflection. R8 strips
// its no-arg constructor, so the app crashes on launch with
// "Failed to create an instance of class androidx.work.impl.WorkDatabase".
// This plugin appends keep rules to android/app/proguard-rules.pro at prebuild.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# hara: keep Room databases';
const RULES = `
${MARKER} (WorkManager WorkDatabase_Impl is created via reflection)
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }
`;

module.exports = function withRoomProguard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes(MARKER)) {
        fs.writeFileSync(file, current + RULES);
      }
      return cfg;
    },
  ]);
};
