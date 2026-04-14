import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getV1UserMe,
  patchV1UserMe,
  patchV1UserByUsername,
  deleteV1UserMe,
  getV1User,
  putV1UserByUsername,
  deleteV1UserByUsername,
} from "../client";
import { client } from "../client/client.gen";
import type {
  UserResponse,
  PatchMe,
} from "../client/types.gen";

interface User {
  displayName: string;
  name: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  updateUsername: (newUsername: string) => Promise<User>;
  updateDisplayName: (newDisplayName: string) => Promise<User>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<User>;
  deleteAccount: () => Promise<void>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;

  getAllUsers: () => Promise<UserResponse[]>;
  createUser: (userData: { name: string; displayName: string; password: string }) => Promise<UserResponse>;
  deleteUser: (username: string) => Promise<void>;
  hasAdminAccess: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants - Using nginx reverse proxy, all API calls go to /api
const API_BASE_URL = "/api";
const STORAGE_KEYS = {
  USER: "enclave_user",
  CREDENTIALS: "enclave_credentials",
} as const;

// Helper functions for credential management
function encodeCredentials(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

function decodeCredentials(
  encodedCredentials: string
): { username: string; password: string } | null {
  try {
    const decoded = atob(encodedCredentials);
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) return null;
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    if (!username || !password) return null;
    return { username, password };
  } catch {
    return null;
  }
}

function getStoredCredentials(): { username: string; password: string } | null {
  const stored = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
  return stored ? decodeCredentials(stored) : null;
}

function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.CREDENTIALS);
}

// Helper function to configure the API client
function configureClient(username?: string, password?: string): void {
  if (username && password) {
    client.setConfig({
      baseUrl: API_BASE_URL,
      headers: {
        Authorization: `Basic ${encodeCredentials(username, password)}`,
      },
    });
  } else {
    // Try to get credentials from storage
    const credentials = getStoredCredentials();
    if (credentials) {
      client.setConfig({
        baseUrl: API_BASE_URL,
        headers: {
          Authorization: `Basic ${encodeCredentials(
            credentials.username,
            credentials.password
          )}`,
        },
      });
    }
  }
}

// Helper function to handle API errors
function handleApiError(error: unknown): void {
  console.error("API Error:", error);

  // Check if it's an API error with status
  if (error && typeof error === "object" && "status" in error) {
    const apiError = error as {
      status: number;
      body?: { error?: string };
      message?: string;
    };

    if (apiError.status === 401) {
      toast.error("Authentication failed. Please log in again.");
      clearAuthData();
      window.location.assign("/login");
    } else if (apiError.status === 403) {
      toast.error(
        "Access denied. You don't have permission to perform this action."
      );
    } else if (apiError.status >= 400 && apiError.status < 500) {
      const message =
        apiError.body?.error || apiError.message || "Something went wrong";
      toast.error(message);
    } else {
      toast.error("An unexpected error occurred");
    }
  } else {
    toast.error("An unexpected error occurred");
  }
}

