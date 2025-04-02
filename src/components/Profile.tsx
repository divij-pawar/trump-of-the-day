import { useEffect, useState } from "react";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/auth/user", {
          credentials: "include",
        });

        if (!res.ok) {
          setError("You must be logged in to view this page.");
          setUser(null);
        } else {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Failed to fetch user.");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) return <div className="p-4 text-center">Loading profile...</div>;

  if (error)
    return (
      <div className="p-4 text-center text-red-600 font-medium">{error}</div>
    );

  return (
    <div className="p-8 max-w-lg mx-auto bg-white dark:bg-gray-800 rounded shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Your Profile
      </h1>
      {user.avatar && (
        <img
          src={user.avatar}
          className="w-24 h-24 rounded-full mb-4"
          alt="avatar"
        />
      )}
      <p className="text-gray-700 dark:text-gray-200">
        <strong>Name:</strong> {user.name}
      </p>
      <p className="text-gray-700 dark:text-gray-200">
        <strong>Email:</strong> {user.email}
      </p>
    </div>
  );
}
