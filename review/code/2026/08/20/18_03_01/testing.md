STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard

## 검증 방법

diff 는 prompt 크기 제한으로 다수 파일이 생략돼 있어, `git diff origin/main...HEAD -- codebase/`
로 실제 변경분 전체(23개 코드 파일, +1044/-177)를 직접 재구성해 검토했다. 핵심 신규/변경
테스트 파일 4개(`rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`,
`masked-markers.test.ts`, `dynamic-form-ui.test.tsx`)를 `vitest run` 으로, 백엔드 2개
(`executions.service.spec.ts`, `background-runs.service.spec.ts`)를 `jest` 로 직접
재실행해 전부 green(frontend 92 passed / backend 71 passed)임을 확인했다.

이 PR 은 같은 워크트리 안에서 **9라운드**의 `/ai-review` + fix 사이클을 이미 거쳤고(각
라운드 RESOLUTION.md 가 남아 있음), 그중 다수가 testing 관점 지적(값-단독 판정의 우회,
터치 후 재마스킹, object leaf 마커, 스키마 지연 도착, 스키마 드리프트 교착, 무효 JSON
폴백, 배열 분기 보폭, 재오픈 리셋 등)이었다. `plan/in-progress/eia-inputdata-marker-guard.md`
에 12종 뮤테이션 결과표가 남아 있고, 이번 세션에서도 마지막 커밋(`d446ab7ad`, 라운드9)의
캐너리(`[회귀] 스키마에서 사라진 마스킹 키도 렌더돼 재입력으로 풀린다`)가 실제로
`orphanMasked` 로직과 정확히 대응함을 코드 대조로 확인했다.

## 발견사항