// Helper to convert API response to our User type
function mapUserResponse(apiUser: UserResponse): User {
  return {
    displayName: apiUser.displayName,
    name: apiUser.name,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      // Configure client with stored credentials
      configureClient();
    }
    setIsLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<LoginResult> => {
    setIsLoading(true);

    try {
      // Configure client with credentials
      configureClient(username, password);

      // Test authentication by getting current user
      const apiUser = await getV1UserMe();

      if (!apiUser.data) {
        throw new Error("No user data received");
      }

      const user = mapUserResponse(apiUser.data);

      // Store user and credentials
      setUser(user);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(
        STORAGE_KEYS.CREDENTIALS,
        encodeCredentials(username, password)
      );

      setIsLoading(false);
      return { success: true };
    } catch (error) {
      console.error("Login failed:", error);
      handleApiError(error);
      setIsLoading(false);
      return { success: false, error: "Invalid username or password." };
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthData();
    // Clear client configuration
    client.setConfig({
      baseUrl: API_BASE_URL,
      headers: {},
    });
  };

  const updateUsername = async (newUsername: string): Promise<User> => {
    try {
      const credentials = getStoredCredentials();
      if (!credentials) {
        throw new Error("No stored credentials found");
      }

      configureClient();

      // Username rename is done via the admin patch endpoint
      const response = await patchV1UserByUsername({
        path: { username: credentials.username },
        body: {},
      });

      if (!response.data) {
        throw new Error("No response data received");
      }

      // Note: the new API does not support renaming usernames.
      // We update display name only and keep existing username.
      const updatedUser = mapUserResponse(response.data);
      void newUsername; // username change not supported by new API

      // Update user state and localStorage
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

      return updatedUser;
    } catch (error) {
      console.error("Failed to update username:", error);
      handleApiError(error);
      throw error;
    }
  };

  const updateDisplayName = async (newDisplayName: string): Promise<User> => {
    try {
      configureClient(); // Use stored credentials

      const patchData: PatchMe = { displayName: newDisplayName };
      const response = await patchV1UserMe({ body: patchData });

      if (!response.data) {
        throw new Error("No response data received");
      }

      const updatedUser = mapUserResponse(response.data);

      // Update user state and localStorage
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));

      return updatedUser;
    } catch (error) {
      console.error("Failed to update display name:", error);
      handleApiError(error);
      throw error;
    }
  };

  const updatePassword = async (
    oldPassword: string,
    newPassword: string
  ): Promise<User> => {
    try {
      // First verify old password by configuring with it
      const credentials = getStoredCredentials();
      if (!credentials) {
        throw new Error("No stored credentials found");
      }

      configureClient(credentials.username, oldPassword);

      // Verify old password by making a request
      await getV1UserMe();

      // Now update password
      const patchData: PatchMe = { password: newPassword };
      const response = await patchV1UserMe({ body: patchData });

      if (!response.data) {
        throw new Error("No response data received");
      }

      const updatedUser = mapUserResponse(response.data);

      // Update stored credentials with new password
      localStorage.setItem(
        STORAGE_KEYS.CREDENTIALS,
        encodeCredentials(credentials.username, newPassword)
      );
      configureClient(credentials.username, newPassword);

      return updatedUser;
    } catch (error) {
      console.error("Failed to update password:", error);
      handleApiError(error);
      throw error;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      configureClient(); // Use stored credentials

      await deleteV1UserMe();

      // Clear user state and local storage
      setUser(null);
      clearAuthData();

      // Clear client configuration
      client.setConfig({
        baseUrl: API_BASE_URL,
        headers: {},
      });
    } catch (error) {
      console.error("Failed to delete account:", error);
      handleApiError(error);
      throw error;
    }
  };

  // User management functions
  const getAllUsers = async (): Promise<UserResponse[]> => {
    try {
      configureClient();

      const response = await getV1User();

      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }

      return [];
    } catch (error) {
      console.error("Failed to get users:", error);
      handleApiError(error);
      throw error;
    }
  };

  const createUser = async (userData: { name: string; displayName: string; password: string }): Promise<UserResponse> => {
    try {
      configureClient();

      const response = await putV1UserByUsername({
        path: { username: userData.name },
        body: { password: userData.password, displayName: userData.displayName },
      });

      if (!response.data) {
        throw new Error("No user data returned");
      }

      return response.data;
    } catch (error) {
      console.error("Failed to create user:", error);
      handleApiError(error);
      throw error;
    }
  };

  const deleteUser = async (username: string): Promise<void> => {
    try {
      configureClient();

      await deleteV1UserByUsername({ path: { username } });
    } catch (error) {
      console.error("Failed to delete user:", error);
      handleApiError(error);
      throw error;
    }
  };

  const hasAdminAccess = (): boolean => {
    return user !== null;
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    updateUsername,
    updateDisplayName,
    updatePassword,
    deleteAccount,
    isLoading,
    getAllUsers,
    createUser,
    deleteUser,
    hasAdminAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
