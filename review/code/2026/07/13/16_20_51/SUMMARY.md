# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 병합을 막는 CRITICAL 은 없으나(직전 라운드 CRITICAL·WARNING 5건은 실측 재확인으로 해소됨), 테스트 커버리지 갭 3건(WARNING, testing 리뷰어 MEDIUM)과 DRY 불완전·성능 무상한 직렬화 WARNING 이 남아 있고, `documentation`/`user_guide_sync` 2개 reviewer 는 `status=success` 로 보고됐음에도 output 파일이 디스크에 없어(disk-write gap) 이번 diff 가 포함한 CHANGELOG/spec/mdx 동기화 검증 결과를 확인할 수 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 프로세스(disk-write gap) | `documentation`, `user_guide_sync` reviewer 가 매니페스트상 `status=success` 로 보고됐으나 output 파일이 실제로 디스크에 존재하지 않아(9개 파일만 실재: security/performance/architecture/requirement/scope/side_effect/maintainability/testing/concurrency) 내용을 확인할 수 없음. journal.jsonl 등 복구 경로도 세션 디렉터리에 없어 재구성 불가. 이번 diff 는 CHANGELOG.md·`spec/3-workflow-editor/2-edge.md`·`plan/in-progress/spec-sync-edge-gaps.md`·`connecting-nodes.mdx`(ko/en) 를 포함해 두 reviewer 의 실검증이 특히 중요한 변경분이다 | `.../16_20_51/documentation.md`(부재), `.../16_20_51/user_guide_sync.md`(부재) | 두 reviewer 를 재실행해 실제 산출물을 확보할 것. 다른 리뷰어(requirement)가 문서 4곳(JSDoc/CHANGELOG/spec/plan) 일치를 이미 grep 으로 재확인했으나, mdx 사용자 가이드·문서 전용 리뷰 관점의 독립 검증은 아직 없다 |
| 2 | 유지보수성/아키텍처(DRY) | 신규 O(1) selector `findLatestResultByNodeId` 도입 목적이던 "3중 중복 로직 단일화"가 신규 소비처(`edge-data-preview.tsx`)에만 적용되고, 원래 지적 대상이던 기존 두 소비처는 여전히 자체 역순 스캔을 유지 — `findLatestResultByNodeId`가 갖춘 stale-index 방어(`row?.nodeId === nodeId` 재확인)도 없어 두 구현이 향후 갈라질 위험(divergence)이 남음. `RESOLUTION.md`의 "반영" 표기가 실제 범위보다 넓게 서술됨(architecture·maintainability 리뷰어 공통 지적) | `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508-513`(`InfoTab`), `codebase/frontend/src/components/editor/expression/use-expression-context.ts:104-120`, `codebase/frontend/src/lib/stores/execution-store.ts:712`(`findLatestResultByNodeId`) | `node-settings-panel.tsx` `InfoTab`·`use-expression-context.ts` 를 `findLatestResultByNodeId` 로 교체하는 후속 작업을 별도 plan 항목으로 명시 등록. 최소한 `RESOLUTION.md` 표기를 "부분 반영(신규 코드 한정, 기존 2 사이트 미이관)"으로 정정 |
| 3 | 성능 | 바이트 크기 계산(`summarizeDataForPreview` 의 `JSON.stringify(value)` 전체 + `TextEncoder.encode`)이 여전히 상한·디바운스 없이 원본 전체를 동기 직렬화 — `useMemo(() => summarizeDataForPreview(data), [data])` 는 "같은 엣지 반복 hover"만 완화하고, 캔버스 위 여러 엣지를 빠르게 훑는(sweep) 시나리오는 매 엣지마다 캐시가 미스돼 전체 직렬화가 그대로 실행됨. `show()` 는 `scheduleHide()` 와 달리 디바운스 없음 | `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview` | 바이트 계산에 길이 상한을 두어 초과 시 근사치(`~`) 표시로 대체, `edgeHoverPreview.show()` 호출에 80~120ms 디바운스 추가, 필요 시 축약 문자열 생성과 바이트 계산을 단일 순회로 통합 |
| 4 | 테스팅 | `EdgeDataModal` 테스트 전무 — 직전 라운드가 지적한 "모달 데이터-없음 판정이 `output:null` 시 리터럴 `"null"` 노출" 결함을 `data == null` 로 수정했다고 `RESOLUTION.md` 에 명시했으나, 그 수정을 고정하는 회귀 테스트가 하나도 없음(신규 RTL 테스트 3건은 전부 `EdgeDataPreviewTooltip` 만 다룸) | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`(`EdgeDataModal`), 테스트 `.../__tests__/edge-data-preview.test.tsx`(import 목록에 `EdgeDataModal` 없음) | `EdgeDataModal` 전용 테스트 추가 — (1) `edgeId=null`→Dialog 미노출, (2) `output:null`→"표시할 데이터 없음" 문구(리터럴 "null" 아님), (3) 정상 데이터→`JsonContent` 렌더, (4) 닫기 액션→`onClose` 호출 |
| 5 | 테스팅 | 툴팁 `onMouseEnter`/`onMouseLeave` → `onKeepAlive`/`onDismiss` 배선이 미검증 — 두 prop 은 타입 시그니처(`() => void`)가 완전히 동일해 서로 바꿔 배선해도(예: `onMouseEnter={onDismiss}`) TypeScript 컴파일이 통과하며, 오직 동작 테스트만 이 실수를 잡을 수 있는데 그 테스트가 없음 | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:441-444` | `fireEvent.mouseEnter`/`fireEvent.mouseLeave` 를 툴팁 루트(`role="tooltip"`)에 발생시켜 `onKeepAlive`/`onDismiss` mock 이 정확히 호출되는지 검증하는 케이스 추가 |
| 6 | 테스팅 | 신규 store selector `findLatestResultByNodeId` 전용 단위 테스트 부재 — 형제 selector `findNodeResult` 는 `execution-store.test.ts` 에 전용 케이스가 있으나 신규 함수는 언급조차 없음. stale-index 방어 분기(`row?.nodeId === nodeId` 가 실제로 `undefined` 를 반환하는 경로)와 "Loop/ForEach 로 여러 번 실행된 노드는 마지막 결과를 반환한다"는 핵심 클레임 둘 다 미검증 | `codebase/frontend/src/lib/stores/execution-store.ts:712`, `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`(미언급) | `execution-store.test.ts` 에 전용 케이스 추가 — 정상 조회, 인덱스 stale(다른 nodeId 가 그 인덱스에 있는 경우)→`undefined`, 동일 nodeId 다중 행 중 최신(마지막) 채택 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 엣지 hover 미리보기가 노드 실행 결과(잠재적 민감 데이터: 토큰/PII 등)를 저마찰(hover, 200ms 유지)로 노출 — 권한 상승·신규 데이터 접근 경로는 아니며(동일 인증 세션·이미 store 에 존재하는 데이터) 화면 공유·shoulder-surfing 시나리오에서 우발적 노출 가능성만 다소 높임 | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` | 별도 강제 조치 불필요. 향후 노드 출력 시크릿 마스킹/redaction 정책 도입 시 이 hover 경로도 적용 대상에 포함 |
| 2 | 성능 | `abbreviate()` 객체 분기가 `Object.entries(value)` 로 전체 키를 eager 하게 열거한 뒤에야 `slice(0, 20)` — 배열 분기(`value.slice(0, 5)`)와 비대칭 | `codebase/frontend/src/lib/utils/edge-data-preview.ts` `abbreviate` | 우선순위 낮음 — 필요 시 20개에서 조기 종료하는 순회로 교체 |
| 3 | 아키텍처 | `canvas/` → `run-results/` 크로스 임포트, `edges` 배열 prop-drilling(hover 시점에 이미 `RFEdge` 를 쥐고 있음에도 `edgeId` 문자열만 넘겨 하위에서 재탐색), `workflow-canvas.tsx` 오케스트레이션 누적 — 모두 직전 라운드부터 이월된 항목, 이번 라운드에서 악화 없음 | `edge-data-preview.tsx:6`, `workflow-canvas.tsx` | §4 오케스트레이션 정리 후속 작업으로 이미 plan 에 이월됨. 추가 조치 불요 |
| 4 | 유지보수성 | `formatBytes` 의 단위 임계값(`1024`, `1024*1024`)이 매직 넘버 — 같은 파일 `MAX_STRING`/`MAX_TOP_ARRAY`/`MAX_TOP_KEYS` 는 이름 있는 상수인데 이 함수만 스타일이 다름 | `codebase/frontend/src/lib/utils/edge-data-preview.ts` `formatBytes` | `BYTES_PER_KB` 상수 추출(선택적, 낮은 우선순위 — 이미 defer 결정된 항목) |
| 5 | 테스팅 | `summarizeDataForPreview`/`formatBytes` 경계값(배열 정확히 5/21개, 객체 정확히 20/21개 필드, `formatBytes(1024)`/`formatBytes(1024*1024)` 등호 분기) 테스트 부재 — 로직 검토상 정확해 보이나 회귀 가드 없음 | `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts` | 경계값(정확히 임계치·임계치+1) 케이스 추가 |
| 6 | 테스팅 | `workflow-canvas.tsx` 의 hover→미리보기 배선 자체는 RTL 통합 테스트 사각지대(기존 갭 연장, 신규 회귀 아님) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 우선순위 낮음 — canvas 통합 테스트 하네스 마련 시 함께 포함(§4 오케스트레이션 정리 후속) |
| 7 | 부작용 | 신규 테스트 2개 파일이 실제 싱글턴 Zustand store(`useExecutionStore`)를 mock 없이 `setState` 로 직접 시딩 — 파일 내부 `beforeEach` 격리는 있으나 스위트 종료 후 복원 로직 없음(기존 관례와 일치, 이번 PR 만의 신규 리스크 아님) | `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` | 필요 시 `afterEach` 에 store 초기화 추가(낮은 우선순위) |
| 8 | 보안 | 툴팁 위치가 뷰포트 경계로 clamp 되지 않아 화면 우측/하단 근처 hover 시 잘릴 수 있음(보안과 무관, 순수 UX) | `workflow-canvas.tsx` `onEdgeMouseEnter`, `edge-data-preview.tsx` | 참고용, 조치 불요 |

## 확인된 정상 동작(결함 아님, 참고)

- 직전 라운드(`review/code/2026/07/13/15_52_56`) CRITICAL 1건(i18n 하드코딩 ratchet 위반)이 `useT()` + `dict/{ko,en}/editor.ts` 4개 키로 완전히 해소됨을 requirement/security/maintainability 3개 리뷰어가 각각 실측(`hardcoded-korean-ratchet.test.ts` 재실행, grep)으로 재확인.
- 직전 라운드 WARNING 5건 중 4건(`JsonContent` 미재사용, 무가드 직렬화의 "매 렌더 재계산" 측면, 테스트 전무, null 체크 누락)은 실제로 해소 확인(단, 회귀 테스트 자체는 WARNING #4로 별도 지적).
- XSS/인젝션 벡터 없음(React 텍스트 자식으로만 렌더, `dangerouslySetInnerHTML` 신규 사용 없음).
- 동시성 관점 결함 없음 — 타이머 상태기계는 "단일 활성 타이머" 불변식을 정확히 유지, `addNodeResult` 는 단일 `set()` 호출로 원자적이라 정상 앱 경로에서 stale-index 윈도우 없음.
- 스코프 이탈 없음 — 27개 신규/수정 파일 전부가 "§4/§5 엣지 데이터 미리보기 구현 + 직전 리뷰 CRITICAL/WARNING 해소"라는 단일 의도에 정확히 대응, 무관 파일 수정·과잉 리팩터 없음.
- spec §4/§5 본문과 코드가 line-level 로 일치(ASCII 목업·표·구현 상태 서술), SPEC-DRIFT 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | hover 노출 마찰 저하(INFO), XSS/인젝션 벡터 없음 |
| performance | LOW | bytes 계산 무상한 직렬화(WARNING), abbreviate eager 열거(INFO) |
| architecture | LOW | selector DRY 불완전 — 기존 소비처 미이관(WARNING) |
| requirement | LOW | 이전 CRITICAL/WARNING 전부 해소 실측 확인, spec §4/§5 line-level 일치 |
| scope | NONE | 요청 범위 정확히 준수, 스코프 이탈 없음 |
| side_effect | LOW | 신규 부작용 없음, 테스트 store 시딩 관례 일치(INFO) |
| maintainability | LOW | selector DRY 불완전(WARNING, architecture 와 중복 지적), 매직넘버(INFO) |
| testing | MEDIUM | EdgeDataModal 테스트 부재·hover 배선 미검증·selector 단위테스트 부재(WARNING×3) |
| concurrency | NONE | 타이머 상태기계·stale-index 방어 모두 정상, 레이스 없음 |
| documentation | 재시도 필요 | output 파일 디스크 미기록(disk-write gap) — 내용 확인 불가 |
| user_guide_sync | 재시도 필요 | output 파일 디스크 미기록(disk-write gap) — 내용 확인 불가 |

## 발견 없는 에이전트

- security, scope, concurrency — WARNING/CRITICAL 없음(전부 INFO 참고 또는 확인된 정상 동작).

## 권장 조치사항

1. **[최우선]** `documentation`, `user_guide_sync` reviewer 를 재실행해 실제 산출물을 확보할 것 — 두 reviewer 가 `success` 로 보고됐으나 output 파일이 디스크에 없어(disk-write gap) 이번 diff 가 포함한 CHANGELOG/spec/mdx 동기화 검증 결과가 통째로 부재하다. 재실행 없이는 이번 SUMMARY 의 documentation/user_guide_sync 관점 위험도를 "NONE" 으로 단정할 수 없다.
2. testing WARNING 3건 조치 — `EdgeDataModal` 회귀 테스트, hover mouse-enter/leave 배선 테스트, `findLatestResultByNodeId` 단위 테스트를 추가해 이미 "고쳤다"고 주장한 수정들을 실제로 고정할 것.
3. performance WARNING — 바이트 계산에 길이 상한 + `show()` 디바운스(80~120ms)를 추가해 여러 엣지를 빠르게 훑는 시나리오의 메인스레드 블로킹 누적을 방지할 것.
4. architecture/maintainability WARNING(DRY 불완전) — `node-settings-panel.tsx` `InfoTab`·`use-expression-context.ts` 를 `findLatestResultByNodeId` 로 이관하는 후속 작업을 별도 plan 항목으로 명시 등록하거나, 최소한 `RESOLUTION.md` 의 "반영" 표기를 "부분 반영"으로 정정할 것.
5. INFO 항목(경계값 테스트, `abbreviate()` eager 열거, `formatBytes` 매직넘버, prop-drilling 등)은 우선순위 낮음 — 후속 정리 작업 시 일괄 처리 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(매니페스트에 상세 사유 미기재) — 이번 diff 가 신규 의존성을 도입하지 않아 제외된 것으로 추정 |
  | database | 라우터 판단(매니페스트에 상세 사유 미기재) — 이번 diff 가 순수 프런트엔드 변경으로 DB 접근이 없어 제외된 것으로 추정 |
  | api_contract | 라우터 판단(매니페스트에 상세 사유 미기재) — 이번 diff 가 API/wire 프로토콜을 건드리지 않아 제외된 것으로 추정 |