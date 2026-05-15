# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 보안 취약점(버튼 ID 조작, XSS), 아키텍처 결합도(실행 엔진-핸들러 간 내부 구조 노출), 테스트 커버리지 누락이 복합적으로 존재

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 버튼 ID에 `__item_` 구분자 포함 시 포트 라우팅 조작 가능 — 설정 권한 보유자가 의도하지 않은 포트로 실행 흐름 변경 가능 | `carousel.handler.ts` `validateItemButtons()`, `execution-engine.service.ts` L1594–1597 | 버튼 ID 검증에 `__item_` 포함 여부 차단 추가: `if (btn.id.includes('__item_')) errors.push(...)` |
| 2 | Security | link 타입 버튼 URL에 `javascript:` 등 위험 스킴 검증 부재 — XSS 위험 | `carousel.handler.ts` `validateItemButtons()` link 타입 처리 | `sanitizeUrl()`을 버튼 URL에도 적용하고 `javascript:`, `data:`, `vbscript:` 스킴 차단 여부 명시적 검증 |
| 3 | Security | `buttonConfig`가 `cleanNodeOutput`에 유지되어 다운스트림 노드(AI Agent, HTTP Request 등)에 내부 메타데이터 노출 | `execution-engine.service.ts` `delete cleanNodeOutput.buttonConfig` 제거 부분 | 실행 상세 렌더링용 데이터는 DB 원본 레코드에서 직접 조회하고, `cleanNodeOutput`에서는 `buttonConfig` 계속 제거 |
| 4 | Security | `unwrap<T>()`에서 `{ data: null }` 응답 시 `null`이 `T`로 반환되어 런타임 오류 유발 가능 | `frontend/src/lib/api/executions.ts` `unwrap` 함수 | `null` 체크 추가: `d.data !== null && d.data !== undefined` 조건 강화 |
| 5 | Architecture | 실행 엔진이 Carousel 핸들러 내부 구조(`buttonItemMap`, `__item_` ID 패턴)를 직접 파싱 — OCP 위반, 핸들러 추가 시마다 실행 엔진 수정 필요 | `execution-engine.service.ts` L1594–1604, `carousel.handler.ts` L162 | 핸들러에 `resolveButtonClick(buttonId, nodeOutput)` 인터페이스 도입, 또는 버튼 정의에 `portId` 필드 별도 포함 |
| 6 | Maintainability | `__item_` 구분자 문자열이 두 파일에 하드코딩으로 분산 — 변경 시 양쪽 동시 수정 필요 | `carousel.handler.ts` L162, `execution-engine.service.ts` L1604 | 공유 상수 또는 유틸 함수(`buildItemButtonId`, `parseItemButtonId`)로 추출 |
| 7 | Maintainability | `validateItemButtons`와 `validateButtons` 간 중복 검증 로직 — 단일 책임 원칙 위반 | `carousel.handler.ts` `validateItemButtons` 함수 | 공통 버튼 검증 로직을 단일 헬퍼로 통합, 최대 개수 제한만 파라미터로 분리 |
| 8 | Maintainability | `ConversationInspector`의 `previewOnly` 플래그 하나로 상태 관리, UI, 클릭 가능 여부 등 모두 분기 — 단일 책임 원칙 위반 | `conversation-inspector.tsx` | `ConversationPreview`(히스토리)와 `ConversationInspector`(라이브)로 분리, 또는 공통 로직 훅으로 추출 |
| 9 | Side Effect | `executionsApi.getById` 반환 타입이 `AxiosResponse<ExecutionData>` → `ExecutionData`로 변경 — 미수정 호출자 존재 시 런타임 오류 | `frontend/src/lib/api/executions.ts`, `use-execution-events.ts` | `grep -r "executionsApi.getById" frontend/src`로 모든 소비자 확인 후 `.data` 접근 패턴 제거 |
| 10 | Side Effect | `execution-store.ts` waiting 액션 내 `selectedResultNodeId` 직접 설정과 기존 `useEffect` 기반 자동 선택 로직 중복 실행 | `execution-store.ts` `waitingForButtons`, `waitingForForm`, `waitingForConversation` | store action과 useEffect 중 하나로 통일하여 이중 상태 변경 방지 |
| 11 | Testing | `execution-list-page.test.tsx`: `vi.clearAllMocks()` 후 `getByWorkflow` mock 구현 미재설정 — 테스트 실행 순서에 따라 비결정적 실패 가능 | `execution-list-page.test.tsx` `beforeEach` 블록 | `beforeEach`에서 명시적으로 `mockResolvedValue` 재설정 |
| 12 | Testing | `execution-detail-page.test.tsx` Failed Execution 테스트에서 `executionId` 불일치 (`"exec-1"` vs `"exec-fail"`) | `execution-detail-page.test.tsx` Failed Execution describe 블록 | `executionId`를 `failedExec.id`와 일치하도록 통일 |
| 13 | Testing | Prev/Next 네비게이션 테스트 전무 — 핵심 기능인데 비활성화 조건, 클릭 시 라우팅 미검증 | `execution-detail-page.test.tsx` | prev/next null 시 버튼 비활성화, 클릭 시 `router.push` 호출 여부 테스트 추가 |
| 14 | Testing | 정렬/필터/페이지네이션 인터랙션 테스트 전무 | `execution-list-page.test.tsx` | 컬럼 정렬 클릭, 상태 필터 클릭, 페이지네이션 클릭 시 `getByWorkflow` 파라미터 검증 테스트 추가 |
| 15 | Testing | `carousel-buttons.handler.spec.ts`: `itemButtons` validation, `buttonItemMap` 생성, 아이템별 버튼 ID 생성 등 신규 기능 테스트 누락 | `carousel-buttons.handler.spec.ts` | `should generate per-item button IDs`, `should build buttonItemMap correctly`, `should validate itemButtons max 4 per item` 등 추가 |
| 16 | Testing | `execution-engine.service.spec.ts`: `_selectedPort` 스트리핑 동작 검증 테스트 명확성 부족 | `execution-engine.service.spec.ts` L1191-1198 | `_selectedPort`가 실제로 스트리핑되는지 명시적으로 검증하는 별도 테스트 추가 |
| 17 | Requirement | EH-DETAIL-05: Skipped 상태 노드 제외 로직에 대한 테스트 누락 | `execution-detail-page.test.tsx` `makeExecution()` 픽스처 | `status: "skipped"` 노드 포함 픽스처로 해당 노드가 목록에 미표시됨을 검증하는 테스트 추가 |
| 18 | Requirement | ND-CL-10: `source` 표현식 resolution 파이프라인 연결 불명확 — 미해결 표현식 도달 시 silent failure | `carousel.handler.ts` L163 | 표현식 엔진이 `source` 필드를 실제로 평가하는지 확인 후 방어 코드 또는 경고 로그 추가 |
| 19 | Performance | `custom-node.tsx`의 `hasAnyLink` 계산 시 `portDefs` 구성 이후 불필요한 중복 순회 | `custom-node.tsx` `hasAnyLink` 계산 라인 | `portDefs` 구성 루프에서 `hasAnyLink` 플래그를 동시에 수집 |
| 20 | Scope | 리뷰 결과물이 `frontend/review/`와 루트 `review/` 양쪽에 중복 저장되고, 후자는 날짜 폴더가 중첩됨 | `frontend/review/2026-04-09_06-29-35/`, `review/2026-04-09_06-29-35/2026-04-09_06-29-35/` | CLAUDE.md 폴더 구조에 따라 루트 `review/` 하나만 유지, 중복 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `selectedItem` 전체 객체가 다운스트림 노드에 전달 — 민감 필드 의도치 않은 노출 가능 | `execution-engine.service.ts` L1617 | 필드 화이트리스트 필터링 또는 사용자 선택 필드 설정 옵션 제공 검토 |
| 2 | Architecture | `execution-status.ts`의 상태 매핑이 `Record<string, ...>` 타입 — 새 상태 추가 시 누락을 타입 시스템이 잡지 못함 | `frontend/src/lib/utils/execution-status.ts` | `Record<ExecutionStatus, string>` 타입 적용으로 exhaustive mapping 강제 |
| 3 | Architecture | `getByWorkflow`가 `unwrap()` 없이 직접 캐스팅 — `getById`와 정규화 방식 불일치 | `frontend/src/lib/api/executions.ts` `getByWorkflow` | `unwrapPaginated` 등 일관된 패턴 적용 |
| 4 | Architecture | `RunResultsDrawer`가 `useParams()`로 URL 구조에 직접 의존 | `run-results-drawer.tsx` | `workflowId`를 prop으로 전달받거나 링크 생성을 부모에 위임 |
| 5 | Maintainability | `custom-node.tsx` carousel 출력 포트 계산 로직 복잡도 과다 — static/dynamic 분기 + globalButtons + `hasAnyLink` 중첩 | `custom-node.tsx` carousel 조건부 포트 계산 블록 | 포트 계산을 `getCarouselOutputPorts(config)` 함수로 추출 |
| 6 | Maintainability | `llm-config.service.spec.ts`: `eslint-disable` 주석 제거 후 `any` 타입 경고 발생 가능 | `llm-config.service.spec.ts` L13 | `mockRepo` 타입을 구체적으로 정의하거나 ESLint 통과 여부 확인 후 주석 제거 판단 |
| 7 | Testing | `carousel.handler.spec.ts`: `source` 없는 backward compatibility 테스트와 기존 테스트 중복 | `carousel.handler.spec.ts` L32-34 | 기존 테스트를 backward compatibility 명시 테스트로 리네이밍하고 중복 제거 |
| 8 | Testing | `unwrap()` 함수 자체의 단위 테스트 부재 | `frontend/src/lib/api/executions.ts` | 래핑/비래핑/null 응답 edge case 등 단위 테스트 추가 |
| 9 | Testing | `mockBack` 선언 후 미사용 — 뒤로가기 버튼 동작 미검증 | `execution-list-page.test.tsx` L6 | 뒤로가기 버튼 클릭 시 `mockBack` 호출 여부 검증 테스트 추가 |
| 10 | Testing | `execution-list-page.test.tsx`: `document.querySelectorAll("tbody tr")` 직접 DOM 접근 | `execution-list-page.test.tsx` row click 테스트 | `within(screen.getByRole("table")).getAllByRole("row")` 또는 `data-testid` 활용 |
| 11 | Documentation | `buttonItemMap`, `validateItemButtons()`, `unwrap()` 등 비자명적 로직에 맥락 설명 주석 부재 | `execution-engine.service.ts`, `carousel.handler.ts`, `executions.ts` | 각 함수/변수의 목적과 cross-reference 주석 추가 |
| 12 | Documentation | `execution-status.ts`에서 유니코드 이스케이프(`\u2705`) 사용으로 가독성 저하 | `execution-status.ts`, `execution-status.test.ts` | 직접 이모지 리터럴(`✅`) 사용 |
| 13 | Documentation | `POLL_INTERVAL_WAITING_MS` 10000→2000 변경 이유 주석 부재 | `use-execution-events.ts` | 변경 이유(버튼 클릭 반응성 개선 등) 주석으로 명시 |
| 14 | Documentation | `prd/3-node-system.md` ND-CL-10 `source` 표현식 예시가 spec에 미반영 가능 | `spec/` Carousel 관련 스펙 문서 | `source` 필드 설명 및 표현식 문법 예시 동기화 |
| 15 | Performance | `execution-engine.service.ts`: `buttonId.includes('__item_')` + `split()` 이중 호출 | `execution-engine.service.ts` selectedPort 계산 블록 | `const parts = buttonId.split('__item_'); selectedPort = parts.length > 1 ? parts[0] : buttonId` |
| 16 | Scope | `POLL_INTERVAL_WAITING_MS` 10000→2000 동작 변경이 기능 변경과 혼재 — 서버 부하 5배 증가 | `use-execution-events.ts` `POLL_INTERVAL_WAITING_MS` | 별도 커밋으로 분리 및 변경 의도 문서화 |
| 17 | Requirement | EH-LIST-03: `pending` 상태 필터 미포함 — 의도적 제외인지 불명확 | `executions/page.tsx` `FILTER_BUTTONS` | `pending` 제외 의도를 주석으로 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | 버튼 ID를 통한 포트 라우팅 조작, link URL XSS, buttonConfig 다운스트림 노출, unwrap null 처리 오류 |
| Architecture | MEDIUM | 실행 엔진이 Carousel 내부 구조(buttonItemMap, `__item_` 패턴)에 직접 결합, ConversationInspector 단일 책임 위반 |
| Testing | MEDIUM | Prev/Next 네비게이션, 정렬/필터/페이지네이션 인터랙션 테스트 전무, mock 비결정성, 신규 carousel 기능 커버리지 누락 |
| Side Effect | MEDIUM | getById 반환 타입 변경으로 미수정 호출자 런타임 오류 가능, selectedResultNodeId 이중 상태 변경 |
| API Contract | MEDIUM | `_selectedPort` 제거 vs `buttonConfig` 유지 간 내부 필드 노출 정책 불일치, 아이템 버튼 포트 라우팅 계약 미문서화 |
| Requirement | MEDIUM | EH-DETAIL-07 선택 버튼 하이라이트 미확인, ND-CL-10 source 표현식 파이프라인 미검증, EH-DETAIL-05 테스트 누락 |
| Maintainability | MEDIUM | `__item_` 구분자 두 파일에 하드코딩 분산, validateButtons 중복 검증 로직, custom-node.tsx 포트 계산 복잡도 |
| Performance | LOW | hasAnyLink 중복 순회, buttonItemMap 중첩 루프(도메인 제약으로 실질 영향 제한적) |
| Concurrency | LOW | POLL_INTERVAL_WAITING_MS 단축 시 setInterval 기반이면 중복 요청 가능, setTimeout 재귀 방식 확인 필요 |
| Documentation | LOW | 비자명 로직 맥락 주석 부재, 유니코드 이스케이프, PRD-Spec 동기화 미흡 |
| Dependency | LOW | getById 반환 타입 변경으로 소비자 전수 확인 필요 (완료 시 NONE) |
| Scope | LOW | 포맷팅·eslint 정리가 기능 변경과 혼재, 리뷰 결과물 경로 중복 |
| Database | NONE | 데이터베이스 관련 코드 변경 없음 |

