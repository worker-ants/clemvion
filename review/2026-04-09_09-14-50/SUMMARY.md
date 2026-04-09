# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 캐러셀 아이템 버튼의 암묵적 문자열 프로토콜이 3개 레이어에 걸쳐 분산되고, 핵심 신규 기능(buttonItemMap, selectedItem, __item_ 라우팅)에 대한 테스트가 전무하며, API 계약 변경으로 인한 Breaking Change 위험이 존재함

## Critical 발견사항
없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `buttonItemMap` 생성 로직 및 `allButtons` 병합 로직 테스트 완전 누락 | `carousel.handler.spec.ts`, `carousel-buttons.handler.spec.ts` | dynamic 모드에서 `buttonConfig.buttonItemMap`에 올바른 인덱스 매핑이 생성되는지 검증 테스트 추가 |
| 2 | 테스트 | `__item_` 버튼 ID → 포트 라우팅 로직 테스트 누락 | `execution-engine.service.spec.ts`, `execution-engine.service.ts:1601-1605` | `btn-approve__item_0` 클릭 시 `selectedPort`가 `"btn-approve"`가 되는지 명시적 검증 테스트 추가 |
| 3 | 테스트 | `selectedItem` 필드 포함 여부 테스트 누락 | `execution-engine.service.spec.ts` | 아이템 버튼 클릭 시 `interactionData.selectedItem`이 해당 인덱스 아이템과 일치하는지, global 버튼 클릭 시 누락되는지 단위 테스트 추가 |
| 4 | 테스트 | Carousel `source` 필드 실행 경로 테스트 누락 | `carousel.handler.spec.ts` | `config.source`가 `input` 파라미터보다 우선 사용되는 로직 검증 테스트 추가 |
| 5 | API 계약 | `executionsApi.getById` 반환 타입 Breaking Change (`AxiosResponse<ExecutionData>` → `ExecutionData`) | `frontend/src/lib/api/executions.ts` | `getById` 사용하는 모든 파일 grep으로 완전 확인 필요 |
| 6 | API 계약 | `getById`와 `getByWorkflow`의 응답 언래핑 전략 불일치 (`unwrap` vs 직접 캐스팅) | `frontend/src/lib/api/executions.ts L53-68` | 두 메서드에 동일한 언래핑 전략 적용, 또는 axios 인터셉터 레벨 처리 도입 |
| 7 | API 계약 | `buttonConfig.buttons`가 글로벌+아이템 버튼 모두 포함으로 변경 — 기존 소비자 Breaking Change | `carousel.handler.ts L195-214` | `globalButtons`/`itemButtons`를 분리된 필드로 유지하거나 기존 `buttons`는 글로벌만 유지 |
| 8 | 아키텍처 | 매직 문자열 `__item_`이 3개 레이어(핸들러/엔진/프론트)에 암묵적 프로토콜로 하드코딩 | `carousel.handler.ts`, `execution-engine.service.ts`, `custom-node.tsx` | 상수 파일에 `ITEM_BUTTON_SEPARATOR`, `makeItemButtonId()`, `parseItemButtonId()` 추출; 또는 `buttonItemMap`에 `portId` 포함시켜 ID 파싱 제거 |
| 9 | 보안 | `buttonId` 파싱 포트 라우팅 — `selectedPort` 화이트리스트 검증 미흡 | `execution-engine.service.ts` — `buttonId.includes('__item_')` 분기 | `selectedPort`가 노드에 정의된 실제 포트 목록에 속하는지 화이트리스트 검증 추가 |
| 10 | 부작용 | `unwrap()` 함수 — `null`/`undefined` 케이스에서 `AxiosResponse` 객체 자체가 반환될 수 있음 | `frontend/src/lib/api/executions.ts` — `unwrap` 헬퍼 | axios 인터셉터 레벨로 정규화하거나 명시적 타입 가드 적용 |
| 11 | 부작용 | 캐러셀 `source`가 배열 아닌 경우 예고 없이 `input` 폴백 — 조용한 실패 | `carousel.handler.ts` — execute 메서드 | `source`가 정의되어 있는데 배열이 아닌 경우 명시적 오류 또는 경고 로그 추가 |
| 12 | 부작용 | `buttonId`에 `__item_`이 이미 포함된 경우 `split`이 오작동 | `carousel.handler.ts` + `execution-engine.service.ts` | `buttonId.replace(/__item_\d+$/, '')` 방식으로 교체 |
| 13 | 유지보수 | `carousel.handler.ts`의 `execute` 메서드가 ~100줄에 5개 책임 담당 | `carousel.handler.ts L116-215` | `buildItemsFromStatic`, `buildItemsFromDynamic`, `aggregateButtons` 등 private 메서드로 분리 |
| 14 | 유지보수 | `execution-status.ts` 상수가 `ExecutionStatus` 타입 대신 `Record<string, T>` 사용 — 새 상태 추가 시 컴파일러가 누락 미감지 | `frontend/src/lib/utils/execution-status.ts` | `import type { ExecutionStatus }` 후 `Record<ExecutionStatus, T>` 로 교체 |
| 15 | 아키텍처 | `previewOnly` boolean prop — `ConversationInspector`에 인터랙티브/읽기전용 두 책임 혼재 | `conversation-inspector.tsx`, `generic-renderer.tsx` | `ConversationPreview`/`ConversationInteractor` 분리 또는 render prop 패턴 적용 |
| 16 | 요구사항 | PRD ND-CL-10: `source` 표현식 resolve 책임 소재 불명확 (핸들러 주석 vs 폴백 코드 불일치) | `carousel.handler.ts` — dynamic mode `execute()` | 표현식 resolve 책임 계층을 타입으로 강제하고 폴백 로직 제거 또는 경고 추가 |
| 17 | 요구사항 | PRD ND-CL-09: 아이템 버튼 클릭 → `selectedItem` 다운스트림 전달 E2E 검증 없음 | `execution-engine.service.ts` — `handleClick()` | `selectedItem` 포함 여부 검증하는 integration 테스트 추가 |
| 18 | 요구사항 | PRD EH-DETAIL-07: 선택된 버튼 하이라이트 UI 구현 여부 diff에서 확인 불가 | `presentation-renderers.tsx` | `interactionData.buttonId`와 일치하는 버튼 하이라이트 렌더링 로직 확인 및 테스트 추가 |
| 19 | 성능 | `POLL_INTERVAL_WAITING_MS` 10000ms → 2000ms — 대기 상태에서 서버 API 호출 5배 증가 | `use-execution-events.ts` | 대기 상태는 WebSocket으로 감지하거나 최소 5~10초 간격 유지 |
| 20 | 테스트 | `execution-detail-page.test.tsx`의 `executionId: "exec-fail"` vs `failedExec.id: "exec-1"` 불일치 | `execution-detail-page.test.tsx L192, L210` | `failedExec.id`를 `"exec-fail"`로 맞추거나 `executionId: "exec-1"`로 통일 |
| 21 | 보안 | `buttonItemMap`의 `itemIndex` 음수 범위 검증 미흡 | `execution-engine.service.ts` — `itemIndex` 추출 로직 | `itemIndex >= 0 && itemIndex < outputItems.length` 조건 명시적 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프 | 리뷰 파일이 `review/2026-04-09_06-29-35/2026-04-09_06-29-35/` 경로에 중복 생성 | `review/` 루트 경로 | 중복 경로 파일 제거 |
| 2 | 스코프 | `llm-config.service.spec.ts` eslint 주석만 제거, `any` 타입 유지 — CI 경고 가능성 | `llm-config.service.spec.ts L13` | 주석 제거 + 타입 구체화, 또는 주석 유지 중 하나로 일관성 처리 |
| 3 | API 계약 | 버튼 ID 컨벤션 `{defId}__item_{idx}` 스펙 문서에 미명시 | `prd/`, `spec/` | 스펙 문서에 ID 컨벤션 명시, 유효성 검증에서 `__item_` 포함 버튼 ID 금지 규칙 추가 |
| 4 | 문서 | `_selectedPort` 스트리핑 동작이 구현부가 아닌 테스트 주석에만 문서화 | `execution-engine.service.ts` 관련 로직 | 구현부에 `// Strip _selectedPort from downstream input to avoid leaking internal routing state` 추가 |
| 5 | 문서 | `unwrap<T>` 배열 예외 처리 조건 설명 주석 없음 | `executions.ts` — `unwrap` 함수 | `// Arrays are never wrapped; only unwrap object-shaped { data: T } responses` 추가 |
| 6 | 문서 | `buttonItemMap` 구조의 인라인 설명 부재 | `execution-engine.service.ts` | `// buttonItemMap: { [buttonId]: itemIndex } — used to resolve selectedItem on click` 추가 |
| 7 | 유지보수 | `outputItems` 할당의 불필요한 이중 조회 (`nodeOutput.items ?? cleanNodeOutput.items`) | `execution-engine.service.ts ~L1581` | `const outputItems = nodeOutput.items as unknown[] \| undefined;`로 단순화 |
| 8 | 아키텍처 | `execution-store.ts`에서 실행 상태와 UI 선택 상태 혼합 (대기 상태 진입 시 `selectedResultNodeId` 동시 설정) | `execution-store.ts` — `waitForForm/Buttons/Conversation` | 선택 상태를 별도 `useEffect`로 분리하거나 로컬 상태로 관리 |
| 9 | 아키텍처 | `RunResultsDrawer`가 `/workflows/[id]/...` URL 구조에 직접 결합 | `run-results-drawer.tsx` | `workflowId`를 prop으로 주입받거나 `useWorkflowNavigationLinks` 훅으로 분리 |
| 10 | 아키텍처 | 동적 `Wrapper` 태그 (`"button" \| "div"`) — React reconciler 불안정성 | `conversation-inspector.tsx` SummaryView | 명시적 조건부 렌더링 분기 또는 항상 `<div>`에 `role="button"` 패턴 사용 |
| 11 | 테스트 | `Back` 버튼 테스트가 `getAllByRole("button")[0]` 인덱스에 의존 — 취약 | `execution-detail-page.test.tsx L150` | `getByRole("button", { name: /back/i })` 또는 `aria-label` 추가 |
| 12 | 테스트 | `mockBack` 선언 후 어떤 `expect`에서도 미검증 | `execution-list-page.test.tsx L7` | `router.back()` 호출 검증 추가 또는 변수 제거 |
| 13 | 테스트 | 필터/정렬/페이지네이션 인터랙션 테스트 부재 | `execution-list-page.test.tsx` | 필터 버튼 클릭→API 재호출, 정렬 토글, 페이지 이동 인터랙션 테스트 추가 |
| 14 | 요구사항 | EH-DETAIL-09: 100건 초과 시 이전/다음 탐색 불가 제약이 UI/PRD에 미명시 | `prd/7-execution-history.md`, 실행 상세 UI | UI에 제약 안내 또는 PRD에 현재 제약 명시 |
| 15 | 보안 | `workflowId`를 UUID 검증 없이 `href`에 직접 삽입 | `run-results-drawer.tsx` | `/^[0-9a-f-]{36}$/i.test(workflowId)` 검증 추가 |
| 16 | 성능 | `adjacentQuery` — prev/next 2개 ID를 위해 100건 전체 페치 | `[executionId]/page.tsx` — `adjacentQuery` queryFn | 백엔드에 `GET /executions/:id/adjacent` 엔드포인트 추가 또는 id 전용 경량 API 분리 |
| 17 | 문서 | `execution-status.test.ts`의 `formatDuration(59999)` → `"60.0s"` 동작이 의도적임을 테스트명에 미명시 | `execution-status.test.ts L44` | `it("rounds 59999ms to 60.0s (toFixed rounding)", ...)` 로 테스트명 변경 |
| 18 | 의존성 | `getByWorkflow`가 `unwrap` 미사용으로 `getById`와 응답 처리 불일치 | `frontend/src/lib/api/executions.ts` | `unwrap<PaginatedExecutions>(data)` 사용으로 통일 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | `buttonId` 파싱 포트 라우팅 화이트리스트 미검증, `buttonConfig` 다운스트림 노출 |
| Performance | MEDIUM | `POLL_INTERVAL_WAITING_MS` 5배 단축으로 불필요한 서버 부하, `adjacentQuery` 100건 bulk fetch |
| Architecture | MEDIUM | `__item_` 프로토콜 3레이어 암묵적 결합, `previewOnly` OCP 위반, `source` 계약 불명확 |
| Testing | MEDIUM | buttonItemMap/selectedItem/`__item_` 라우팅 핵심 기능 테스트 전무, executionId 불일치 |
| API Contract | MEDIUM | `getById` Breaking Change, `buttonConfig.buttons` 구조 변경, 언래핑 전략 불일치 |
| Maintainability | MEDIUM | `__item_` 하드코딩 3개 파일 분산, `execute` 메서드 과다 책임, `ExecutionStatus` 타입 미활용 |
| Requirement | MEDIUM | `source` resolve 책임 불명확, EH-DETAIL-07 버튼 하이라이트 미검증, E2E 테스트 누락 |
| Side Effect | MEDIUM | `getById` 반환타입 변경 파급, `unwrap` 휴리스틱 오처리, `__item_` split 오작동 가능성 |
| Documentation | LOW | `_selectedPort` 스트리핑 동작 테스트에만 문서화, `unwrap` 조건 설명 부재 |
| Scope | LOW | `POLL_INTERVAL_WAITING_MS` 스펙 근거 없이 변경, 리뷰 파일 경로 중복 |
| Concurrency | NONE | 동시성 관련 새로운 위험 요소 없음 |
| Database | NONE | 데이터베이스 레이어 변경 없음 |
| Dependency | NONE | 신규 외부 의존성 없음, `getByWorkflow` 언래핑 불일치만 지적 |

