# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치
매핑 본문을 적재했다. 변경 파일은 `git diff origin/main...HEAD --stat -- codebase/`
(21개 코드/문서 파일, `review/`·`plan/` 산출물 제외)로 확정했다. 저장소 파일은 뮤테이션하지
않았다 — `Read`/`grep`/`git show`/`git log`와, 새 가드 2개 파일에 한해 `vitest run`(읽기 전용
실행, 파일 변경 없음)만 사용했다. `git status --short` 로 뮤테이션 없음을 재확인했다.

이 PR(`911d9d7dd` → `a68457936` → `de99def86` → `137784219`)은 그 자체가 **유저 가이드 동반
갱신 결함을 고치는 배치**다. 이미 `/ai-review` 3라운드(10_12_19 · 10_40_34 · 11_07_36)와
`--impl-done` 2라운드가 이 changeset 을 훑었고, 직전 라운드(11_07_36)의 requirement WARNING이
지목한 "노드-종류별 에러 코드 표가 spec §1.4 대비 실재 코드 5종 누락"은 마지막 커밋
(`137784219`, "리뷰 라운드 3")에서 처분됐다. 본 리뷰는 그 위에서 매트릭스 trigger 관점을
독립적으로 재검증했고, 특히 라운드 3 의 수정 자체가 완전한지(재발 여부)를 spec SoT 와 직접
대조했다.

## Trigger 매칭 결과

| Trigger (matrix id) | 매칭 파일 | 요구 동반 갱신 | 같은 changeset 내 존재? |
|---|---|---|---|
| `backend-api-change` (`dto/**` glob) | `integration-response.dto.ts`, `model-config-response.dto.ts` | swagger jsdoc + 관련 user-guide 페이지 | ✓ |
| `run-debug-flow-change` (semantic) | `error-handling{,.en}.mdx`, `run-results{,.en}.mdx` | `05-run-and-debug/` 갱신 | ✓ |
| `integration-provider-change` 유사 (semantic) | `integrations{,.en}.mdx` (`02-nodes/`, MakeShop 에러 코드 서술) | provider 코드/문구 정합 | ✓ |
| `new-error-code` / `new-warning-code` | 대상 없음 (`error-codes.ts` 미변경) | — | 미해당 (trigger 불발) |
| `new-ui-string` (`*.tsx`) | `model-config-manager.test.tsx`(테스트만) | dict ko/en parity | 미해당 — 프로덕션 tsx 무변경, 기존 i18n 키(`models.connectionFailed`) 재사용 |
| `new-node` / `node-schema-change` | 대상 없음 (`codebase/backend/src/nodes/**` 미변경) | — | 미해당 |
| `new-userguide-section-dir` | 대상 없음 (기존 디렉토리만 수정) | — | 미해당 |
| `auth-session-flow-change` / `expression-language-change` | 대상 없음 | — | 미해당 |

## 상세 확인

### 1) `run-debug-flow-change` — 라운드 3 수정이 spec SoT 와 완전히 일치하는지 재검증

직전 라운드가 "노드-종류별 표가 spec §1.4 대비 5종(`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·
`MAX_COLLECTION_RETRIES_EXCEEDED`·`SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE`)
누락"을 지적했고, 마지막 커밋이 이를 고쳤다고 주장한다. 그 주장을 신뢰하지 않고
`spec/5-system/3-error-handling.md §1.4`(라인 134-139)와 현재 `run-results.mdx`/`.en.mdx`
표를 셀 단위로 직접 대조했다:

- HTTP / Database / Email / LLM / Code / Sub-workflow 6행 전부 spec 표와 **글자까지 일치**한다
  (`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`·`MAX_COLLECTION_RETRIES_EXCEEDED`·
  `SUB_WORKFLOW_QUEUE_FAILED`·`WORKFLOW_FORBIDDEN_WORKSPACE` 5종 모두 반영 확인).
- spec 이 `HTTP_TIMEOUT`을 "enum 에는 있으나 **미발행**"이라고 명시적으로 주석 달아 두었는데
  (§1.4 라인 141), 가이드 표도 이 코드를 신지 않는다 — **누락이 아니라 "실제로 발행되는
  코드만 싣는다"는 가이드의 취지와 정확히 일치**하는 의도된 배제다.
