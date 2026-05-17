"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  ProjectBriefWithStarter,
  ProjectEntity,
  ProjectRelationship,
} from "@/lib/ai/planner-schema";

import { BriefSectionCard } from "./brief-section-card";
import { RegenerateButton } from "./regenerate-button";

type DataModelEditorProps = {
  brief: ProjectBriefWithStarter;
  onChange: (brief: ProjectBriefWithStarter) => void;
  onRegenerate?: (constraint: string | undefined) => Promise<void>;
};

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "entity";
}

function uniqueId(base: string, existingIds: string[]) {
  let candidate = slugify(base);
  let suffix = 2;

  while (existingIds.includes(candidate)) {
    candidate = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function fieldsToList(value: string) {
  return value
    .split("\n")
    .map((field) => field.trim())
    .filter(Boolean);
}

export function DataModelEditor({
  brief,
  onChange,
  onRegenerate,
}: DataModelEditorProps) {
  const { entities, relationships } = brief.dataModel;
  const entityOptions = entities.map((entity) => ({
    label: entity.name,
    value: entity.id,
  }));

  function updateDataModel(dataModel: ProjectBriefWithStarter["dataModel"]) {
    onChange({ ...brief, dataModel });
  }

  function updateEntity(index: number, entity: ProjectEntity) {
    const previousId = entities[index]?.id;
    const nextEntities = entities.map((item, itemIndex) =>
      itemIndex === index ? entity : item,
    );
    const nextRelationships = relationships.map((relationship) => ({
      ...relationship,
      sourceEntityId:
        relationship.sourceEntityId === previousId
          ? entity.id
          : relationship.sourceEntityId,
      targetEntityId:
        relationship.targetEntityId === previousId
          ? entity.id
          : relationship.targetEntityId,
    }));

    updateDataModel({
      entities: nextEntities,
      relationships: nextRelationships,
    });
  }

  function removeEntity(entityId: string) {
    updateDataModel({
      entities: entities.filter((entity) => entity.id !== entityId),
      relationships: relationships.filter(
        (relationship) =>
          relationship.sourceEntityId !== entityId &&
          relationship.targetEntityId !== entityId,
      ),
    });
  }

  function updateRelationship(
    index: number,
    relationship: ProjectRelationship,
  ) {
    updateDataModel({
      entities,
      relationships: relationships.map((item, itemIndex) =>
        itemIndex === index ? relationship : item,
      ),
    });
  }

  return (
    <BriefSectionCard
      numeral="IV"
      anchor="Model"
      title="Data Model"
      description="Edit entities and relationships. The visualisation updates immediately."
      actions={
        onRegenerate ? <RegenerateButton onRegenerate={onRegenerate} /> : null
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="micro-label">Entities</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className=""
              onClick={() => {
                const id = uniqueId(
                  "new-entity",
                  entities.map((entity) => entity.id),
                );
                updateDataModel({
                  entities: [
                    ...entities,
                    {
                      id,
                      name: "New Entity",
                      description: "Describe this entity.",
                      fields: ["id", "name"],
                    },
                  ],
                  relationships,
                });
              }}
            >
              <PlusIcon data-icon="inline-start" />
              Add entity
            </Button>
          </div>

          {entities.map((entity, index) => (
            <div
              className="flex flex-col gap-4 border bg-muted p-4"
              key={entity.id}
            >
              <div className="grid gap-4 md:grid-cols-[0.55fr_0.45fr_auto]">
                <label className="flex flex-col gap-2">
                  <span className="micro-label">Name</span>
                  <Input
                    value={entity.name}
                    onChange={(event) =>
                      updateEntity(index, {
                        ...entity,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="micro-label">ID</span>
                  <Input
                    value={entity.id}
                    onChange={(event) =>
                      updateEntity(index, {
                        ...entity,
                        id: slugify(event.target.value),
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove entity"
                  className="self-end"
                  onClick={() => removeEntity(entity.id)}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <label className="flex flex-col gap-2">
                <span className="micro-label">Description</span>
                <Input
                  value={entity.description}
                  onChange={(event) =>
                    updateEntity(index, {
                      ...entity,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="micro-label">Fields, one per line</span>
                <Textarea
                  value={entity.fields.join("\n")}
                  onChange={(event) =>
                    updateEntity(index, {
                      ...entity,
                      fields: fieldsToList(event.target.value),
                    })
                  }
                  className="min-h-28 bg-card font-mono text-sm leading-7"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="micro-label">Relationships</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className=""
              disabled={entities.length < 2}
              onClick={() => {
                const id = uniqueId(
                  "relationship",
                  relationships.map((relationship) => relationship.id),
                );
                updateDataModel({
                  entities,
                  relationships: [
                    ...relationships,
                    {
                      id,
                      sourceEntityId: entities[0].id,
                      targetEntityId: entities[1].id,
                      label: "relates to",
                    },
                  ],
                });
              }}
            >
              <PlusIcon data-icon="inline-start" />
              Add relationship
            </Button>
          </div>

          {relationships.map((relationship, index) => (
            <div
              className="grid gap-4 border bg-muted p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
              key={relationship.id}
            >
              <Select
                items={entityOptions}
                value={relationship.sourceEntityId}
                onValueChange={(sourceEntityId) => {
                  if (sourceEntityId) {
                    updateRelationship(index, {
                      ...relationship,
                      sourceEntityId,
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {entityOptions.map((entity) => (
                      <SelectItem key={entity.value} value={entity.value}>
                        {entity.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                value={relationship.label}
                onChange={(event) =>
                  updateRelationship(index, {
                    ...relationship,
                    label: event.target.value,
                  })
                }
                aria-label="Relationship label"
              />
              <Select
                items={entityOptions}
                value={relationship.targetEntityId}
                onValueChange={(targetEntityId) => {
                  if (targetEntityId) {
                    updateRelationship(index, {
                      ...relationship,
                      targetEntityId,
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {entityOptions.map((entity) => (
                      <SelectItem key={entity.value} value={entity.value}>
                        {entity.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove relationship"
                onClick={() =>
                  updateDataModel({
                    entities,
                    relationships: relationships.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </BriefSectionCard>
  );
}