## 발견 없는 에이전트
- **Database** — 변경사항에 DB 직접 접근 코드 없음
- **Concurrency** — 요청별 로컬 변수 사용으로 동시성 이슈 없음
- **Dependency** — 신규 외부 의존성 없음

## 권장 조치사항

1. **[즉시] 신규 기능 테스트 추가** — `buttonItemMap`, `selectedItem`, `__item_` 포트 라우팅, `source` 우선순위 등 이번 변경의 핵심 로직에 대한 테스트가 전무함. 기능 신뢰도 확보를 위해 최우선 조치 필요
2. **[즉시] `__item_` split → replace 교체** — `buttonId.includes('__item_')` + `split('__item_')[0]` 를 `buttonId.replace(/__item_\d+$/, '')` 로 교체하여 ID에 `__item_`이 포함된 엣지 케이스 방어
3. **[즉시] `getById` 호출부 전체 grep 확인** — 반환 타입 Breaking Change로 인해 `response.data` 패턴 사용 코드가 있다면 런타임 오류 발생
4. **[단기] `__item_` 상수 및 헬퍼 추출** — `ITEM_BUTTON_SEPARATOR`, `makeItemButtonId()`, `parseItemButtonId()`를 공유 상수 파일로 추출하여 3개 레이어의 암묵적 결합 해소
5. **[단기] `buttonConfig.buttons` 구조 변경 호환성 처리** — `globalButtons`/`itemButtons` 분리 필드 도입 또는 기존 소비자 전체 업데이트 확인
6. **[단기] `selectedPort` 화이트리스트 검증 추가** — 클라이언트 제출 `buttonId`에서 추출한 포트가 노드 정의 포트 목록에 있는지 검증
7. **[단기] `POLL_INTERVAL_WAITING_MS` 재검토** — waiting 상태는 사용자 액션 전까지 상태 변화가 없으므로 2초 폴링은 불필요한 서버 부하. 5~10초 또는 WebSocket 전용으로 복귀
8. **[단기] `execution-status.ts` 타입 강화** — `Record<string, T>` → `Record<ExecutionStatus, T>`로 교체하여 새 상태 추가 시 컴파일러 검증 활성화
9. **[단기] `executionId` 불일치 수정** — `execution-detail-page.test.tsx`의 `"exec-fail"` vs `"exec-1"` 불일치로 Failed Execution 테스트가 실제와 다른 상태 검증 중
10. **[중기] `unwrap` 전략 일원화** — axios 인터셉터 레벨 정규화 도입 또는 `getById`/`getByWorkflow` 동일 전략 적용, `null`/`undefined` 케이스 방어 로직 추가
11. **[중기] `carousel.handler.ts` execute 메서드 분리** — `buildItemsFromStatic`, `buildItemsFromDynamic`, `aggregateButtons` private 메서드로 분리
12. **[중기] 리뷰 파일 중복 경로 정리** — `review/2026-04-09_06-29-35/2026-04-09_06-29-35/` 중복 디렉토리 제거