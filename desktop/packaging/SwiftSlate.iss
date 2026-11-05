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
SetupIconFile=SwiftSlate.ico
DisableWelcomePage=no
WizardStyle=modern dynamic windows11 includetitlebar
WizardImageFile=wizard\SwiftSlate-Wizard-Light.png
WizardImageFileDynamicDark=wizard\SwiftSlate-Wizard-Dark.png
WizardSmallImageFile=..\ui\src\assets\swiftslate-logo.png
WizardSmallImageFileDynamicDark=..\ui\src\assets\swiftslate-logo.png
WizardImageBackColor=#f7f5fb
WizardImageBackColorDynamicDark=#09090d
WizardSmallImageBackColor=#f7f5fb
WizardSmallImageBackColorDynamicDark=#09090d
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

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft Edge WebView2 Runtime…"; Flags: runhidden waituntilterminated; Check: ShouldInstallWebView2
Filename: "{app}\{#MyAppExeName}"; Description: "Launch SwiftSlate"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM SwiftSlate.exe /F"; Flags: runhidden; RunOnceId: "StopSwiftSlate"

[Code]
var
  WebView2Required: Boolean;
  BrandPage: TWizardPage;

procedure AddBrandFeature(Page: TWizardPage; Top: Integer; const Heading, Detail: String);
var
  HeadingLabel: TNewStaticText;
  DetailLabel: TNewStaticText;
begin
  HeadingLabel := TNewStaticText.Create(Page);
  HeadingLabel.Parent := Page.Surface;
  HeadingLabel.Left := 0;
  HeadingLabel.Top := ScaleY(Top);
  HeadingLabel.Width := Page.SurfaceWidth;
  HeadingLabel.Height := ScaleY(18);
  HeadingLabel.AutoSize := False;
  HeadingLabel.Caption := Heading;
  HeadingLabel.Font.Style := [fsBold];

  DetailLabel := TNewStaticText.Create(Page);
  DetailLabel.Parent := Page.Surface;
  DetailLabel.Left := ScaleX(22);
  DetailLabel.Top := ScaleY(Top + 22);
  DetailLabel.Width := Page.SurfaceWidth - ScaleX(22);
  DetailLabel.Height := ScaleY(34);
  DetailLabel.AutoSize := False;
  DetailLabel.WordWrap := True;
  DetailLabel.Caption := Detail;
end;

procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel1.Caption := 'Welcome to SwiftSlate';
  WizardForm.WelcomeLabel2.Caption :=
    'A lightweight, system-wide writing assistant for Windows.' + #13#10 + #13#10 +
    'Setup installs SwiftSlate for your Windows account and keeps the dashboard available only when you open it.';
  WizardForm.FinishedHeadingLabel.Caption := 'SwiftSlate is ready';
  WizardForm.FinishedLabel.Caption :=
    'Launch SwiftSlate to finish provider setup, then type an inline command such as .fix in any supported Windows app.';

  BrandPage := CreateCustomPage(
    wpWelcome,
    'Designed to stay out of your way',
    'Local-first behavior, protected credentials, and a lightweight background engine.'
  );
  AddBrandFeature(
    BrandPage,
    20,
    'SYSTEM-WIDE INLINE COMMANDS',
    'Transform selected text directly in the Windows app where you are already writing.'
  );
  AddBrandFeature(
    BrandPage,
    92,
    'PROTECTED PROVIDER KEYS',
    'Remote-provider credentials are encrypted for the current Windows user with DPAPI.'
  );
  AddBrandFeature(
    BrandPage,
    164,
    'ON-DEMAND SETTINGS',
    'The WebView2 dashboard closes completely when you return to the tray, keeping idle overhead low.'
  );
end;

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
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM SwiftSlate.exe /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    { The application owns this preference; Setup must not create or reset it on upgrade. }
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'SwiftSlate');
  end;
end;
