# Cross-Spec 일관성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD` 실측:
- `spec/4-nodes/7-trigger/1-manual-trigger.md`: frontmatter `code:` 목록에
  `codebase/backend/src/modules/executions/executions.service.ts` 1줄 추가뿐 (spec 본문 무변경).
- 코드 diff 4개 파일(`trigger-parameter.types.ts` · `resolve-trigger-parameters.ts` ·
  `re-run.dto.ts` · `workflows.controller.ts`)은 전부 **주석/JSDoc/Swagger 설명문 한글화 및
  추가**뿐이다 — 조건문·분기·반환값·타입 시그니처 변경 없음 (동일 `try/catch`, 동일
  `resolveTriggerParametersRejectingMasked` 호출, 동일 `REASON_TO_DETAIL` 값). 즉 이번
  변경분은 이전 PR(#1188~#1191)에서 이미 구현·리뷰된 마스킹 마커 재제출 거부 로직의
  **동작 변경 없는 cosmetic followup**이다.

이 전제 위에서 target 문서(및 그 diff)가 다른 spec 영역과 새로 충돌시키는 지점이 있는지를 검토했다.

## 확인한 교차 참조

- **EIA §R17** (`spec/5-system/14-external-interaction-api.md`, "적용 범위는 총칭이 아니라
  열거다" 항목 및 "닫는 조건은 충족됐다 (2026-08-20)" 표): manual-trigger.md §6 이 서술하는
  `masked_value_resubmitted` 검사 시점(raw 우선 → resolve 후 재검사)·wrapper
  분리 이유(base 는 Webhook/Schedule 공유라 넣지 않음)·CI 가드
  (`repo-guards/__tests__/masked-reject-callers-guard.ts`)·서버측 가드 두 호출부
  (`POST /workflows/:id/execute`, `POST /executions/:id/re-run`) 전부 EIA §R17 원문과
  **문구 수준까지 일치**한다. 새로 추가된 JSDoc 주석도 이 내용을 그대로 요약한 것으로,
  모순이 아니라 SoT 재인용이다.
- **`spec/1-data-model.md`** `Execution.input_data` 행: "2026-08-20 부터는 서버도 2층으로
  거부한다" 서술이 manual-trigger.md §6 및 diff 의 `re-run.dto.ts` 설명(마커 3종 예약어,
  `MASKED_VALUE_RESUBMITTED`, 부분 일치 통과)과 일치.
- **API 규약 §5.3** / **error-handling §1.7** / **webhook §5.2**: manual-trigger.md §6 이
  인용하는 앵커가 모두 실재하며(`grep` 확인), 에러 봉투 형태(`{ error: { code, message,
  requestId, details } }`, field code `UPPER_SNAKE_CASE`) 서술도 상충 없음.
- **`code:` frontmatter 공유**: 이번에 추가된
  `codebase/backend/src/modules/executions/executions.service.ts` 는 이미
  `spec/2-navigation/14-execution-history.md` · `spec/5-system/14-external-interaction-api.md` ·
  `spec/5-system/13-replay-rerun.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/conventions/node-cancellation.md` 에서도 SoT 코드로 인용 중인 공유 서비스 파일이다.
  이 저장소는 하나의 코드 파일을 여러 영역 문서가 SoT 로 공유하는 것을 기존 관례로 쓰고
  있어(여러 책임이 한 서비스에 모임), 이번 추가가 그 관례와 어긋나지 않는다.

## 발견사항

없음. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서
target 변경분(주석/JSDoc 한글화 + frontmatter 1줄)이 다른 spec 영역과 새로 모순되는
지점을 찾지 못했다. 실질 동작·계약은 이미 origin/main 이전 PR 에서 확정되었고 EIA §R17 이
그 SoT 로 이미 참조되어 있다.

### 요약

이번 target 변경은 이미 병합된 마스킹 마커 재제출 거부 기능(#1188~#1191)에 대한 순수
주석/문서화 followup이며 spec 본문·코드 동작 모두 변경이 없다(단 하나의 frontmatter
`code:` 항목 추가는 이미 여러 영역이 공유 중인 서비스 파일을 트리거 스펙에도 SoT로
명시한 것으로, 기존 다중-소유 관례와 부합한다). EIA §R17·데이터 모델·API 규약·webhook·
error-handling 등 target 이 참조하는 모든 교차 spec 섹션을 대조한 결과 데이터 모델,
API 계약, 요구사항 ID, 상태 전이, RBAC, 계층 책임 어느 관점에서도 모순을 확인하지
못했다.

### 위험도

NONE
