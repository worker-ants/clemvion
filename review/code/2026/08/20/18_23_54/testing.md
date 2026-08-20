STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard

## 검증 방법

프롬프트가 크기 제한으로 다수 파일 diff 를 생략해, `git diff origin/main...HEAD -- codebase/`
(23개 코드 파일, +1126/-177)를 직접 재구성해 전수 검토했다. 핵심 테스트 파일 4개를
`pnpm vitest run`으로 재실행(**93 passed**: `rerun-modal.test.tsx`·
`editor-toolbar-run-input.test.tsx`·`masked-markers.test.ts`·`dynamic-form-ui.test.tsx`),
backend 2개(`executions.service.spec.ts`·`background-runs.service.spec.ts`)를 `jest` 로
재실행(**71 passed**)해 전량 green 을 실측 확인했다.

추가로 `masked-markers.ts` 의 핵심 불변식("값 검사가 깊이 검사보다 먼저") 하나를 직접
뮤테이션해 재검증했다 — `scanForMarker` 의 두 조건 순서를 뒤집으니 `masked-markers.test.ts`
의 "[경계] 상한 깊이(10)…" 캐너리 2건이 정확히 **RED** 로 잡혔다(다른 16개는 영향 없음).
이 PR 의 RESOLUTION.md 들이 반복 주장하는 "뮤테이션으로 재검증했다"는 서술 중 하나를
독립적으로 재현해 신뢰도를 확인했다. 뮤테이션은 원복 후 `git status`/`git diff` 로 워킹
트리가 깨끗함을 재확인했다.

이 PR 은 같은 워크트리 안에서 이미 **10라운드**의 리뷰-수정 사이클을 거쳤고, 그중 다수가
testing 관점 지적(값-단독 판정 우회, 터치 후 재마스킹, object/array leaf 마커 누락, 스키마
지연 도착/드리프트, 무효 JSON 폴백, 배열 재귀 보폭, 재오픈 리셋 누락, 음성-단독 단언의
vacuous 함정, 노드 레벨 마커 보존 캐너리 누락)이었다. 아래는 그 축적된 상태에 대한 독립
재검토다.

## 발견사항

- **[INFO]** 프런트 마커 상수의 "backend SoT 일치"는 여전히 리터럴-대-리터럴 비교라 진짜 크로스체크가 아니다 (기존 인지·트래커 등재 항목, 재확인)
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` (`"마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)"` 테스트)
  - 상세: `MASKED_MARKERS`/`MAX_MARKER_SCAN_DEPTH`는 backend `sanitize-error-message.ts`의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MAX_REDACT_DEPTH`를 손으로 복제한 값이다. frontend(vitest)와 backend(jest)가 런타임을 공유하지 않아, 이 테스트는 "이 파일 안의 리터럴이 그대로인가"만 지키고 "backend 가 바뀌었는데 프런트가 안 따라갔는가"는 지키지 못한다 — 두 값이 갈리면 양쪽 스위트 모두 green 인 채로 egress 마스킹 감지 가드(폼 프리필·Re-run 모달·에디터 히스토리 로드 세 곳 전부)가 조용히 뚫린다. 테스트 파일 JSDoc 이 이 한계를 정확히 인지·문서화하고 있고("못 지킨다: backend 가 바뀌는 것"), `plan/in-progress/eia-inputdata-marker-guard.md`에도 "마커 미러 계약 테스트" 트래커 항목으로 이미 등재돼 있다.
  - 제안: 이미 트래커에 있으므로 이번 PR 을 막을 사안은 아니다. 공유 패키지로 상수를 추출하거나, backend 상수 파일이 바뀌면 실패하는 골든 파일/스냅샷 계약 테스트를 별도 작업으로 추가하는 편이 좋다.

## 그 외 확인한 항목 (문제 없음)

