"use client";
import { Input, Select } from "@/components/ui/input";
import {
  Field,
  LinkedChips,
  PanelContainer,
} from "@/components/document/properties-panel-controls";
import {
  registerPropertiesPanel,
  type PropertiesPanelProps,
} from "@/lib/document-kinds";
import {
  MEMO_KIND_LABELS,
  PRD_STATUS_LABELS,
  type MemoKind,
  type PRDStatus,
} from "@/lib/types";

// Per-kind Properties panels. Each registers itself with the kind config
// registry at module-load. The unified detail page imports this module
// once so the side-effect runs.

function ResearchPropertiesPanel({
  document: d,
  onChange,
  disabled,
  ctx,
}: PropertiesPanelProps<"research">) {
  return (
    <PanelContainer disabled={disabled}>
      <Field label="Source / team">
        <Input
          value={d.source ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              source: e.target.value || "Internal",
            }))
          }
          disabled={disabled}
        />
      </Field>

      <Field label="Date conducted">
        <Input
          type="date"
          value={d.properties.conductedAt?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              properties: {
                ...doc.properties,
                conductedAt: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined,
              },
            }))
          }
          disabled={disabled}
        />
      </Field>

      <Field label="Tags (comma-separated)" full>
        <Input
          value={d.tags.join(", ")}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean),
            }))
          }
          disabled={disabled}
        />
      </Field>

      <LinkedChips
        label="Linked people"
        full
        items={ctx.people.map((p) => ({ id: p.id, label: p.name }))}
        selected={d.linkedPersonIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedPersonIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked customers"
        full
        items={ctx.customers.map((c) => ({ id: c.id, label: c.name }))}
        selected={d.linkedCustomerIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedCustomerIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked objectives"
        full
        items={ctx.objectives.map((o) => ({ id: o.id, label: o.title }))}
        selected={d.linkedObjectiveIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedObjectiveIds: ids }))
        }
        disabled={disabled}
      />
    </PanelContainer>
  );
}

function PRDPropertiesPanel({
  document: d,
  onChange,
  disabled,
  ctx,
}: PropertiesPanelProps<"prd">) {
  return (
    <PanelContainer disabled={disabled}>
      <Field label="Owner / team">
        <Input
          value={d.source ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              source: e.target.value || undefined,
            }))
          }
          disabled={disabled}
        />
      </Field>

      <Field label="Status">
        <Select
          value={d.properties.status}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              properties: {
                ...doc.properties,
                status: e.target.value as PRDStatus,
              },
            }))
          }
          disabled={disabled}
        >
          {(Object.keys(PRD_STATUS_LABELS) as PRDStatus[]).map((s) => (
            <option key={s} value={s}>
              {PRD_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Target ship date">
        <Input
          type="date"
          value={d.properties.targetShipDate?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              properties: {
                ...doc.properties,
                targetShipDate: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined,
              },
            }))
          }
          disabled={disabled}
        />
      </Field>

      <Field label="Business unit">
        <Select
          value={d.linkedBusinessUnitId ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              linkedBusinessUnitId: e.target.value || undefined,
            }))
          }
          disabled={disabled}
        >
          <option value="">(none)</option>
          {ctx.businessUnits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tags (comma-separated)" full>
        <Input
          value={d.tags.join(", ")}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean),
            }))
          }
          disabled={disabled}
        />
      </Field>

      <LinkedChips
        label="Linked people"
        full
        items={ctx.people.map((p) => ({ id: p.id, label: p.name }))}
        selected={d.linkedPersonIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedPersonIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked customers"
        full
        items={ctx.customers.map((c) => ({ id: c.id, label: c.name }))}
        selected={d.linkedCustomerIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedCustomerIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked objectives"
        full
        items={ctx.objectives.map((o) => ({ id: o.id, label: o.title }))}
        selected={d.linkedObjectiveIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedObjectiveIds: ids }))
        }
        disabled={disabled}
      />
    </PanelContainer>
  );
}

function MemoPropertiesPanel({
  document: d,
  onChange,
  disabled,
  ctx,
}: PropertiesPanelProps<"memo">) {
  return (
    <PanelContainer disabled={disabled}>
      <Field label="Author / team">
        <Input
          value={d.source ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              source: e.target.value || undefined,
            }))
          }
          disabled={disabled}
        />
      </Field>

      <Field label="Kind">
        <Select
          value={d.properties.memoKind}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              properties: {
                ...doc.properties,
                memoKind: e.target.value as MemoKind,
              },
            }))
          }
          disabled={disabled}
        >
          {(Object.keys(MEMO_KIND_LABELS) as MemoKind[]).map((k) => (
            <option key={k} value={k}>
              {MEMO_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Business unit">
        <Select
          value={d.linkedBusinessUnitId ?? ""}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              linkedBusinessUnitId: e.target.value || undefined,
            }))
          }
          disabled={disabled}
        >
          <option value="">(none)</option>
          {ctx.businessUnits.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tags (comma-separated)" full>
        <Input
          value={d.tags.join(", ")}
          onChange={(e) =>
            onChange((doc) => ({
              ...doc,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean),
            }))
          }
          disabled={disabled}
        />
      </Field>

      <LinkedChips
        label="Linked people"
        full
        items={ctx.people.map((p) => ({ id: p.id, label: p.name }))}
        selected={d.linkedPersonIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedPersonIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked customers"
        full
        items={ctx.customers.map((c) => ({ id: c.id, label: c.name }))}
        selected={d.linkedCustomerIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedCustomerIds: ids }))
        }
        disabled={disabled}
      />
      <LinkedChips
        label="Linked objectives"
        full
        items={ctx.objectives.map((o) => ({ id: o.id, label: o.title }))}
        selected={d.linkedObjectiveIds}
        onChange={(ids) =>
          onChange((doc) => ({ ...doc, linkedObjectiveIds: ids }))
        }
        disabled={disabled}
      />
    </PanelContainer>
  );
}

registerPropertiesPanel("research", ResearchPropertiesPanel);
registerPropertiesPanel("prd", PRDPropertiesPanel);
registerPropertiesPanel("memo", MemoPropertiesPanel);

// Module exports a noop so callers can import for the side effect.
export const _registered = true;
