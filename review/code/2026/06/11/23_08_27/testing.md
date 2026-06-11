# 테스트(Testing) 리뷰

## 발견사항

### [INFO] `testConnection` kind=chat 경로에 대한 `dimension` 부재 명시 케이스 없음
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` — `describe('testConnection')`
- 상세: kind=chat 성공 케이스는 기존부터 존재하지만, 변경 후 반환 타입이 `{ success: boolean; error?: string; dimension?: number }` 로 확장됐다. chat 경로에서 `dimension` 필드가 절대 포함되지 않음을 명시적으로 검증하는 케이스가 없다. 현재 코드상 `dimension` 이 미포함되는 것은 맞으나, 회귀 방지 관점에서 `expect(result).not.toHaveProperty('dimension')` 수준의 assertion 하나가 있으면 반환 형태 계약을 명확히 고정할 수 있다.
- 제안: 기존 chat testConnection 성공 케이스에 `expect(result).toEqual({ success: true })` (dimension 없음)를 assert 로 추가하거나, 별도 케이스로 `'does not return dimension for kind=chat'` 을 추가한다.

---

### [INFO] `embed` 가 `null` 요소를 포함한 배열을 반환하는 엣지케이스 미테스트
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` — embedding probe 케이스들
- 상세: `vectors[0]?.length` 로 차원을 추출하므로 `vectors[0]` 이 `undefined` 인 경우(빈 배열)는 "empty vector" 케이스로 커버됐다. 그러나 `vectors[0]` 이 `null` 이거나, 길이 0인 벡터(`[]`)를 담은 배열(`[[]]`)을 반환하는 케이스는 커버되지 않는다. `vectors[0].length === 0` 이면 falsy 이므로 `{ success: true }` 가 반환되는데, 이것이 의도된 동작인지 테스트가 명시하지 않는다.
- 제안: `mockClient.embed.mockResolvedValue([[]])` (빈 내부 벡터) 케이스를 추가하여 `{ success: true }` 반환(dimension 없음)임을 assert 한다. null 요소 케이스도 실제 프로바이더가 가능하다면 추가한다.

---

### [INFO] `testConnection` 성공 시 `invalidate()` 호출 여부 미검증 (프론트엔드)
- 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` — `"persists detected dimension and shows it in the toast on successful test"` 케이스
- 상세: `model-config-manager.tsx` 의 `onSuccess` 에서 `await modelConfigsApi.update(...)` 성공 후 `invalidate()` (query invalidation) 를 호출한다. 이 사이드이펙트가 테스트에서 검증되지 않는다. `updateMock` 호출 확인 후 쿼리가 다시 fetch 됐는지(getAllMock 재호출 여부 등)를 검증하지 않아, invalidate 로직이 누락되어도 테스트가 통과한다.
- 제안: `updateMock` 이 호출된 후 `getAllMock` 이 다시 호출됐는지(queryClient invalidation 으로 refetch 트리거) 를 `waitFor` 로 검증하거나, `queryClient.invalidateQueries` 를 spy 하여 호출 확인한다.

---

### [INFO] 프론트엔드 `"still reports success when dimension auto-persist fails"` — toast.error 미호출만 검증
- 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` — `"still reports success when dimension auto-persist fails (e.g. permission)"` 케이스
- 상세: `updateMock.mockRejectedValue(new Error('403 Forbidden'))` 시 `toast.success` 가 차원 값과 함께 호출됨을 검증하고, `toast.error` 가 호출되지 않음을 검증한다. 그러나 `console.error` 나 다른 에러 노출 경로를 막고 있지 않아, 실제 컴포넌트가 `catch` 블록 내에서 추가로 에러 UI 를 노출해도 테스트가 통과한다. 이는 낮은 우선순위지만, try/catch 가 제대로 삼키고 있음을 `mockRejectedValue` 후 React 경계 미발생으로 확인하는 것이 완전하다.
- 제안: 현재 수준으로도 핵심 동작을 검증하므로 강제하지 않으나, `expect(() => screen.queryByRole('alert')).toBeFalsy()` 등으로 에러 노출 부재를 명시적으로 추가할 수 있다.

