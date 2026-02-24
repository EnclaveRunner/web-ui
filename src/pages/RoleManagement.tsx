import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// UI Components
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Icons
import {
  IconShield,
  IconPlus,
  IconSearch,
  IconTrash,
  IconShieldOff,
  IconRefresh,
  IconUsers,
  IconDatabase,
} from "@tabler/icons-react";

// API Client
import {
  getRbacListRoles,
  postRbacRole,
  deleteRbacRole,
  getRbacRole,
  getRbacListResourceGroups,
  postRbacResourceGroup,
  deleteRbacResourceGroup,
  getRbacResourceGroup,
  getUsersUser,
  getRbacPolicy,
  postRbacPolicy,
  deleteRbacPolicy,
  postRbacEndpoint,
} from "../client";
import { client } from "../client/client.gen";
import type { RbacPolicy } from "../client";

// ===== TYPES =====
interface UserDetail {
  id: string;
  name: string;
  displayName: string;
}

interface Role {
  name: string;
  users?: UserDetail[];
  isLoading?: boolean;
  hasUserAccess?: boolean; // Track if user can access user details
}

interface ResourceGroup {
  name: string;
  endpoints?: string[];
  isLoading?: boolean;
  hasEndpointAccess?: boolean; // Track if user can access endpoint details
}

interface CreateRoleFormData {
  name: string;
}

interface CreateResourceGroupFormData {
  name: string;
  endpoints: string[];
}

// ===== CONSTANTS =====
const EMPTY_ROLE_FORM: CreateRoleFormData = {
  name: "",
};

const EMPTY_RESOURCE_GROUP_FORM: CreateResourceGroupFormData = {
  name: "",
  endpoints: [],
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
        baseUrl: "/api", // Using nginx reverse proxy
        headers: {
          Authorization: `Basic ${storedCredentials}`,
        },
      });
    } catch {
      throw new Error(
        "Failed to configure API client with existing credentials"
      );
    }
  }
}

/**
 * Handle API errors consistently
 */
function handleApiError(error: unknown, defaultMessage: string): void {
  const err = error as { body?: { error?: string } };
  toast.error(err.body?.error || defaultMessage);
}

