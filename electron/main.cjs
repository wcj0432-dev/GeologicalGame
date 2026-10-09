const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
function createWindow() {
  const window = new BrowserWindow({width:1440,height:1000,minWidth:800,minHeight:650,backgroundColor:'#0c191e',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(({url}) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',(event,url)=>{
    if(url !== window.webContents.getURL()) event.preventDefault();
  });
  window.loadFile(path.join(__dirname,'../dist/index.html'));
}
app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