- `*_HOST_BLOCKED` 설명 문단(신규)도 ko/en 양쪽에 같은 의미로 추가됐다.
- backend `error-codes.ts` 직접 grep 으로 6개 카테고리 전 코드가 실재함을 재확인
  (`HTTP_TRANSPORT_FAILED`·`DB_QUERY_FAILED`·`EMAIL_SEND_FAILED`·`LLM_CALL_FAILED`·
  `CODE_EXECUTION_FAILED`·`SUB_WORKFLOW_FAILED` 등).

결론: 라운드 3 수정은 커밋 메시지의 주장대로 **완결**됐다. 재발 없음.

### 2) `integration-provider-change` — MakeShop 코드 정정 재검증

`02-nodes/integrations.mdx`/`.en.mdx` 의 `MAKESHOP_API_ERROR`(지어낸 이름) → `MAKESHOP_404` +
실재 코드 계열 서술을 backend 소스와 대조 — `MAKESHOP_404/422/4XX/5XX/AUTH_FAILED/
RATE_LIMITED/TRANSPORT_FAILED` 및 사전-호출 실패 4종(`MAKESHOP_UNKNOWN_OPERATION`·
`MAKESHOP_MISSING_FIELDS`·`MAKESHOP_INVALID_SHOP_UID`·`MAKESHOP_UNRESOLVED_PATH_PARAM`) 전부
`codebase/backend/src/nodes/integration/makeshop/`(handler·api client·metadata) 에서 실재
확인. ko/en 양쪽에 같은 두 문단(사후 실패 7종 vs 사전 검증 실패 4종 구분)이 대칭으로 추가돼
parity 결함 없음.

### 3) `guide-sanitized-message-parity.test.ts` — 신규 가드가 실제로 GREEN 인지 직접 실행

문서만 읽고 "테스트가 있다"를 믿지 않고 `guide-error-code-existence.test.ts` +
`guide-sanitized-message-parity.test.ts` 를 직접 `vitest run` 했다 — **2 test files, 21
tests, 전부 PASS**. `sanitize-error.util.ts` 의 8갈래 반환 리터럴과 `models{,.en}.mdx` 표
첫 열이 문자 단위로 일치함을 가드가 실측 확인하고 있다.

### 4) `new-ui-string` — 미해당 판정이 맞다

이 diff 의 유일한 `.tsx` 변경은 `model-config-manager.test.tsx`(테스트)뿐이고, 프로덕션
`model-config-manager.tsx` 자체는 변경되지 않았다. 그 파일의 토스트 문자열은 여전히
`t("models.connectionFailed", { error: result.message ?? "" })` 로 기존 i18n dict 키를
그대로 재사용한다(`grep` 으로 하드코딩 리터럴 없음을 확인) — 신규 UI 문자열이 아니므로
`i18n/dict/{ko,en}` 갱신 의무가 없다.

### 5) `backend-api-change` (dto/**) — `TestConnectionResultDto.code` 의 user-guide 노출 여부

`integration-response.dto.ts` 에 신규 선언된 `code?: string`(`INTEGRATION_INCOMPLETE`·
`EMAIL_CONNECT_FAILED`·`MCP_*`)이 실제로 프런트엔드 UI 에 노출되는지 확인했다 —
`codebase/frontend/src/lib/api/integrations.ts` 의 응답 타입에는 이미 `code?: string` 이
있었지만(이번 PR 이전부터), 이 값을 분기해 사용자에게 보여주는 컴포넌트는 저장소 전체에서
찾지 못했다(`grep -rn "result.code\|\.code ===" codebase/frontend/src/components/` 결과
무관한 `error-page.tsx` 의 axios `err.code` 뿐). 즉 이 필드는 **선언(OpenAPI)만 실제 발행
상태에 맞춘 것**이고 새로운 사용자-가시 표면이 아니므로, `06-integrations-and-config/
{cafe24,makeshop}.mdx` 에 이 코드값을 문서화할 의무는 이번 diff 기준으로는 발생하지 않는다.
swagger jsdoc(대상 1)은 이미 갱신됨.

### 6) `ERROR_KO`/`WARNING_KO` 매핑 — 트리거 불발 확인 (재-flag 방지)