- **[INFO]** 프런트 마커 상수의 "backend SoT 일치" 는 여전히 리터럴-대-리터럴 비교라 진짜 크로스체크가 아니다 (기존에 인지·트래커 등재된 갭)
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` (`"마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)"` 테스트, `masked-markers.test.ts` 파일 상단 JSDoc)
  - 상세: `MASKED_MARKERS`/`MAX_MARKER_SCAN_DEPTH` 는 backend `sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MAX_REDACT_DEPTH` 를 손으로 복제한 값이다. frontend(vitest)와 backend(jest)가 런타임을 공유하지 않아, 이 테스트는 "이 파일 안의 리터럴이 그대로인가" 만 지키고 "backend 가 바뀌었는데 프런트가 안 따라갔는가" 는 지키지 못한다 — 값이 갈리면 두 스위트 모두 green 인 채로 마스킹 감지 가드가 조용히 뚫린다. 테스트 파일 자체의 JSDoc 이 이 한계를 정확히 인지하고 문서화하고 있고("못 지킨다: backend 가 바뀌는 것"), plan 에도 "마커 미러 계약 테스트" 트래커 항목으로 등재돼 있다.
  - 제안: 이미 트래커에 있으므로 이번 PR 을 막을 사안은 아니다. 공유 패키지로 상수를 추출하거나(제안된 방향), 최소한 backend 상수 파일이 바뀌면 실패하는 골든 파일/스냅샷 형태의 계약 테스트를 별도 작업으로 추가하는 편이 좋다.

- **[INFO]** 서버측이 `inputOverride` 에 마스킹 마커가 그대로 담겨 제출되는 경로를 거부하지 않는 것에 대한 테스트가 없다 (기존에 판정·트래커 등재된 갭)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`reRun` 의 `resolveTriggerParameters(schema, dto.inputOverride ?? {})` 자리, 약 486~504행) — 프런트 가드가 UI 정상 흐름에서만 막고, curl 등으로 API 를 직접 호출하면 마커 문자열이 그대로 새 실행 입력이 될 수 있다.
  - 상세: 이 PR 의 가드는 전부 클라이언트 측(React 컴포넌트)이다. 서버가 `inputOverride` 값 중 `isMaskedMarker`/`hasMaskedMarkerLeaf` 에 해당하는 값을 거부하는 로직·테스트는 이번 diff 에 없다. 다만 이는 새로 발견한 갭이 아니라 — RESOLUTION 이력(`14_44_08` 트래커 6번)에서 이미 지적됐고, security reviewer 가 "§R17 이 가드 범위를 UI 정상 흐름으로 명시했다" 는 이유로 INFO 로 판정해 트래커에 별건으로 등재해 둔 상태다.
  - 제안: 조치 불요(이미 처분 완료). 다만 그 트래커 항목이 실제로 집행될 때는, 서버가 거부하는 계약을 고정하는 `executions.service.spec.ts` 케이스(`reRun` 에 마커가 섞인 `inputOverride` 를 주고 400 을 기대)가 함께 추가돼야 한다는 점을 테스트 관점에서 재확인해 둔다.

## 그 외 확인한 항목 (문제 없음)

- **테스트 격리**: `rerun-modal.test.tsx` 의 신규 `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)` 블록은 `beforeEach` 에서 `vi.clearAllMocks()`·`cleanup()`·store reset·mock reset 을 명시적으로 수행하고, `renderModal` 헬퍼가 테스트마다 새 `QueryClient` 인스턴스를 생성해 React Query 캐시가 테스트 간 누수되지 않는다.
- **엣지 케이스**: 마스킹 마커 판별의 깊이 상한(10/11)을 object·array 두 분기 모두에서, 그리고 backend `MAX_REDACT_DEPTH` 치환 지점과 정확히 일치시켜 경계 테스트를 뒀다(`masked-markers.test.ts`). "값 검사가 깊이 검사보다 먼저" 라는 순서 의존성도 별도 언급·주석으로 고정돼 있다(코드 실행으로 순서를 뒤집으면 어느 테스트가 RED 가 되는지까지 문서화됨).
- **회귀 테스트 유효성**: `executions.service.spec.ts` 의 `inputData` 관련 캐너리들은 `Execution` 레벨 카브아웃 폐지로 방향이 반전됐고(과거엔 "원문 통과", 지금은 "마스킹"), diff 가 그 반전을 8개 지점(①②⑤⑥⑥-b⑧⑧-b + background-runs)에서 일관되게 뒤집었다. `git diff`·재실행 모두로 확인했으며 stale 캐너리(옛 방향을 그대로 둔 것)는 남아 있지 않다.
- **Mock 적절성**: `editor-toolbar-run-input.test.tsx` 의 신규 테스트 중 하나는 textarea 직접 조작이 아니라 `getByWorkflow`/`getById` API mock → `Load from History` 클릭이라는 **실제 유입 경로**로 재현하도록 별도로 작성돼 있어(`14_08_45` W5 대응), textarea 직접 조작 테스트만으로는 못 잡는 직렬화 단계 회귀를 커버한다.
- **테스트 용이성**: `hasMaskedMarkerLeaf`/`isMaskedMarker`/`isStructuredType` 이 순수 함수로 `lib/utils/masked-markers.ts` 에 승격돼 컴포넌트 렌더 없이 직접 단위 테스트 가능해졌다 — 이전엔 `dynamic-form-ui.tsx` 컴포넌트를 통한 간접 검증만 있어 non-string 입력 경로가 한 번도 행사되지 않았던 갭(`14_08_45` INFO-6)이 이번에 직접 해소됐다.

## 요약

이 PR 은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 세 소비처(폼 프리필·Re-run
모달·에디터 히스토리 로드)에 마커 가드를 추가하는 변경으로, 9라운드에 걸친 리뷰-수정
사이클을 통해 테스트 관점의 결함 클래스(값-단독 판정 우회, 터치 후 재마스킹, object/array
leaf 마커 누락, 스키마 지연 도착/드리프트, 무효 JSON 폴백, 배열 재귀 보폭, 재오픈 리셋 누락,
음성-단독 단언의 vacuous 함정)가 순차적으로 발견되고 캐너리 테스트로 고정돼 왔다. 이번
세션에서 실제 코드(`git diff origin/main...HEAD`)와 관련 테스트 스위트를 직접 재실행해
전량 green 임을 확인했고, 새로 도입된 로직(스키마 드리프트 시 orphan masked 필드 렌더 유지)
도 그에 대응하는 회귀 테스트와 정확히 짝지어져 있음을 코드 대조로 검증했다. 남은 갭 2건
(backend 미러 계약 테스트 부재, `inputOverride` 서버측 마커 거부 테스트 부재)은 모두 이미
팀이 인지하고 트래커에 별건으로 등재한 항목이라 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
