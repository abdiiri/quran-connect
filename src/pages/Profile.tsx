import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Hash, Shield, LogOut } from "lucide-react";

const Profile = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const items = [
    { label: "Name", value: user.name, icon: User },
    { label: "User ID", value: user.id, icon: Hash },
    { label: "Role", value: user.role, icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary p-4 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-primary-foreground p-2 -ml-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Profile</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 animate-fade-in">
        {/* Avatar */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full gradient-primary mx-auto flex items-center justify-center mb-3">
            <span className="text-primary-foreground text-3xl font-bold">{user.name[0]?.toUpperCase()}</span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">{user.name}</h2>
          <span className="inline-block mt-1 text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full capitalize">{user.role}</span>
        </div>

        {/* Details */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {items.map((item, i) => (
            <div key={item.label} className={`flex items-center gap-4 p-4 ${i < items.length - 1 ? "border-b border-border" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium text-foreground capitalize">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive text-destructive font-medium hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
