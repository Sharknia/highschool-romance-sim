import type {
  ProjectApiResult,
  ProjectRepairAction,
  ProjectRepairActionRequiredInput,
  ProjectRepairHistoryEntry,
  ProjectRevision
} from "./projectPageTypes";

export type RepairInputValues = Record<string, Record<string, string>>;

export function repairActionInputText(action: ProjectRepairAction): string {
  const inputs = (action.requiredInputs || []).map((input) => input.label || input.name).filter(Boolean);
  return inputs.length ? `필요 입력 ${inputs.join(", ")}` : "추가 입력 없음";
}

export function repairActionMetaText(action: ProjectRepairAction): string {
  const metadata = [
    action.issueCode ? `문제 코드 ${action.issueCode}` : "",
    action.targetPath ? `대상 ${action.targetPath}` : "",
    action.destructive ? "삭제/변경 포함" : "비파괴",
    action.requiresConfirmation ? "확인 필요" : "",
    repairActionInputText(action)
  ].filter(Boolean);
  return metadata.join(" · ");
}

export function repairActionKey(action: Pick<ProjectRepairAction, "actionId" | "issueCode" | "targetPath">): string {
  return [action.issueCode || "issue", action.actionId || "action", action.targetPath || "target"].join("::");
}

export function repairInputDefaultValue(input: ProjectRepairActionRequiredInput): string {
  if (input.inputType === "select") {
    return input.options?.[0]?.value || "";
  }
  return "";
}

export function repairInputDisplayLabel(input: ProjectRepairActionRequiredInput): string {
  return input.label || input.name || "입력";
}

export function repairInputValue(action: ProjectRepairAction, input: ProjectRepairActionRequiredInput, values: RepairInputValues): string {
  const name = input.name || "";
  if (!name) {
    return "";
  }
  const value = values[repairActionKey(action)]?.[name];
  return typeof value === "string" ? value : repairInputDefaultValue(input);
}

export function repairInputsFor(action: ProjectRepairAction, values: RepairInputValues): Record<string, string> {
  return (action.requiredInputs || []).reduce<Record<string, string>>((inputs, input) => {
    if (input.name) {
      inputs[input.name] = repairInputValue(action, input, values);
    }
    return inputs;
  }, {});
}

export function repairRequestBody(
  action: ProjectRepairAction,
  projectDirectory: string,
  values: RepairInputValues,
  expectedProjectRevision?: ProjectRevision | null
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    projectDirectory,
    repairAction: {
      actionId: action.actionId,
      issueCode: action.issueCode,
      targetPath: action.targetPath,
      inputs: repairInputsFor(action, values)
    }
  };
  if (expectedProjectRevision) {
    body.expectedProjectRevision = expectedProjectRevision;
  }
  return body;
}

export function repairResultMessage(result: ProjectApiResult, fallback: string): string {
  return result.message || result.error || result.issues?.[0]?.message || result.validation?.issues?.[0]?.message || fallback;
}

export function activeRepairHistoryEntry(entry: ProjectRepairHistoryEntry | null): ProjectRepairHistoryEntry | null {
  if (entry?.id && !entry.revertedAt) {
    return entry;
  }
  return null;
}
