STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법

`origin/main...HEAD` diff(30개 파일, spec 7 + codebase 23)를 대상 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`, 현재 checkout)에서
직접 확인했다. 이번 변경은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드
3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 도입이며, **신규로 도입되는 식별자는
전부 frontend 지역 스코프**다. 신규 요구사항 ID·API endpoint·이벤트명·ENV var 는 diff 에 존재하지
않는다(전부 기존 `EIA §R17` 재인용, 신규 API/이벤트/설정키 0건 — grep 으로 확인).

## 발견사항

### 신규 식별자 목록과 충돌 검사 결과 (전부 충돌 없음)

| 범주 | 신규 식별자 | 위치 | 충돌 검사 |
|---|---|---|---|
| 파일 경로 | `codebase/frontend/src/lib/utils/masked-markers.ts` | 신규 파일 | `lib/utils/` 기존 22개 파일과 겹치지 않음. kebab-case 컨벤션 일치 |
| export const | `MASKED_MARKERS` | `masked-markers.ts:18` | backend `sanitize-error-message.ts:150` 의 (module-private) `MASKED_MARKERS` 와 **동일 이름** 이지만, 양쪽 JSDoc(`masked-markers.ts:11`, `sanitize-error-message.ts:143`)이 "이름을 backend 와 똑같이 둔다 — 미러 동기화를 grep 으로 찾기 위해" 라고 **명시적으로 의도**한 동기화 미러 쌍이다. 다른 의미로 쓰이는 재사용이 아니므로 충돌 아님 |
| export function | `isMaskedMarker` | `masked-markers.ts:48` | 위와 동일 — backend `sanitize-error-message.ts:156` 의 동명 함수와 **의도된 미러**. 소비처(`dynamic-form-ui.tsx`, `rerun-modal.tsx`)도 이 사실을 알고 import |
| export function | `hasMaskedMarkerLeaf` | `masked-markers.ts:88` | 코드베이스 전체에 이 이름의 다른 정의 없음 (grep 0건 외 정의) |
| private function | `scanForMarker` | `masked-markers.ts:98` | 모듈 내부 전용, 외부 재사용 없음 |
| const | `MAX_MARKER_SCAN_DEPTH` | `masked-markers.ts:96` | 코드베이스 유일. backend `MAX_REDACT_DEPTH` 와 **의도적으로 같은 값**을 갖는 별도 이름(이름까지 통일하지 않음 — 주석에 근거 명시) |
| local function | `splitMaskedParameters`, `isStructuredType`, `inferTypeFromValue`, `isStructuredField` | `rerun-modal.tsx` | 전부 파일-로컬 유일 정의, 다른 파일에 동명 심볼 없음 |
| local state/var | `touchedKeys`, `maskedKeys`, `blockedByMaskedInput` | `rerun-modal.tsx` | 컴포넌트-로컬 스코프. 프로젝트 전역에 동명 export 없음 |
| i18n key | `editor.runWithInputMasked` | `dict/{en,ko}/editor.ts` | 기존 `editor.*` 키 목록에 동명 키 없음 (신규) |
| i18n key | `history.rerun.maskedInputBlocked` | `dict/{en,ko}/history.ts` | 기존 `history.rerun.*` 키 목록에 동명 키 없음 (신규). en/ko 양쪽 페어 일치 확인 |
| type field | `ResponseExecution.inputData: Record<string, unknown> \| null` | `executions.service.ts:116` | `Omit<Execution, 'error' \| 'inputData' \| 'outputData' \| ...>` 로 엔티티의 `inputData: Record<string,unknown>`(non-null) 를 재선언한 것 — 신규 필드 도입이 아니라 기존 필드의 nullable 화. `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData`/`BackgroundRunNodeExecutionDto.inputData` 등 형제 DTO 필드와 이름·shape 이 일치, 충돌 없음 |
| 제거된 식별자 | `MASKED_INPUT_DATA_REASON` (backend const) | 삭제됨 | `spec/**` 전수 재확인 결과 잔여 참조 0건. `plan/in-progress/*.md` 2건은 "이 식별자를 지운다/지웠다"는 과거형 추적 서술이라 댕글링 참조 아님 |

### 요구사항 ID / API endpoint / 이벤트명 / ENV var

- 신규 requirement ID 없음 — 전 diff 가 기존 `EIA §R17`(spec/5-system/14-external-interaction-api.md)
  섹션만 재인용하며 새 `R-*`/`RR-PL-*`/`WH-*` ID 를 추가하지 않는다.
- 신규 API endpoint(method+path) 없음 — 기존 `GET /api/executions/:id`, `POST
  /api/executions/:executionId/re-run`, `GET /executions/workflow/:id` 재사용뿐.
- 신규 webhook/queue/SSE 이벤트명 없음 — `execution.node.completed` 등 기존 이벤트만 언급.
- 신규 ENV var·config key 없음.

## INFO

- **[INFO]** backend/frontend `MASKED_MARKERS`/`isMaskedMarker` 이름 일치는 의도된 동기화 미러(양쪽 JSDoc 이 상호 참조)이며, grep 가능성을 위해 이름을 맞췄다는 설계 의도가 코드에 명문화돼 있다. 신규 식별자 충돌 관점에서는 "충돌"이 아니라 "정합"이지만, 향후 이 이름을 두 곳 중 한쪽만 리네임하면 그 즉시 미러 계약이 깨지고 마스킹 가드가 조용히 뚫릴 수 있다는 점은 다른 검토 축(convention-compliance/rationale-continuity)에서 이미 캐치할 사안으로 별도 액션 불필요.

## 요약

target 변경(`spec/5-system/` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 도입)이 새로 도입하는 식별자는 신규 파일 `masked-markers.ts` 의 export 4개(`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`/`MAX_MARKER_SCAN_DEPTH`), `rerun-modal.tsx` 의 로컬 헬퍼·상태 7개, i18n 키 2개(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)뿐이며 신규 요구사항 ID·API endpoint·이벤트명·ENV var 는 전혀 도입하지 않는다. 코드베이스 전수 grep 으로 대조한 결과 이름이 겹치는 유일한 사례(`MASKED_MARKERS`/`isMaskedMarker`)는 backend 상수를 frontend 가 의도적으로 동일 이름으로 미러링한 설계이며 다른 의미로 재사용된 사례가 아니다. 제거된 backend 상수 `MASKED_INPUT_DATA_REASON` 도 spec 전역에서 댕글링 참조가 남지 않았다. 신규 식별자 충돌 관점에서 이 target 은 깨끗하다.

## 위험도

NONE
