import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// UI Components
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import {
  IconUsers,
  IconPlus,
  IconSearch,
  IconTrash,
  IconEdit,
  IconShield,
  IconShieldOff,
  IconRefresh,
} from "@tabler/icons-react";

// API Client
import {
  getUsersList,
  postUsersUser,
  deleteUsersUser,
  getRbacListRoles,
  postRbacUser,
  deleteRbacUser,
  getRbacUser,
} from "../client";
import { client } from "../client/client.gen";
import type { UserResponse } from "../client/types.gen";

// ===== TYPES =====
interface User extends UserResponse {
  roles: string[];
}

interface CreateUserFormData {
  name: string;
  displayName: string;
  password: string;
}

// ===== CONSTANTS =====
const EMPTY_CREATE_FORM: CreateUserFormData = {
  name: "",
  displayName: "",
  password: "",
};

// ===== UTILITY FUNCTIONS =====
/**
 * Configure the API client with stored authentication credentials
 */
function configureClient(): void {
  const storedCredentials = localStorage.getItem("enclave_credentials");
  if (storedCredentials) {
    try {
      client.setConfig({
        baseUrl: "/api",
        headers: {
          Authorization: `Basic ${storedCredentials}`,
        },
      });
    } catch (error) {
      console.error("Failed to configure client:", error);
    }
  }
}

/**
 * Parse role data from API response into a clean array of role names
 */
function parseRoles(roleData: unknown[]): string[] {
  return roleData.map((role) => {
    if (typeof role === "string") return role;
    if (role && typeof role === "object" && "name" in role) {
      return (role as { name: string }).name;
    }
    if (role && typeof role === "object" && "role" in role) {
      return (role as { role: string }).role;
    }
    return String(role);
  });
}

/**
 * Handle API errors consistently
 */
function handleApiError(error: unknown, defaultMessage: string): void {
  const err = error as { body?: { error?: string } };
  toast.error(err.body?.error || defaultMessage);
}

