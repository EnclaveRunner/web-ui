/**
 * JSON Schema for Blueprint YAML validation
 * 
 * This schema defines the structure and validation rules for Blueprint YAML files
 * used in the Enclave system. It validates the following structure:
 * - apiVersion: enclave.dev/v1alpha1
 * - kind: Blueprint
 * - metadata: { name }
 * - spec: { artifact: { source, function, input } }
 * - status: { healthy, created, events, revisions } (optional)
 */

export const blueprintSchema = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "apiVersion": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string"
        }
      },
      "required": ["name"]
    },
    "spec": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "artifact": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "source": {
              "type": "string"
            },
            "function": {
              "type": "string"
            },
            "input": {
              "type": "string"
            }
          },
          "required": ["source", "function", "input"]
        }
      },
      "required": ["artifact"]
    },
    "status": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "healthy": {
          "type": "boolean"
        },
        "created": {
          "type": "string"
        },
        "events": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "revisions": {
          "type": "integer"
        }
      }
    }
  },
  "required": ["apiVersion", "kind", "metadata", "spec"]
} as const;

export default blueprintSchema;
