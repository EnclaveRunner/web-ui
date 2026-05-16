import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  IconUpload,
  IconFile,
} from "@tabler/icons-react";

// API Client
import {
  getV1Artifact,
  deleteV1ArtifactByNamespaceByNameHashByHash,
  postV1ArtifactRawByNamespaceByName,
  patchV1ArtifactByNamespaceByNameHashByHash,
} from "../client";
import { client } from "../client/client.gen";
import type { Artifact } from "../client";

type ArtifactPackage = {
  namespace: string;
  name: string;
  versions: Artifact[]; // sorted newest first
};

export default function Artifacts() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [hasAccess, setHasAccess] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // key = "namespace/name", value = versionHash of selected version
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const [artifactToDelete, setArtifactToDelete] = useState<Artifact | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadNamespace, setUploadNamespace] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadTag, setUploadTag] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ITEMS_PER_PAGE = 6;

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

      const all: Artifact[] = [];
      const limit = 100;
      let offset = 0;
      while (true) {
        const response = await getV1Artifact({ query: { limit, offset } });
        if (!response.data || !Array.isArray(response.data)) break;
        all.push(...response.data);
        if (response.data.length < limit) break;
        offset += limit;
      }
      setArtifacts(all);
      setHasAccess(true);
      toast.success(`Loaded ${all.length} artifacts`);
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

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  // Group flat artifacts into packages keyed by "namespace/name"
  const packages = useMemo<ArtifactPackage[]>(() => {
    const map = new Map<string, Artifact[]>();
    for (const a of artifacts) {
      const key = `${a.namespace}/${a.name}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([, versions]) => {
      versions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { namespace: versions[0].namespace, name: versions[0].name, versions };
    });
  }, [artifacts]);

  // When packages change, seed selectedVersions for any package not yet tracked
  useEffect(() => {
    setSelectedVersions((prev) => {
      const next = { ...prev };
      for (const pkg of packages) {
        const key = `${pkg.namespace}/${pkg.name}`;
        if (!next[key]) {
          const latestTagged = pkg.versions.find((v) =>
            (v.tags ?? []).some((t) => t.toLowerCase() === "latest")
          );
          next[key] = (latestTagged ?? pkg.versions[0]).versionHash;
        }
      }
      return next;
    });
  }, [packages]);

  const getSelectedVersion = (pkg: ArtifactPackage): Artifact => {
    const key = `${pkg.namespace}/${pkg.name}`;
    const hash = selectedVersions[key];
    return pkg.versions.find((v) => v.versionHash === hash) ?? pkg.versions[0];
  };

  const filteredPackages = packages.filter((pkg) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return pkg.versions.some(
      (v) =>
        v.name.toLowerCase().includes(searchLower) ||
        v.namespace.toLowerCase().includes(searchLower) ||
        (v.tags ?? []).some((tag) => tag.toLowerCase().includes(searchLower)) ||
        v.versionHash.toLowerCase().includes(searchLower)
    );
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredPackages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPackages = filteredPackages.slice(startIndex, endIndex);
  const showPagination = filteredPackages.length > ITEMS_PER_PAGE;

  // Handle search term change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when search changes
  };

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

  const getSortedTags = (tags: string[] | null | undefined) => {
    // Sort tags alphabetically, but if there's a "latest" tag, put it first
    const sortedTags = [...(tags ?? [])].sort();
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

      await deleteV1ArtifactByNamespaceByNameHashByHash({
        path: {
          namespace: artifactToDelete.namespace,
          name: artifactToDelete.name,
          hash: artifactToDelete.versionHash,
        },
      });

      toast.success(`Artifact "${artifactToDelete.name}" deleted successfully!`);

      // If the deleted version was selected, clear its selection so the next
      // version gets auto-selected when packages recompute.
      const pkgKey = `${artifactToDelete.namespace}/${artifactToDelete.name}`;
      setSelectedVersions((prev) => {
        if (prev[pkgKey] === artifactToDelete.versionHash) {
          const { [pkgKey]: _removed, ...rest } = prev;
          return rest;
        }
        return prev;
      });

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

  const handleUploadArtifact = async () => {
    if (!uploadFile || !uploadNamespace.trim() || !uploadName.trim()) {
      toast.error("Please fill in all required fields and select a file.");
      return;
    }

    try {
      setUploading(true);
      configureClient();

      const uploadResponse = await postV1ArtifactRawByNamespaceByName({
        path: {
          namespace: uploadNamespace.trim(),
          name: uploadName.trim(),
        },
        body: uploadFile,
      });

      // If tags were provided, assign them via PATCH
      const tags = uploadTag.trim()
        ? uploadTag.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

      if (tags && tags.length > 0 && uploadResponse.data?.versionHash) {
        await patchV1ArtifactByNamespaceByNameHashByHash({
          path: {
            namespace: uploadNamespace.trim(),
            name: uploadName.trim(),
            hash: uploadResponse.data.versionHash,
          },
          body: { tags },
        });
      }

      toast.success(`Artifact "${uploadName}" uploaded successfully!`);
      setUploadModalOpen(false);
      setUploadNamespace("");
      setUploadName("");
      setUploadTag("");
      setUploadFile(null);
      await loadArtifacts();
    } catch (error) {
      console.error("Upload artifact error:", error);
      const err = error as { status?: number; body?: { error?: string }; message?: string };

      if (err.status === 409) {
        toast.error("A tag with this name is already assigned to another version.");
      } else if (err.status === 403 || err.status === 401) {
        toast.error("You don't have permission to upload artifacts.");
      } else if (err.status === 413) {
        toast.error("The file is too large to upload.");
      } else {
        const message = err.body?.error || err.message || "Unknown error";
        toast.error(`Failed to upload artifact: ${message}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleCloseUploadModal = () => {
    if (uploading) return;
    setUploadModalOpen(false);
    setUploadNamespace("");
    setUploadName("");
    setUploadTag("");
    setUploadFile(null);
  };


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
              <Button onClick={() => setUploadModalOpen(true)}>
                <IconUpload className="h-4 w-4 mr-2" />
                Upload
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
        ) : filteredPackages.length === 0 ? (
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
            {paginatedPackages.map((pkg) => {
              const pkgKey = `${pkg.namespace}/${pkg.name}`;
              const artifact = getSelectedVersion(pkg);
              const sortedTags = getSortedTags(artifact.tags);
              const versionLabel =
                sortedTags.length > 0 ? sortedTags[0] : artifact.versionHash.slice(0, 8);

              return (
              <Card
                key={pkgKey}
                className="group hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <IconPackage className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base truncate">
                        {artifact.name}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-fit text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteArtifact(artifact)}
                        title="Delete selected version"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <p className="truncate">
                        <strong>Namespace:</strong> {artifact.namespace}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          copyToClipboard(artifact.namespace, "Namespace")
                        }
                        title="Copy namespace"
                      >
                        <IconCopy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate max-w-[180px] sm:max-w-[260px] md:max-w-[320px] break-all">
                        <strong>Package:</strong>{" "}
                        {`${artifact.namespace}/${artifact.name}`}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          copyToClipboard(
                            `${artifact.namespace}/${artifact.name}`,
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
                  {/* Create Task Button */}
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      const artifactId = `${artifact.namespace}-${artifact.name}-${artifact.versionHash}`;
                      navigate(`/task/new/${encodeURIComponent(artifactId)}`, {
                        state: { artifact },
                      });
                    }}
                    title="Create Task"
                  >
                    <IconFileCode className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>

                  {/* Version selector */}
                  <div className="flex items-center gap-2">
                    <IconTag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs justify-between min-w-0 flex-1"
                        >
                          <span className="truncate">{versionLabel}</span>
                          <div className="flex items-center gap-1 ml-1 shrink-0">
                            {pkg.versions.length > 1 && (
                              <Badge variant="secondary" className="h-4 px-1 text-xs">
                                {pkg.versions.length}
                              </Badge>
                            )}
                            <IconChevronDown className="h-3 w-3" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {pkg.versions.map((v) => {
                          const vTags = getSortedTags(v.tags);
                          const label =
                            vTags.length > 0
                              ? vTags.join(", ")
                              : v.versionHash.slice(0, 12);
                          const isSelected = v.versionHash === artifact.versionHash;
                          return (
                            <DropdownMenuItem
                              key={v.versionHash}
                              onClick={() =>
                                setSelectedVersions((prev) => ({
                                  ...prev,
                                  [pkgKey]: v.versionHash,
                                }))
                              }
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between w-full gap-2">
                                <span className="truncate text-xs">{label}</span>
                                {isSelected && (
                                  <Badge variant="default" className="h-4 px-1 text-xs shrink-0">
                                    selected
                                  </Badge>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

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
                </CardContent>
              </Card>
              );
            })}
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
        {!loading && packages.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            {showPagination ? (
              <>
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredPackages.length)} of{" "}
                {filteredPackages.length} packages
                {searchTerm && ` matching "${searchTerm}"`}
              </>
            ) : (
              <>
                Showing {filteredPackages.length} of {packages.length}{" "}
                packages
                {searchTerm && ` matching "${searchTerm}"`}
              </>
            )}
          </div>
        )}
      </div>

      {/* Upload Artifact Dialog */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => !open && handleCloseUploadModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUpload className="h-5 w-5" />
              Upload Artifact
            </DialogTitle>
            <DialogDescription>
              Upload a new artifact file with its metadata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Namespace */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-namespace">
                Namespace <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upload-namespace"
                placeholder="e.g. myorg"
                value={uploadNamespace}
                onChange={(e) => setUploadNamespace(e.target.value)}
                disabled={uploading}
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upload-name"
                placeholder="e.g. my-artifact"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                disabled={uploading}
              />
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-tag">Tag</Label>
              <Input
                id="upload-tag"
                placeholder="e.g. latest, v1.0 (comma-separated)"
                value={uploadTag}
                onChange={(e) => setUploadTag(e.target.value)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Separate multiple tags with commas.
              </p>
              {(() => {
                const ns = uploadNamespace.trim();
                const nm = uploadName.trim();
                const enteredTags = uploadTag.split(",").map((t) => t.trim()).filter(Boolean);
                if (!ns || !nm || enteredTags.length === 0) return null;
                const conflicting = enteredTags.filter((tag) =>
                  artifacts.some(
                    (a) =>
                      a.namespace === ns &&
                      a.name === nm &&
                      (a.tags ?? []).some((t) => t === tag)
                  )
                );
                if (conflicting.length === 0) return null;
                return (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Warning: {conflicting.length === 1 ? `Tag "${conflicting[0]}" is` : `Tags ${conflicting.map((t) => `"${t}"`).join(", ")} are`} already used for an artifact in <strong>{ns}/{nm}</strong>.
                  </p>
                );
              })()}
            </div>

            {/* File */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-file">
                File <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                id="upload-file"
                type="file"
                accept=".wasm"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && !file.name.endsWith(".wasm")) {
                    toast.error("Only .wasm files are allowed.");
                    e.target.value = "";
                    return;
                  }
                  setUploadFile(file);
                }}
              />
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                type="button"
              >
                {uploadFile ? (
                  <>
                    <IconFile className="h-4 w-4 shrink-0" />
                    <span className="truncate">{uploadFile.name}</span>
                    <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                      {(uploadFile.size / 1024).toFixed(1)} KB
                    </Badge>
                  </>
                ) : (
                  <>
                    <IconUpload className="h-4 w-4 shrink-0" />
                    <span className="text-muted-foreground">Choose .wasm file…</span>
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">Only <code>.wasm</code> files are accepted.</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseUploadModal} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadArtifact}
              disabled={uploading || !uploadFile || !uploadNamespace.trim() || !uploadName.trim()}
            >
              {uploading ? (
                <>
                  <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <IconUpload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!artifactToDelete}
        onOpenChange={(open) => !open && setArtifactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artifact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{artifactToDelete?.name}"?
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
