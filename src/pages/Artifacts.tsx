import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// UI Components
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import {
  IconPackage,
  IconSearch,
  IconHash,
  IconCalendar,
  IconUsers,
  IconTag,
  IconCopy,
  IconChevronDown,
  IconFileCode,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconRefresh,
  IconCube,
} from "@tabler/icons-react";

// API Client
import { getArtifactList, deleteArtifact } from "../client";
import { client } from "../client/client.gen";
import type { Artifact } from "../client";

export default function Artifacts() {
  // ===== HOOKS =====
  const navigate = useNavigate();

  // ===== STATE =====
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [hasAccess, setHasAccess] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [artifactToDelete, setArtifactToDelete] = useState<Artifact | null>(null);
  
  // ===== PAGINATION CONSTANTS =====
  const ITEMS_PER_PAGE = 6;

  // ===== CONFIGURE CLIENT =====
  const configureClient = () => {
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
    } else {
      throw new Error("No authentication credentials found");
    }
  };

  // ===== LOAD ARTIFACTS =====
  const loadArtifacts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if we have credentials
      const storedCredentials = localStorage.getItem("enclave_credentials");
      if (!storedCredentials) {
        toast.error("Not authenticated. Please log in.");
        setHasAccess(false);
        setArtifacts([]);
        return;
      }

      configureClient();
      
      const response = await getArtifactList();
      
      if (response.data && Array.isArray(response.data)) {
        setArtifacts(response.data);
        setHasAccess(true);
        toast.success(`Loaded ${response.data.length} artifacts`);
      } else {
        setArtifacts([]);
      }
    } catch (error: unknown) {
      console.error("Error loading artifacts:", error);
      const err = error as { status?: number; body?: { error?: string }; message?: string };
      
      if (err.status === 403 || err.status === 401) {
        setHasAccess(false);
        toast.error("You don't have permission to view artifacts");
      } else {
        setHasAccess(true);
        const errorMessage = err.body?.error || err.message || "Failed to load artifacts";
        toast.error(errorMessage);
        console.error("Full error details:", err);
      }
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== EFFECTS =====
  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  // ===== FILTERING AND PAGINATION =====
  const filteredArtifacts = artifacts.filter((artifact) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      artifact.package.name.toLowerCase().includes(searchLower) ||
      artifact.package.namespace.toLowerCase().includes(searchLower) ||
      artifact.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      artifact.versionHash.toLowerCase().includes(searchLower)
    );
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedArtifacts = filteredArtifacts.slice(startIndex, endIndex);
  const showPagination = filteredArtifacts.length > ITEMS_PER_PAGE;

  // Handle search term change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  // ===== UTILITY FUNCTIONS =====
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPulls = (pulls: number) => {
    if (pulls >= 1000000) return `${(pulls / 1000000).toFixed(1)}M`;
    if (pulls >= 1000) return `${(pulls / 1000).toFixed(1)}K`;
    return pulls.toString();
  };

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${description} copied to clipboard!`);
    } catch (error) {
      toast.error(`Failed to copy ${description.toLowerCase()}`);
      console.error("Copy error:", error);
    }
  };

  const getSortedTags = (tags: string[]) => {
    // Sort tags alphabetically, but if there's a "latest" tag, put it first
    const sortedTags = [...tags].sort();
    const latestIndex = sortedTags.findIndex(tag => tag.toLowerCase() === 'latest');
    if (latestIndex > 0) {
      const latestTag = sortedTags.splice(latestIndex, 1)[0];
      sortedTags.unshift(latestTag);
    }
    return sortedTags;
  };

  const handleDeleteArtifact = (artifact: Artifact) => {
    setArtifactToDelete(artifact);
  };

  const confirmDeleteArtifact = async () => {
    if (!artifactToDelete) return;

    try {
      configureClient();

      await deleteArtifact({
        body: {
          package: artifactToDelete.package,
          identifier: `hash:${artifactToDelete.versionHash}`
        }
      });

      toast.success(`Artifact "${artifactToDelete.package.name}" deleted successfully!`);
      
      // Close dialog and refresh the artifacts list
      setArtifactToDelete(null);
      await loadArtifacts();
      
    } catch (error) {
      console.error("Delete artifact error:", error);
      const err = error as { status?: number; body?: { error?: string }; message?: string };
      
      if (err.status === 403 || err.status === 401) {
        toast.error("You don't have permission to delete this artifact");
      } else if (err.status === 404) {
        toast.error("Artifact not found or already deleted");
      } else {
        const errorMessage = err.message || err.body?.error || 'Unknown error';
        toast.error(`Failed to delete artifact: ${errorMessage}`);
      }
    }
  };



  // ===== RENDER =====
  if (!hasAccess) {
    return (
      <PageLayout title="Artifacts">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <IconPackage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You don't have permission to view artifacts.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Artifacts">
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
            <IconCube className="text-muted-foreground h-8 w-8" />
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Artifacts</h2>
                <p className="text-muted-foreground">
                    Browse and manage your enclave artifacts.
                </p>
            </div>
        </div>

        {/* Search and Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSearch className="h-5 w-5" />
              Search & Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search by name, author, source, tags, or hash..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={() => handleSearchChange("")}>
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={loadArtifacts}
                disabled={loading}
              >
                <IconRefresh
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Artifacts Grid */}
        {loading ? (
          <div className="text-center py-8">
            <IconRefresh className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading artifacts...</p>
          </div>
        ) : filteredArtifacts.length === 0 ? (
          <div className="text-center py-12">
            <IconPackage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No artifacts found</h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Try adjusting your search terms."
                : "No artifacts are available at the moment."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginatedArtifacts.map((artifact) => (
              <Card
                key={`${artifact.package.namespace}-${artifact.package.name}-${artifact.versionHash}`}
                className="group hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconPackage className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base truncate">
                        {artifact.package.name}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-fit text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteArtifact(artifact)}
                        title="Delete Artifact"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <p className="truncate">
                        <strong>Namespace:</strong> {artifact.package.namespace}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          copyToClipboard(artifact.package.namespace, "Namespace")
                        }
                        title="Copy namespace"
                      >
                        <IconCopy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate max-w-[180px] sm:max-w-[260px] md:max-w-[320px] break-all">
                        <strong>Package:</strong>{" "}
                        {`${artifact.package.namespace}/${artifact.package.name}`}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          copyToClipboard(
                            `${artifact.package.namespace}/${artifact.package.name}`,
                            "Package"
                          )
                        }
                        title="Copy package"
                      >
                        <IconCopy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Create Blueprint Button */}
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      // Navigate to blueprint page with artifact data
                      const artifactId = `${artifact.package.namespace}-${artifact.package.name}-${artifact.versionHash}`;
                      navigate(`/blueprint/${encodeURIComponent(artifactId)}`, {
                        state: { artifact },
                      });
                    }}
                    title="Create Blueprint"
                  >
                    <IconFileCode className="h-4 w-4 mr-2" />
                    Create Blueprint
                  </Button>

                  {/* Version Hash */}
                  <div className="flex items-center gap-2">
                    <IconHash className="h-4 w-4 text-muted-foreground" />
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate flex-1">
                      {artifact.versionHash}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        copyToClipboard(artifact.versionHash, "Version hash")
                      }
                      title="Copy hash"
                    >
                      <IconCopy className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Creation Date */}
                  <div className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatDate(artifact.createdAt)}
                    </span>
                  </div>

                  {/* Pull Count */}
                  <div className="flex items-center gap-2">
                    <IconUsers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatPulls(artifact.pulls)} pulls
                    </span>
                  </div>

                  {/* Tags */}
                  {artifact.tags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <IconTag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Tags
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs justify-between min-w-0"
                            >
                              <span className="truncate">
                                {getSortedTags(artifact.tags)[0]}
                              </span>
                              {artifact.tags.length > 1 && (
                                <div className="flex items-center gap-1 ml-1">
                                  <Badge
                                    variant="secondary"
                                    className="h-4 px-1 text-xs"
                                  >
                                    +{artifact.tags.length - 1}
                                  </Badge>
                                  <IconChevronDown className="h-3 w-3" />
                                </div>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            {getSortedTags(artifact.tags).map((tag) => (
                              <DropdownMenuItem
                                key={tag}
                                onClick={() => copyToClipboard(tag, "Tag")}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="truncate">{tag}</span>
                                  <IconCopy className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {artifact.tags.length === 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              copyToClipboard(artifact.tags[0], "Tag")
                            }
                            title="Copy tag"
                          >
                            <IconCopy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {showPagination && !loading && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <IconChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {totalPages <= 7 ? (
                  // Show all pages if 7 or fewer
                  Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  )
                ) : (
                  // Show compact pagination for many pages
                  <>
                    <Button
                      variant={currentPage === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      className="w-8 h-8 p-0"
                    >
                      1
                    </Button>

                    {currentPage > 3 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}

                    {Array.from(
                      { length: Math.min(3, totalPages - 2) },
                      (_, i) => Math.max(2, currentPage - 1) + i
                    )
                      .filter((page) => page > 1 && page < totalPages)
                      .map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}

                    {currentPage < totalPages - 2 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}

                    {totalPages > 1 && (
                      <Button
                        variant={
                          currentPage === totalPages ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}

        {/* Results Summary */}
        {!loading && artifacts.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            {showPagination ? (
              <>
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredArtifacts.length)} of{" "}
                {filteredArtifacts.length} artifacts
                {searchTerm && ` matching "${searchTerm}"`}
              </>
            ) : (
              <>
                Showing {filteredArtifacts.length} of {artifacts.length}{" "}
                artifacts
                {searchTerm && ` matching "${searchTerm}"`}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!artifactToDelete}
        onOpenChange={(open) => !open && setArtifactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artifact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{artifactToDelete?.package.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteArtifact}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