`run-results{,.en}.mdx` 가 인용하는 코드들은 전부 **기존에 이미 존재하던** `ErrorCode` 값이며,
이 diff 는 `codebase/backend/src/nodes/core/error-codes.ts` 를 건드리지 않는다 —
매트릭스 `new-error-code` 행의 glob trigger 가 fire 하지 않으므로 이번 PR 에 `ERROR_KO`
매핑 추가 의무가 없다. `backend-labels.ts` 를 직접 열어 확인한 결과 이 코드들이 여전히
`ERROR_KO`/`WARNING_KO` 어디에도 없는 것은 사실이지만, 이는 **이번 PR 이 새로 발행한 코드가
아닌 기존 상태**이고 `plan/in-progress/guide-error-code-truth.md` §F 가 "코드를 UI 에 노출할
것인가"라는 별개의 제품 결정으로 이미 구분해 등재해 두었다. 재-flag 하지 않는다.

### 7) spec/ 층 갱신 갭 — 매트릭스 밖, developer 권한 밖 확인

`spec/conventions/user-guide-evidence.md` 에 신규 가드 3종(existence/scan/parity)이 아직
관계표에 등재되지 않은 것과, "가이드 → 코드" 단방향 가드의 사각지대(코드에는 있는데 가이드가
빠뜨리는 방향)를 잡는 역방향 가드가 아직 없는 것을 확인했다. 둘 다 `plan/in-progress/
guide-error-code-truth.md`(§I architecture W#3 처분란) 및 `plan/in-progress/
spec-draft-nullable-notation-followups.md:3305`에 developer 권한 경계를 지켜 백로그로
정확히 등재돼 있다(CLAUDE.md 규약상 `developer` 는 `spec/` 쓰기 권한 없음). 이 매트릭스의
21개 trigger 어디에도 "새 가드 신설 → convention 문서 관계표 갱신"을 요구하는 행이 없어
엄밀히는 범위 밖이지만, 다음 세션이 "가드 3건"이라는 낡은 카운트를 신뢰하지 않도록 INFO 로
기록해 둔다.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** 신규 가드 가족(`guide-error-code-existence`·`guide-error-code-scan`·
  `guide-sanitized-message-parity`)이 `spec/conventions/user-guide-evidence.md` 의 가드
  관계표에 아직 반영되지 않았다 — 매트릭스 밖(어떤 row 도 "가드 신설 → convention 관계표"를
  요구하지 않음), developer 권한 밖으로 이미 plan 백로그에 정확히 위임돼 있어 이번 PR 을
  막을 사유는 아니다. 재확인 목적의 기록.
  - 위치: `spec/conventions/user-guide-evidence.md` (미변경) vs
    `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence,guide-error-code-scan,guide-sanitized-message-parity}.*`(신규 3파일)
  - 제안: planner 턴에서 관계표 갱신 시 이 기록을 참조.
- **[INFO]** "가이드 → 코드" 단방향 존재성 가드만 있고 "코드 → 가이드"(실재 코드가 가이드에
  빠졌는지) 역방향 가드는 아직 없다 — 라운드 3 이 이 사각지대로 직접 걸렸던 자리이며, 지금은
  수동 대조(본 리뷰가 spec §1.4 와 셀 단위 대조)로만 닫혀 있다. `plan/in-progress/
  spec-draft-nullable-notation-followups.md:3305` 에 이미 등재돼 있어 이번 PR 스코프는 아니다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (존재 방향만 구현)
  - 제안: 후속 PR 에서 spec §1.4/§9.1 카탈로그를 미러링하는 역방향 가드 신설 시 이 기록 참조.

## 요약

매트릭스 21행 중 3행(`backend-api-change`·`run-debug-flow-change`·`integration-provider-change`
유사)이 이 changeset 에 매칭됐고, 3행 모두 같은 커밋 세트 안에서 요구된 동반 갱신(swagger
jsdoc, `05-run-and-debug/` MDX, `02-nodes/integrations.mdx` 코드 정정, ko/en 양쪽)이 완료돼
있음을 spec SoT(§1.4) 및 backend 소스와의 직접 대조·신규 가드 실행(vitest 21/21 PASS)으로
독립 재검증했다. 직전 라운드가 지적한 "노드-종류별 표 5종 누락"은 마지막 커밋에서 완전히
해소됐음을 셀 단위로 확인했다(재발 없음). `new-ui-string`·`new-node`·`new-error-code` 등
나머지 트리거는 대상 파일이 diff 에 없어 불발이다. `ERROR_KO` 매핑 부재·신규 가드의 convention
관계표 미등재는 실재하지만 이번 PR 이 새로 만든 갭이 아니라 이미 별도 트래커에 정확히 위임된
선행 항목이라 재-flag 하지 않았다. 누락된 동반 갱신 0건.

## 위험도

NONE
