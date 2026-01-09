
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
        <li className="flex gap-4"><span>📜</span> "The Forge only responds to physical sweat. Every real-world workout always strikes the foe, unless the fates (d20) fumble."</li>
        <li className="flex gap-4"><span>📜</span> "Damage is a simple sum of your effort: Roll d20 + Your Strength (Level) + Weapon Modifier."</li>
        <li className="flex gap-4 text-[#8b0000] font-black"><span>📜</span> "A Natural 20 is an INSTANT KILL! The foe falls immediately, and you earn an extra Pip!"</li>
        <li className="flex gap-4 opacity-50"><span>📜</span> "A Natural 1 is a Total Miss. You deal 0 damage this strike."</li>
        <li className="flex gap-4"><span>📜</span> "Inspired Heroes (Gold) have gone above and beyond. Do extra workouts to earn this blessing."</li>
        <li className="flex gap-4 text-[#8b0000]"><span>📜</span> "Shadow Growth & Shrink: Missed workouts strengthen the final boss, but extra effort shrinks its vitality."</li>
        <li className="flex gap-4"><span>📜</span> "When a foe falls, the one with the highest total D20 rolls (The Fair Sweat Rule) claims the loot."</li>
        <li className="flex gap-4 font-black uppercase tracking-tighter not-italic mt-6 text-[#3a352f] justify-center text-lg md:text-xl border-t border-[#5c5346]/10 pt-4 text-center">"Now back to work."</li>
      </ul>
    </div>
  );
};

