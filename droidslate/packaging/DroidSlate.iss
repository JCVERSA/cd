#define MyAppName "DroidSlate"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "JCVERSA"
#define MyAppExeName "DroidSlate.exe"

[Setup]
AppId={{7C4A1E62-93B5-4D8E-A1F0-2E6D84B7C9A1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\DroidSlate
DefaultGroupName=DroidSlate
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=DroidSlate-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
SetupIconFile=DroidSlate.ico
DisableWelcomePage=no
WizardStyle=modern
WizardSmallImageFile=..\ui\public\droidslate-logo.png
WizardSmallImageBackColor=#0d1117
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
CloseApplicationsFilter=DroidSlate.exe
UninstallDisplayIcon={app}\DroidSlate.exe
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=DroidSlate installer
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\build\DroidSlate\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: ShouldInstallWebView2

[Icons]
Name: "{group}\DroidSlate"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\DroidSlate"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime…"; Flags: runhidden waituntilterminated; Check: ShouldInstallWebView2
Filename: "{app}\{#MyAppExeName}"; Description: "Launch DroidSlate"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM DroidSlate.exe /F"; Flags: runhidden; RunOnceId: "StopDroidSlate"

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
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM DroidSlate.exe /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