- **회귀 테스트 유효성 (backend)**: `executions.service.spec.ts`의 `inputData` 캐너리 8곳(①②③⑤⑥⑥-b⑧⑧-b)이 `Execution` 레벨 카브아웃 폐지에 맞춰 방향을 일관되게 뒤집었다 — 과거 "원문 통과" 단언이 전부 "마스킹" 단언으로 반전됐고, 옛 방향을 그대로 둔 stale 캐너리는 없다. `background-runs.service.spec.ts`도 같은 반전을 노드 레벨 표면에 반영했고, "필드별로 나눠서 잰다"는 코멘트대로 `outputData`/`inputData`를 각각 독립 문자열로 분리해 단언해, 한쪽 필드가 통째로 비거나 `null`이 돼도 다른 쪽 마스킹 성공만으로 통과하던 vacuous 함정을 닫았다.
- **엣지 케이스**: `masked-markers.test.ts`가 깊이 상한(10/11)을 object·array 두 분기 모두에서, backend `MAX_REDACT_DEPTH` 치환 지점과 정확히 일치시켜 경계 테스트를 두었다. "값 검사가 깊이 검사보다 먼저"라는 순서 의존성을 직접 뮤테이션해 재확인했다(위 검증 방법 참조). non-string 입력(`number`/`null`/`undefined`/`boolean`/`{}`/`[]`) 전수, 스택 오버플로 회귀(depth 5,000, `JSON.parse`가 통과시키지만 옛 재귀 구현은 터지는 실측값)도 커버한다.
- **Mock 적절성**: `editor-toolbar-run-input.test.tsx`의 신규 테스트 하나는 textarea 직접 조작이 아니라 `getByWorkflow`/`getById` API mock → `Load from History` 클릭이라는 **실제 유입 경로**로 재현해, `JSON.stringify` 직렬화 단계를 우회하는 회귀를 잡는다. `rerun-modal.test.tsx`는 매 테스트 `renderModal`이 새 `QueryClient` 인스턴스를 만들어 React Query 캐시 누수를 차단한다.
- **테스트 격리**: 신규 `describe("ReRunModal — 마스킹 마커 왕복 차단", …)` 블록은 `beforeEach`에서 `vi.clearAllMocks()`·`cleanup()`·`useWorkspaceStore().reset()`·mock reset을 명시적으로 수행한다. 순서 무관하게 개별 실행 가능함을 `vitest run`으로 확인했다(93/93 green, 실행 순서 무관).
- **테스트 가독성**: 각 캐너리 테스트가 "이 조건이 없던 시절 실제로 뚫린 경로"를 JSDoc 표로 명시하고, 라운드별 지적 태그(예: `14_44_08` W2, `17_38_33` W3)를 남겨 왜 이 테스트가 존재하는지 추적 가능하다. 스키마 드리프트 교착 테스트는 "관측 시점이 가설의 일부였다"는 실패한 첫 프로브의 교훈까지 주석에 남겨, 다음 사람이 같은 실수를 반복하지 않게 한다.
- **테스트 용이성**: `hasMaskedMarkerLeaf`/`isMaskedMarker`가 `lib/utils/masked-markers.ts`로 승격되며 컴포넌트 렌더 없이 직접 단위 테스트 가능해졌다 — 이전엔 `dynamic-form-ui.tsx` 컴포넌트를 통한 간접 검증만 있어 non-string 입력 경로가 한 번도 행사되지 않았던 갭이 해소됐다. `rerun-modal.tsx`의 `isStructuredType`/`inferTypeFromValue`도 순수 함수로 분리돼 있다.
- **커버리지**: backend 읽기 표면 5곳(`toResponseExecution`→`findById`/`getChain`/`stop`, `toExecutionDto`→`findByWorkflow`) 전부가 소스 diff와 테스트 캐너리 사이에 1:1 대응함을 함수 정의부(`executions.service.ts:579,615,746,881,977,1068`)를 직접 열어 대조했다 — 테스트만 읽고 넘겨짚지 않았다.

## 요약

이 PR은 `Execution.inputData` egress 마스킹 카브아웃을 닫으며 세 소비처(폼 프리필·Re-run
모달·에디터 히스토리 로드)에 마커 가드를 추가하는 변경으로, 10라운드에 걸친 리뷰-수정
사이클을 통해 테스트 관점의 결함 클래스가 순차적으로 발견·캐너리로 고정돼 왔다. 이번
세션에서 실제 코드와 관련 테스트 스위트를 전량 재실행(frontend 93 / backend 71, 모두
green)했고, `masked-markers.ts`의 핵심 순서 불변식 하나를 직접 뮤테이션해 대응 캐너리가
실제로 RED 를 내는 것까지 재현 검증했다. backend 5개 읽기 표면과 테스트 캐너리의 1:1
대응도 소스 코드 직접 열람으로 확인했다. 남은 갭 1건(프런트 마커 상수의 backend 미러
계약 테스트 부재)은 이미 테스트 파일 자체의 JSDoc과 plan 트래커에 명시적으로 인지·등재돼
있어 이번 PR을 막을 사유가 아니다.

## 위험도

NONE
