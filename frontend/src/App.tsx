import { useState } from 'react';
import SurveyorPortal from './components/SurveyorPortal';
import GovernmentPortal from './components/GovernmentPortal';
import CitizenPortal from './components/CitizenPortal';
import { Landmark, User, ShieldCheck, Map, ArrowRight, LogOut, Hexagon } from 'lucide-react';

type ViewState = 'selection' | 'surveyor' | 'government' | 'citizen';

function App() {
  const [view, setView] = useState<ViewState>('selection');

  const handleSignOut = () => {
    setView('selection');
  };

  if (view === 'selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary-200 rounded-full blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 animate-pulse delay-700"></div>
        </div>

        <div className="max-w-6xl w-full z-10 space-y-16">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-xl shadow-primary-100 mb-4 animate-bounce-slow">
              <Hexagon className="w-12 h-12 text-primary-600 fill-primary-50" />
            </div>
            <h1 className="text-6xl font-black text-gray-900 tracking-tight leading-tight">
              Decentralized <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">Land Registry</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              The future of property ownership. Secure, transparent, and immutable land records powered by Ethereum and Arweave.
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Surveyor Card */}
            <div
              onClick={() => setView('surveyor')}
              className="group relative bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-primary-500/20 transition-all duration-300 border border-gray-100 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                <Map className="w-40 h-40" />
              </div>
              <div className="relative z-10 space-y-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
                  <Map className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Surveyor Portal</h3>
                  <p className="text-gray-500 font-medium">Register new land parcels, defining boundaries and generating unique H3 geospatial identities.</p>
                </div>
                <div className="flex items-center text-blue-600 font-bold group-hover:translate-x-2 transition-transform">
                  Enter Portal <ArrowRight className="ml-2 w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Government Card */}
            <div
              onClick={() => setView('government')}
              className="group relative bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300 border border-gray-100 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                <Landmark className="w-40 h-40" />
              </div>
              <div className="relative z-10 space-y-6">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center group-hover:bg-red-600 transition-colors duration-300">
                  <Landmark className="w-8 h-8 text-red-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Government Portal</h3>
                  <p className="text-gray-500 font-medium">Verify applications, authorize surveyors, and digitally sign land titles for minting.</p>
                </div>
                <div className="flex items-center text-red-600 font-bold group-hover:translate-x-2 transition-transform">
                  Enter Portal <ArrowRight className="ml-2 w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Citizen Card */}
            <div
              onClick={() => setView('citizen')}
              className="group relative bg-white rounded-[2rem] p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300 border border-gray-100 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                <User className="w-40 h-40" />
              </div>
              <div className="relative z-10 space-y-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors duration-300">
                  <User className="w-8 h-8 text-green-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Citizen Portal</h3>
                  <p className="text-gray-500 font-medium">Mint approved land as NFTs, manage your property portfolio, and trade on the marketplace.</p>
                </div>
                <div className="flex items-center text-green-600 font-bold group-hover:translate-x-2 transition-transform">
                  Enter Portal <ArrowRight className="ml-2 w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm font-semibold text-gray-400">
              <ShieldCheck className="w-4 h-4" /> Secure Blockchain Infrastructure
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Common Header for Portals
  const PortalHeader = ({ title, colorClass }: { title: string, colorClass: string }) => (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-3">
            <div onClick={handleSignOut} className="cursor-pointer hover:opacity-80 transition-opacity">
              <div className={`p-2 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100')}`}>
                <Hexagon className={`w-8 h-8 ${colorClass}`} />
              </div>
            </div>
            <div>
              <span className="text-xl font-black text-gray-900 tracking-tight block">LAND<span className={colorClass}>REGISTRY</span></span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="group flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-all duration-300"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {view === 'surveyor' && (
        <>
          <PortalHeader title="Surveyor Portal" colorClass="text-blue-600" />
          <main className="py-8">
            <SurveyorPortal />
          </main>
        </>
      )}
      {view === 'government' && (
        <>
          <PortalHeader title="Government Portal" colorClass="text-red-600" />
          <main className="py-8">
            <GovernmentPortal />
          </main>
        </>
      )}
      {view === 'citizen' && (
        <>
          <PortalHeader title="Citizen Portal" colorClass="text-green-600" />
          <main className="py-8">
            <CitizenPortal />
          </main>
        </>
      )}
    </div>
  );
}

export default App;
