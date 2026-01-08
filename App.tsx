
import React, { useState, useEffect, useRef } from 'react';
import { api, socket } from './services/api';
import { AppState, LogEntry, WeaponTier } from './types';
import { WEAPONS, FLAVOR_TEXT } from './constants';

const LEVEL_TITLES = [
  "Initiate", "Sweat Apprentice", "Iron Enthusiast", "Certified Lifter", "Muscle Adept",
  "Anvil Botherer", "Forge Regular", "Respectably Swole", "Hammer-Sworn", "Paragon of Gains",
  "Heavy Hitter", "Iron Disciple", "Kettlebell Cavalier", "Steelbound Striker", "Anvil Knight",
  "Plate Smasher", "Barbarian of Bench", "Squat Sergeant", "Deadlift Duke", "Titan of Tenacity",
  "Gritty Gladiator", "Stone-Cold Crusher", "Boulder-Shouldered Baron", "Iron-Willed Warden", "Champion of Chalk",
  "Master of Mass", "Grandmaster of Gravity", "Sovereign of Sweat", "Lord of the Lift", "Apex Athlete",
  "Mythic Muscle", "Colossal Commander", "Behemoth of Brawn", "Dreadnought of Discipline", "Unstoppable Force",
  "Immovable Object", "Titan of Treadmill", "Archon of Iron", "High Priest of Pump", "Demigod of Definition",
  "Celestial Crusher", "Cosmic Contender", "Astral Athlete", "Eternal Exerciser", "God-King of Gains",
  "Forge-Born Deity", "Transcendent Trainer", "Ascended Avenger", "Multiversal Muscle", "The Living Anvil"
];

const getLevelTitle = (level: number) => {
  if (level > 50) return "Immortal of the Iron";
  return LEVEL_TITLES[level - 1] || "Iron Bound";
};

// --- Constants / Components ---

