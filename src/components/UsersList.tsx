import { useEffect, useState } from 'react';

export default function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  // Use the environment variable for server URL
  const SERVER_URL = import.meta.env.VITE_SERVER_URL;

  useEffect(() => {
    fetch(`${SERVER_URL}/api/auth/users`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">All Users</h1>
      <ul className="space-y-4">
        {users.map((user, idx) => (
          <li key={idx} className="border rounded-lg p-4 shadow">
            <div className="flex items-center gap-4">
              <img src={user.avatar} className="w-12 h-12 rounded-full" alt={user.name} />
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