// ===== MAIN COMPONENT =====
export default function UserManagement() {
  // ===== STATE =====
  // User data and UI state
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasAccess, setHasAccess] = useState(true);

  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] =
    useState<CreateUserFormData>(EMPTY_CREATE_FORM);
  const [createLoading, setCreateLoading] = useState(false);

  // Role management dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);

  // ===== DATA LOADING =====
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setHasAccess(true);
      configureClient();

      const usersResponse = await getUsersList();

      if (!usersResponse.data || !Array.isArray(usersResponse.data)) {
        setUsers([]);
        setHasAccess(false);
        return;
      }

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        usersResponse.data.map(async (user: UserResponse): Promise<User> => {
          try {
            const userRolesResponse = await getRbacUser({
              query: { userId: user.id },
            });

            const roles =
              userRolesResponse.data && Array.isArray(userRolesResponse.data)
                ? parseRoles(userRolesResponse.data)
                : [];

            return { ...user, roles };
          } catch (error) {
            console.warn(`Failed to get roles for user ${user.name}:`, error);
            return { ...user, roles: [] };
          }
        })
      );

      setUsers(usersWithRoles);
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number } };
      const status = err.status || err.response?.status;

      if (status === 403) {
        setHasAccess(false);
        setUsers([]);
      } else if (status === 401) {
        toast.error("Authentication required");
        window.location.assign("/login");
      } else {
        handleApiError(error, "Failed to load users");
        setHasAccess(false);
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAvailableRoles = useCallback(async () => {
    try {
      configureClient();
      const rolesResponse = await getRbacListRoles();

      const roleNames =
        rolesResponse.data && Array.isArray(rolesResponse.data)
          ? parseRoles(rolesResponse.data)
          : [];

      setAvailableRoles(roleNames);
    } catch (error) {
      console.error("Failed to load available roles:", error);
      setAvailableRoles([]);
    }
  }, []);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ===== USER MANAGEMENT ACTIONS =====
  const handleCreateUser = async () => {
    const { name, displayName, password } = createFormData;

    if (!name || !displayName || !password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setCreateLoading(true);
      configureClient();

      await postUsersUser({
        body: { name, displayName, password },
      });

      toast.success("User created successfully");
      resetCreateForm();
      loadUsers();
    } catch (error: unknown) {
      handleApiError(error, "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      configureClient();
      await deleteUsersUser({ body: { id: userId } });
      toast.success(`User ${userName} deleted successfully`);
      loadUsers();
    } catch (error: unknown) {
      handleApiError(error, "Failed to delete user");
    }
  };

  // ===== ROLE MANAGEMENT =====
  const handleManageRoles = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setSelectedUser(user);
    setRoleDialogOpen(true);

    await Promise.all([loadAvailableRoles(), fetchUserRoles(userId)]);
  };

  const fetchUserRoles = async (userId: string) => {
    try {
      configureClient();
      const userRolesResponse = await getRbacUser({
        query: { userId },
      });

      if (userRolesResponse.data && Array.isArray(userRolesResponse.data)) {
        const roles = parseRoles(userRolesResponse.data);

        // Update both selected user and users list
        setSelectedUser((prev) => (prev ? { ...prev, roles } : null));
        setUsers((prev) =>
          prev.map((user) => (user.id === userId ? { ...user, roles } : user))
        );
      }
    } catch (error) {
      console.warn(`Failed to fetch roles for user ${userId}:`, error);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error("Please select a role to add");
      return;
    }

    if (selectedUser.roles.includes(selectedRole)) {
      toast.error("User already has this role");
      return;
    }

    try {
      setRoleLoading(true);
      configureClient();

      await postRbacUser({
        body: { userId: selectedUser.id, role: selectedRole },
      });

      // Update roles in state immediately
      const newRoles = [...selectedUser.roles, selectedRole];
      setSelectedUser((prev) => (prev ? { ...prev, roles: newRoles } : null));
      setUsers((prev) =>
        prev.map((user) =>
          user.id === selectedUser.id ? { ...user, roles: newRoles } : user
        )
      );

      toast.success(
        `Role "${selectedRole}" added to user ${selectedUser.name}`
      );
      setSelectedRole("");
    } catch (error: unknown) {
      handleApiError(error, "Failed to add role");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleRemoveRole = async (roleToRemove: string) => {
    if (!selectedUser) return;

    try {
      setRoleLoading(true);
      configureClient();

      await deleteRbacUser({
        body: { userId: selectedUser.id, role: roleToRemove },
      });

      // Update roles in state immediately
      const newRoles = selectedUser.roles.filter(
        (role) => role !== roleToRemove
      );
      setSelectedUser((prev) => (prev ? { ...prev, roles: newRoles } : null));
      setUsers((prev) =>
        prev.map((user) =>
          user.id === selectedUser.id ? { ...user, roles: newRoles } : user
        )
      );

      toast.success(
        `Role "${roleToRemove}" removed from user ${selectedUser.name}`
      );
    } catch (error: unknown) {
      handleApiError(error, "Failed to remove role");
    } finally {
      setRoleLoading(false);
    }
  };

  // ===== COMPUTED VALUES =====
  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.displayName.toLowerCase().includes(searchLower)
    );
  });

  const availableRolesForUser = availableRoles.filter(
    (role) => !selectedUser?.roles.includes(role)
  );

  // ===== RENDER HELPERS =====
  const resetCreateForm = () => {
    setCreateFormData(EMPTY_CREATE_FORM);
    setCreateDialogOpen(false);
  };

  const resetRoleDialog = () => {
    setRoleDialogOpen(false);
    setSelectedUser(null);
    setSelectedRole("");
  };

  if (loading) {
    return (
      <PageLayout title="User Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading users...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!hasAccess && !loading) {
    return (
      <PageLayout title="User Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <IconShieldOff className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground max-w-md">
              You don't have permission to access user management. Contact your
              administrator if you believe this is an error.
            </p>
            <div className="flex justify-center space-x-2 pt-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button variant="default" onClick={loadUsers}>
                <IconRefresh className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="User Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-6 w-6" />
            <h1 className="text-2xl font-bold">User Management</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadUsers} disabled={loading}>
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system with their basic information.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="create-name" className="text-right">
                      Username *
                    </Label>
                    <Input
                      id="create-name"
                      value={createFormData.name}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="col-span-3"
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="create-display-name" className="text-right">
                      Display Name *
                    </Label>
                    <Input
                      id="create-display-name"
                      value={createFormData.displayName}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      className="col-span-3"
                      placeholder="Enter display name"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="create-password" className="text-right">
                      Password *
                    </Label>
                    <Input
                      id="create-password"
                      type="password"
                      value={createFormData.password}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="col-span-3"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={resetCreateForm}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateUser} disabled={createLoading}>
                    {createLoading ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Role Management Dialog (for a certain user) */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Manage Roles - {selectedUser?.name}</DialogTitle>
              <DialogDescription>
                Add or remove roles for this user.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Current Roles */}
              <div>
                <Label className="text-sm font-medium">Current Roles</Label>
                <div className="mt-2 space-y-2">
                  {selectedUser?.roles && selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((role) => (
                      <div
                        key={role}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <Badge variant="secondary">{role}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveRole(role)}
                          disabled={roleLoading}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No roles assigned
                    </p>
                  )}
                </div>
              </div>

              {/* Add New Role */}
              <div>
                <Label className="text-sm font-medium">Add Role</Label>
                <div className="mt-2 flex space-x-2">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesForUser.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddRole}
                    disabled={!selectedRole || roleLoading}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetRoleDialog}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSearch className="h-5 w-5" />
              Search Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search by username or display name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No users found</h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Try adjusting your search terms."
                    : "Create your first user to get started."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge
                                key={role}
                                variant={
                                  role === "admin" ? "default" : "secondary"
                                }
                              >
                                {role === "admin" ? (
                                  <IconShield className="h-3 w-3 mr-1" />
                                ) : null}
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline">No roles</Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManageRoles(user.id)}
                          >
                            <IconEdit className="h-3 w-3 mr-1" />
                            Manage
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete user "
                                  {user.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteUser(user.id, user.name)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
