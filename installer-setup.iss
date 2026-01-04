; Inno Setup Script for Complaints System v2.1
; Tamir Facilities Management
; Organized structure with logical folders for better maintenance


[Setup]
; Basic application information
AppId={{A5B8C9D7-E6F4-4A3B-9C8D-7E6F5A4B3C2D}}
AppName=Complaints System
AppVersion=2.1.0
AppVerName=Complaints System
AppPublisher=التعمير لإدارة المرافق
AppPublisherURL=
AppSupportURL=
AppUpdatesURL=
AppContact=Tammer_facility@mhud.gov.eg
AppCopyright=Copyright (C) 2025 التعمير لإدارة المرافق | Developed by IT-M
AppComments=نظام متكامل لإدارة ومتابعة شكاوى العملاء - تطوير IT-M
VersionInfoVersion=2.1.0
VersionInfoCompany=التعمير لإدارة المرافق
VersionInfoDescription=Complaints System
VersionInfoProductName=Complaints System
VersionInfoProductVersion=2.1.0
DefaultDirName={autopf}\ComplaintsSystem
DefaultGroupName=Complaints System
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
OutputDir=dist\installer
OutputBaseFilename=ComplaintsSystem-Setup-v2.1.0
SetupIconFile=C:\Users\VIP\Desktop\complaints-system\icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible

; Language and interface
ShowLanguageDialog=no
LanguageDetectionMethod=none

; Installation options
DisableProgramGroupPage=yes
DisableWelcomePage=no
DisableFinishedPage=no

; Additional settings - v2.1
UninstallDisplayIcon={app}\منظومة الشكاوى.exe
UninstallDisplayName=Complaints System

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
; Copy all application files - organized structure v2.1
Source: "C:\Users\VIP\Desktop\complaints-system\dist\منظومة الشكاوى-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start menu shortcut
Name: "{group}\Complaints System"; Filename: "{app}\منظومة الشكاوى.exe"; IconFilename: "C:\Users\VIP\Desktop\complaints-system\icon.ico"
Name: "{group}\Uninstall Complaints System"; Filename: "{uninstallexe}"

; Desktop shortcut
Name: "{autodesktop}\Complaints System"; Filename: "{app}\منظومة الشكاوى.exe"; IconFilename: "C:\Users\VIP\Desktop\complaints-system\icon.ico"; Tasks: desktopicon

[Run]
; Run application after installation - v2.1 improved
Filename: "{app}\منظومة الشكاوى.exe"; Description: "Launch Complaints System"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Delete remaining files on uninstall
Type: filesandordirs; Name: "{app}"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  if (GetWindowsVersion < $06010000) then // Windows 7 or newer
  begin
    MsgBox('This application requires Windows 7 or newer.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if MsgBox('Are you sure you want to uninstall the Complaints System?' + #13#10 + 
            'All saved data will be deleted.', 
            mbConfirmation, MB_YESNO) = IDNO then
    Result := False;
end;