---

## 발견 없는 에이전트

- **Database** — 데이터베이스 레이어와 무관한 변경으로 발견사항 없음

---

## 권장 조치사항

1. **[즉시] 버튼 ID 보안 검증 추가** — `validateItemButtons()`와 `validateButtons()`에서 `__item_` 구분자 포함 여부 및 허용 문자 패턴 검증 추가 (포트 라우팅 조작 방지)

2. **[즉시] link 타입 버튼 URL 스킴 검증** — `sanitizeUrl()`을 버튼 URL에도 적용하여 `javascript:` 등 위험 스킴 차단

3. **[즉시] `executionsApi.getById` 호출자 전수 확인** — `grep -r "executionsApi.getById" frontend/src`로 `.data` 접근 패턴 잔존 여부 확인

4. **[즉시] 테스트 비결정성 수정** — `execution-list-page.test.tsx`의 `beforeEach`에서 mock 명시적 재설정, `execution-detail-page.test.tsx`의 `executionId` 불일치 수정

5. **[높음] `buttonConfig` 다운스트림 전달 재검토** — 실행 상세 렌더링용 데이터를 DB 원본에서 직접 조회하거나, `_meta` 채널로 분리하여 `cleanNodeOutput`에서 제거 유지

6. **[높음] `unwrap()` null 안전성 강화** — `{ data: null }` 응답 처리 버그 수정

7. **[높음] 핵심 기능 테스트 추가** — Prev/Next 네비게이션, 정렬/필터/페이지네이션 인터랙션, carousel 신규 기능(`buttonItemMap`, 아이템별 버튼 ID, itemButtons 검증) 테스트 작성

8. **[중간] `__item_` 구분자를 공유 상수/유틸로 추출** — `buildItemButtonId()`, `parseItemButtonId()` 함수로 두 파일 간 암묵적 결합 해소

9. **[중간] `execution-store.ts` 이중 상태 변경 정리** — waiting 액션 내 직접 설정과 `useEffect` 기반 자동 선택 중 하나로 통일

10. **[중간] `execution-status.ts` 타입 안전성 강화** — `Record<string, ...>` → `Record<ExecutionStatus, ...>` 적용으로 새 상태 추가 시 누락 컴파일 타임 검출

11. **[낮음] 리뷰 결과물 경로 중복 제거** — `frontend/review/` 하위 중복 파일 제거, 루트 `review/` 구조 정리

12. **[낮음] 비자명 로직 주석 보강** — `buttonItemMap` 목적, `unwrap()` 동작 이유, `POLL_INTERVAL_WAITING_MS` 변경 근거 주석 추가