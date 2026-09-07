// Wires the native push bridge to auth + routing. Renders nothing.
//  • Feeds the router's navigate to the bridge (so notification taps deep-link,
//    including a tap that cold-started the app).
//  • Registers for push once a hotel admin is logged in.
// Lives inside <BrowserRouter>, so useNavigate is available.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerPush, setNavigator } from '../utils/pushBridge';

export default function PushManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setNavigator(navigate); }, [navigate]);

  useEffect(() => {
    if (user && user.role === 'hoteladmin') registerPush();
  }, [user]);

  return null;
}