// ===== MAIN COMPONENT =====
export default function RoleManagement() {
  // ===== STATE =====
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [activeTab, setActiveTab] = useState<"roles" | "groups" | "policies">(
    "roles"
  );

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [createRoleDialogOpen, setCreateRoleDialogOpen] = useState(false);
  const [createRoleFormData, setCreateRoleFormData] =
    useState<CreateRoleFormData>(EMPTY_ROLE_FORM);
  const [roleLoading, setRoleLoading] = useState(false);

  // Resource groups state
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createGroupFormData, setCreateGroupFormData] =
    useState<CreateResourceGroupFormData>(EMPTY_RESOURCE_GROUP_FORM);
  const [groupLoading, setGroupLoading] = useState(false);

  // Policies state
  const [policies, setPolicies] = useState<RbacPolicy[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<string[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [createPolicyDialogOpen, setCreatePolicyDialogOpen] = useState(false);
  const [createPolicyFormData, setCreatePolicyFormData] = useState({
    role: "",
    resourceGroup: "",
    permission: "*",
  });
  // Function to discover endpoints from OpenAPI specification
  const discoverEndpoints = useCallback(async () => {
    try {
      setEndpointsLoading(true);
      // Fetch the OpenAPI specification
      const response = await fetch('/openapi.yml');
      if (!response.ok) {
        throw new Error('Failed to fetch OpenAPI specification');
      }
      
      const yamlText = await response.text();
      
      // Simple YAML parsing for paths section
      // This is a basic parser focused on extracting endpoint paths
      const pathsMatch = yamlText.match(/^paths:\s*([\s\S]*?)^(?:\w|$)/m);
      if (!pathsMatch) {
        throw new Error('No paths section found in OpenAPI spec');
      }
      
      const pathsSection = pathsMatch[1];
      const endpointMatches = pathsSection.match(/^\s{2}(\/[^:]+):/gm);
      
      if (endpointMatches) {
        const endpoints = endpointMatches
          .map(match => match.trim().replace(':', ''))
          .filter(endpoint => endpoint.startsWith('/'))
          .sort();
        
        setDiscoveredEndpoints(endpoints);
      } else {
        setDiscoveredEndpoints([]);
      }
    } catch (error) {
      console.error('Error discovering endpoints:', error);
      // Fallback to common endpoints if auto-discovery fails
      setDiscoveredEndpoints([
        '/users/user',
        '/users/list',
        '/artifacts/list',
        '/artifacts/artifact',
        '/tasks/list',
        '/tasks/task',
        '/rbac/roles',
        '/rbac/policies',
        '/rbac/resource-groups'
      ]);
    } finally {
      setEndpointsLoading(false);
    }
  }, []);

  // ===== POLICIES =====
  const loadPolicies = useCallback(async () => {
    try {
      configureClient();
      setPolicyLoading(true);
      const response = await getRbacPolicy();
      if (response.data && Array.isArray(response.data)) {
        setPolicies(response.data);
      } else {
        setPolicies([]);
      }
    } catch (error) {
      setPolicies([]);
      handleApiError(error, "Failed to load policies");
    } finally {
      setPolicyLoading(false);
    }
  }, []);

  const handleCreatePolicy = async () => {
    const { role, resourceGroup, permission } = createPolicyFormData;
    if (!role || !resourceGroup || !permission) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      setPolicyLoading(true);
      configureClient();
      await postRbacPolicy({
        body: {
          role,
          resourceGroup,
          permission: permission as RbacPolicy["permission"],
        },
      });
      toast.success("Policy created successfully");
      setCreatePolicyDialogOpen(false);
      setCreatePolicyFormData({ role: "", resourceGroup: "", permission: "*" });
      loadPolicies();
    } catch (error) {
      handleApiError(error, "Failed to create policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleDeletePolicy = async (policy: RbacPolicy) => {
    try {
      setPolicyLoading(true);
      configureClient();
      await deleteRbacPolicy({ body: policy });
      toast.success("Policy deleted successfully");
      loadPolicies();
    } catch (error) {
      handleApiError(error, "Failed to delete policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  // ===== DATA LOADING =====
  const loadRoles = useCallback(async () => {
    try {
      configureClient();
      const rolesResponse = await getRbacListRoles();
      if (!rolesResponse.response.ok) {
        setHasAccess(false);
      }
      if (rolesResponse.data && Array.isArray(rolesResponse.data)) {
        // API returns Array<string>, so map directly to role objects
        const rolesData = rolesResponse.data.map((roleName) => ({
          name: String(roleName),
          users: [],
          isLoading: true,
          hasUserAccess: true,
        }));
        setRoles(rolesData);

        rolesResponse.data.forEach((roleName) => {
          loadRoleUsers(String(roleName));
        });
      } else {
        setRoles([]);
      }
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number } };
      const status = err.status || err.response?.status;

      if (status === 403) {
        setRoles([]);
        throw error;
      } else if (status === 401) {
        toast.error("Authentication required");
        window.location.assign("/login");
        throw error;
      } else {
        setRoles([]);
        throw error;
      }
    }
  }, []);

  const loadResourceGroups = useCallback(async () => {
    try {
      configureClient();
      const groupsResponse = await getRbacListResourceGroups();

      if (groupsResponse.data && Array.isArray(groupsResponse.data)) {
        // API returns Array<string>, so map directly to group objects
        const groupsData = groupsResponse.data.map((groupName) => ({
          name: String(groupName),
          endpoints: [],
          isLoading: true,
          hasEndpointAccess: true,
        }));
        setResourceGroups(groupsData);

        // Load endpoints for each group immediately
        groupsResponse.data.forEach((groupName) => {
          loadGroupEndpoints(String(groupName));
        });
      } else {
        setResourceGroups([]);
      }
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number } };
      const status = err.status || err.response?.status;

      if (status === 403) {
        setResourceGroups([]);
        throw error; // Let the parent handle access denial
      } else if (status === 401) {
        toast.error("Authentication required");
        window.location.assign("/login");
        throw error;
      } else {
        setResourceGroups([]);
        throw error;
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setHasAccess(true);

      await Promise.all([loadRoles(), loadResourceGroups()]);
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number } };
      const status = err.status || err.response?.status;

      if (status === 403) {
        setHasAccess(false);
      } else if (status === 401) {
        toast.error("Authentication required");
        window.location.assign("/login");
      } else {
        handleApiError(error, "Failed to load data");
        setHasAccess(false);
      }
    } finally {
      setLoading(false);
    }
  }, [loadRoles, loadResourceGroups]);

  useEffect(() => {
    loadData();
    loadPolicies();
    discoverEndpoints();
  }, [loadData, discoverEndpoints]);

  // ===== ROLE MANAGEMENT ACTIONS =====
  const handleCreateRole = async () => {
    const { name } = createRoleFormData;

    if (!name) {
      toast.error("Please enter a role name");
      return;
    }

    try {
      setRoleLoading(true);
      configureClient();

      await postRbacRole({
        body: { role: name },
      });

      toast.success("Role created successfully");
      resetRoleForm();
      loadRoles();
    } catch (error: unknown) {
      handleApiError(error, "Failed to create role");
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteRole = async (roleName: string) => {
    try {
      configureClient();
      await deleteRbacRole({ body: { role: roleName } });
      toast.success(`Role "${roleName}" deleted successfully`);
      loadRoles();
    } catch (error: unknown) {
      handleApiError(error, "Failed to delete role");
    }
  };

  // ===== RESOURCE GROUP MANAGEMENT ACTIONS =====
  const handleCreateResourceGroup = async () => {
    const { name, endpoints } = createGroupFormData;

    if (!name) {
      toast.error("Please enter a resource group name");
      return;
    }

    try {
      setGroupLoading(true);
      configureClient();

      // Create the resource group first
      await postRbacResourceGroup({
        body: { resourceGroup: name },
      });

      // Assign each selected endpoint to the resource group
      if (endpoints.length > 0) {
        await Promise.all(
          endpoints.map((endpoint) =>
            postRbacEndpoint({
              body: {
                resourceGroup: name,
                endpoint,
              },
            })
          )
        );
      }

      toast.success(`Resource group created successfully${endpoints.length > 0 ? ` with ${endpoints.length} endpoint(s)` : ''}`);
      resetGroupForm();
      loadResourceGroups();
    } catch (error: unknown) {
      handleApiError(error, "Failed to create resource group");
    } finally {
      setGroupLoading(false);
    }
  };

  const handleDeleteResourceGroup = async (groupName: string) => {
    try {
      configureClient();
      await deleteRbacResourceGroup({ body: { resourceGroup: groupName } });
      toast.success(`Resource group "${groupName}" deleted successfully`);
      loadResourceGroups();
    } catch (error: unknown) {
      handleApiError(error, "Failed to delete resource group");
    }
  };

  // ===== DETAIL LOADING =====
  const loadRoleUsers = async (roleName: string) => {
    try {
      configureClient();
      const response = await getRbacRole({ query: { role: roleName } });

      // Check if we got a valid response with expected data format
      if (
        response.data &&
        Array.isArray(response.data) &&
        response.response.ok
      ) {
        // Fetch user details for each user ID
        const userPromises = response.data.map(async (userId: string) => {
          try {
            const userResponse = await getUsersUser({ query: { userId } });
            if (!userResponse.response.ok) {
              throw new Error("Failed to fetch user details");
            }
            return userResponse.data as UserDetail;
          } catch {
            // If we can't get display name, return null to indicate failure
            return null;
          }
        });

        // Await all user detail promises, throwing if any fail
        let userDetailsResults: (UserDetail | null)[];
        try {
          userDetailsResults = await Promise.all(userPromises);
        } catch {
          // If any promise rejects, treat as access denied for this role
          throw new Error("Failed to resolve user details");
        }

        const userDetails = userDetailsResults.filter(
          (user): user is UserDetail => user !== null
        );

        // Check if we got all user details or if some failed
        const hasUserDetailAccess =
          userDetailsResults.length > 0 &&
          userDetailsResults.every((user) => user !== null);

        // Update the role with user details and remove loading state
        setRoles((prev) =>
          prev.map((role) =>
            role.name === roleName
              ? {
                  ...role,
                  users: userDetails,
                  isLoading: false,
                  hasUserAccess: hasUserDetailAccess,
                }
              : role
          )
        );
      } else {
        // Invalid response format - show "-"
        throw new Error("Invalid response format from API");
      }
    } catch {
      // Any error (403, 401, network, invalid response, etc.) should show "-"
      setRoles((prev) =>
        prev.map((role) =>
          role.name === roleName
            ? { ...role, users: [], isLoading: false, hasUserAccess: false }
            : role
        )
      );
    }
  };

  const loadGroupEndpoints = async (groupName: string) => {
    try {
      configureClient();
      const response = await getRbacResourceGroup({
        query: { resourceGroup: groupName },
      });

      // Check if we got a valid response with expected data format
      if (
        response.data &&
        Array.isArray(response.data) &&
        response.response.ok
      ) {
        // Update the group with endpoints and remove loading state
        setResourceGroups((prev) =>
          prev.map((group) =>
            group.name === groupName
              ? {
                  ...group,
                  endpoints: response.data as string[],
                  isLoading: false,
                  hasEndpointAccess: true,
                }
              : group
          )
        );
      } else {
        // Invalid response format - show "-"
        throw new Error("Invalid response format from API");
      }
    } catch {
      // Any error (403, 401, network, invalid response, etc.) should show "-"
      setResourceGroups((prev) =>
        prev.map((group) =>
          group.name === groupName
            ? {
                ...group,
                endpoints: [],
                isLoading: false,
                hasEndpointAccess: false,
              }
            : group
        )
      );
    }
  };

  // ===== COMPUTED VALUES =====
  const filteredRoles = roles.filter((role) => {
    const searchLower = searchTerm.toLowerCase();
    return role.name.toLowerCase().includes(searchLower);
  });

  // Edit Policy Dialog State
  const [editPolicyDialogOpen, setEditPolicyDialogOpen] = useState(false);
  const [editPolicyFormData, setEditPolicyFormData] =
    useState<RbacPolicy | null>(null);

  const handleEditPolicy = (policy: RbacPolicy) => {
    setEditPolicyFormData(policy);
    setEditPolicyDialogOpen(true);
  };

  // Filtered policies for search
  const filteredPolicies = policies.filter((policy: RbacPolicy) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      policy.role.toLowerCase().includes(searchLower) ||
      policy.resourceGroup.toLowerCase().includes(searchLower) ||
      policy.permission.toLowerCase().includes(searchLower)
    );
  });

  const handleUpdatePolicy = async () => {
    if (!editPolicyFormData) return;
    try {
      setPolicyLoading(true);
      configureClient();
      // Remove old policy, then add new one
      await deleteRbacPolicy({ body: editPolicyFormData });
      await postRbacPolicy({ body: editPolicyFormData });
      toast.success("Policy updated successfully");
      setEditPolicyDialogOpen(false);
      setEditPolicyFormData(null);
      loadPolicies();
    } catch (error) {
      handleApiError(error, "Failed to update policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  const filteredResourceGroups = resourceGroups.filter((group) => {
    const searchLower = searchTerm.toLowerCase();
    return group.name.toLowerCase().includes(searchLower);
  });

  // ===== RENDER HELPERS =====
  const resetRoleForm = () => {
    setCreateRoleFormData(EMPTY_ROLE_FORM);
    setCreateRoleDialogOpen(false);
  };

  const resetGroupForm = () => {
    setCreateGroupFormData(EMPTY_RESOURCE_GROUP_FORM);
    setCreateGroupDialogOpen(false);
  };

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <PageLayout title="Role & Group Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading roles and groups...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ===== ACCESS DENIED STATE =====
  if (!hasAccess && !loading) {
    return (
      <PageLayout title="Role & Group Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <IconShieldOff className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground max-w-md">
              You don't have permission to access role and group management.
              Contact your administrator if you believe this is an error.
            </p>
            <div className="flex justify-center space-x-2 pt-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                Go Back
              </Button>
              <Button variant="default" onClick={loadData}>
                <IconRefresh className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <PageLayout title="Role & Group Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconShield className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Role & Group Management</h1>
          </div>

          <Button variant="outline" onClick={loadData} disabled={loading}>
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSearch className="h-5 w-5" />
              Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search roles and groups..."
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

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value: string) =>
            setActiveTab(value as "roles" | "groups")
          }
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <IconUsers className="h-4 w-4" />
              Roles ({filteredRoles.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <IconDatabase className="h-4 w-4" />
              Resource Groups ({filteredResourceGroups.length})
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              Policies ({policies.length})
            </TabsTrigger>
          </TabsList>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Roles</h3>
                <p className="text-muted-foreground">
                  Manage system roles and permissions
                </p>
              </div>

              <Dialog
                open={createRoleDialogOpen}
                onOpenChange={setCreateRoleDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>
                      Add a new role to the system with its basic information.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="role-name" className="text-right">
                        Name *
                      </Label>
                      <Input
                        id="role-name"
                        value={createRoleFormData.name}
                        onChange={(e) =>
                          setCreateRoleFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="col-span-3"
                        placeholder="Enter role name"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={resetRoleForm}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRole} disabled={roleLoading}>
                      {roleLoading ? "Creating..." : "Create Role"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {filteredRoles.length === 0 ? (
                  <div className="text-center py-8">
                    <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No roles found</h3>
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Try adjusting your search terms."
                        : "Create your first role to get started."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRoles.map((role, index) => (
                        <TableRow
                          key={role.name || index}
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="font-medium">
                            {role.name}
                          </TableCell>
                          <TableCell>
                            {role.hasUserAccess === false ? (
                              <Badge variant="secondary">
                                <IconUsers className="h-3 w-3 mr-1" />-
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="secondary"
                                          className="cursor-pointer hover:bg-gray-200 transition-colors"
                                        >
                                          <IconUsers className="h-3 w-3 mr-1" />
                                          {role.isLoading
                                            ? "Loading..."
                                            : `${
                                                role.users?.length || 0
                                              } users`}
                                        </Badge>
                                      </TooltipTrigger>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <h4 className="font-medium">
                                          Users in role: {role.name}
                                        </h4>
                                        {role.isLoading ? (
                                          <p className="text-sm text-muted-foreground">
                                            Loading users...
                                          </p>
                                        ) : role.users &&
                                          role.users.length > 0 ? (
                                          <div className="max-h-40 overflow-y-auto">
                                            {role.users.map((user, idx) => (
                                              <div
                                                key={user.id || idx}
                                                className="text-sm py-2 px-3 bg-muted rounded mb-1 border"
                                              >
                                                <div className="font-medium text-foreground">
                                                  {user.displayName}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                  {user.name}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">
                                            No users assigned to this role
                                          </p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <TooltipContent>
                                    <p>Click to view users in this role</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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
                                    <AlertDialogTitle>
                                      Delete Role
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete role "
                                      {role.name}"? This action cannot be undone
                                      and will affect all users with this role.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDeleteRole(role.name)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Role
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
          </TabsContent>

          {/* Resource Groups Tab */}
          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Policies</h3>
                <p className="text-muted-foreground">
                  Map roles to resource groups and manage permissions
                </p>
              </div>
              <Dialog
                open={createPolicyDialogOpen}
                onOpenChange={setCreatePolicyDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Add Policy
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Policy</DialogTitle>
                    <DialogDescription>
                      Create a new policy mapping a role to a resource group and
                      permission.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="policy-role" className="text-right">
                        Role *
                      </Label>
                      <Select
                        value={createPolicyFormData.role}
                        onValueChange={(value) =>
                          setCreatePolicyFormData((prev) => ({
                            ...prev,
                            role: value,
                          }))
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.name} value={role.name}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="policy-group" className="text-right">
                        Resource Group *
                      </Label>
                      <Select
                        value={createPolicyFormData.resourceGroup}
                        onValueChange={(value) =>
                          setCreatePolicyFormData((prev) => ({
                            ...prev,
                            resourceGroup: value,
                          }))
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select resource group" />
                        </SelectTrigger>
                        <SelectContent>
                          {resourceGroups.map((group) => (
                            <SelectItem key={group.name} value={group.name}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="policy-permission" className="text-right">
                        Permission *
                      </Label>
                      <Select
                        value={createPolicyFormData.permission}
                        onValueChange={(value) =>
                          setCreatePolicyFormData((prev) => ({
                            ...prev,
                            permission: value as RbacPolicy["permission"],
                          }))
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select permission" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="*">*</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                          <SelectItem value="HEAD">HEAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreatePolicyDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreatePolicy}
                      disabled={policyLoading}
                    >
                      {policyLoading ? "Creating..." : "Add Policy"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Card>
              <CardContent className="p-0">
                {policyLoading ? (
                  <div className="text-center py-8">Loading policies...</div>
                ) : policies.length === 0 ? (
                  <div className="text-center py-8">
                    <IconShield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No policies found</h3>
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Try adjusting your search terms."
                        : "Create your first policy to get started."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Resource Group</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPolicies.map((policy: RbacPolicy) => (
                        <TableRow
                          key={
                            policy.role +
                            policy.resourceGroup +
                            policy.permission
                          }
                        >
                          <TableCell>{policy.role}</TableCell>
                          <TableCell>{policy.resourceGroup}</TableCell>
                          <TableCell>{policy.permission}</TableCell>
                          <TableCell className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPolicy(policy)}
                              disabled={policyLoading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePolicy(policy)}
                              disabled={policyLoading}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Edit Policy Dialog */}
                      <Dialog
                        open={editPolicyDialogOpen}
                        onOpenChange={setEditPolicyDialogOpen}
                      >
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Policy</DialogTitle>
                            <DialogDescription>
                              Modify the role, resource group, or permission for
                              this policy.
                            </DialogDescription>
                          </DialogHeader>
                          {editPolicyFormData && (
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label
                                  htmlFor="edit-policy-role"
                                  className="text-right"
                                >
                                  Role *
                                </Label>
                                <Select
                                  value={editPolicyFormData.role}
                                  onValueChange={(value) =>
                                    setEditPolicyFormData((prev) =>
                                      prev ? { ...prev, role: value } : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.map((role) => (
                                      <SelectItem
                                        key={role.name}
                                        value={role.name}
                                      >
                                        {role.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label
                                  htmlFor="edit-policy-group"
                                  className="text-right"
                                >
                                  Resource Group *
                                </Label>
                                <Select
                                  value={editPolicyFormData.resourceGroup}
                                  onValueChange={(value) =>
                                    setEditPolicyFormData((prev) =>
                                      prev
                                        ? { ...prev, resourceGroup: value }
                                        : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select resource group" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {resourceGroups.map((group) => (
                                      <SelectItem
                                        key={group.name}
                                        value={group.name}
                                      >
                                        {group.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label
                                  htmlFor="edit-policy-permission"
                                  className="text-right"
                                >
                                  Permission *
                                </Label>
                                <Select
                                  value={editPolicyFormData.permission}
                                  onValueChange={(value) =>
                                    setEditPolicyFormData((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            permission:
                                              value as RbacPolicy["permission"],
                                          }
                                        : prev
                                    )
                                  }
                                >
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select permission" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="*">*</SelectItem>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                    <SelectItem value="DELETE">
                                      DELETE
                                    </SelectItem>
                                    <SelectItem value="HEAD">HEAD</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setEditPolicyDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleUpdatePolicy}
                              disabled={policyLoading}
                            >
                              {policyLoading ? "Saving..." : "Save Changes"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="groups" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Resource Groups</h3>
                <p className="text-muted-foreground">
                  Manage resource groups and endpoint access
                </p>
              </div>

              <Dialog
                open={createGroupDialogOpen}
                onOpenChange={setCreateGroupDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Create Resource Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Resource Group</DialogTitle>
                    <DialogDescription>
                      Add a new resource group to organize endpoint access.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="group-name" className="text-right">
                        Name *
                      </Label>
                      <Input
                        id="group-name"
                        value={createGroupFormData.name}
                        onChange={(e) =>
                          setCreateGroupFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="col-span-3"
                        placeholder="Enter group name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="group-endpoints" className="text-right pt-2">
                        Endpoints
                      </Label>
                      <div className="col-span-3 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Select from available API endpoints to assign to this resource group (auto-discovered from OpenAPI specification)
                        </p>
                        
                        {/* Available endpoints from OpenAPI specification */}
                        {(() => {
                          // Combine discovered endpoints with any existing ones from resource groups
                          const existingEndpoints = new Set<string>();
                          resourceGroups.forEach((group) => {
                            if (group.endpoints && group.hasEndpointAccess) {
                              group.endpoints.forEach((endpoint) => {
                                existingEndpoints.add(endpoint);
                              });
                            }
                          });
                          
                          // Merge discovered endpoints with existing ones, prioritizing discovered ones
                          const allAvailableEndpoints = [...new Set([
                            ...discoveredEndpoints,
                            ...Array.from(existingEndpoints)
                          ])].sort();
                          
                          return endpointsLoading ? (
                            <div className="text-sm text-muted-foreground p-2 border rounded flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              Loading available endpoints...
                            </div>
                          ) : allAvailableEndpoints.length > 0 ? (
                            <Select
                              value=""
                              onValueChange={(endpoint) => {
                                if (endpoint && !createGroupFormData.endpoints.includes(endpoint)) {
                                  setCreateGroupFormData((prev) => ({
                                    ...prev,
                                    endpoints: [...prev.endpoints, endpoint],
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an endpoint to add..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allAvailableEndpoints
                                  .filter(endpoint => !createGroupFormData.endpoints.includes(endpoint))
                                  .map((endpoint) => {
                                    const isFromOpenAPI = discoveredEndpoints.includes(endpoint);
                                    return (
                                      <SelectItem key={endpoint} value={endpoint}>
                                        <div className="flex items-center gap-2">
                                          {endpoint}
                                          {isFromOpenAPI && (
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                              API
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-muted-foreground p-2 border rounded">
                              No endpoints available. There may be an issue loading the API specification.
                            </div>
                          );
                        })()}
                        
                        {/* Selected endpoints */}
                        {createGroupFormData.endpoints.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Selected endpoints:</p>
                            <div className="flex flex-wrap gap-2">
                              {createGroupFormData.endpoints.map((endpoint) => (
                                <Badge
                                  key={endpoint}
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                >
                                  {endpoint}
                                  <button
                                    onClick={() => {
                                      setCreateGroupFormData((prev) => ({
                                        ...prev,
                                        endpoints: prev.endpoints.filter(ep => ep !== endpoint),
                                      }));
                                    }}
                                    className="ml-1 hover:bg-red-100 rounded-full p-0.5"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={resetGroupForm}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateResourceGroup}
                      disabled={groupLoading}
                    >
                      {groupLoading ? "Creating..." : "Create Group"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {filteredResourceGroups.length === 0 ? (
                  <div className="text-center py-8">
                    <IconDatabase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">
                      No resource groups found
                    </h3>
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Try adjusting your search terms."
                        : "Create your first resource group to get started."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Endpoints</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResourceGroups.map((group, index) => (
                        <TableRow
                          key={group.name || index}
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="font-medium">
                            {group.name}
                          </TableCell>
                          <TableCell>
                            {group.hasEndpointAccess === false ? (
                              <Badge variant="secondary">
                                <IconDatabase className="h-3 w-3 mr-1" />-
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="secondary"
                                          className="cursor-pointer hover:bg-gray-200 transition-colors"
                                        >
                                          <IconDatabase className="h-3 w-3 mr-1" />
                                          {group.isLoading
                                            ? "Loading..."
                                            : `${
                                                group.endpoints?.length || 0
                                              } endpoints`}
                                        </Badge>
                                      </TooltipTrigger>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <h4 className="font-medium">
                                          Endpoints in group: {group.name}
                                        </h4>
                                        {group.isLoading ? (
                                          <p className="text-sm text-muted-foreground">
                                            Loading endpoints...
                                          </p>
                                        ) : group.endpoints &&
                                          group.endpoints.length > 0 ? (
                                          <div className="max-h-40 overflow-y-auto">
                                            {group.endpoints.map((endpoint) => (
                                              <div
                                                key={endpoint}
                                                className="text-sm py-2 px-3 bg-muted rounded mb-1 font-mono border text-foreground"
                                              >
                                                {endpoint}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">
                                            No endpoints in this group
                                          </p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  <TooltipContent>
                                    <p>Click to view endpoints in this group</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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
                                    <AlertDialogTitle>
                                      Delete Resource Group
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete resource
                                      group "{group.name}"? This action cannot
                                      be undone and will affect endpoint access.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDeleteResourceGroup(group.name)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Group
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
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