const EnemyDisplay: React.FC<{ enemy: any }> = ({ enemy }) => {
  const hpPercent = (enemy.hp / enemy.maxHp) * 100;
  const adj = enemy.adjustmentHp || 0;

  return (
    <div className="text-center mb-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Active Bounty</div>
      <div className="h-px bg-[#5c5346]/20 w-16 mx-auto mb-6" />
      <div className="rpg-card dashed-card p-6 md:p-8 text-left bg-[#fdf6e3]/50 relative overflow-hidden">
        {adj !== 0 && (
          <div className={`absolute top-0 right-0 py-1 px-4 text-[9px] font-black uppercase tracking-widest rotate-0 z-10 shadow-sm border-l border-b ${adj > 0 ? 'bg-[#8b0000] text-[#fdf6e3] border-[#8b0000]/20' : 'bg-green-700 text-[#fdf6e3] border-green-700/20'}`}>
            {adj > 0 ? `+${adj} Shadow Growth` : `${adj} Shadow Shrink`}
          </div>
        )}

        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2 leading-none">{enemy.name}</h2>
            <p className="italic opacity-70 text-lg leading-snug">{enemy.description}</p>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-[10px] items-end font-bold uppercase opacity-60">
          <span className="tracking-widest">Vitality</span>
          <div className="flex items-center gap-2">
            {adj > 0 && <span className="text-[#8b0000] animate-pulse">🛡️ (+{adj} Barrier)</span>}
            {adj < 0 && <span className="text-green-700 animate-pulse">✨ ({adj} Fracture)</span>}
            <span className="pencil-font text-xs uppercase tracking-tighter ml-2">{Math.ceil(enemy.hp)} / {enemy.maxHp} HP</span>
          </div>
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
    participantsText: "",
    initialEnemyName: "",
    initialEnemyDesc: ""
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolutionData, setResolutionData] = useState<any>(null);
  const [nextVillainName, setNextVillainName] = useState("");
  const [nextVillainDesc, setNextVillainDesc] = useState("");

  // --- Effects ---

  // Initialization
  useEffect(() => {
    const storedCamId = localStorage.getItem('forge_campaign_id');

    const init = async () => {
      setLoading(true);
      try {
        // If we have a stored ID, try to load it
        if (storedCamId) {
          try {
            const c = await api.getCampaign(storedCamId);
            setCampaign(c);
            setView('game');
          } catch (e) {
            console.error("Failed to load stored campaign, fallback to list");
            localStorage.removeItem('forge_campaign_id');
            const list = await api.getAllCampaigns();
            setCampaignsList(list);
            setView('landing');
          }
        } else {
          // If no stored ID, see if any campaigns exist in the realm
          const list = await api.getAllCampaigns();
          setCampaignsList(list);

          if (list.length === 0) {
            // Realm is empty, need to forge a new one
            setView('create');
          } else if (list.length === 1) {
            // Only one campaign exists, join it immediately
            const first = await api.getCampaign(list[0].id);
            setCampaign(first);
            localStorage.setItem('forge_campaign_id', first.id);
            setView('game');
          } else {
            // Multiple campaigns exist, let user choose
            setView('landing');
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
      const handleConnect = () => {
        console.log("[SOCKET] Connected, joining room:", campaign.id);
        socket.emit('joinCampaign', campaign.id);
      };

      socket.connect();

      // Handle initial connection if already connected or when it connects
      if (socket.connected) {
        handleConnect();
      }

      socket.on('connect', handleConnect);
      socket.on('gamestate_update', (updatedCampaign) => {
        console.log("[SOCKET] Received gamestate_update");
        setCampaign(updatedCampaign);
      });

      return () => {
        socket.off('connect', handleConnect);
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
      const initialEnemy = createForm.initialEnemyName.trim()
        ? { name: createForm.initialEnemyName.trim(), description: createForm.initialEnemyDesc.trim() }
        : undefined;

      const newCampaign = await api.createCampaign("", config, names, initialEnemy);
      console.log("[FRONTEND] Campaign created successfully:", newCampaign.id);
      setCampaign(newCampaign);
      localStorage.setItem('forge_campaign_id', newCampaign.id);
      setView('game');
    } catch (err: any) {
      console.error("Create failed", err);
      const msg = err.error || err.message || "Failed to forge quest.";
      const details = err.details ? ` (${err.details})` : "";
      setError(`${msg}${details}`);
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
    if (activeRoll || isSubmitting) return;
    setIsSubmitting(true);

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
          if (res.campaign) setCampaign(res.campaign);
          const isCrit = res.roll === 20;
          const isFumble = res.roll === 1;
          const hit = res.damage > 0;
          const participant = campaign.participants.find((p: any) => p.id === participantId);
          const currentEnemy = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex);
          const winnerParticipant = campaign.participants.find((p: any) => p.id === participantId);
          const winnerName = winnerParticipant?.name || "The Fellowship";

          let msg = "";
          if (isCrit) msg = FLAVOR_TEXT.crit;
          else if (isFumble) msg = FLAVOR_TEXT.fumble[Math.floor(Math.random() * FLAVOR_TEXT.fumble.length)];
          else if (hit) msg = FLAVOR_TEXT.success[Math.floor(Math.random() * FLAVOR_TEXT.success.length)];
          else msg = FLAVOR_TEXT.failure[Math.floor(Math.random() * FLAVOR_TEXT.failure.length)];

          setActiveRoll({
            pId: participantId,
            roll: res.roll,
            strength: res.strength,
            modifier: res.modifier,
            isCrit: res.isCrit,
            isMiss: res.isMiss,
            hit: !res.isMiss,
            damage: res.damage,
            resolving: false,
            phase: 2,
            message: msg,
            killed: res.killed,
            victoryPayload: res.killed ? {
              winner: winnerName,
              winnerLevel: winnerParticipant?.level || 1,
              enemyName: currentEnemy?.name || "The Foe",
              weaponTier: res.tier
            } : null
          });
        } else {
          setActiveRoll(null);
        }
      }, remainingRitualTime);

    } catch (err) {
      console.error(err);
      setActiveRoll(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkout = async (participantId: string) => {
    try {
      const res = await api.logWorkout(campaign.id!, participantId);
      if (res.campaign) setCampaign(res.campaign);
    } catch (e) { console.error(e); }
  };

  const handleUndo = async (participantId: string) => {
    if (!campaign?.id) return;
    try {
      const res = await api.undoLastAction(campaign.id, participantId);
      if (res.campaign) setCampaign(res.campaign);
    } catch (e: any) {
      console.error(e);
      alert(e.error || "Failed to undo action.");
    }
  };

  const handleExitCampaign = async () => {
    setLoading(true);
    localStorage.removeItem('forge_campaign_id');
    localStorage.removeItem('forge_participant_id');
    setCampaign(null);
    try {
      const list = await api.getAllCampaigns();
      setCampaignsList(list);
      setView('landing');
    } catch (e) {
      console.error(e);
      setView('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setCampaign(null);
    setView('landing');
  };

  const handleDeleteCampaign = async (idOrEvent?: string | React.MouseEvent) => {
    // If it's a click event, ignore it and use the current campaign id
    const id = typeof idOrEvent === 'string' ? idOrEvent : undefined;
    const targetId = id || campaign?.id;
    if (!targetId) return;

    if (!window.confirm("Are you sure you wish to delete this quest? All progress will be lost forever.")) return;

    try {
      const resp = await api.deleteCampaign(targetId);
      if (resp.success) {
        // Close modal first to avoid zombie state
        setShowAbandonModal(false);

        // If we deleted the campaign that is currently stored, clear it
        if (targetId === localStorage.getItem('forge_campaign_id')) {
          localStorage.removeItem('forge_campaign_id');
          localStorage.removeItem('forge_participant_id');
        }

        if (targetId === campaign?.id) {
          setCampaign(null);
        }

        // Refresh the list
        const list = await api.getAllCampaigns();
        setCampaignsList(list);

        if (list.length === 0) {
          setView('create');
        } else if (view === 'game' && targetId === campaign?.id) {
          // If we were inside the campaign we just deleted, and others remain, go to landing
          setView('landing');
        }
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
    if (!window.confirm("Are you sure you wish to advance the week? This ritual will reset weekly pips, evaluate oaths, and might strengthen the final shadow if goals were missed.")) return;

    try {
      const { campaign: updated, summary } = await api.forgeAhead(campaign.id);
      setCampaign(updated);
      setResolutionData(summary);
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

  const handleForgeOnwards = async () => {
    if (nextVillainName.trim()) {
      try {
        const updated = await api.renameEnemy(campaign.id, campaign.currentEnemyIndex, nextVillainName.trim(), nextVillainDesc.trim());
        if (updated) setCampaign(updated);
      } catch (e) {
        console.error("Rename failed", e);
      }
    }
    setVictoryData(null);
    setNextVillainName("");
    setNextVillainDesc("");
  };

  // Back navigation
  const goBack = () => {
    if (view === 'create' || view === 'select_campaign') setView('landing');
  };

  // --- Renders ---

  if (loading && !campaign && campaignsList.length === 0) return <div className="flex items-center justify-center min-h-screen animate-pulse text-2xl font-black uppercase tracking-widest">Igniting Forge...</div>;

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
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">📯 Select Your Forge</h1>
          <div className="flex items-center gap-3 mb-10 w-48 mx-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Choose Wisely</span>
            <div className="h-px bg-[#5c5346]/20 flex-1"></div>
          </div>

          <div className="grid gap-4 max-h-[40vh] overflow-y-auto mb-8 pr-2 relative min-h-[100px]">
            {loading && (
              <div className="absolute inset-0 bg-[#fdf6e3]/60 backdrop-blur-[1px] z-50 flex items-center justify-center animate-in fade-in duration-300">
                <div className="text-[10px] font-black uppercase tracking-[0.5em] opacity-60 animate-pulse">Scouting the realm...</div>
              </div>
            )}
            {campaignsList.map((c: any) => (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => handleSelectCampaign(c.id)}
                  className="w-full flex flex-col items-center py-5 button-ink transition-all border border-[#3a352f]"
                >
                  <span className="text-lg font-bold uppercase tracking-[0.2em]">{c.name}</span>
                  <span className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-40 mt-1">{c._count?.participants || 0} Heroes Active</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCampaign(c.id);
                  }}
                  className="absolute top-2 right-2 p-2 text-[#8b0000] opacity-60 hover:opacity-100 transition-opacity text-xl font-bold"
                  aria-label="Delete Campaign"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setView('create')} className="w-full py-4 button-hollow text-sm">
            New Forge
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
              <p className="text-[9px] opacity-40 uppercase tracking-widest mt-2">The fellowship will be bound to this quest immediately. Each "Strike" represents a real-world workout.</p>
            </div>

            <div className="space-y-6 pt-6 border-t border-[#5c5346]/10">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-1">Ritual of the First Shadow</div>
                <h4 className="text-xl font-black uppercase tracking-tight">The Primordial Foe</h4>
                <p className="text-[10px] opacity-50 uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">
                  Every great journey begins with a challenge. Be creative—this is the first shared enemy the entire fellowship will face together.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">The Shadow's Identity (Name)</label>
                  <input
                    type="text"
                    className="w-full text-xl py-2 border-b-2 border-[#5c5346]/20 bg-transparent focus:border-[#3a352f] transition-colors pencil-font outline-none"
                    placeholder="e.g. Malakor the Grim"
                    value={createForm.initialEnemyName}
                    onChange={e => setCreateForm({ ...createForm, initialEnemyName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">The Shadow's Legend (Flavor)</label>
                  <textarea
                    className="w-full p-4 border-2 border-[#5c5346]/10 bg-black/5 h-24 pencil-font text-sm outline-none focus:border-[#3a352f]/30 transition-colors"
                    placeholder="What terror greets the fellowship?"
                    value={createForm.initialEnemyDesc}
                    onChange={e => setCreateForm({ ...createForm, initialEnemyDesc: e.target.value })}
                  />
                </div>
              </div>
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
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight leading-none">📯 {campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-40 text-pencil-color">+1 to Strength</span>
            <div className="h-px bg-[#5c5346]/20 flex-1 min-w-[50px]"></div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExitCampaign}
            className="px-4 py-2 button-hollow text-[10px]"
          >
            Switch Quest
          </button>
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <div className="rpg-card p-6 md:p-12 text-center max-w-sm w-full ink-border shadow-2xl relative my-auto">
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
              <>
                <div className="animate-in zoom-in fade-in duration-500">
                  <div className="mb-6 relative flex flex-col items-center">
                    <div className="flex items-center gap-6 mb-8 mt-2">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Basis</div>
                        <div className="text-4xl font-black">{activeRoll.roll}</div>
                      </div>
                      <div className="text-2xl font-light opacity-30 mt-4">+</div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Strength</div>
                        <div className="text-4xl font-black">{activeRoll.strength}</div>
                      </div>
                      <div className="text-2xl font-light opacity-30 mt-4">+</div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Weapon</div>
                        <div className="text-4xl font-black">{activeRoll.modifier}</div>
                      </div>
                    </div>

                    <div className="text-2xl font-black uppercase tracking-[0.4em] mb-2 text-[#8b0000]/60">
                      {activeRoll.isCrit ? "INSTANT KILL!" : activeRoll.isMiss ? "TOTAL MISS" : "Total Strike"}
                    </div>

                    <div className={`text-7xl font-black pencil-font ${activeRoll.isCrit ? 'text-[#8b0000] scale-110 drop-shadow-xl' : activeRoll.isMiss ? 'text-gray-400 line-through' : 'text-[#3a352f]'}`}>
                      {activeRoll.isCrit ? "MAX" : activeRoll.damage} <span className="text-xl uppercase tracking-tighter opacity-30">DMG</span>
                    </div>
                    {activeRoll.isCrit && <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b0000] animate-bounce mt-2">The Foe is Vanquished!</div>}
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

                <button
                  onClick={() => {
                    if (activeRoll.victoryPayload) {
                      setVictoryData(activeRoll.victoryPayload);
                    }
                    setActiveRoll(null);
                  }}
                  className="w-full py-4 button-ink font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  {(() => {
                    const next = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex);
                    const isShadow = next?.name.includes("Shadow") || next?.name.startsWith("The Shadow of");
                    const prevWasShadow = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex - 1)?.name.includes("Shadow");
                    return (isShadow && !prevWasShadow) ? "Enter The Shadow Realm" : "Onward";
                  })()}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {activeRoll && activeRoll.log && (
        <div className="fixed bottom-4 right-4 z-[151] p-4 bg-black/70 text-white rounded-lg shadow-lg max-w-xs">
          <p className="text-sm">{activeRoll.log}</p>
        </div>
      )}

      {
        victoryData && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in zoom-in-95 duration-700 overflow-y-auto">
            <div className="rpg-card max-w-sm w-full p-0 shadow-[0_0_100px_rgba(217,197,163,0.1)] border-4 border-[#5c5346] relative my-auto">

              {/* The Placard Header */}
              <div className="bg-[#5c5346] text-[#fdf6e3] py-8 text-center relative">
                <div className="text-6xl mb-4 animate-bounce">🏆</div>
                <h3 className="text-4xl font-black uppercase tracking-[0.2em] leading-none mb-2 drop-shadow-lg">
                  Victory!
                </h3>
                <div className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-60">The Bounty Hunt is Concluded</div>
              </div>

              {/* The Decree Content */}
              <div className="p-5 md:p-6 text-center bg-[#fdf6e3] max-h-[60vh] overflow-y-auto">
                <div className="border-4 border-double border-[#3a352f]/40 p-6 relative">
                  {/* Corner Accents */}
                  <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-[#3a352f]/40"></div>
                  <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-[#3a352f]/40"></div>
                  <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-[#3a352f]/40"></div>
                  <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-[#3a352f]/40"></div>

                  <p className="text-lg italic mb-6 opacity-80 leading-snug">
                    "The terror known as <span className="font-bold not-italic">{victoryData.enemyName}</span> has been struck from the living ledger forever."
                  </p>

                  {victoryData.weaponTier > 0 && (
                    <div className="mb-8">
                      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Claimant of the Spoils</div>
                      <div className="text-3xl font-black uppercase tracking-tight text-[#8b0000]">
                        {victoryData.winner}
                      </div>
                      <div className="flex flex-col items-center mt-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-1">Level {victoryData.winnerLevel}</div>
                        <div className="text-sm font-black uppercase tracking-widest text-[#8b0000]">{getLevelTitle(victoryData.winnerLevel)}</div>
                      </div>
                    </div>
                  )}

                  {victoryData.weaponTier > 0 && (
                    <div className="text-center mb-4 relative">
                      <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Bequeathed Armament</div>
                      <div className="text-xl font-black uppercase tracking-tight py-2 px-4 border-2 border-[#5c5346]/20 inline-block bg-white/40">
                        {WEAPONS[victoryData.weaponTier as WeaponTier]?.name || "Rusty Dagger"}
                      </div>
                      <div className="mt-2 flex justify-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] opacity-50">
                        <span className="pencil-font text-xs tracking-tighter">Strike Bonus: {WEAPONS[victoryData.weaponTier as WeaponTier]?.dice}</span>
                        <span>•</span>
                        <span>Forge Rank {victoryData.weaponTier}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 space-y-6">
                  <div className="h-px bg-[#3a352f]/10 w-full mb-6" />

                  {victoryData.weaponTier > 0 && campaign.currentEnemyIndex < campaign.enemies.length && (
                    <div className="text-left space-y-4 animate-in slide-in-from-bottom-2 duration-500">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 text-center mb-4">Ritual of Succession</div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-30 ml-2">The Shadow's Identity (Name)</label>
                        <input
                          className="w-full bg-[#fdf6e3] border-2 border-[#3a352f]/10 p-3 pencil-font text-lg outline-none focus:border-[#3a352f]/40 transition-all text-center"
                          placeholder="e.g. Malakor the Grim"
                          value={nextVillainName}
                          onChange={e => setNextVillainName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase opacity-30 ml-2">The Shadow's Legend (Flavor)</label>
                        <textarea
                          className="w-full bg-[#fdf6e3] border-2 border-[#3a352f]/10 p-3 pencil-font text-sm outline-none focus:border-[#3a352f]/40 transition-all min-h-[80px] text-center"
                          rows={2}
                          placeholder="What terror greets the fellowship?"
                          value={nextVillainDesc}
                          onChange={e => setNextVillainDesc(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleForgeOnwards}
                    className="w-full py-5 button-ink text-lg font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                    {(() => {
                      const next = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex);
                      const isShadow = next?.name.includes("Shadow") || next?.name.startsWith("The Shadow of");
                      const prevWasShadow = campaign.enemies.find((e: any) => e.order === campaign.currentEnemyIndex - 1)?.name.includes("Shadow");
                      return (isShadow && !prevWasShadow) ? "Enter The Shadow Realm" : "Onward";
                    })()}
                  </button>
                  <div className="mt-4 text-[9px] font-bold uppercase tracking-widest opacity-30 italic">
                    The fellowship grows stronger. {campaign.currentEnemyIndex < campaign.enemies.length ? "The next shadow awaits." : "The realm is safe... for now."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        resolutionData && (
          <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in zoom-in-95 duration-500 overflow-y-auto">
            <div className="rpg-card max-w-xl w-full p-0 shadow-[0_0_150px_rgba(0,0,0,0.5)] border-4 border-[#3a352f] my-auto">
              <div className="bg-[#3a352f] text-[#fdf6e3] py-8 text-center relative">
                <div className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-2">Weekly Ritual Complete</div>
                <h3 className="text-4xl font-black uppercase tracking-[0.1em] leading-none mb-2 drop-shadow-lg">
                  The Resolution
                </h3>
                <div className="h-1 w-24 bg-[#8b0000] mx-auto mt-4"></div>
              </div>

              <div className="p-8 bg-[#fdf6e3]">
                <div className="space-y-8">
                  {/* Fellowship Performance */}
                  <section>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border-b border-[#5c5346]/10 pb-2">Fellowship Status</h4>
                    <div className="space-y-4">
                      {[...(resolutionData.participants || [])].sort((a, b) => (a.id || "").localeCompare(b.id || "")).map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white/40 p-3 rounded border border-[#5c5346]/5">
                          <div className="flex flex-col">
                            <span className="text-lg font-black uppercase tracking-tight leading-none">{p.name}</span>
                            <span className="text-[10px] font-bold opacity-40 uppercase mt-1">
                              {p.workouts} / {p.goal} Oaths Kept {p.looted && <span className="text-[#8b0000] ml-1">• Looted!</span>}
                            </span>
                          </div>
                          <div className="text-right">
                            {p.statusChange === 'inspired' && <span className="text-[9px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded border border-yellow-500/20">✨ Inspired</span>}
                            {p.statusChange === 'cursed' && <span className="text-[9px] font-black uppercase tracking-widest bg-black/10 text-gray-700 px-2 py-1 rounded border border-black/10">💀 Cursed</span>}
                            {p.statusChange === 'saved' && <span className="text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-700 px-2 py-1 rounded border border-green-500/10">🛡️ Saved</span>}
                            {p.statusChange === 'sustained' && <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/5 text-blue-700 px-2 py-1 rounded border border-blue-500/10">⚖️ Sustained</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Shadow Growth & Shrink */}
                  <section className={`${resolutionData.shadowShrinkHP > 0 ? 'bg-green-600/5 border-green-600/10' : 'bg-[#8b0000]/5 border-[#8b0000]/10'} border p-6 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl font-black">{resolutionData.shadowShrinkHP > 0 ? '✨' : '🌑'}</div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest ${resolutionData.shadowShrinkHP > 0 ? 'text-green-700' : 'text-[#8b0000]'} mb-2`}>
                      {resolutionData.shadowShrinkHP > 0 ? 'The Shadow Recedes' : 'The Shadow Growth'}
                    </h4>
                    {resolutionData.shadowShrinkHP > 0 ? (
                      <>
                        <div className="text-3xl font-black text-green-700 mb-1">-{resolutionData.shadowShrinkHP} HP</div>
                        <p className="text-[11px] italic opacity-70 leading-relaxed">
                          The fellowship's collective zeal burns through the darkness! Your extra effort has stripped the final boss of their power.
                        </p>
                      </>
                    ) : resolutionData.shadowMonstersSpawned > 0 ? (
                      <>
                        <div className="text-3xl font-black text-[#8b0000] mb-1">+{resolutionData.shadowMonstersSpawned} Shadow Monsters</div>
                        <p className="text-[11px] italic opacity-70 leading-relaxed">
                          The darkness thickens! Your missed Oaths have manifested into {resolutionData.shadowMonstersSpawned} new terrors that stand between you and the finish.
                        </p>
                      </>
                    ) : resolutionData.shadowGrowthHP > 0 ? (
                      <>
                        <div className="text-3xl font-black text-[#8b0000] mb-1">+{resolutionData.shadowGrowthHP} HP</div>
                        <p className="text-[11px] italic opacity-70 leading-relaxed">
                          The final foe devours missed Oaths from the fellowship. The darkness thickens...
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] italic opacity-70 leading-relaxed">
                        The fellowship held firm. The shadow remains stunted this cycle.
                      </p>
                    )}
                  </section>

                  <button
                    onClick={() => setResolutionData(null)}
                    className="w-full py-5 button-ink text-lg font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                    Enter Next Week
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        showRules && (
          <div className="fixed inset-0 bg-[#3a352f]/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRules(false)}>
            <div onClick={e => e.stopPropagation()}><KragCommandments onClose={() => setShowRules(false)} noMargin /></div>
          </div>
        )
      }

      {
        activeTab === 'battle' && (
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
                    <button onClick={handleExitCampaign} className="w-full py-5 button-ink text-sm font-black uppercase tracking-widest">Return to Titles</button>
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
              <div className="text-center italic opacity-40 text-[10px] uppercase tracking-[0.2em] mb-4">The Forge only responds to physical sweat. Strike while the iron is hot.</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[...(participants || [])].sort((a, b) => a.id.localeCompare(b.id)).map((p: any) => {
                  return (
                    <div key={p.id} className="flex flex-col items-center relative group">
                      {p.isLootDisqualified && (
                        <div className="absolute -top-2 -right-2 bg-[#8b0000] text-[#fdf6e3] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md ring-2 ring-[#fdf6e3]">
                          Cursed
                        </div>
                      )}
                      {p.isInspired && (
                        <div className="absolute -top-2 -right-2 bg-yellow-400 text-[#3a352f] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md ring-2 ring-yellow-200 animate-pulse">
                          Inspired
                        </div>
                      )}
                      {p.isCursed && (
                        <div className="absolute -top-2 -right-2 bg-[#1a1a1a] text-[#8b0000] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md ring-2 ring-[#8b0000]/40 animate-pulse">
                          Cursed
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

                  // Milestone: STATUS_CHANGES
                  const isStatus = log.type === 'system' && (
                    content.message?.includes('EVENT_INSPIRED') ||
                    content.message?.includes('EVENT_CURSED') ||
                    content.message?.includes('EVENT_SAVED')
                  );
                  if (isStatus) {
                    const [tag, text] = content.message.split(':');
                    const bgColor = tag === 'EVENT_INSPIRED' ? 'bg-yellow-500/5' : tag === 'EVENT_CURSED' ? 'bg-black/5' : 'bg-green-500/5';
                    const textColor = tag === 'EVENT_INSPIRED' ? 'text-yellow-700' : tag === 'EVENT_CURSED' ? 'text-gray-700' : 'text-green-700';
                    const icon = tag === 'EVENT_INSPIRED' ? '✨' : tag === 'EVENT_CURSED' ? '💀' : '🛡️';
                    return (
                      <div key={log.id} className={`py-3 px-6 border-l-4 ${tag === 'EVENT_INSPIRED' ? 'border-yellow-500' : tag === 'EVENT_CURSED' ? 'border-black' : 'border-green-500'} ${bgColor} my-2 mx-4`}>
                        <div className={`text-[10px] font-black uppercase tracking-widest ${textColor} flex items-center gap-2`}>
                          <span>{icon}</span> {text}
                        </div>
                      </div>
                    );
                  }

                  // Milestone: SHADOW_MOVEMENTS
                  if (log.type === 'system' && (content.message?.includes('SHADOW_GROWTH') || content.message?.includes('SHADOW_RECEDES') || content.message?.includes('EVENT_SHADOW_REALM'))) {
                    const isGrowth = content.message.includes('SHADOW_GROWTH');
                    const isRealm = content.message.includes('EVENT_SHADOW_REALM');
                    return (
                      <div key={log.id} className={`py-4 px-6 border-y border-dashed ${isGrowth ? 'border-[#8b0000]/20 bg-[#8b0000]/5' : isRealm ? 'border-[#3a352f]/40 bg-black/20 text-white' : 'border-green-700/20 bg-green-700/5'} my-4 text-center`}>
                        <div className={`text-[9px] font-bold uppercase tracking-[0.3em] ${isGrowth ? 'text-[#8b0000]' : isRealm ? 'text-white' : 'text-green-800'} mb-1`}>
                          {isGrowth ? 'The Shadow Grows' : isRealm ? 'THRESHOLD CROSSED' : 'The Shadow Recedes'}
                        </div>
                        <div className={`pencil-font text-sm italic ${isRealm ? 'opacity-100' : 'opacity-60'}`}>
                          "{isRealm ? content.message.split(':')[1].trim() : content.message.split(':')[1].trim()}"
                        </div>
                      </div>
                    );
                  }

                  // Milestone: LEVEL_UP
                  if (log.type === 'system' && content.message?.includes('EVENT_LEVELUP')) {
                    const [tag, text] = content.message.split(':');
                    return (
                      <div key={log.id} className="py-2 px-6 my-1 mx-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#8b0000] flex items-center gap-2">
                          <span className="animate-bounce">⚔️</span> {text}
                        </div>
                      </div>
                    );
                  }

                  // Milestone: ENEMY_NAMED
                  if (log.type === 'system' && content.message?.includes('EVENT_ENEMYNAMED')) {
                    return (
                      <div key={log.id} className="py-6 px-10 border-2 border-double border-[#5c5346]/20 mx-8 my-6 bg-white/20 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-[#5c5346]/10" />
                        <div className="text-[8px] font-bold uppercase tracking-[0.4em] opacity-30 mb-2">A New Threat Emerges</div>
                        <div className="text-xl font-black uppercase tracking-tight text-[#3a352f] mb-2">{content.enemyName}</div>
                        <div className="text-[10px] italic opacity-50 px-4">"{content.description}"</div>
                      </div>
                    );
                  }

                  // Cycle Start
                  if (log.type === 'system' && content.message?.includes('begun. The Forge burns brighter.')) {
                    return (
                      <div key={log.id} className="py-8 px-4 text-center">
                        <div className="h-px bg-[#5c5346]/20 w-32 mx-auto mb-4" />
                        <div className="text-[10px] font-bold uppercase tracking-[0.8em] opacity-40">{content.message}</div>
                        <div className="h-px bg-[#5c5346]/20 w-32 mx-auto mt-4" />
                      </div>
                    );
                  }

                  // Standard Attack
                  if (log.type === 'attack') {
                    const isCrit = content.roll === 20;
                    const isFumble = content.roll === 1;
                    const rollColor = isCrit ? 'text-[#8b0000]' : isFumble ? 'text-gray-400 opacity-50 line-through' : 'text-[#3a352f]';

                    return (
                      <div key={log.id} className="grid grid-cols-[60px_1fr_60px_60px] md:grid-cols-[80px_1fr_100px_100px] items-center py-3 px-2 md:px-4 border-b border-[#5c5346]/10 hover:bg-black/5 transition-colors overflow-x-hidden">
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
                        <div className="text-right text-[10px] font-bold opacity-30 uppercase tracking-tighter">
                          {content.roll} + {content.strength} + {content.modifier}
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black pencil-font leading-none">
                            {content.damage} <span className="text-[8px] uppercase tracking-tighter opacity-40">DMG</span>
                          </div>
                          {isCrit && <div className="text-[7px] font-bold text-[#8b0000] tracking-[0.2em] mt-1">CRIT</div>}
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
        )
      }

      {
        activeTab === 'party' && (
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
              {[...(participants || [])].sort((a, b) => a.id.localeCompare(b.id)).map((p: any) => {
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
                    {p.isInspired && (
                      <div className="absolute -top-2 -left-2 bg-yellow-400 text-[#3a352f] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest -rotate-12 z-10 shadow-md ring-2 ring-yellow-200 animate-pulse">
                        Inspired
                      </div>
                    )}
                    {p.isCursed && (
                      <div className="absolute -top-2 -right-2 bg-[#1a1a1a] text-[#8b0000] text-[8px] font-black px-2 py-0.5 uppercase tracking-widest rotate-12 z-10 shadow-md ring-2 ring-[#8b0000]/40 animate-pulse">
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
                      <div className="text-xs font-bold">{weapon.name} <span className="opacity-40 font-normal">({weapon.dice} bonus)</span></div>
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
        )
      }
    </div >
  );
}
