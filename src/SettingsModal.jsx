import { useMemo, useState } from 'react';
import {
  X,
  Monitor,
  Layout,
  Maximize2,
  Link,
  Activity,
  Bell,
  Globe,
  Info,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { THEMES, CHART_TYPES, LAYOUTS, CARD_SIZES, PROVIDER_OPTIONS, GREEK_SYMBOLS } from './themes';
import {
  buildSettingsProfileFilename,
  buildSettingsProfileImportState,
  normalizePersistedSettings,
  serializeSettingsProfile,
  summarizeSettingsProfile,
} from './settingsPersistence';

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const [profileMessage, setProfileMessage] = useState(null);
  const importState = useMemo(() => buildSettingsProfileImportState(importText), [importText]);
  const importPreview = importState.preview;

  if (!isOpen) return null;

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'profile', label: 'Profile', icon: Download },
    { id: 'layout', label: 'Layout', icon: Layout },
    { id: 'cards', label: 'Cards', icon: Maximize2 },
    { id: 'providers', label: 'Providers', icon: Globe },
    { id: 'integrations', label: 'Integrations', icon: Link },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'tutorial', label: 'Tutorial', icon: Info },
  ];

  const updateSetting = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const updateProfileMessage = (type, text) => {
    setProfileMessage({ type, text });
  };

  const exportProfile = () => {
    setExportText(serializeSettingsProfile(settings));
    updateProfileMessage('success', 'Profile JSON is ready to copy.');
  };

  const downloadProfile = () => {
    const profileJson = serializeSettingsProfile(settings);
    const blob = new Blob([profileJson], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', buildSettingsProfileFilename(settings));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportText(profileJson);
    updateProfileMessage('success', 'Profile JSON downloaded and mirrored below.');
  };

  const importProfile = () => {
    if (!importState.canApply) {
      updateProfileMessage('error', importPreview?.error || 'Paste a valid profile JSON before applying.');
      return;
    }

    onSettingsChange(importPreview.settings);
    updateProfileMessage('success', 'Profile imported into the active dashboard.');
  };

  const resetProfile = () => {
    const resetSettings = normalizePersistedSettings({});
    onSettingsChange(resetSettings);
    setImportText('');
    setExportText(serializeSettingsProfile(resetSettings));
    updateProfileMessage('success', 'Profile reset to default operator settings.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-dark-800 rounded-2xl shadow-2xl w-[90vw] max-w-5xl max-h-[85vh] flex overflow-hidden border border-dark-600"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* Sidebar */}
        <div className="w-48 bg-dark-900/50 p-3 border-r border-dark-600">
          <h2 className="text-lg font-bold text-white mb-4 px-2">Settings</h2>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-dark-700 text-accent-cyan'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                }`}
                style={{ color: activeTab === tab.id ? 'var(--color-accent)' : undefined }}
              >
                <tab.icon size={16} />
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Appearance</h3>
              
              {/* Theme */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Color Theme</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(THEMES).map(([key, theme]) => (
                    <button
                      key={key}
                      onClick={() => updateSetting('theme', key)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        settings.theme === key
                          ? 'border-accent-cyan bg-dark-700'
                          : 'border-dark-600 hover:border-dark-500'
                      }`}
                      style={{ 
                        borderColor: settings.theme === key ? 'var(--color-accent)' : undefined 
                      }}
                    >
                      <div className="flex gap-1 mb-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.background }} />
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.accent }} />
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.accentGreen }} />
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: theme.accentRed }} />
                      </div>
                      <span className="text-sm text-white">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Chart Type</label>
                <div className="flex gap-2">
                  {Object.entries(CHART_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => updateSetting('chartType', value)}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        settings.chartType === value
                          ? 'border-accent-cyan bg-dark-700 text-white'
                          : 'border-dark-600 text-gray-400 hover:text-white'
                      }`}
                      style={{ 
                        borderColor: settings.chartType === value ? 'var(--color-accent)' : undefined 
                      }}
                    >
                      {key.charAt(0) + key.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white">Operator Profile</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Move dashboard controls, theme, providers, integrations, and alert preferences between sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {summarizeSettingsProfile(settings).map(({ label, value, detail }) => (
                  <div key={label} className="rounded-lg border border-dark-600 bg-dark-900/50 p-4">
                    <p className="text-xs uppercase text-gray-500">{label}</p>
                    <p className="mt-2 min-h-[1.5rem] font-mono text-sm text-white">{value}</p>
                    <p className="mt-1 min-h-[1.25rem] text-xs text-gray-500">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportProfile}
                  className="flex items-center gap-2 rounded-lg bg-dark-700 px-3 py-2 text-sm text-white hover:bg-dark-600"
                >
                  <Download size={16} />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={downloadProfile}
                  className="flex items-center gap-2 rounded-lg bg-dark-700 px-3 py-2 text-sm text-white hover:bg-dark-600"
                >
                  <Download size={16} />
                  Download File
                </button>
                <button
                  type="button"
                  onClick={importProfile}
                  disabled={!importState.canApply}
                  className="flex items-center gap-2 rounded-lg bg-accent-cyan/20 px-3 py-2 text-sm text-accent-cyan hover:bg-accent-cyan/30 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <Upload size={16} />
                  Apply Import
                </button>
                <button
                  type="button"
                  onClick={resetProfile}
                  className="flex items-center gap-2 rounded-lg bg-dark-900 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700 hover:text-white"
                >
                  <RotateCcw size={16} />
                  Reset Defaults
                </button>
              </div>

              {profileMessage && (
                <div
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    profileMessage.type === 'error'
                      ? 'border-red-500/30 bg-red-500/10 text-red-200'
                      : 'border-green-500/30 bg-green-500/10 text-green-200'
                  }`}
                >
                  {profileMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-gray-400">Exported profile JSON</span>
                  <textarea
                    readOnly
                    value={exportText}
                    placeholder="Click Export JSON to generate a portable profile."
                    className="h-64 w-full resize-none rounded-lg border border-dark-600 bg-dark-900 p-3 font-mono text-xs text-gray-200 outline-none"
                  />
                </label>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-sm text-gray-400">Import profile JSON</span>
                    <textarea
                      value={importText}
                      onChange={(event) => setImportText(event.target.value)}
                      placeholder='Paste {"settings": {...}} or a raw settings object.'
                      className="h-64 w-full resize-none rounded-lg border border-dark-600 bg-dark-900 p-3 font-mono text-xs text-gray-200 outline-none focus:border-accent-cyan"
                    />
                  </label>

                  {importPreview && (
                    importPreview.ok ? (
                      <div className="rounded-lg border border-dark-600 bg-dark-900/60 p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                          <CheckCircle size={15} className="text-green-400" />
                          Import Preview
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {importPreview.summary.map(({ label, value, detail }) => (
                            <div key={label} className="rounded border border-dark-700 bg-dark-800/70 p-2">
                              <p className="text-[11px] uppercase text-gray-500">{label}</p>
                              <p className="mt-1 font-mono text-xs text-white">{value}</p>
                              <p className="mt-1 text-[11px] text-gray-500">{detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                        <AlertTriangle size={16} />
                        <span>{importPreview.error}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === 'layout' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Layout</h3>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Layout Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(LAYOUTS).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => updateSetting('layout', value)}
                      className={`p-4 rounded-lg border transition-all ${
                        settings.layout === value
                          ? 'border-accent-cyan bg-dark-700'
                          : 'border-dark-600 hover:border-dark-500'
                      }`}
                      style={{ 
                        borderColor: settings.layout === value ? 'var(--color-accent)' : undefined 
                      }}
                    >
                      <Layout size={24} className="mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
                      <span className="text-sm text-white">{key}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cards Tab */}
          {activeTab === 'cards' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Card Size</h3>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Default Card Size</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(CARD_SIZES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => updateSetting('cardSize', value)}
                      className={`p-4 rounded-lg border transition-all ${
                        settings.cardSize === value
                          ? 'border-accent-cyan bg-dark-700'
                          : 'border-dark-600 hover:border-dark-500'
                      }`}
                      style={{ 
                        borderColor: settings.cardSize === value ? 'var(--color-accent)' : undefined 
                      }}
                    >
                      <Maximize2 size={24} className="mx-auto mb-2" style={{ color: 'var(--color-accent)' }} />
                      <span className="text-sm text-white">{key.toLowerCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resize Hint */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <p className="text-sm text-gray-300">
                  <strong>Tip:</strong> Cards can be resized by dragging the bottom-right corner.
                  Similar to Windows folder resizing in Sentinel Edge.
                </p>
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Data Providers</h3>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Provider</label>
                <div className="space-y-2">
                  {PROVIDER_OPTIONS.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      disabled={!provider.runnable}
                      onClick={() => {
                        if (provider.runnable) updateSetting('provider', provider.id);
                      }}
                      className={`w-full p-3 rounded-lg border transition-all text-left ${
                        settings.provider === provider.id
                          ? 'border-accent-cyan bg-dark-700'
                          : 'border-dark-600 hover:border-dark-500'
                      } ${provider.runnable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
                      style={{ 
                        borderColor: settings.provider === provider.id ? 'var(--color-accent)' : undefined
                      }}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-white">{provider.label}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            provider.runnable
                              ? 'bg-accent-green/20 text-accent-green'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}
                        >
                          {provider.badge}
                        </span>
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-gray-400">
                        {provider.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Input */}
              {(settings.provider === 'polygon' || settings.provider === 'intrinio') && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {settings.provider.toUpperCase()} API Key
                  </label>
                  <input
                    type="password"
                    value={settings[`${settings.provider}ApiKey`] || ''}
                    onChange={(e) => updateSetting(`${settings.provider}ApiKey`, e.target.value)}
                    className="w-full p-3 rounded-lg bg-dark-900 border border-dark-600 text-white focus:border-accent-cyan outline-none"
                    placeholder={`Enter ${settings.provider.toUpperCase()} API key...`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Integrations</h3>
              
              {/* Grafana URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Link size={14} className="inline mr-1" />
                  Grafana Dashboard URL
                </label>
                <input
                  type="url"
                  value={settings.grafanaUrl || ''}
                  onChange={(e) => updateSetting('grafanaUrl', e.target.value)}
                  className="w-full p-3 rounded-lg bg-dark-900 border border-dark-600 text-white focus:border-accent-cyan outline-none"
                  placeholder="https://your-grafana-instance.com/d/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link your Grafana dashboard for external monitoring
                </p>
              </div>

              {/* Plotly URL */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Activity size={14} className="inline mr-1" />
                  Plotly Server URL
                </label>
                <input
                  type="url"
                  value={settings.plotlyUrl || ''}
                  onChange={(e) => updateSetting('plotlyUrl', e.target.value)}
                  className="w-full p-3 rounded-lg bg-dark-900 border border-dark-600 text-white focus:border-accent-cyan outline-none"
                  placeholder="https://your-plotly-server.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Plotly chart server for advanced visualizations
                </p>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Notifications</h3>
              
              {/* Sound */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <div>
                  <span className="text-white">Sound Alerts</span>
                  <p className="text-xs text-gray-400">Play sound on whale trades</p>
                </div>
                <button
                  onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    settings.soundEnabled ? 'bg-accent-cyan' : 'bg-dark-600'
                  }`}
                  style={{ 
                    backgroundColor: settings.soundEnabled ? 'var(--color-accent)' : undefined 
                  }}
                >
                  <div 
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} 
                  />
                </button>
              </div>

              {/* Desktop */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <div>
                  <span className="text-white">Desktop Notifications</span>
                  <p className="text-xs text-gray-400">Browser push notifications</p>
                </div>
                <button
                  onClick={() => updateSetting('desktopAlerts', !settings.desktopAlerts)}
                  className={`w-12 h-6 rounded-full transition-all ${
                    settings.desktopAlerts ? 'bg-accent-cyan' : 'bg-dark-600'
                  }`}
                  style={{ 
                    backgroundColor: settings.desktopAlerts ? 'var(--color-accent)' : undefined 
                  }}
                >
                  <div 
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.desktopAlerts ? 'translate-x-6' : 'translate-x-0.5'
                    }`} 
                  />
                </button>
              </div>

              {/* Discord Webhook */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Discord Webhook URL</label>
                <input
                  type="url"
                  value={settings.discordWebhook || ''}
                  onChange={(e) => updateSetting('discordWebhook', e.target.value)}
                  className="w-full p-3 rounded-lg bg-dark-900 border border-dark-600 text-white focus:border-accent-cyan outline-none"
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </div>
            </div>
          )}

          {/* Tutorial Tab */}
          {activeTab === 'tutorial' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">Tutorial & Setup Guide</h3>
              
              {/* API Setup */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">Quick Start</h4>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2">
                  <li>Open the app - data generates automatically</li>
                  <li>Adjust whale threshold slider (10K-200K shares)</li>
                  <li>Click a stock card to view detailed charts</li>
                  <li>Set up alerts in Settings / Alerts</li>
                </ol>
              </div>

              {/* Grafana */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">
                  Connect Grafana
                </h4>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2">
                  <li>Install Infinity plugin: <code className="bg-dark-800 px-1 rounded">grafana-cli plugins install yesoreyeram-infinity-datasource</code></li>
                  <li>Add Data Source / Infinity</li>
                  <li>URL: <code className="bg-dark-800 px-1 rounded">http://localhost:8000/grafana/table?symbol=AAPL</code></li>
                  <li>Parse with UQL: <code className="bg-dark-800 px-1 rounded">parse-json</code></li>
                </ol>
              </div>

              {/* Plotly */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">
                  Connect Plotly
                </h4>
                <p className="text-sm text-gray-300 mb-2">
                  Use Plotly JSON from these endpoints:
                </p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>Area Chart: <code className="bg-dark-800 px-1 rounded">/visualization/area?symbol=AAPL</code></li>
                  <li>Bar Chart: <code className="bg-dark-800 px-1 rounded">/visualization/bar?symbol=AAPL</code></li>
                  <li>Combined: <code className="bg-dark-800 px-1 rounded">/visualization/combined?symbol=AAPL</code></li>
                </ul>
              </div>

              {/* Discord Bot */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">
                  Discord Slash Commands
                </h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li><code className="bg-dark-800 px-1 rounded">/darkpool symbol:AAPL tier:T1</code> - Get darkpool data</li>
                  <li><code className="bg-dark-800 px-1 rounded">/setalert symbol:NVDA threshold:100000</code> - Set whale alert</li>
                  <li><code className="bg-dark-800 px-1 rounded">/alertstatus</code> - Show active alerts</li>
                </ul>
              </div>

              {/* Images Placeholder */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">Interface Guide</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div className="p-2 bg-dark-800 rounded">
                    <div className="text-accent-cyan mb-1">Stock Cards</div>
                    <p>Click to select, shows price/volume</p>
                  </div>
                  <div className="p-2 bg-dark-800 rounded">
                    <div className="text-accent-yellow mb-1">Whale Slider</div>
                    <p>Adjusts threshold (10K-200K)</p>
                  </div>
                  <div className="p-2 bg-dark-800 rounded">
                    <div className="text-accent-green mb-1">Buy (Green)</div>
                    <p>Long positions, buying pressure</p>
                  </div>
                  <div className="p-2 bg-dark-800 rounded">
                    <div className="text-accent-red mb-1">Sell (Red)</div>
                    <p>Short positions, selling pressure</p>
                  </div>
                </div>
              </div>

              {/* Greek Letters */}
              <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <h4 className="text-lg font-semibold text-white mb-2">
                  Options Greeks
                </h4>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {Object.entries(GREEK_SYMBOLS).map(([key, symbol]) => (
                    <div key={key} className="p-2 bg-dark-800 rounded">
                      <span 
                        className="text-2xl font-bold"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {symbol}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
