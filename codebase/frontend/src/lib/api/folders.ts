import { apiClient } from "./client";
import { unwrap } from "./unwrap";

/**
 * 폴더 도메인 typed API 카탈로그.
 *
 * 워크플로우 목록의 폴더 필터(spec/2-navigation/1-workflow-list.md §2.3)가
 * 현재 워크스페이스 폴더 목록을 조회하는 데 사용한다. 서버는 `sortOrder→name`
 * 순으로 정렬된 래핑 배열(`{ data: FolderData[] }`)을 반환한다.
 */

/** `GET /folders` 응답의 폴더 행 (필터 UI 가 소비하는 필드). */
export interface FolderData {
  id: string;
  name: string;
  parentId?: string | null;
  sortOrder: number;
}

export const foldersApi = {
  /** `GET /folders` — 현재 워크스페이스의 폴더 목록. */
  list: async (): Promise<FolderData[]> => {
    const response = await apiClient.get<{ data: FolderData[] }>("/folders");
    return unwrap<FolderData[]>(response) ?? [];
  },
};
