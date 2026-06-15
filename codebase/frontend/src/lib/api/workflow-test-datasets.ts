import { apiClient } from "./client";
import { unwrap } from "./unwrap";

export type TestDatasetVisibility = "private" | "workspace";

/** §2.2 저장된 테스트 데이터셋 (워크플로우 Mock Input). */
export interface WorkflowTestDatasetData {
  id: string;
  workflowId: string;
  ownerId: string;
  visibility: TestDatasetVisibility;
  name: string;
  /** Mock Input JSON (API 키는 `input` — entity 컬럼은 `data`). */
  input: Record<string, unknown>;
  /** 요청 유저가 소유자인지 — false 면 공유본(수정 불가, clone 만). */
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestDatasetBody {
  name: string;
  input: Record<string, unknown>;
  visibility?: TestDatasetVisibility;
}

export const workflowTestDatasetsApi = {
  /** 같은 워크플로우의 내 데이터셋 + 워크스페이스 공유본. */
  async list(workflowId: string): Promise<WorkflowTestDatasetData[]> {
    const res = await apiClient.get(`/workflows/${workflowId}/test-datasets`);
    return unwrap<WorkflowTestDatasetData[]>(res);
  },

  async create(
    workflowId: string,
    body: CreateTestDatasetBody,
  ): Promise<WorkflowTestDatasetData> {
    const res = await apiClient.post(
      `/workflows/${workflowId}/test-datasets`,
      body,
    );
    return unwrap<WorkflowTestDatasetData>(res);
  },

  async update(
    datasetId: string,
    body: Partial<CreateTestDatasetBody>,
  ): Promise<WorkflowTestDatasetData> {
    const res = await apiClient.patch(`/test-datasets/${datasetId}`, body);
    return unwrap<WorkflowTestDatasetData>(res);
  },

  async remove(datasetId: string): Promise<void> {
    await apiClient.delete(`/test-datasets/${datasetId}`);
  },

  /** 조회 가능한 데이터셋을 자기 소유 private 사본으로 복제. */
  async clone(datasetId: string): Promise<WorkflowTestDatasetData> {
    const res = await apiClient.post(`/test-datasets/${datasetId}/clone`);
    return unwrap<WorkflowTestDatasetData>(res);
  },
};
