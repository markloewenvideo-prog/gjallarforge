const UserSelectionScreen: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        // Fetch users (or just use hardcoded if API fails, but we want real IDs)
        api.getUsers()
            .then(setUsers)
            .catch(e => {
                console.error(e);
                setError("Failed to load heroes. Is the Forge cold?");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSelect = async (username: string) => {
        try {
            // In a real app we'd need a password, but we hardcoded 'password123'
            const user = await api.login(username, 'password123');
            onLogin(user);
        } catch (e) {
            setError("Failed to awaken hero.");
        }
    };

    return (
        <div className= "min-h-screen flex items-center justify-center p-4" >
        <div className="rpg-card p-10 max-w-lg w-full shadow-2xl text-center" >
            <h1 className="text-4xl font-black mb-1 uppercase tracking-tighter" > The Gjallar Forge </h1>
                < p className = "text-xs font-bold uppercase tracking-widest opacity-50 mb-8" > +1 to Strength </p>
                    < div className = "border-b-2 border-[#5c5346] mb-8" > </div>
                        < h2 className = "text-2xl font-bold uppercase mb-6" > Who approaches the anvil ? </h2>
        
        { loading && <div className="text-xl animate-pulse" > Summoning...</div> }
    { error && <div className="text-red-900 font-bold mb-4" > { error } </div> }

    <div className="grid gap-4" >
    {
        users.map(u => (
            <button 
              key= { u.id }
              onClick = {() => handleSelect(u.username)}
className = "py-4 button-ink text-xl font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform"
    >
    { u.username }
    </button>
          ))}
{
    users.length === 0 && !loading && (
        <div className="opacity-50 italic" > No heroes found.Check the archives.</div>
          )
}
</div>
    </div>
    </div>
  );
};