---

### [INFO] `dimensionAutoDetected` 로직에 대한 단위 테스트 없음 (form dialog)
- 위치: `codebase/frontend/src/components/models/model-config-form-dialog.tsx` — `dimensionAutoDetected` 파생 로직
- 상세: `model-config-form-dialog.tsx` 의 `dimensionAutoDetected` 계산(`showDimension && editConfig?.dimension != null`) 및 그에 따른 `readOnly` 속성 설정은 신규 로직이다. 프론트엔드 테스트 파일 `model-config-manager.test.tsx` 에서 "renders the dimension field read-only when editing" 케이스가 추가됐으나, 이 케이스는 `dimensionAutoDetected` 가 `false` 인 경우(편집 중 `editConfig.dimension === null`) 필드가 writable 인지를 검증하는 반대 케이스가 없다.
- 제안: `dimension: null` 인 설정 편집 시 dimension 입력 필드가 `readOnly` 가 아님을 검증하는 케이스를 추가한다(`expect(dimensionInput).not.toHaveAttribute('readonly')`).

---

### [INFO] 백엔드 컨트롤러 레이어 테스트 부재 — `dimension` 필드 직렬화 미검증
- 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` — `ModelTestConnectionResultDto.dimension`
- 상세: `ModelTestConnectionResultDto` 에 `dimension?: number` 필드가 추가됐으나, 컨트롤러 레이어에서 이 DTO 가 올바르게 직렬화(Swagger/class-transformer)되는지 검증하는 통합 테스트 또는 e2e 케이스가 현재 diff 에 포함되지 않는다. `@ApiPropertyOptional` 데코레이터만으로는 런타임 직렬화 동작이 보장되지 않는다.
- 제안: 컨트롤러 spec 테스트에서 embedding kind 의 testConnection 응답이 `dimension` 필드를 포함하는 케이스를 추가하거나, e2e 테스트에서 `/model-configs/:id/test` 응답 body 에 `dimension` 이 포함됨을 검증한다.

---

### [INFO] `listModels` kind-agnostic 변경에 대한 테스트 부재
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `listModels` 메서드 (`findEntity` 에서 `'chat'` 인수 제거)
- 상세: `listModels` 의 `findEntity` 호출에서도 `'chat'` 고정 인수가 제거됐으나, 이에 대한 테스트 케이스가 추가되지 않았다. `testConnection` 에 대해서는 회귀 케이스가 추가됐는데, `listModels` 의 동일 변경에 대해서는 embedding kind 설정으로 `listModels` 가 정상 조회됨을 검증하는 케이스가 없다.
- 제안: `listModels` describe 블록에 `findEntity` 가 kind 인수 없이 호출되는지 검증하는 케이스를 추가한다. 최소한 `expect(mockModelConfigService.findEntity).toHaveBeenCalledWith(configId, workspaceId)` (3번째 인수 없음)를 assert 한다.

---

## 요약

이번 변경에서 테스트 커버리지는 전반적으로 충실하다. 백엔드 `testConnection` 에는 embedding 회귀, 빈 벡터, 에러 sanitize, rerank 분기 케이스가 체계적으로 추가됐고, 프론트엔드에는 dimension 자동 저장·중복 저장 방지·저장 실패 허용·read-only 렌더링 케이스가 추가됐다. 다만 몇 가지 갭이 남아 있다. `listModels` 의 kind-agnostic 변경은 테스트 없이 지나쳐 회귀 방지가 약하고, `invalidate()` 사이드이펙트 미검증은 query 갱신 로직 누락 시 발견 불가 상태다. 또한 빈 내부 벡터(`[[]]`) 엣지케이스와 dimension 필드 DTO 직렬화 검증이 없어 경계 조건 커버리지에 작은 구멍이 있다. 이들은 모두 INFO 수준으로, 현재 구현의 핵심 동작(embedding probe 분기, rerank 우회, dimension 반환)은 테스트로 충분히 고정돼 있다.

## 위험도

LOW
