import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/Home';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CustomerForm from './pages/CustomerForm';
import CustomerDetails from './pages/CustomerDetails';
import DuplicateReview from './pages/DuplicateReview';
import InteractionList from './pages/InteractionList';
import InteractionForm from './pages/InteractionForm';
import InteractionDetails from './pages/InteractionDetails';
import FollowUps from './pages/FollowUps';
import OrderList from './pages/OrderList';
import OrderForm from './pages/OrderForm';
import OrderDetails from './pages/OrderDetails';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { NotFound, Unauthorized } from './pages/Status';
import { useAuth } from './context/AuthContext';

const guard = (el, permission) => <ProtectedRoute permission={permission}>{el}</ProtectedRoute>;

export default function App() {
  const { user, booting } = useAuth();
  return (
    <Routes>
      {/* Public pages share one navbar */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={!booting && user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="signup" element={!booting && user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      </Route>

      {/* Signed-in app: sidebar + top bar */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />

        <Route path="customers" element={guard(<CustomerList />, 'customers.view')} />
        <Route path="customers/new" element={guard(<CustomerForm />, 'customers.create')} />
        <Route path="customers/duplicates" element={guard(<DuplicateReview />, 'customers.merge')} />
        <Route path="customers/:id" element={guard(<CustomerDetails />, 'customers.view')} />
        <Route path="customers/:id/edit" element={guard(<CustomerForm />, 'customers.edit')} />

        <Route path="interactions" element={guard(<InteractionList />, 'interactions.view')} />
        <Route path="interactions/new" element={guard(<InteractionForm />, 'interactions.create')} />
        <Route path="interactions/:id" element={guard(<InteractionDetails />, 'interactions.view')} />
        <Route path="interactions/:id/edit" element={guard(<InteractionForm />, 'interactions.edit')} />
        <Route path="follow-ups" element={guard(<FollowUps />, 'interactions.view')} />

        <Route path="orders" element={guard(<OrderList />, 'orders.view')} />
        <Route path="orders/new" element={guard(<OrderForm />, 'orders.create')} />
        <Route path="orders/:id" element={guard(<OrderDetails />, 'orders.view')} />

        <Route path="notifications" element={<Notifications />} />
        <Route path="reports" element={guard(<Reports />, 'reports.view')} />
        <Route path="audit-logs" element={guard(<AuditLogs />, 'audit.view')} />
        <Route path="users" element={guard(<Users />, 'users.manage')} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={guard(<Settings />, 'settings.manage')} />
        <Route path="unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
