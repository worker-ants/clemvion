STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD`(30개 실 코드/문서 파일, `review/**` 세션 산출물 제외)를 직접 열어
확인했다. 핵심은 `Execution.inputData` egress 마스킹 카브아웃 폐지 — backend 두 관문
(`ExecutionsService.toResponseExecution`/`toExecutionDto`, `BackgroundRunsService`)에 마스킹을
걸고, frontend 세 소비처(폼 프리필 `dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터
히스토리 로드 `editor-toolbar.tsx`)에 마스킹 마커 감지 가드를 추가했다. 이 changeset 은 이미
9라운드에 걸친 code/consistency 리뷰(2026-08-20 하루 동안 `10_26` ~ `17_38` 세션)를 거쳤고
CRITICAL 은 모두 해소된 상태다 — 아래는 그 결과물에 대한 독립적 최종 확인이다.

## 발견사항

- **[WARNING]** `inputOverride` 를 통한 마스킹 마커 리터럴 제출을 막는 서버측 검증이 없다 — 이번
  PR 이 구축하는 마커 가드 전체가 **프런트엔드 UI 계층에서만** 강제된다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`
    (`isCoerceFailure`/`resolveTriggerParameters` 전체 — 타입·필수값만 검증하고 값이 마스킹
    마커(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 정확히 일치하는지는 검사하지 않는다),
    호출부 `codebase/backend/src/modules/executions/executions.service.ts` 의 `useOriginal ===
    false` 분기(`resolveTriggerParameters(schema, dto.inputOverride ?? {})`)
  - 상세: 이 PR 이 막으려는 "리터럴 `'***'` 가 새 실행의 실제 입력이 되는" 데이터 오염은
    `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`
    (세 조건의 합 — touched · no-marker-leaf · structured-field-parse-success) 과
    `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 의
    `hasMaskedMarkerLeaf(parsed)` 체크로만 막힌다. 둘 다 클라이언트 렌더 경로다. `curl` 등으로
    `POST .../re-run` 을 직접 호출해 `inputOverride: { apiKey: "***" }` 를 실으면 UI 가드를
    전혀 거치지 않고 `resolveTriggerParameters` 를 통과해(타입이 `string` 이면 그대로 coerce
    성공) 새 실행의 실제 입력값이 리터럴 `'***'` 가 된다 — 이 PR 이 정의하는 "조용한 데이터
    오염" 그 자체가 API 레벨에서는 여전히 재현 가능하다.
  - 참고: 이 갭은 이번 PR 이 새로 만든 결함이 아니라 원래부터 있던 것이고, `security` 리뷰어가
    라운드마다("기밀성 침해 아님 + 피해는 호출자 자기 자신의 새 실행") 독립적으로 INFO 판정해
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`inputOverride` 서버측 마커
    리터럴 거부, 2026-08-20 등재)에 이미 추적 중이다. 다만 그 트래커 항목 자신이 "유예 근거
    하나가 과장이었다"(§R17 에 실제로는 "API 직접 호출은 가드 범위 밖" 이라는 명문이 없었다)를
    인정하고 있어, 반복 하향 판정의 근거가 처음 생각만큼 튼튼하지 않았다는 점은 이 라운드에서도
    유효하다. 영향 범위가 자기 자신의 새 실행에 한정돼(교차 테넌트 기밀성 침해가 아님) CRITICAL
    로 올리지는 않지만, 이 PR 의 헤드라인 주장("카브아웃을 닫았다")이 UI 정상 흐름에 한정된
    닫힘이라는 점은 재확인해 둔다.
  - 제안: 트래커 항목대로 서버측에서 `inputOverride` 값이 `MASKED_MARKERS` 와 정확히 일치하면
    `400 INVALID_INPUT` 계열로 거부하는 얕은 defense-in-depth 체크를 다음 PR 에서 추가하고,
    동시에(spec 쓰기 권한이 `developer` 밖이므로) planner 턴으로 §R17 에 "이 가드는 UI 정상
    흐름 한정" 또는 "API 직접 호출도 거부" 중 하나를 명문화한다.

- **[INFO]** 마스킹 마커 집합(`MASKED_MARKERS`)이 backend SoT 와 frontend 미러 사이에 손으로
  복제돼 있고, 어긋남을 기계적으로 잡는 계약 테스트가 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` (SoT) ↔
    `codebase/frontend/src/lib/utils/masked-markers.ts:18` (미러, 이번 PR 에서
    `dynamic-form-ui.tsx` 밖으로 승격)
  - 상세: 두 파일의 JSDoc 이 "어긋나면 가드가 조용히 뚫린다"고 명시적으로 경고하고 있고, 실제로
    이 승격 자체가 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드) 전부의 단일
    실패점이다 — backend 에 새 마커 종류가 추가되고 frontend 미러 갱신이 누락되면 세 가드가
    동시에 fail-open 한다. 두 상수 파일 모두 사람이 grep 으로 찾는 것에 의존한다(이름을
    `MASKED_MARKERS`/`isMaskedMarker` 로 맞춘 것도 그 대비책).
  - 참고: 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`("마커 미러 계약
    테스트", 2026-08-17 최초 등재, 이 시리즈에서 반복 지적됨)에 추적 중이다. 소비처가 하나(폼)
    에서 셋으로 늘어난 이번 PR 로 단일 실패점의 폭발 반경이 커졌으므로 재확인해 둔다.
  - 제안: backend `MASKED_MARKERS`/`MAX_REDACT_DEPTH` 를 export 하고 frontend 가 빌드 타임
    또는 테스트 타임에 값을 가져와 대조하는 계약 테스트(예: 두 상수를 나열한 JSON 픽스처를
    양쪽이 import 하거나, CI 스크립트로 두 파일의 리터럴을 파싱해 diff)를 추가한다.

## 긍정적으로 확인한 점 (회귀 없음)

- **깊이 상한 일치**: `codebase/frontend/src/lib/utils/masked-markers.ts` 의
  `MAX_MARKER_SCAN_DEPTH = 10` 이 backend `MAX_REDACT_DEPTH`(`sanitize-error-message.ts:112`)와
  정확히 일치하고, 값 검사가 깊이 검사보다 먼저 실행돼 상한 지점에 치환된 마커를 놓치지 않는다.
- **정확 일치만 감지**(exact-match, no substring/regex) — `a***b` 같은 정상 값을 오탐으로 막지
  않고, 정규식 기반이 아니라 ReDoS 위험도 없다.
- **표면 전수 일관성**: `ExecutionsService.findById`/`findByWorkflow`/`getChain`/`stop` 4경로 +
  `BackgroundRunsService` 노드 레벨까지 `Execution.inputData` 마스킹이 일관되게 적용됐고, 테스트가
  각각 양성(`toContain('***')`)·음성(`not.toContain(...)`) 단언 쌍으로 필드 소실/`null` 회귀도
  잡는다.
- **webhook ingestion `[REDACTED]` 마커 비파괴 보존**이 `Execution.inputData` 표면
  (`executions.service.spec.ts` ⑥)과 `BackgroundRunsService` 노드 레벨 표면 양쪽에서 확인됨 —
  12-webhook §5.3 계약이 이번 정책 전환으로 깨지지 않았다.
- **인가 로직 무변경**: Re-run 의 `RR-PL-06`(타인 실행은 워크스페이스 owner/admin 만) 검사가
  이번 diff 로 건드려지지 않았다.
- **하드코딩 시크릿 없음**: 테스트 픽스처의 `sk-live-abc123`/`admin:pw` 는 마스킹 검증용 가짜
  리터럴이고 실제 자격증명이 아니다.
- **에러 메시지 노출 없음**: `editor-toolbar.tsx` 의 `JSON.parse` 실패 시 `e.message` 노출은
  사용자 자신이 입력한 텍스트의 파싱 실패 사유(V8 표준 메시지)일 뿐 서버·인프라 정보를 담지
  않는다.

## 요약

이 PR 은 `Execution.inputData` re-run 재제출 카브아웃을 닫아 실제 데이터 무결성 결함(마스킹된
`'***'` 가 새 실행의 실제 입력이 되는 조용한 오염)을 해소했고, 9라운드의 선행 리뷰를 거치며
CRITICAL 이 전부 소거된 성숙한 상태다 — 마스킹 표면 4곳 + 노드 레벨, 깊이 상한, ingestion 마커
보존까지 코드·테스트가 일관되게 맞물린다. 새로 발견한 결함은 없고, 이미 트래커에 등재된 두 항목
(서버측 마커 리터럴 미검증, 마커 미러 무계약)을 독립 확인 결과로 재확인했다 — 특히 전자는 이 PR
이 표방하는 "카브아웃 폐지"가 UI 정상 흐름에 한정된 닫힘이며 직접 API 호출 경로는 여전히 우회
가능하다는 점에서, 다음 라운드의 defense-in-depth 작업으로 명확히 남겨 둔다.

## 위험도

LOW
