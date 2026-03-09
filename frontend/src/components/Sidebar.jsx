import { Link, useLocation } from 'react-router-dom';
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlinePlusCircle,
  HiOutlineArrowUpTray,
  HiOutlineCog6Tooth,
} from 'react-icons/hi2';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HiOutlineHome },
  { name: 'Exams', href: '/exams', icon: HiOutlineDocumentText },
  { name: 'Create Exam', href: '/exams/new', icon: HiOutlinePlusCircle },
  { name: 'Upload Papers', href: '/upload', icon: HiOutlineArrowUpTray },
  { name: 'Settings', href: '/settings', icon: HiOutlineCog6Tooth },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 shadow-sm z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">EE</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">ExamEval</h1>
          <p className="text-xs text-gray-500">AI Paper Evaluator</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          Powered by Ollama + DeepSeek
        </p>
      </div>
    </aside>
  );
}
