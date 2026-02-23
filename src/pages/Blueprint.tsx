import { useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

// Icons
import {
  IconArrowLeft,
  IconPlayerPlay,
  IconFileCode,
  IconCode,
  IconFileText,
  IconDownload,
} from "@tabler/icons-react";

import { toast } from "sonner";
import * as yaml from "js-yaml";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { Artifact } from "../client";
import { postManifest } from "../client";
import { client } from "../client/client.gen";
import { blueprintSchema } from "../schemas/blueprintSchema";




// Create AJV validator instance
const createValidator = () => {
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  return ajv.compile(blueprintSchema);
};

export default function Blueprint() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"json" | "text">("json");
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const validationTimeoutRef = useRef<number | null>(null);

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

  // Cleanup function for timeouts
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);
  
  // Get artifact data from navigation state
  const artifact = location.state?.artifact as Artifact | undefined;

  // If no artifact data, redirect back to artifacts page
  if (!artifact) {
    return (
      <PageLayout title="Blueprint">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <IconFileCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Artifact Data</h3>
            <p className="text-muted-foreground mb-4">
              No artifact data was provided. Please select an artifact from the artifacts page.
            </p>
            <Button onClick={() => navigate("/artifacts")}>
              <IconArrowLeft className="h-4 w-4 mr-2" />
              Back to Artifacts
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Generate the blueprint YAML content as JSON
const blueprintJson = {
    apiVersion: "blueprint.enclave-runner.de/v1alpha1",
    kind: "Blueprint",
    metadata: {
        name: artifact.fqn.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    },
    spec: {
        artifact: {
            source: `${artifact.fqn.source}/${artifact.fqn.author}/${artifact.fqn.name}:${artifact.versionHash ? "hash:" + artifact.versionHash : (artifact.tags && artifact.tags.length > 0 ? artifact.tags[0] : "")}`,
            function: "helloWorld",
            input: btoa(JSON.stringify("hello world")) // Example input encoded in base64
        }
    }
};

  const blueprintJsonString = JSON.stringify(blueprintJson, null, 2);
  const blueprintYamlString = yaml.dump(blueprintJson, { 
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false
  });

  // Generate blueprint text description
  const blueprintText = `# Blueprint for ${artifact.fqn.name}

## Artifact Information
**Name:** ${artifact.fqn.name}
**Author:** ${artifact.fqn.author}
**Source:** ${artifact.fqn.source}
**Version Hash:** ${artifact.versionHash}
**Created:** ${new Date(artifact.createdAt).toLocaleString()}
**Tags:** ${artifact.tags && artifact.tags.length > 0 ? artifact.tags.join(', ') : 'No tags'}

## Blueprint Configuration
${blueprintJsonString}`;

  // Validate YAML content against schema
  const validateYamlContent = useCallback((yamlContent: string) => {
    try {
      // Don't validate empty content
      if (!yamlContent.trim()) {
        return { isValid: false, errors: ['YAML content is empty'] };
      }

      // Parse YAML to JSON
      const parsedData = yaml.load(yamlContent);
      
      // Check if parsing resulted in valid data
      if (!parsedData || typeof parsedData !== 'object') {
        return { isValid: false, errors: ['Invalid YAML: must be an object'] };
      }

      // Validate against schema
      const validate = createValidator();
      const isValid = validate(parsedData);
      
      if (!isValid) {
        const errors = validate.errors?.map(error => {
          const path = error.instancePath || error.schemaPath || 'root';
          const message = error.message || 'validation error';
          return `${path}: ${message}`;
        }) || ['Unknown validation error'];
        return { isValid: false, errors };
      } else {
        return { isValid: true, errors: [] };
      }
    } catch (yamlError) {
      const errorMessage = yamlError instanceof Error ? yamlError.message : 'Invalid YAML syntax';
      return { isValid: false, errors: [`YAML Parse Error: ${errorMessage}`] };
    }
  }, []);

  // Monaco Editor setup  
  const handleEditorDidMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    try {
      editorRef.current = editor;
      
      // Set initial value
      editor.setValue(blueprintYamlString);
      
      // Simple validation function
      const validateAndSetMarkers = (content: string) => {
        try {
          const validation = validateYamlContent(content);
          setValidationErrors(validation.errors);
          
          if (!validation.isValid) {
            const markers: Monaco.editor.IMarkerData[] = validation.errors.map((error, index) => ({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: Math.max(1, index + 1),
              startColumn: 1,
              endLineNumber: Math.max(1, index + 1),
              endColumn: 100,
              message: error,
            }));
            
            monaco.editor.setModelMarkers(editor.getModel()!, 'blueprint-validator', markers);
          } else {
            monaco.editor.setModelMarkers(editor.getModel()!, 'blueprint-validator', []);
          }
        } catch (error) {
          console.error('Validation error:', error);
          setValidationErrors(['Validation failed']);
        }
      };
      
      // Debounced validation
      const debouncedValidation = (content: string) => {
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
        }
        validationTimeoutRef.current = window.setTimeout(() => {
          validateAndSetMarkers(content);
        }, 500);
      };
      
      // Initial validation
      validateAndSetMarkers(editor.getValue());
      
      // Set up content change listener
      editor.onDidChangeModelContent(() => {
        try {
          debouncedValidation(editor.getValue());
        } catch (error) {
          console.error('Content change error:', error);
        }
      });
      
    } catch (error) {
      console.error('Monaco Editor setup failed:', error);
    }
  }, [blueprintYamlString, validateYamlContent]);

  // Run blueprint function - Create the manifest
  const handleRunBlueprint = async () => {
    try {
      // Get current editor content
      const currentContent = editorRef.current?.getValue() || blueprintYamlString;
      
      // Validate YAML before running
      const validation = validateYamlContent(currentContent);
      if (!validation.isValid) {
        toast.error("Cannot create manifest: Please fix validation errors first");
        return;
      }

      // Configure the API client with authentication
      configureClient();

      // Parse the YAML to get manifest details for user feedback
      const manifestData = yaml.load(currentContent) as { metadata?: { name?: string } };
      const manifestName = manifestData?.metadata?.name || 'unnamed-manifest';
      
      // Create the manifest using the proper API
      const result = await postManifest({
        body: currentContent
      });

      if (result.data) {
        toast.success(`Blueprint manifest "${manifestName}" created successfully!`);
      } else {
        toast.success(`Blueprint manifest "${manifestName}" created successfully!`);
      }
      
    } catch (error) {
      console.error("Create manifest error:", error);
      const err = error as { status?: number; body?: { error?: string }; message?: string };
      
      if (err.status === 403 || err.status === 401) {
        toast.error("You don't have permission to create manifests");
      } else if (err.status === 404) {
        toast.error("Manifest endpoint not found. Please check your API configuration.");
      } else {
        const errorMessage = err.message || err.body?.error || 'Unknown error';
        toast.error(`Failed to create manifest: ${errorMessage}`);
      }
    }
  };

  const handleDownloadJson = () => {
    const currentContent = editorRef.current?.getValue() || blueprintYamlString;
    const blob = new Blob([currentContent], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.fqn.name}-blueprint.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Blueprint YAML downloaded!");
  };

  return (
    <PageLayout title="Blueprint">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate("/artifacts")}>
              <IconArrowLeft className="h-4 w-4 mr-2" />
              Back to Artifacts
            </Button>
            <h1 className="text-3xl font-bold mt-2">Blueprint: {artifact.fqn.name}</h1>
            <p className="text-muted-foreground">
              Generated blueprint configuration from artifact <strong>{artifact.fqn.source}/{artifact.fqn.author}/{artifact.fqn.name}</strong>
            </p>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as "json" | "text")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json" className="flex items-center gap-2">
              <IconCode className="h-4 w-4" />
              YAML Editor
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <IconFileText className="h-4 w-4" />
              Text View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconFileCode className="h-5 w-5" />
                    Blueprint YAML Configuration
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={handleRunBlueprint}>
                      <IconPlayerPlay className="h-4 w-4 mr-1" />
                      Run Blueprint
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadJson}>
                      <IconDownload className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Edit the blueprint YAML configuration with syntax highlighting and validation. The schema includes:
                  <strong> apiVersion</strong> (enclave.dev/v1alpha1), 
                  <strong> kind</strong> (Blueprint),
                  <strong> metadata</strong> (name), and
                  <strong> spec.artifact</strong> (source, function, input).
                </p>
              </CardHeader>
              <CardContent className="p-0">
                {/* Validation Status */}
                {validationErrors.length > 0 && (
                  <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Schema Validation Errors:</h4>
                    <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                      {validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border rounded-b-lg overflow-hidden h-[calc(100vh-320px)]">
                  <Editor
                    height="100%"
                    language="yaml"
                    value={blueprintYamlString}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      lineNumbers: 'on',
                      roundedSelection: false,
                      scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                      },
                      folding: true,
                      bracketPairColorization: { enabled: true },
                      formatOnPaste: true,
                      formatOnType: true,
                      autoIndent: 'full',
                      tabSize: 2,
                      insertSpaces: true,
                      wordWrap: 'on',
                      automaticLayout: true,
                    }}
                    theme="vs-dark"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconFileText className="h-5 w-5" />
                    Blueprint Summary
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto font-mono">
                  {blueprintText}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
