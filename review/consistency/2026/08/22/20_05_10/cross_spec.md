# Cross-Spec 일관성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 확인 (절대경로 워크트리 기준 실측)

`git diff origin/main...HEAD` 실측 결과:

- `spec/4-nodes/7-trigger/1-manual-trigger.md`: frontmatter `code:` 목록에
  `codebase/backend/src/modules/executions/executions.service.ts` **1줄 추가뿐** — spec 본문
  변경 없음.
- 코드 diff는 4개 파일뿐이다 (`trigger-parameter.types.ts` · `resolve-trigger-parameters.ts` ·
  `re-run.dto.ts` · `workflows.controller.ts`). 전부 **주석/JSDoc/Swagger `description` 문자열**
  변경이며, 조건문·분기·반환값·타입 시그니처·호출 관계는 origin/main 과 동일
  (동일 `try/catch`, 동일 `resolveTriggerParametersRejectingMasked` 호출, 동일
  `REASON_TO_DETAIL` key/value). `plan/complete/masked-marker-cosmetic-followups.md` 도
  "동작 무변경 · 실행 코드 라인 0줄" 로 명시. 즉 이번 변경분은 이미 병합된 마스킹 마커
  재제출 거부 기능(#1188~#1191)에 대한 **동작 변경 없는 문서화 followup**이다.

이 전제 위에서 target 문서(및 diff)가 다른 spec 영역과 새로 충돌시키는 지점이 있는지
워크트리 절대경로로 재검증했다.

## 확인한 교차 참조 (실측)

- **EIA §R17** (`spec/5-system/14-external-interaction-api.md` L1568-L1617, "닫는 조건은
  충족됐다 (2026-08-20)" 표 + 하위 4개 인용 블록): manual-trigger.md §6 이 서술하는
  `masked_value_resubmitted` 검사 시점(raw 우선 → resolve 후 재검사) · wrapper 분리 이유
  (base 는 Webhook/Schedule 공유라 넣지 않음) · CI 가드
  (`repo-guards/__tests__/masked-reject-callers-guard.ts`) · 서버측 가드 두 호출부
  (`POST /workflows/:id/execute`, `POST /executions/:id/re-run`) · 정확 일치만 감지(부분
  일치는 통과) 전부 EIA §R17 원문과 문구 수준까지 일치. 이번 diff 가 새로 추가한 JSDoc/
  Swagger description(`resolve-trigger-parameters.ts`, `re-run.dto.ts`)도 이 내용을 그대로
  요약한 것으로, SoT 재인용이지 모순이 아니다.
- **`spec/1-data-model.md`** `Execution.input_data` 서술: "서버도 2층으로 거부한다"가
  diff 의 `re-run.dto.ts` description(마커 3종 예약어, `MASKED_VALUE_RESUBMITTED`, 부분
  일치 통과)과 일치.
- **`spec/5-system/3-error-handling.md` §1.7**(L183, 앵커 실재 확인) / **API 규약 §5.3** /
  **webhook §5.2**: `TriggerParameterErrorDetail` JSDoc 및 manual-trigger.md §6 이 인용하는
  에러 봉투 형태(`{ error: { code, message, requestId, details } }`, field code
  `UPPER_SNAKE_CASE`)와 상충 없음.
- **`code:` frontmatter 공유** — 신규 추가된
  `codebase/backend/src/modules/executions/executions.service.ts` 는 이미
  `spec/2-navigation/14-execution-history.md` · `spec/5-system/13-replay-rerun.md` ·
  `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/conventions/node-cancellation.md` 5개 문서가 SoT 코드로 인용 중인 공유 서비스
  파일이다(`grep -rl` 재확인). 다중 영역이 한 서비스 파일을 공유 SoT 로 인용하는 것은
  이 저장소의 기존 관례이며 신규 충돌이 아니다.
- **`REASON_TO_DETAIL` 4종 JSDoc 신설**: `missing_required`/`coerce_failed`/`invalid_schema`
  는 이번에 처음 JSDoc 이 붙었으나 `code`/`message` 값 자체는 origin/main 과 동일 — 문서
  밀도만 변경, 요구사항 ID·에러 코드 재정의 없음.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** 신규 항목이 참조하는
  `spec/conventions/egress-masking.md`(PR #1194)는 현재 워크트리에 **아직 존재하지 않음**
  (`ls spec/conventions/` 확인). 그러나 이는 plan 문서 내 forward-reference 로, 그 plan
  자신이 "#1194 가 철회되거나 늦게 들어오면 이 항목이 유일한 기록" 이라고 명시해 fork
  케이스를 이미 흡수했다 — spec 파일 간 충돌이 아니라 plan 서술이므로 본 검토 범위(spec 간
  충돌) 밖.

## 발견사항

없음. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서
target 변경분(주석/JSDoc/Swagger 한글화·보강 + frontmatter 1줄)이 다른 spec 영역과 새로
모순되는 지점을 찾지 못했다. 실질 동작·계약은 origin/main 이전 PR 에서 이미 확정되었고
EIA §R17 이 그 SoT 로 계속 참조되고 있으며, 이번 diff 는 그 SoT 를 여러 지점에 산문으로
재인용했을 뿐이다(재인용 자체가 늘어난 유지비는 plan 이 이미 별도 항목으로 추적 중이며
cross-spec 모순이 아니라 문서 동기화 리스크로 다뤄지고 있음).

### 요약

이번 target 변경(spec/4-nodes/7-trigger/ frontmatter 1줄 + 4개 코드 파일의 주석/JSDoc/
Swagger description 변경)은 이미 병합된 마스킹 마커 재제출 거부 기능에 대한 순수 문서화
followup이며 spec 본문·코드 동작 모두 실질 변경이 없다. EIA §R17·데이터 모델·API 규약·
error-handling §1.7·webhook §5.2 등 target 이 참조하는 모든 교차 spec 섹션을 워크트리
절대경로로 직접 대조한 결과 데이터 모델, API 계약, 요구사항 ID, 상태 전이, RBAC, 계층
책임 어느 관점에서도 모순을 확인하지 못했다. 신규 추가된 frontmatter `code:` 항목도 이미
5개 spec 문서가 공유 SoT 로 인용 중인 파일이라 기존 다중-소유 관례와 부합한다.

### 위험도

NONE
