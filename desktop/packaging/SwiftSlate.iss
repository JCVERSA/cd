#define MyAppName "SwiftSlate"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "JCVERSA"
#define MyAppExeName "SwiftSlate.exe"

[Setup]
AppId={{D926BB2A-4752-4DC1-9224-F6C5B021796E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\SwiftSlate
DefaultGroupName=SwiftSlate
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=SwiftSlate-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
CloseApplicationsFilter=SwiftSlate.exe
UninstallDisplayIcon={app}\SwiftSlate.exe
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=SwiftSlate installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\build\SwiftSlate\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: ShouldInstallWebView2

[Icons]
Name: "{group}\SwiftSlate"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\SwiftSlate"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: none; ValueName: "SwiftSlate"; Flags: uninsdeletevalue

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime…"; Flags: runhidden waituntilterminated; Check: ShouldInstallWebView2
Filename: "{app}\{#MyAppExeName}"; Description: "Launch SwiftSlate"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /IM SwiftSlate.exe /F >NUL 2>&1"; Flags: runhidden; RunOnceId: "StopSwiftSlate"

[Code]
var
  WebView2Required: Boolean;

function EdgeUpdateContainsWebView2(RootKey: Integer; const BaseKey: String): Boolean;
var
  Names: TArrayOfString;
  Index: Integer;
  ProductName: String;
  Version: String;
begin
  Result := False;
  if not RegGetSubkeyNames(RootKey, BaseKey, Names) then
    exit;

  for Index := 0 to GetArrayLength(Names) - 1 do
  begin
    ProductName := '';
    Version := '';
    RegQueryStringValue(RootKey, BaseKey + '\\' + Names[Index], 'name', ProductName);
    RegQueryStringValue(RootKey, BaseKey + '\\' + Names[Index], 'pv', Version);
    if (Pos('webview2 runtime', Lowercase(ProductName)) > 0) and (Version <> '') and (Version <> '0.0.0.0') then
    begin
      Result := True;
      exit;
    end;
  end;
end;

function IsWebView2Installed: Boolean;
begin
  Result :=
    EdgeUpdateContainsWebView2(HKLM32, 'Software\Microsoft\EdgeUpdate\Clients') or
    EdgeUpdateContainsWebView2(HKCU32, 'Software\Microsoft\EdgeUpdate\Clients') or
    EdgeUpdateContainsWebView2(HKLM64, 'Software\Microsoft\EdgeUpdate\Clients') or
    EdgeUpdateContainsWebView2(HKCU64, 'Software\Microsoft\EdgeUpdate\Clients');
end;

function ShouldInstallWebView2: Boolean;
begin
  Result := WebView2Required;
end;

function InitializeSetup: Boolean;
begin
  WebView2Required := not IsWebView2Installed;
  Result := True;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  { Stop a tray-resident previous version so one-directory files can be replaced. }
  Exec(ExpandConstant('{cmd}'), '/C taskkill /IM SwiftSlate.exe /F >NUL 2>&1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
