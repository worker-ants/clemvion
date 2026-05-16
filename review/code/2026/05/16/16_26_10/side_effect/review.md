# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `cafe24Precheck` 함수 시그니처에 선택적 `signal` 파라미터 추가
  - 위치: `frontend/src/lib/api/integrations.ts` — `cafe24Precheck(mallId: string, signal?: AbortSignal)`
  - 상세: 기존 `cafe24Precheck(mallId: string)` 에서 `cafe24Precheck(mallId, signal?)` 으로 시그니처가 확장됐다. `signal` 은 선택적(`?`) 이므로 기존 호출자(`precheckMock`, 기존 테스트 등)는 두 번째 인자를 생략해도 TypeScript 에러가 발생하지 않는다. 실제 부작용 위험 없음 — 하위 호환성 유지.
  - 제안: 변경 사항은 적절하다. 호출 사이트 전체가 단일 페이지(`page.tsx`) 이고, 해당 파일에서도 올바르게 `controller.signal` 을 전달하고 있어 별도 조치 불필요.

- **[INFO]** `AbortController` 생성 위치와 `useEffect` 정리 타이밍
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect` 내부
  - 상세: `AbortController` 가 `useEffect` 본문 최상위(timeout 설정 전)에서 즉시 생성된다. effect cleanup 함수에서 `controller.abort()` 와 `clearTimeout(t)` 를 함께 호출한다. `aborted` 플래그도 함께 유지해 abort 이후에도 상태 업데이트를 방지한다. 이중 방어는 바람직하다. AbortController 는 `useEffect` 지역 변수이므로 전역 상태나 공유 상태를 건드리지 않는다.
  - 제안: 현재 구현이 올바르다. React strict mode 에서 effect 가 두 번 실행될 때 각 실행이 독립적인 `controller` 인스턴스를 갖는지 확인 — 지역 변수이므로 문제 없음.

- **[INFO]** `buildFakeCafe24Integration` 헬퍼의 기본값이 테스트 격리에 미치는 영향
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 함수 (라인 42~87)
  - 상세: 헬퍼는 순수 함수(pure function)로 호출마다 새 객체를 반환한다. 공유 상태를 수정하거나 전역 변수를 참조하지 않는다. 기본값(`mallId: 'priv-shop'`, `status: 'connected'` 등)이 고정되어 있어, 오버라이드 없이 호출한 경우 여러 테스트가 동일한 기본값을 갖는 객체를 생성한다. 테스트 간 참조 공유는 없으므로 상태 오염 위험은 없다.
  - 제안: 현재 구현이 적절하다. 단, `installToken: overrides.installToken` 과 `installTokenIssuedAt: overrides.installTokenIssuedAt` 은 오버라이드가 없으면 `undefined` 가 할당된다(default fallback 없음). 의도적이라면 주석으로 명시해두면 추후 혼란을 줄일 수 있다.

- **[INFO]** 메타데이터 배열(`applicationOperations`, `collectionOperations` 등)의 대규모 항목 삭제와 `planned.ts` 이동
  - 위치: `backend/src/nodes/integration/cafe24/metadata/application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts`, `personal.ts`, `privacy.ts`, `promotion.ts`, `translation.ts`
  - 상세: 각 메타데이터 배열에서 "Phase 8x" 주석으로 추가됐던 항목들이 삭제되고, 동일 항목들이 `planned.ts` 의 `CAFE24_PLANNED_BY_RESOURCE` 레코드로 이동했다. 이 변경은 런타임 side effect 가 있다 — 해당 operation id 들이 더 이상 `applicationOperations` 등의 배열에서 조회되지 않는다. 이를 참조하는 코드(예: 노드 실행 엔진에서 `id` 로 메타데이터를 lookup 하는 로직)가 있다면, 삭제된 id 들은 `undefined` 를 반환하게 된다. 그러나 해당 항목들이 "planned" 상태로 전환되는 것이 변경 의도이므로, 이를 lookup 하는 호출 경로가 없어야 정상이다.
  - 제안: `CAFE24_PLANNED_BY_RESOURCE` 를 실제 operation 조회에 사용하는 코드 경로가 없는지 확인 필요. planned 항목이 실수로 노드 실행 경로에서 조회될 경우 silent failure 가 발생할 수 있다. 기존 테스트가 이를 커버하고 있다면 문제없음.

- **[INFO]** `integrations.controller.ts` 의 `@ApiOperation.description` 문자열 변경
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` — 라인 370~371
  - 상세: 단순 문서 문자열(description string) 변경으로, 런타임 동작에는 영향 없다. Swagger UI 및 OpenAPI JSON 출력에만 반영된다. 라우트 순서 경고를 Swagger 문서에 포함시킨 것은 유지보수 측면에서 유익하다.
  - 제안: 변경 사항 적절. 단, Swagger description 의 마크다운 (`**Route order note**`) 이 Swagger UI 에서 렌더링되는지 사전 확인 권장.

