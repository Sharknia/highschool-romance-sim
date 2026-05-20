import type {
  LocalStorageSaveStorageOptions,
  SaveSlot,
  VisualNovelKeyValueStorage,
  VisualNovelSaveStorage
} from "./types";
import { createDefaultVisualNovelPlatform } from "./platform";

function getSlotKey(storageKey: string, slotId: string): string {
  return `${storageKey}:${slotId}`;
}

function getAvailableStorage(options: LocalStorageSaveStorageOptions): VisualNovelKeyValueStorage | null {
  const storage = options.storage || createDefaultVisualNovelPlatform(options.platform).getStorage?.();

  if (storage) {
    return storage;
  }
  return null;
}

function parseSaveSlot(rawSaveSlot: string | null): SaveSlot | null {
  if (!rawSaveSlot) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSaveSlot) as SaveSlot;

    if (!parsed || !parsed.id || !parsed.state || !parsed.sceneId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function createLocalStorageSaveStorage(options: LocalStorageSaveStorageOptions): VisualNovelSaveStorage {
  const storageKey = options.storageKey.trim();

  if (!storageKey) {
    throw new Error("localStorage 저장소 키가 비어 있습니다.");
  }

  function requireStorage(): VisualNovelKeyValueStorage {
    const storage = getAvailableStorage(options);

    if (!storage) {
      throw new Error("localStorage를 사용할 수 없습니다.");
    }

    return storage;
  }

  return {
    save(saveSlot) {
      const storage = requireStorage();
      storage.setItem(getSlotKey(storageKey, saveSlot.id), JSON.stringify(saveSlot));
      return saveSlot;
    },

    load(slotId) {
      return parseSaveSlot(requireStorage().getItem(getSlotKey(storageKey, slotId)));
    },

    list() {
      const storage = requireStorage();
      const saveSlots: SaveSlot[] = [];

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);

        if (!key || !key.startsWith(`${storageKey}:`)) {
          continue;
        }

        const saveSlot = parseSaveSlot(storage.getItem(key));

        if (saveSlot) {
          saveSlots.push(saveSlot);
        }
      }

      return saveSlots.sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
    },

    remove(slotId) {
      requireStorage().removeItem(getSlotKey(storageKey, slotId));
    }
  };
}
