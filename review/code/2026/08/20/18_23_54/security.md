STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff 82a967afb...HEAD`(merge-base 기준, `codebase/` 23개 실 코드/문서 파일 + spec 4개 +
plan/review 산출물)를 직접 열어 확인했다. 이 changeset 은 `Execution.inputData` egress 마스킹
카브아웃 폐지 — backend 두 관문(`ExecutionsService.toResponseExecution`/`toExecutionDto`/
`getChain`/`stop`, `BackgroundRunsService`)에 마스킹을 걸고, frontend 세 소비처(폼 프리필
`dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터 히스토리 로드
`editor-toolbar.tsx`)에 마커 감지 가드를 추가했다. 이미 10라운드(`10_26`~`18_03`)의 code/
consistency 리뷰를 거친 성숙한 상태이고, 이번 리뷰는 그 최종 결과물(라운드10 fix 포함, 커밋
`2c628f6ac` 까지)에 대한 독립 확인이다.

## 발견사항

- **[WARNING]** `inputOverride` 를 통한 마스킹 마커 리터럴 제출을 막는 서버측 검증이 없다 — 마커
  가드가 프런트엔드 UI 계층에서만 강제된다 (기존에 추적 중이던 갭, 이번 라운드에도 재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`
    (`resolveTriggerParameters`/`isCoerceFailure` — 타입·필수값만 검증, 값이
    `MASKED_MARKERS`(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 정확히 일치하는지는
    검사하지 않는다), 호출부
    `codebase/backend/src/modules/executions/executions.service.ts` 의 `useOriginal === false`
    분기 (`executionInput = { __triggerSource: 'manual', parameters: resolveTriggerParameters(schema, dto.inputOverride ?? {}) }`)
  - 상세: `POST .../re-run` 을 `curl` 등으로 직접 호출해 `inputOverride: { apiKey: "***" }` 를
    실으면 프런트 가드(`rerun-modal.tsx` 의 `blockedByMaskedInput`, `editor-toolbar.tsx` 의
    `hasMaskedMarkerLeaf(parsed)`)를 거치지 않고 `resolveTriggerParameters` 를 통과해(타입이
    `string` 이면 그대로 coerce 성공) 리터럴 `'***'` 가 새 실행의 실제 입력값이 된다. 이 PR 이
    "닫았다" 고 표방하는 오염 경로가 API 레벨에서는 여전히 재현 가능하다 — CHANGELOG 자신도
    이번 라운드에 "UI 정상 흐름 한정" 이라고 범위를 명시적으로 좁혔다(`CHANGELOG.md` Unreleased
    상단 신규 caveat).
  - 참고: 이번 PR 이 새로 만든 결함은 아니고 기존 갭이 데이터 무결성 축에서 계속 열려 있는
    것이다. 영향은 교차 테넌트 기밀성 침해가 아니라 **호출자 자신의 새 실행 입력이 리터럴
    `'***'`/`'[REDACTED]'` 로 오염**되는 것에 한정된다(WS §RR-PL-06 인가 검사는 이 diff 로
    변경되지 않았고, 여전히 유효). `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    (`inputOverride` 서버측 마커 리터럴 거부, 2026-08-20 등재)에 이미 추적 중이며 CHANGELOG 도
    "서버측 거부는 트래커 항목으로 남겼다" 고 명시한다.
  - 제안: 트래커 항목대로 서버측에서 `inputOverride`(및 파생 필드) 값이 `MASKED_MARKERS` 와
    정확히 일치하면 `400 INVALID_INPUT` 계열로 거부하는 defense-in-depth 체크를 추가한다.
    타입·필수값 검증(`resolveTriggerParameters`)과 같은 자리에 붙이면 UI 우회 경로 없이 API
    직접 호출도 함께 막힌다.

- **[INFO]** 마스킹 마커 집합(`MASKED_MARKERS`)이 backend SoT 와 frontend 미러 사이에 손으로
  복제돼 있고, 어긋남을 기계적으로 검증하는 계약 테스트가 없다 (기존에 추적 중이던 갭)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150` (SoT) ↔
    `codebase/frontend/src/lib/utils/masked-markers.ts:16` (미러). 깊이 상한도 마찬가지 —
    `sanitize-error-message.ts:112` `MAX_REDACT_DEPTH = 10` ↔
    `masked-markers.ts` 의 `MAX_MARKER_SCAN_DEPTH = 10`(현재는 값이 일치함을 직접 대조해
    확인했다).
  - 상세: 이번 PR 에서 이 미러가 `dynamic-form-ui.tsx` 내부 상수(소비처 1곳)에서
    `lib/utils/masked-markers.ts`(소비처 3곳 — 폼 프리필·Re-run 모달·에디터 히스토리 로드)로
    승격돼, 단일 실패점(backend 에 신규 마커 추가 시 frontend 미갱신)의 폭발 반경이 커졌다. 두
    파일의 JSDoc 이 서로를 가리키며 "어긋나면 조용히 뚫린다" 고 경고하는 수준이 현재의 유일한
    방어다.
  - 참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` ("마커 미러 계약
    테스트", 2026-08-17 최초 등재)에 이미 추적 중.
  - 제안: backend 상수를 공유 패키지로 추출하거나, 두 파일의 리터럴을 파싱해 대조하는
    CI/테스트 스크립트를 추가한다.

## 긍정적으로 확인한 점 (회귀 없음)

- **표면 전수 일관성**: `ExecutionsService.findById`/`findByWorkflow`/`getChain`/`stop` +
  `BackgroundRunsService` 노드 레벨까지 `Execution.inputData` 마스킹이 일관되게 적용됐고
  (line-level 로 grep 하여 미마스킹 read 경로가 없음을 확인), 테스트가 양성(`toContain('***')`)·
  음성(`not.toContain(...)`) 단언 쌍으로 필드 소실/`null` 회귀를 함께 잡는다.
- **깊이 상한 일치·순서**: frontend `MAX_MARKER_SCAN_DEPTH`(10)가 backend
  `MAX_REDACT_DEPTH`(10)와 정확히 일치하고, `hasMaskedMarkerLeaf` 가 값 검사를 깊이 검사보다
  먼저 실행해 상한 지점(depth 10)에 치환된 마커를 놓치지 않는다. 상한 없는 재귀 탐색이
  `RangeError`(스택 오버플로)로 렌더 경로(`useMemo`)를 깨뜨리는 DoS 형 회귀도 캐너리로 고정돼
  있다.
- **정확 일치만 감지**(exact-match, no substring/regex) — `a***b`/`postgres://***@db` 같은
  이미 자격증명이 제거된 정상 값을 오탐으로 막지 않고, 정규식 기반이 아니라 ReDoS 위험도 없다.
- **webhook ingestion `[REDACTED]` 마커 비파괴 보존** — `Execution.inputData` 표면
  (`executions.service.spec.ts` ⑥)과 `BackgroundRunsService` 노드 레벨 표면 양쪽에서 확인됨
  (12-webhook §5.3 계약 유지).
- **인가 로직 무변경**: Re-run 의 `RR-PL-06`(타인 실행은 워크스페이스 owner/admin 만) 검사,
  `@Roles` 게이트 여부(`BackgroundRunsController` 는 종전대로 워크스페이스 멤버 전원 접근)가
  이번 diff 로 건드려지지 않았다.
- **서버측 재실행 로직은 마스킹을 우회하지 않는다** — `executions.service.ts` 의
  `rerun`/`re-run` 처리 경로(L484, L524)가 읽는 `original.inputData` 는 egress 마스킹 관문을
  타지 않는 내부 엔티티 원문이지만, 이는 실행 엔진에 넘기는 서버 내부 값이지 클라이언트로
  나가는 응답이 아니므로 마스킹 정책과 모순되지 않는다(egress 만 마스킹 대상).
- **하드코딩 시크릿 없음**: `codebase` diff 전체에서 `password|secret|api-key|token` 매칭은
  전부 테스트 픽스처(`sk-live-abc123`/`admin:pw`/`apiKey:"***"` 등 가짜 리터럴)이거나 마스킹
  변수명·i18n 문자열이었다. 실제 자격증명·API 키는 발견되지 않았다.
- **에러 메시지 노출 없음**: `editor-toolbar.tsx` 의 `JSON.parse` 실패 시 `e.message` 노출은
  사용자 자신이 입력한 텍스트의 파싱 실패 사유(V8 표준 메시지)일 뿐 서버·인프라 정보를 담지
  않는다. `sanitize-error-message.ts` 의 핵심 마스킹 함수(`deepRedactCore`, `SECRET_LEAK_PATTERNS`)
  자체는 이번 diff 에서 JSDoc 만 바뀌었고 로직 변경이 없다.
- **XSS 없음**: 새 UI(경고 배너 `role="alert"`, i18n 문자열)는 전부 정적 번역 텍스트를
  렌더하며, 사용자 입력을 `dangerouslySetInnerHTML` 등으로 그대로 삽입하는 경로가 없다.

## 요약

이 PR 은 `Execution.inputData` re-run 재제출 카브아웃을 닫아 실제 데이터 무결성 결함(마스킹된
`'***'` 가 새 실행의 실제 입력이 되는 조용한 오염)을 해소했다. 10라운드의 선행 리뷰를 거치며
CRITICAL 은 전부 소거됐고, 이번 독립 확인에서도 새로운 CRITICAL 은 발견되지 않았다 — 마스킹
표면 4경로 + 노드 레벨, 깊이 상한 일치, ingestion 마커 보존, 인가 로직 무변경까지 코드·테스트가
일관되게 맞물린다. 남은 발견사항 2건(서버측 마커 리터럴 미검증, 마커 미러 무계약)은 모두 이번
PR 이전부터 존재했고 이미 트래커에 등재·CHANGELOG 에 범위가 명시된 defense-in-depth 항목으로,
확인적 재기재에 해당한다. 영향 범위가 호출자 자신의 새 실행에 한정돼 기밀성 침해가 아니므로
이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