const KragCommandments: React.FC<{ onClose?: () => void; noMargin?: boolean }> = ({ onClose, noMargin }) => {
  return (
    <div className={`rpg-card p-6 md:p-8 ${noMargin ? '' : 'mt-12'} border-double border-4 border-[#5c5346] max-w-3xl mx-auto overflow-hidden shadow-2xl relative`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-3 md:top-4 md:right-6 text-[#5c5346] text-4xl md:text-5xl hover:text-[#8b0000] transition-colors leading-none font-bold p-2 z-20 opacity-40 hover:opacity-100"
          aria-label="Close Commandments"
        >
          ×
        </button>
      )}
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest mb-8 border-b-2 border-[#5c5346] pb-2 text-center">Krag’s Commandments</h2>
      <ul className="space-y-4 text-sm md:text-base italic font-medium leading-relaxed opacity-90 max-w-xl mx-auto">
        <li className="flex gap-4"><span>⚔️</span> "Roll the d20! Your weapon’s modifier (+0, +1, etc.) adds directly to your raw effort."</li>
        <li className="flex gap-4"><span>📜</span> "The Effective Roll determines Hit Quality: Glancing (2-5), Solid (6-10), Strong (11-15), or Critical (16-19)."</li>
        <li className="flex gap-4"><span>🐉</span> "An Effective 20 is an AUTO-KILL. The beast falls instantly. Victory is yours."</li>
        <li className="flex gap-4"><span>⚡</span> "Damage scales with Level. Higher power allows you to roll more dice (ceil of level / 2) on every strike."</li>
        <li className="flex gap-4"><span>💎</span> "When a foe falls, the one with the highest total D20 rolls (The Fair Sweat Rule) claims the loot."</li>
        <li className="flex gap-4"><span>⚠️</span> "A Natural 1 on the d20 is a Fumble. You deal no damage and are cursed (no loot) for that battle."</li>
        <li className="flex gap-4 font-black uppercase tracking-tighter not-italic mt-6 text-[#3a352f] justify-center text-lg md:text-xl border-t border-[#5c5346]/10 pt-4 text-center">"Now back to work."</li>
      </ul>
    </div>
  );
};

const EnemyDisplay: React.FC<{ enemy: any }> = ({ enemy }) => {
  const hpPercent = (enemy.hp / enemy.maxHp) * 100;
  return (
    <div className="text-center mb-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Active Bounty</div>
      <div className="h-px bg-[#5c5346]/20 w-16 mx-auto mb-6" />
      <div className="rpg-card dashed-card p-6 md:p-8 text-left bg-[#fdf6e3]/50">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 leading-none">{enemy.name}</h2>
            <p className="italic opacity-70 text-lg leading-snug">{enemy.description}</p>
          </div>
          <div className="ml-4">
            <div className="strength-box text-center bg-white/50 border-2 border-[#5c5346]/20">
              <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Protection</div>
              <div className="text-3xl font-bold pencil-font">{enemy.ac}</div>
            </div>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-[10px] items-end font-bold uppercase opacity-60">
          <span className="tracking-widest">Vitality</span>
          <span className="pencil-font text-xs uppercase tracking-tighter">{Math.ceil(enemy.hp)} / {enemy.maxHp} HP</span>
        </div>
        <div className="h-5 bg-black/5 border border-[#5c5346]/30 mb-8 relative overflow-hidden rounded-sm">
          <div
            className="absolute top-0 left-0 h-full bg-[#8b0000] opacity-90 transition-all duration-1000 ease-out"
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center border-t border-[#5c5346]/20 pt-4 text-[10px] font-bold uppercase tracking-widest">
          <span className="opacity-40">Victory Bounty:</span>
          <span>Tier {enemy.weaponDropTier} – {WEAPONS[enemy.weaponDropTier as WeaponTier]?.name}</span>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  // State - LIVE MODE
  const [view, setView] = useState<'landing' | 'create' | 'select_campaign' | 'select_hero' | 'game'>('landing');
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Form State
  const [createForm, setCreateForm] = useState({
    weeks: 4,
    workoutsPerWeek: 3,
    participantsText: ""
  });

  // Game UI State
  const [activeTab, setActiveTab] = useState<'battle' | 'party'>('battle');
  const [showRules, setShowRules] = useState(false);
  const [activeRoll, setActiveRoll] = useState<any>(null);
  const [showEnlist, setShowEnlist] = useState(false);
  const [showForgeAhead, setShowForgeAhead] = useState(false);
  const [enlistName, setEnlistName] = useState("");
  const [victoryData, setVictoryData] = useState<any>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);

  // --- Effects ---

  // Initialization
  useEffect(() => {
    const storedCamId = localStorage.getItem('forge_campaign_id');

    const init = async () => {
      setLoading(true);
      try {
        // If we have a stored ID, try to load it
        if (storedCamId) {
          const c = await api.getCampaign(storedCamId);
          setCampaign(c);
          setView('game');
        } else {
          // If no stored ID, see if any campaigns exist in the realm
          const list = await api.getAllCampaigns();
          setCampaignsList(list);

          if (list.length > 0) {
            // Found a quest! Join the first one immediately
            const first = await api.getCampaign(list[0].id);
            setCampaign(first);
            localStorage.setItem('forge_campaign_id', first.id);
            setView('game');
          } else {
            // Realm is empty, need to forge a new one
            setView('create');
          }
        }
      } catch (e) {
        console.error("Initialization failed", e);
        localStorage.clear();
        setView('landing');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Socket Connection
  useEffect(() => {
    if (campaign?.id) {
      socket.connect();
      socket.emit('joinCampaign', campaign.id);
      socket.on('gamestate_update', setCampaign);
      return () => {
        socket.off('gamestate_update');
        socket.disconnect();
      };
    }
  }, [campaign?.id]);

  // --- Handlers ---

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const names = createForm.participantsText.split(',').map(n => n.trim()).filter(Boolean);
      if (names.length === 0) throw { error: "At least one hero is required." };

      const config = {
        totalWeeks: createForm.weeks,
        workoutsPerWeek: createForm.workoutsPerWeek,
        numParticipants: names.length
      };

      console.log("[FRONTEND] Sending createCampaign request...");
      // Empty string for name, backend will default to "The Gjallar Forge"
      const newCampaign = await api.createCampaign("", config, names);
      console.log("[FRONTEND] Campaign created successfully:", newCampaign.id);
      setCampaign(newCampaign);
      localStorage.setItem('forge_campaign_id', newCampaign.id);
      setView('game');
    } catch (err: any) {
      console.error("Create failed", err);
      setError(err.error || err.message || "Failed to forge quest. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampaign = async (cId: string) => {
    setLoading(true);
    try {
      const c = await api.getCampaign(cId);
      setCampaign(c);
      localStorage.setItem('forge_campaign_id', c.id);
      setView('game');
    } catch (e) {
      setError("This quest has faded from memory.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHero = (pId: string) => {
    localStorage.setItem('forge_campaign_id', campaign.id);
    localStorage.setItem('forge_participant_id', pId);
    setView('game');
  };

  const handleAction = async (type: 'attack', participantId: string) => {
    // Clear any existing roll first
    setActiveRoll(null);

    // Phase 1: Calculation (2 Seconds)
    setActiveRoll({ resolving: true, roll: 0, phase: 1 });

    try {
      const startTime = Date.now();
      const res = await api.performAction(campaign.id!, participantId, type);

      // Note: We avoid optimistic campaign state updates here 
      // because the Socket.io 'gamestate_update' broadcast handles 
      // the source of truth and prevents double-incrementing pips.

      // Calculate how long the API took and how much longer we need to wait for the 2s ritual
      const elapsed = Date.now() - startTime;
      const remainingRitualTime = Math.max(0, 2000 - elapsed);

      setTimeout(() => {
        if (res.success) {
          const isCrit = res.roll === 20;
          const isFumble = res.roll === 1;
          const hit = res.damage > 0;
          const participant = campaign.participants.find((p: any) => p.id === participantId);

          let msg = "";
          if (isCrit) msg = FLAVOR_TEXT.crit;
          else if (isFumble) msg = FLAVOR_TEXT.fumble[Math.floor(Math.random() * FLAVOR_TEXT.fumble.length)];
          else if (hit) msg = FLAVOR_TEXT.success[Math.floor(Math.random() * FLAVOR_TEXT.success.length)];
          else msg = FLAVOR_TEXT.failure[Math.floor(Math.random() * FLAVOR_TEXT.failure.length)];

          setActiveRoll({
            pId: participantId,
            roll: res.roll,
            effectiveRoll: res.effectiveRoll,
            quality: res.quality,
            isCrit: res.quality === 'CRITICAL' || res.quality === 'AUTO-KILL',
            isFumble: res.roll === 1,
            hit: res.quality !== 'MISS',
            damage: res.damage,
            resolving: false,
            phase: 2,
            message: msg,
            strength: participant?.level || 0,
            killed: res.killed
          });

          // Phase 3: Auto-fade after 5 seconds
          const fadeTimeout = setTimeout(() => {
            setActiveRoll(current => {
              if (current && current.phase === 2 && current.pId === participantId) {
                if (current.killed) {
                  const currentEnemy = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex);
                  const winnerParticipant = campaign.participants.find((p: any) => p.id === participantId);
                  const winnerName = winnerParticipant?.name || "The Fellowship";

                  setVictoryData({
                    winner: winnerName,
                    winnerLevel: winnerParticipant?.level || 1,
                    bounty: WEAPONS[res.tier as WeaponTier]?.name || "a bounty",
                    weaponTier: res.tier,
                    stats: WEAPONS[res.tier as WeaponTier]?.dice || "??",
                    enemyName: currentEnemy?.name || "The Foe"
                  });
                }
                return null;
              }
              return current;
            });
          }, 5000);
        } else {
          setActiveRoll(null);
        }
      }, remainingRitualTime);

    } catch (err) {
      console.error(err);
      setActiveRoll(null);
    }
  };

  const handleWorkout = async (participantId: string) => {
    try { await api.logWorkout(campaign.id!, participantId); } catch (e) { console.error(e); }
  };

  const handleUndo = async (participantId: string) => {
    if (!campaign?.id) return;
    try {
      await api.undoLastAction(campaign.id, participantId);
    } catch (e: any) {
      console.error(e);
      alert(e.error || "Failed to undo action.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setCampaign(null);
    setView('landing');
  };

  const handleDeleteCampaign = async () => {
    if (!campaign?.id) return;
    try {
      const resp = await api.deleteCampaign(campaign.id);
      if (resp.success) {
        localStorage.clear();
        // Close modal and clear campaign state first
        setShowAbandonModal(false);
        setCampaign(null);
        // Reset creation form
        setCreateForm({
          name: "",
          weeks: 4,
          workoutsPerWeek: 3,
          participantsText: ""
        });
        // Switch view last to ensure clean transition
        setView('create');
        api.getAllCampaigns().then(list => setCampaignsList(list));
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert("The ritual of abandonment failed. The forge remains lit.");
    }
  };

  const handleEnlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enlistName.trim()) return;
    try {
      await api.enlistHero(campaign.id, enlistName.trim());
      const updated = await api.getCampaign(campaign.id);
      setCampaign(updated);
      setShowEnlist(false);
      setEnlistName("");
    } catch (e) {
      console.error("Enlist failed", e);
    }
  };

  const handleForgeAhead = async () => {
    try {
      const updated = await api.forgeAhead(campaign.id);
      setCampaign(updated);
      setShowForgeAhead(false);
    } catch (e) {
      console.error("Forge Ahead failed", e);
    }
  };

  const handleRetireHero = async (participantId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to retire ${name} from the fellowship? Their deeds will be remembered, but they will fight no more.`)) return;
    try {
      await api.retireHero(campaign.id, participantId);
      const updated = await api.getCampaign(campaign.id);
      setCampaign(updated);
    } catch (e) {
      console.error("Retire hero failed", e);
    }
  };

  // Back navigation
  const goBack = () => {
    if (view === 'create' || view === 'select_campaign') setView('landing');
  };

  // --- Renders ---

  if (loading && !campaign) return <div className="flex items-center justify-center min-h-screen animate-pulse text-2xl font-black uppercase tracking-widest">Igniting Forge...</div>;

  // LANDING (Now acts as Campaign List)
  if (view === 'landing') {
    // If no campaigns exist, go straight to create
    if (!loading && campaignsList.length === 0) {
      setView('create');
      return null;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rpg-card p-10 max-w-xl w-full text-center shadow-2xl relative">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">📯 The Gjallar Forge</h1>
          <div className="flex items-center gap-3 mb-10 w-48 mx-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">+1 to Strength</span>
            <div className="h-px bg-[#5c5346]/20 flex-1"></div>
          </div>

          <div className="grid gap-4 max-h-[40vh] overflow-y-auto mb-8 pr-2">
            {loading && <div className="opacity-50 text-xs italic tracking-widest uppercase py-10">Scouting the realm...</div>}
            {campaignsList.map((c: any) => (
              <button
                key={c.id}
                onClick={() => handleSelectCampaign(c.id)}
                className="flex flex-col items-center py-5 button-ink transition-all border border-[#3a352f]"
              >
                <span className="text-lg font-bold uppercase tracking-[0.2em]">{c.name}</span>
                <span className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-40 mt-1">{c._count?.participants || 0} Heroes Active</span>
              </button>
            ))}
          </div>

          <button onClick={() => setView('create')} className="w-full py-4 button-hollow text-sm">
            Forge New Quest
          </button>
        </div>
      </div>
    );
  }



  if (view === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rpg-card p-8 md:p-12 max-w-2xl w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#3a352f]"></div>
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tight">Forge Settings</h2>
              <p className="text-[10px] font-bold uppercase opacity-40 tracking-[0.2em] mt-1">Define the Journey Ahead</p>
            </div>
            <button onClick={goBack} className="text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity">
              Back to Titles
            </button>
          </div>

          {error && (
            <div className="bg-[#8b0000]/5 border-l-4 border-[#8b0000] p-4 mb-8">
              <div className="text-[10px] font-bold text-[#8b0000] uppercase tracking-widest mb-1">Ritual Failed</div>
              <div className="text-sm italic opacity-80">{error}</div>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Journey Length (Weeks)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={52}
                  className="w-full text-2xl py-2 border-b-2 border-[#5c5346]/20 bg-transparent focus:border-[#3a352f] transition-colors pencil-font outline-none"
                  value={createForm.weeks}
                  onChange={e => setCreateForm({ ...createForm, weeks: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Weekly Oaths (Workouts)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={7}
                  className="w-full text-2xl py-2 border-b-2 border-[#5c5346]/20 bg-transparent focus:border-[#3a352f] transition-colors pencil-font outline-none"
                  value={createForm.workoutsPerWeek}
                  onChange={e => setCreateForm({ ...createForm, workoutsPerWeek: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Summon Heroes (Comma Separated)</label>
              <textarea
                required
                className="w-full p-4 border-2 border-[#5c5346]/10 bg-black/5 h-32 pencil-font text-xl outline-none focus:border-[#3a352f]/30 transition-colors"
                value={createForm.participantsText}
                onChange={e => setCreateForm({ ...createForm, participantsText: e.target.value })}
                placeholder="Krag, DM, Velkyn..."
              />
              <p className="text-[9px] opacity-40 uppercase tracking-widest mt-2">The fellowship will be bound to this quest immediately.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 button-ink text-2xl font-black uppercase tracking-[0.3em] hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50"
            >
              Enter the Forge
            </button>
          </form>
        </div>
      </div>
    );
  }



  // GAME
  if (!campaign) return null; // Safety guard during transitions

  const currentEnemy = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex);
  const participants = campaign.participants;
  const config = JSON.parse(campaign.config);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-10 relative">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 pb-2">
        <div className="w-full md:w-auto">
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">📯 The Gjallar Forge</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-40 text-pencil-color">+1 to Strength</span>
            <div className="h-px bg-[#5c5346]/20 flex-1 min-w-[50px]"></div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRules(true)} className="px-4 py-2 button-hollow text-[10px]">Laws</button>
          <button onClick={() => setShowAbandonModal(true)} className="px-4 py-2 button-red-hollow text-[10px]">Abandon</button>
        </div>
      </header>

      <div className="w-full h-1 bg-[#3a352f] mb-8"></div>

      <nav className="flex mb-12 gap-1 bg-[#5c5346]/5 p-0 border border-[#5c5346]/10">
        <button
          onClick={() => setActiveTab('battle')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'battle' ? 'bg-[#3a352f] text-[#fdf6e3]' : 'opacity-40 hover:opacity-100'}`}
        >
          ⚔️ Battle
        </button>
        <button
          onClick={() => setActiveTab('party')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'party' ? 'bg-[#3a352f] text-[#fdf6e3]' : 'opacity-40 hover:opacity-100'}`}
        >
          🏰 The Party
        </button>
      </nav>

      {showAbandonModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-[#8b0000]/20 backdrop-blur-sm">
          <div className="rpg-card p-10 max-w-sm w-full text-center border-4 border-double border-[#8b0000]/40 shadow-2xl relative">
            <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-[#8b0000] mb-4">Final Verdict</div>
            <h3 className="text-3xl font-black uppercase tracking-tight mb-4">Abandon Quest?</h3>
            <p className="text-sm italic opacity-70 mb-10">"Are you sure, Hero? To abandon is to let the forge go cold and the fellowship dissolve into ash."</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteCampaign}
                className="w-full py-4 bg-[#8b0000] text-[#fdf6e3] font-black uppercase tracking-widest text-xs hover:bg-[#a00000] transition-colors"
              >
                Ash the Progress
              </button>
              <button
                onClick={() => setShowAbandonModal(false)}
                className="w-full py-3 button-hollow text-[10px]"
              >
                Stay the Course
              </button>
            </div>
          </div>
        </div>
      )}

      {activeRoll && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="rpg-card p-4 md:p-12 text-center max-w-sm w-full ink-border shadow-2xl relative">
            <button
              onClick={() => setActiveRoll(null)}
              className="absolute top-4 right-4 text-xs font-bold opacity-30 hover:opacity-100 uppercase tracking-widest"
            >
              ×
            </button>

            <div className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 mb-8 mt-2">Hand of Fate</div>

            {activeRoll.phase === 1 ? (
              <div className="animate-in fade-in duration-500">
                <div className="text-9xl mb-12 animate-spin-slow opacity-40 scale-90 grayscale">
                  🎲
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 animate-pulse mb-4">
                  Calculating Destiny...
                </div>
              </div>
            ) : (
              <div className="animate-in zoom-in fade-in duration-500">
                <div className="mb-6 relative flex flex-col items-center">
                  <div className="flex items-center gap-6 mb-8 mt-2">
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">D20</div>
                      <div className="text-4xl font-black">{activeRoll.roll}</div>
                    </div>
                    <div className="text-2xl font-light opacity-30 mt-4">+</div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Weapon</div>
                      <div className="text-4xl font-black">{activeRoll.effectiveRoll - activeRoll.roll >= 0 ? `+${activeRoll.effectiveRoll - activeRoll.roll}` : activeRoll.effectiveRoll - activeRoll.roll}</div>
                    </div>
                    <div className="text-2xl font-light opacity-30 mt-4">=</div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Effective</div>
                      <div className={`text-5xl font-black ${activeRoll.isCrit ? 'text-[#8b0000] animate-pulse' : ''}`}>{activeRoll.effectiveRoll}</div>
                    </div>
                  </div>

                  <div className={`text-4xl font-black uppercase tracking-tighter mb-4 ${activeRoll.hit ? 'text-black' : 'text-[#8b0000] opacity-50'}`}>
                    {activeRoll.quality}
                  </div>

                  {activeRoll.hit && (
                    <div className="flex flex-col items-center">
                      <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">
                        Power Level {activeRoll.strength} • {Math.ceil(activeRoll.strength / 2)} Dice
                      </div>
                      <div className="text-6xl font-black pencil-font mb-2 text-[#3a352f]">
                        {activeRoll.damage} DMG
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t-2 border-[#5c5346]/10 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#fdf6e3] px-3 text-[8px] font-bold uppercase tracking-widest opacity-40">
                    Krag’s Counsel
                  </div>
                  <div className="italic text-lg opacity-90 px-2 leading-tight py-2">
                    "{activeRoll.message}"
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {victoryData && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in zoom-in-95 duration-700">
          <div className="rpg-card max-w-2xl w-full p-0 overflow-hidden shadow-[0_0_100px_rgba(217,197,163,0.1)] border-4 border-[#5c5346]">
            {/* The Placard Header */}
            <div className="bg-[#5c5346] text-[#fdf6e3] py-12 text-center relative">
              <div className="text-8xl mb-6 animate-bounce">🏆</div>
              <h3 className="text-7xl font-black uppercase tracking-[0.2em] leading-none mb-2 drop-shadow-lg">
                Victory!
              </h3>
              <div className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-60">The Bounty Hunt is Concluded</div>
            </div>

            {/* The Decree Content */}
            <div className="p-12 text-center bg-[#fdf6e3]">
              <div className="border-4 border-double border-[#3a352f]/40 p-10 relative">
                {/* Corner Accents */}
                <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-[#3a352f]/40"></div>
                <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-[#3a352f]/40"></div>
                <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-[#3a352f]/40"></div>
                <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-[#3a352f]/40"></div>

                <p className="text-2xl italic mb-8 opacity-80 leading-snug">
                  "The terror known as <span className="font-bold not-italic">{victoryData.enemyName}</span> has been struck from the living ledger forever."
                </p>

                <div className="mb-10">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Claimant of the Spoils</div>
                  <div className="text-5xl font-black uppercase tracking-tight text-[#8b0000]">
                    {victoryData.winner}
                  </div>
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-1">Level {victoryData.winnerLevel}</div>
                  <div className="text-sm font-black uppercase tracking-widest text-[#8b0000]">{getLevelTitle(victoryData.winnerLevel)}</div>
                </div>

                <div className="text-center mb-8 relative">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Bequeathed Armament</div>
                  <div className="text-2xl font-black uppercase tracking-tight py-3 px-6 border-2 border-[#5c5346]/20 inline-block bg-white/40">
                    {WEAPONS[victoryData.weaponTier]?.name || "Rusty Dagger"}
                  </div>
                  <div className="mt-3 flex justify-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] opacity-50">
                    <span className="pencil-font text-xs tracking-tighter">Power: {WEAPONS[victoryData.weaponTier]?.dice}</span>
                    <span>•</span>
                    <span>Tier {victoryData.weaponTier}</span>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <button
                  onClick={() => setVictoryData(null)}
                  className="w-full py-5 button-ink text-2xl font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Forge Onwards
                </button>
                <div className="mt-4 text-[9px] font-bold uppercase tracking-widest opacity-30 italic">
                  The fellowship grows stronger. The next shadow awaits.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <div className="fixed inset-0 bg-[#3a352f]/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRules(false)}>
          <div onClick={e => e.stopPropagation()}><KragCommandments onClose={() => setShowRules(false)} noMargin /></div>
        </div>
      )}

      {activeTab === 'battle' && (
        <div className="animate-in slide-in-from-left">
          <section className="mb-10 max-w-3xl mx-auto">
            {campaign.currentEnemyIndex >= campaign.enemies.length ? (
              <div className="rpg-card p-12 md:p-16 text-center border-4 border-double border-yellow-600/30 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-yellow-600/40"></div>
                <div className="mb-8 text-6xl">🏆</div>
                <h2 className="text-5xl font-black uppercase tracking-tighter mb-4 text-yellow-700/80">Grand Finale</h2>
                <div className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-8 pb-4 border-b border-[#5c5346]/10">The Forge is Triumphant</div>

                <p className="text-lg italic opacity-70 mb-12 max-w-lg mx-auto leading-relaxed">
                  "Legends speak of a fellowship that dared to face every shadow, every beast, and every drop of sweat without fail. The Gjallar Forge burns eternally in your honor."
                </p>

                <div className="grid grid-cols-2 gap-8 mb-12 text-center">
                  <div>
                    <div className="text-[10px] font-bold uppercase opacity-30 mb-2">Cycles Endured</div>
                    <div className="text-4xl font-black">{campaign.currentWeek}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase opacity-30 mb-2">Foes Vanquished</div>
                    <div className="text-4xl font-black">{campaign.enemies.length}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 max-w-md mx-auto">
                  <button onClick={() => setView('landing')} className="w-full py-5 button-ink text-sm font-black uppercase tracking-widest">Return to Titles</button>
                  <button onClick={() => setShowAbandonModal(true)} className="w-full py-3 button-red-hollow text-[10px]">Ash the Progress (Start Anew)</button>
                </div>
              </div>
            ) : currentEnemy && !currentEnemy.isDead ? (
              <EnemyDisplay enemy={currentEnemy} />
            ) : (
              <div className="rpg-card p-10 text-center opacity-40 italic uppercase tracking-[0.2em] text-xs">Waiting for the Next Shadow...</div>
            )}
          </section>

          <section className="max-w-2xl mx-auto mb-12">
            <div className="text-center italic opacity-40 text-[10px] uppercase tracking-widest mb-4">Strike while the iron is hot</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {participants.map((p: any) => {
                return (
                  <div key={p.id} className="flex flex-col items-center relative group">
                    {p.isLootDisqualified && (
                      <div className="absolute -top-2 -right-2 bg-[#8b0000] text-[#fdf6e3] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md ring-2 ring-[#fdf6e3]">
                        Cursed
                      </div>
                    )}
                    {p.isInspired && (
                      <div className="absolute -top-2 -left-2 bg-yellow-400 text-[#3a352f] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest -rotate-12 z-10 shadow-md ring-2 ring-yellow-200 animate-pulse">
                        Inspired
                      </div>
                    )}
                    <button
                      onClick={() => handleAction('attack', p.id)}
                      disabled={!!activeRoll || (currentEnemy?.isDead)}
                      className="strike-button w-full max-w-[140px] transition-all duration-300 hover:-translate-y-1 group"
                    >
                      <div className="text-[10px] font-bold opacity-40 mb-1">{p.name}</div>
                      <div className="text-xl font-black uppercase tracking-widest mb-2 transition-colors duration-300 group-hover:text-[#8b0000]">Strike</div>
                      <div className="flex justify-center gap-2 mb-1">
                        {Array.from({ length: config.workoutsPerWeek }).map((_, i) => {
                          const isFilled = i < p.workoutsThisWeek;
                          return (
                            <div
                              key={i}
                              className={`w-2.5 h-2.5 rounded-full border transition-all duration-700 
                                ${isFilled ? (p.isInspired ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-[#3a352f] border-[#3a352f]') :
                                  (p.isInspired ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-transparent border-[#3a352f]/40')}`}
                            />
                          );
                        })}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">The Chronicles</div>
              <div className="text-[8px] font-bold uppercase tracking-widest opacity-20">Living Ledger • Total Records: {campaign.logs.length}</div>
            </div>

            <div className="rpg-card h-[400px] overflow-y-auto p-0 space-y-0 bg-black/5 rounded-none border-x-0 border-y-2 border-[#5c5346]/20">
              {campaign.logs.length === 0 && (
                <div className="h-full flex items-center justify-center italic opacity-30 text-sm uppercase tracking-widest">The ink is dry. No deeds recorded yet.</div>
              )}
              {campaign.logs.map((log: any, idx: number) => {
                let content: any;
                try { content = JSON.parse(log.content); } catch { content = {}; }
                const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Milestone: VANQUISHED
                if (log.type === 'system' && content.message?.includes('EVENT_VANQUISHED')) {
                  const enemyName = content.message.split(':')[1].split(' ')[0];
                  return (
                    <div key={log.id} className="py-6 px-4 bg-[#8b0000]/5 border-y-4 border-double border-[#8b0000]/20 my-4 text-center">
                      <div className="text-3xl font-black uppercase tracking-[0.4em] text-[#8b0000] animate-pulse">
                        VANQUISHED!
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">
                        {enemyName} has fallen! Victory to the forge!
                      </div>
                    </div>
                  );
                }

                // Milestone: LOOT_CLAIMED
                if (log.type === 'system' && content.message?.includes('EVENT_LOOT_CLAIMED')) {
                  const winner = content.winnerName;
                  const weaponName = WEAPONS[content.tier as WeaponTier]?.name || "a bounty";
                  return (
                    <div key={log.id} className="py-4 px-6 border-2 border-double border-[#3a352f]/30 mx-8 my-4 text-center bg-white/40 shadow-sm">
                      <div className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-40 mb-1">Spoils of War</div>
                      <div className="text-sm font-black uppercase tracking-tight">
                        <span className="text-[#8b0000]">{winner}</span> claims the <span className="underline decoration-double underline-offset-4">{weaponName}</span>.
                      </div>
                    </div>
                  );
                }

                // Standard Attack
                if (log.type === 'attack') {
                  const isCrit = content.isCrit;
                  const isFumble = content.roll === 1;
                  const rollColor = isCrit ? 'text-[#8b0000]' : isFumble ? 'text-gray-400 opacity-50 line-through' : 'text-[#3a352f]';

                  return (
                    <div key={log.id} className="grid grid-cols-[80px_1fr_60px_100px] items-center py-3 px-4 border-b border-[#5c5346]/10 hover:bg-black/5 transition-colors">
                      <div className="pencil-font text-[10px] opacity-40">{timeStr}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-black uppercase tracking-tight text-xs">{content.participantName}</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30">vs {content.enemyName}</span>
                        {idx === 0 && content.participantId === localStorage.getItem('forge_participant_id') && (
                          <button
                            onClick={() => handleUndo(content.participantId)}
                            className="ml-auto text-[8px] font-bold uppercase tracking-widest text-[#8b0000] opacity-40 hover:opacity-100 hover:underline transition-all"
                            title="Undo this action"
                          >
                            ⌫ Undo
                          </button>
                        )}
                      </div>
                      <div className={`pencil-font text-lg text-center ${rollColor}`}>
                        {content.roll}
                      </div>
                      <div className="text-right">
                        {content.hit ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black tracking-tight">{content.damage} DMG</span>
                            {isCrit && <span className="text-[7px] font-bold text-[#8b0000] tracking-[0.2em]">CRIT</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold opacity-30 line-through tracking-widest">MISS</span>
                        )}
                      </div>
                    </div>
                  );
                }

                // System / Meta entries
                return (
                  <div key={log.id} className="py-1.5 px-4 text-[10px] italic opacity-40 uppercase tracking-widest border-b border-[#5c5346]/5">
                    {content.message || JSON.stringify(content)}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'party' && (
        <div className="animate-in slide-in-from-right">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-4xl font-black tracking-tight">The Party</h2>
              <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Fellowship of the Forge • Cycle {campaign.currentWeek}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEnlist(true)} className="px-4 py-2 button-hollow text-[10px]">Enlist Hero</button>
              <button onClick={() => setShowForgeAhead(true)} className="px-4 py-2 button-ink text-[10px]">Level Up</button>
            </div>
          </div>

          {showEnlist && (
            <div className="fixed inset-0 bg-[#3a352f]/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowEnlist(false)}>
              <div className="rpg-card p-10 max-w-sm w-full text-center relative" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-black uppercase tracking-widest mb-2">Summon Ally</h3>
                <p className="text-[10px] font-bold uppercase opacity-40 tracking-widest mb-8">Enter the name of your fellow hero</p>
                <form onSubmit={handleEnlist}>
                  <input
                    autoFocus
                    type="text"
                    className="w-full text-2xl py-2 border-b-2 border-[#5c5346] bg-transparent text-center mb-10 pencil-font"
                    value={enlistName}
                    onChange={e => setEnlistName(e.target.value)}
                    placeholder="Hero Name"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowEnlist(false)} className="flex-1 py-3 button-hollow text-[10px]">Cancel</button>
                    <button type="submit" className="flex-2 py-3 button-ink text-[10px]">Summon</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showForgeAhead && (
            <div className="fixed inset-0 bg-[#3a352f]/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowForgeAhead(false)}>
              <div className="rpg-card p-10 max-w-lg w-full text-center relative" onClick={e => e.stopPropagation()}>
                <div className="text-[10px] font-bold uppercase opacity-40 tracking-[0.5em] mb-4">The Ritual</div>
                <h3 className="text-4xl font-black uppercase tracking-tight mb-4">Forge Ahead</h3>
                <p className="text-sm opacity-70 mb-8 italic">"Transition the fellowship into Cycle {campaign.currentWeek + 1}. Oaths will be reset, and the brave will grow stronger."</p>

                <div className="grid grid-cols-2 gap-4 mb-10 text-left border-y border-[#5c5346]/10 py-6">
                  <div>
                    <div className="text-[9px] font-bold uppercase opacity-40 tracking-widest mb-1">Gjallar Oaths</div>
                    <div className="text-xs">Met goals become +1 Strength.</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase opacity-40 tracking-widest mb-1">Ritual Reset</div>
                    <div className="text-xs">Workouts reset. Curses lifted.</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowForgeAhead(false)} className="flex-1 py-3 button-hollow text-[10px]">Stay in Cycle {campaign.currentWeek}</button>
                  <button onClick={handleForgeAhead} className="flex-1 py-3 button-ink text-[10px]">Forge Cycle {campaign.currentWeek + 1}</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participants.map((p: any) => {
              const weapon = WEAPONS[p.weaponTier as WeaponTier] || WEAPONS[0];
              return (
                <div key={p.id} className="rpg-card p-6 shadow-sm relative group">
                  <button
                    onClick={() => handleRetireHero(p.id, p.name)}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#8b0000] opacity-0 group-hover:opacity-100 transition-opacity font-bold hover:scale-125 z-20"
                    title="Retire Hero"
                  >
                    ×
                  </button>
                  {p.isLootDisqualified && (
                    <div className="absolute -top-2 -right-2 bg-[#8b0000] text-[#fdf6e3] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md">
                      Cursed
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter leading-none">{p.name}</h3>
                      <div className="text-[10px] font-bold uppercase text-[#8b0000] tracking-widest mt-0.5">{getLevelTitle(p.level)}</div>
                      <div className="text-[9px] font-bold uppercase opacity-40 mt-1 tracking-wider">Level {p.level} • {p.totalWorkouts} Total Deeds</div>
                    </div>
                    <div className="strength-box text-center bg-white/30 border border-[#5c5346]/10">
                      <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Strength</div>
                      <div className="text-xl font-bold">+{p.level}</div>
                    </div>
                  </div>

                  <div className="bg-[#5c5346]/5 p-3 border-l-4 border-[#3a352f] mb-4">
                    <div className="text-[9px] font-bold uppercase opacity-40 tracking-widest mb-1 flex items-center gap-2">
                      <span>⚔️</span> Armament
                    </div>
                    <div className="text-xs font-bold">{weapon.name} <span className="opacity-40 font-normal">({weapon.dice})</span></div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase opacity-40 tracking-widest mb-2">
                      <span>Weekly Oath</span>
                      <span>{p.workoutsThisWeek} / {config.workoutsPerWeek}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: config.workoutsPerWeek }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-2 transition-all duration-700 ${i < p.workoutsThisWeek ? 'bg-[#3a352f]' : 'bg-black/5'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 rpg-card dashed-card p-8 bg-transparent shadow-none border-[#5c5346]/10 text-center">
            <div className="text-[10px] font-bold uppercase opacity-40 tracking-[0.4em] mb-4">Quest Summary</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase opacity-30 mb-1">Current Cycle</div>
                <div className="text-2xl font-bold opacity-60">{campaign.currentWeek}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase opacity-30 mb-1">Foes Vanquished</div>
                <div className="text-2xl font-bold opacity-60">{campaign.currentEnemyIndex} / {campaign.enemies.length}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase opacity-30 mb-1">Completion</div>
                <div className="text-2xl font-bold opacity-60">{Math.round((campaign.currentEnemyIndex / campaign.enemies.length) * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
