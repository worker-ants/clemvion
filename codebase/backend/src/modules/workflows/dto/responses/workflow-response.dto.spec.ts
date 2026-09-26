import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import {
  CanvasSaveResultDto,
  ExportWorkflowDto,
} from './workflow-response.dto';

/**
 * 워크플로우 응답 DTO 의 `nodes`/`edges` 원소 선언 회귀 가드.
 *
 * - `CanvasSaveResultDto` — `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore`
 * - `ExportWorkflowDto` — `GET /workflows/:id/export`
 *
 * ## 왜 e2e 계약 대조로 부족한가
 *
 * `workflow-crud.e2e` 가 실제 응답을 이 DTO 들과 대조한다(저장 C · 복원 I · export C · F). 그러나 응답 계약 검증자는
 * `type: 'object'` 원소 안으로 내려가지 않는다 — `nodes`/`edges` 를 타입 없는 객체 배열로 되돌려도 그 대조는 **그대로
 * 통과한다**(선언이 함께 느슨해지므로). 두 DTO 가 오랫동안 바로 그 상태였다. 그래서 선언 자체를 고정하는 층이 따로 있어야
 * 한다.
 */
describe('워크플로우 응답 DTO 의 원소 선언', () => {
  it.each([
    { dto: CanvasSaveResultDto, key: 'nodes', ref: 'NodeDto' },
    { dto: CanvasSaveResultDto, key: 'edges', ref: 'EdgeDto' },
    { dto: ExportWorkflowDto, key: 'nodes', ref: 'ExportedNodeDto' },
    { dto: ExportWorkflowDto, key: 'edges', ref: 'ExportedEdgeDto' },
  ])(
    '$dto.name 의 $key 원소는 $ref 참조다 — 타입 없는 객체가 아니다',
    async ({ dto, key, ref }) => {
      const contract = await contractForDto(dto);
      const prop = contract.schema.properties?.[key] as
        { type?: string; items?: { $ref?: string; type?: string } } | undefined;

      expect(prop?.type).toBe('array');
      expect(prop?.items?.$ref).toBe(`#/components/schemas/${ref}`);
      // 참조가 가리키는 스키마가 실제로 생성돼야 검증자가 해소할 수 있다.
      expect(contract.schemas[ref]).toBeDefined();
      expect(contract.schema.required).toContain(key);
    },
  );

  it('ExportedNodeDto.description 은 문자열 스키마다 — `string | null` 의 설계 타입(`Object`)을 따라가지 않는다', async () => {
    const contract = await contractForDto(ExportWorkflowDto);
    const description =
      contract.schemas.ExportedNodeDto?.properties?.description;

    expect(description).toEqual({ type: 'string', nullable: true });
  });
});
