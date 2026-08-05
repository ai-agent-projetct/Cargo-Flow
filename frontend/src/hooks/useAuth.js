import { useAuth as useAuthContext } from '../context/AuthContext';

// Re-export for convenience
const useAuth = () => useAuthContext();

export default useAuth;
