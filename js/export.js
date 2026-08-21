"use strict";
/* ASCEND export.js — Export/Import von State als JSON für Backups und Restore */

function exportState(){
  const data = {
    exported: new Date().toISOString(),
    appVersion: APP_STATE_VERSION,
    state: S
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ascend-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("✅ Daten exportiert: ascend-backup-" + todayKey() + ".json");
}

function importState(){
  $("importFile").click();
}

$("importFile").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data.state || typeof data.state !== "object"){
      toast("❌ Ungültige Datei — kein gültiger State gefunden.");
      return;
    }
    const ok = await customConfirm(
      "Stand wirklich wiederherstellen?\n\n" +
      "Exportiert: " + (data.exported ? new Date(data.exported).toLocaleDateString("de-DE") : "unbekannt") + "\n" +
      "App-Version: " + (data.appVersion || "?") + "\n\n" +
      "Der aktuelle Stand wird überschrieben.",
      {title:"Importieren?", okLabel:"Ja, wiederherstellen", danger:true}
    );
    if(!ok) return;
    backupLocalState();
    S = Object.assign(defaultState(), data.state);
    S.updatedAt = Date.now();
    S.wipeAt = 0;
    S.appVersion = APP_STATE_VERSION;
    save();
    renderAll();
    checkBadges();
    cloudSave(true);
    toast("✅ Stand wiederhergestellt.");
  } catch(err){
    toast("❌ Fehler beim Import: " + String(err).slice(0,50));
  }
  $("importFile").value = "";
});

$("exportBtn").addEventListener("click", exportState);
$("importBtn").addEventListener("click", importState);
