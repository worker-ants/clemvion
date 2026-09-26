import { describe, it, expect } from '@jest/globals';

import { contractForDto } from '../../../../shared/testing/response-contract';
import { CanvasSaveResultDto } from './workflow-response.dto';

/**
 * `CanvasSaveResultDto` 의 원소 선언 회귀 가드 — `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore`.
 *
 * ## 왜 e2e 계약 대조로 부족한가
 *
 * `workflow-crud.e2e` C · I 가 실제 응답을 이 DTO 와 대조한다. 그러나 응답 계약 검증자는 `type: 'object'` 원소 안으로
 * 내려가지 않는다 — `nodes`/`edges` 를 타입 없는 객체 배열로 되돌려도 그 대조는 **그대로 통과한다**(선언이 함께
 * 느슨해지므로). 이 DTO 가 오랫동안 바로 그 상태였다. 그래서 선언 자체를 고정하는 층이 따로 있어야 한다.
 */
describe('CanvasSaveResultDto 스키마', () => {
  it.each([
    ['nodes', 'NodeDto'],
    ['edges', 'EdgeDto'],
  ])('%s 원소는 %s 참조다 — 타입 없는 객체가 아니다', async (key, dtoName) => {
    const contract = await contractForDto(CanvasSaveResultDto);
    const prop = contract.schema.properties?.[key] as
      { type?: string; items?: { $ref?: string; type?: string } } | undefined;

    expect(prop?.type).toBe('array');
    expect(prop?.items?.$ref).toBe(`#/components/schemas/${dtoName}`);
    // 참조가 가리키는 스키마가 실제로 생성돼야 검증자가 해소할 수 있다.
    expect(contract.schemas[dtoName]).toBeDefined();
    expect(contract.schema.required).toContain(key);
  });
});