- **[INFO]** `integrations.service.ts` 의 트랜잭션 미적용 의도 주석 추가
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — 라인 394~403
  - 상세: 코드 변경 없이 주석만 추가됐다. 런타임 side effect 없음. `auditLogsService.record` 호출이 `save()` 성공 후에만 이루어지고, preview_token 은 진입 전에 원자적으로 소비된다는 설명이 명시됐다. 단, 주석에 언급된 대로 "향후 audit log 외 부작용이 추가"될 경우 트랜잭션 경계 재검토가 필요하다는 점이 기술적 부채로 남는다.
  - 제안: 주석 내용이 논리적으로 타당하다. `save()` 성공 후 `auditLogsService.record` 실패 시 audit 누락(orphaned integration without audit)이 발생할 수 있다는 점은 현 아키텍처의 알려진 trade-off 로, 주석에 명시해두는 것이 바람직하다. 현재 주석에는 이 시나리오에 대한 언급이 없으니 추가를 권장한다.

- **[INFO]** 프론트엔드 테스트에서 `AbortSignal` 참조 전달 방식
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx` — 라인 123~127
  - 상세: `expect.any(AbortSignal)` 을 사용해 두 번째 인자를 검증한다. `precheckMock` 이 `AbortSignal` 을 받아 `firstSignal` 에 할당한 뒤 `.aborted` 상태를 검사하는 새 테스트가 추가됐다. 이 테스트는 실제 `AbortController` 동작을 검증하므로, mock 환경에서 `AbortController` 가 정상 동작해야 한다. jsdom 환경에서는 `AbortController` 가 기본 지원된다.
  - 제안: `vi.advanceTimersByTime` 이후 `controller.abort()` 가 동기적으로 호출된다는 가정이 테스트에 내재되어 있다(line 2161: `expect(firstSignal?.aborted).toBe(true)` 는 `await act` 없이 즉시 검사). React effect cleanup 이 동기적으로 실행된다는 점이 전제인데, `userEvent.clear` 와 `userEvent.type` 사이에 cleanup 이 flush 되는 시점을 명확히 할 필요가 있다. 현재 테스트가 통과한다면 동작은 검증됐지만, 취약한 타이밍 가정이 포함될 수 있다.

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` 의 이력 항목 삭제
  - 위치: `spec/conventions/cafe24-api-catalog/_overview.md` — 라인 2443~2452 삭제
  - 상세: Phase 8a~8j 의 이력 행이 삭제됐다. 이는 커버리지 히스토리를 역전시키는 문서 부작용이다. 카운트 테이블의 숫자도 Phase 8 이전 상태로 되돌아갔다 (합계 264 → 213). 런타임 side effect 는 없으나, 변경 이력 추적 목적의 문서가 의도적으로 롤백됐다는 점이 주목된다.
  - 제안: 이 변경이 Phase 8 작업 전체를 되돌리는 의도인지(spec 과 코드를 Phase 7 상태로 복원) 명확히 확인 필요. `git log` 나 PR 설명으로 근거를 남기는 것을 권장.

## 요약

이번 변경 세트는 전반적으로 부작용 측면에서 안전하다. 핵심 변경인 `AbortController` 도입은 기존 `cancelled` 플래그 패턴을 확장하는 방식으로, 전역/공유 상태에 접근하지 않고 `useEffect` 지역 변수로 격리돼 있다. `cafe24Precheck` API 함수의 선택적 `signal` 파라미터 추가는 하위 호환성을 유지한다. 테스트 헬퍼 `buildFakeCafe24Integration` 은 순수 함수이므로 테스트 격리에 영향을 주지 않는다. 메타데이터 배열에서의 대규모 항목 이동(`planned.ts` 로)은 런타임 조회 결과에 영향을 미치므로, 해당 id 를 실행 경로에서 참조하지 않는다는 점을 기존 테스트가 보증하는지 확인이 필요하다. `integrations.service.ts` 의 주석 추가는 `save()` 성공 후 `auditLogsService.record` 실패 시 audit 누락 시나리오를 명시하지 않아 불완전하다. 전반적으로 새로운 전역 변수 도입, 예상치 못한 파일시스템 변경, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 없으며, 환경 변수 관련 변경도 없다.

## 위험도

LOW
