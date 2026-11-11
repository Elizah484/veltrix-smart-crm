import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Keeps signed-out visitors on the sign-in page, and sends signed-in people
 * who lack a permission to the Unauthorized page. The server checks every
 * request again, so this is for a clean screen, not for security.
 */
export default function ProtectedRoute({ children, permission, anyOf }) {
  const { user, booting, can, canAny } = useAuth();
  const location = useLocation();
  if (booting) return <div className="fullpage"><LoadingSpinner label="Loading Veltrix…" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (permission && !can(permission)) return <Navigate to="/unauthorized" replace />;
  if (anyOf && !canAny(anyOf)) return <Navigate to="/unauthorized" replace />;
  return children;
}
