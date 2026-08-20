# 신규 식별자 충돌 검토 — `spec/5-system/` (eia-inputdata-marker-guard, impl-done)

## 검토 범위 요약

`origin/main...HEAD` 전체 diff(`git diff --stat`) 및 `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md` + `spec/{1-data-model.md,3-workflow-editor/3-execution.md,4-nodes/1-logic/12-background.md}` 의 실제 diff 를 워킹트리에서 직접 확인. 관련 코드 diff(`masked-markers.ts` 신규, `sanitize-error-message.ts`, `executions.service.ts`, `execution-response.dto.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`, i18n dict)도 함께 확인했다.

본 변경의 실체는 **`Execution.inputData` egress 마스킹 카브아웃을 닫는 것**(spec 정정 + 프런트 마커 가드 3곳)이며, 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로는 **하나도 도입되지 않았다**. 도입된 것은 (1) 신규 유틸 파일 1개, (2) 그 안의 함수/상수 3개, (3) i18n 키 2개, (4) 컴포넌트 로컬 함수/변수 몇 개뿐이다. 아래는 각각에 대한 충돌 검사 결과다.

## 점검 결과

### 1. 요구사항 ID 충돌 — 해당 없음
diff 전체에서 새 정책 ID(`RR-PL-*`, `WH-NF-*` 류)나 새 잔여 번호(`잔여 ①②③`) 부여가 없다. 오히려 기존 `잔여 ②`(EIA §R17)를 "해소"로 갱신했을 뿐, 새 번호를 만들지 않았다. 충돌 없음.

### 2. 엔티티/타입명 충돌 — 해당 없음
`ResponseExecution`(`codebase/backend/src/modules/executions/executions.service.ts`)에 기존 필드 `inputData` 를 Omit-재선언에 추가했을 뿐 새 타입명 도입이 없다. `ExecutionDto.inputData` / `NodeExecutionSummaryDto.inputData` 도 기존 필드의 정책(마스킹 여부) 문서만 갱신됐고 신규 필드명은 없다.

### 3. API endpoint 충돌 — 해당 없음
diff 에 `POST`/`GET` 등 신규 endpoint 선언이 없다. 기존 `GET /api/executions/:id`, `POST /api/executions/:id/re-run` 의 응답 바디 값(egress 마스킹 여부)만 바뀌었다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
`spec/5-system/6-websocket-protocol.md` diff 는 기존 `execution.node.completed` 등 이벤트명을 그대로 쓰고, "가르는 축(레벨→마커 가드)"이라는 서술만 갱신했다. 신규 이벤트/채널명 없음.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var·config key 도입 없음. `MAX_MARKER_SCAN_DEPTH = 10`(`masked-markers.ts`)은 backend `MAX_REDACT_DEPTH` 를 프런트에서 숫자로 미러한 로컬 `const`(비공개, export 안 됨)이며 이름도 backend 상수명과 겹치지 않는다.

### 6. 파일 경로 충돌 — 해당 없음
신규 파일:
- `codebase/frontend/src/lib/utils/masked-markers.ts` (신규)
- `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` (신규)
- `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` (신규)
- `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` (신규)
- `plan/in-progress/eia-inputdata-marker-guard.md`, `plan/in-progress/spec-draft-inputdata-egress-masking.md` (신규)

모두 기존 디렉토리 명명 컨벤션(`lib/utils/<kebab-case>.ts` + `__tests__/` 서브디렉토리, `plan/in-progress/<slug>.md`)을 따르고, 기존 파일과 경로가 겹치지 않는다(`grep -rn "MASKED_MARKERS\|isMaskedMarker\|hasMaskedMarkerLeaf"` 결과 정의처는 각 1곳씩만 존재).

## 확인된 "의도된 동명" 패턴 — 충돌 아님 (참고용 기록)

`masked-markers.ts` 의 `export const MASKED_MARKERS` / `export function isMaskedMarker`는 backend `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 (module-private) `const MASKED_MARKERS` / `function isMaskedMarker` 와 **이름이 완전히 동일**하다. 이는 실수가 아니라 파일 JSDoc 에 명문화된 설계 결정이다 — "미러의 동기화는 결국 사람이 grep 으로 찾는다. 이름이 갈리면 그 검색이 실패한다"(`masked-markers.ts` 상단 주석, `sanitize-error-message.ts` 쪽 미러 언급과 상호 참조). 두 정의는 서로 다른 런타임(NestJS backend / Next.js CSR frontend)에 있어 심볼 충돌이 발생하지 않으며, `dynamic-form-ui.tsx` 에 있던 구(舊) 프런트 정의를 이 파일로 옮기며(export 이동) 유일한 정의처로 수렴시켰다(구 위치의 `export const MASKED_MARKERS`/`export function isMaskedMarker` 는 diff 에서 완전히 삭제되고 import 로 대체됨). CRITICAL/WARNING 대상 아님 — INFO 로만 기록한다.

- **[INFO]** 백엔드/프런트 동명 상수·함수 쌍 (`MASKED_MARKERS`, `isMaskedMarker`)
  - target 신규 식별자: `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`, `isMaskedMarker`, `hasMaskedMarkerLeaf`
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`MASKED_MARKERS`), `:156`(`isMaskedMarker`) — 모듈 비공개(export 없음)
  - 상세: 의미는 동일(같은 마커 집합·같은 판별 로직)하고 backend 가 SoT, frontend 가 미러. 모듈 스코프가 분리돼 있어 실제 심볼 충돌은 없다.
  - 제안: 조치 불필요. 다만 이 의도된 동명 패턴은 두 파일 어느 쪽이든 리팩터링할 때 실수로 "이름 통일"을 시도해 import 시도가 생기지 않도록 (특히 신규 합류자가) 두 JSDoc 의 상호 참조를 유지하면 된다 — 이미 양쪽에 존재.

## 소소한 신규 로컬 식별자 전수 (충돌 없음 확인용)

`splitMaskedParameters`, `isStructuredType`, `isStructuredField`, `blockedByMaskedInput`, `touchedKeys` (모두 `rerun-modal.tsx` 파일 스코프 로컬) / i18n 키 `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` — 전체 코드베이스 grep 결과 각각 선언처가 1곳(+사용처)뿐이며 기존 동명 식별자 없음.

## 요약

이번 target 변경은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var 를 전혀 도입하지 않는 순수 "카브아웃 폐지 + 프런트 마커 가드 3곳" 변경이다. 유일한 신규 파일(`masked-markers.ts`)과 그 안의 식별자(`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`)는 backend 의 동명 비공개 상수/함수와 이름이 겹치지만, 이는 코드 주석에 명문화된 의도적 미러링 관용구이고 모듈 스코프가 분리돼 실질적 충돌이 없다. 신규 i18n 키·컴포넌트 로컬 함수·plan 문서 경로도 전수 확인 결과 기존 사용처와 겹치지 않는다.

## 위험도
NONE
