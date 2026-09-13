# 정식 규약 준수 검토 — `spec/5-system/` (`--impl-done`)

## 검토 범위와 방법

`spec/5-system/` 델타는 0파일(이번 PR 은 spec 을 건드리지 않았다 — 정상. developer 는
spec write 권한이 없고, 아래에서 확인하듯 필요한 spec 변경 3건을 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히 등재만 했다). 실제
구현 diff(HEAD~1..HEAD, 17개 파일/936줄 — `git diff HEAD~1...HEAD` 로 직접 확인, prompt 번들엔
예산 절단으로 diff 본문이 없어서 워킹트리를 절대경로로 직접 읽었다)가 `spec/5-system/1-auth.md`
류 문서가 참조하는 `error-codes.md`·`swagger.md`·`user-guide-evidence.md` 규약을 지키는지를
본다. 세 conventions 파일과 `spec/5-system/3-error-handling.md`·`7-llm-client.md` 는 프롬프트
번들이 절단(스텁만 포함)했으므로 저장소 원본을 `Read`/`grep` 로 전문 대조했다.

## 발견사항

- **[WARNING] LLM 도메인 에러 코드가 여전히 `3-error-handling.md §1` 카탈로그에 없다 (기존 격차, 이번 PR 로 신규 발생 아님)**
  - target 위치: `spec/5-system/3-error-handling.md §1` (grep 결과 `CAFE24_*`/`MAKESHOP_*`/`OAUTH_*` 0건),
    `spec/5-system/7-llm-client.md §6`
  - 위반 규약: `spec/conventions/error-codes.md` "적용 범위"(카탈로그 SoT 는 `3-error-handling.md §1`)
  - 상세: 이번 PR 이 고친 `integrations.mdx`/`integrations.en.mdx` 는 `MAKESHOP_API_ERROR`(지어낸
    이름)를 실재하는 `MAKESHOP_404` 등으로 정정했는데, 그 정정 근거가 될 §1 카탈로그 행 자체가
    없다 — `plan/in-progress/guide-error-code-truth.md` §C 가 스스로 "가이드가 지어낼 때 대조할
    카탈로그 행이 없었다" 고 지목한 사각지대와 동일하다. `01_15_40`(impl-prep) 라운드가 이미
    이 항목(LLM 쪽)을 WARNING 으로 짚었고, developer 는 자기 권한 밖(spec write)이라 판단해
    `spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히 등재했다(governance
    경계 준수 — 위반이 아니라 올바른 위임).
  - 제안: 이미 planner 백로그에 등재됨. 신규 조치 불요 — planner 턴에서 §1 에 CAFE24_*·
    MAKESHOP_*·OAUTH_* 계열 + `LLM_CREDENTIALS_REQUIRED`·`LLM_MODEL_LIST_FAILED` 를 함께 등재하면
    닫힌다.

- **[WARNING] `testConnection` 실패 응답 shape 이 spec 어디에도 없다 (기존 격차, 이번 PR 이 코드는 고쳤지만 spec 은 아직)**
  - target 위치: `spec/5-system/7-llm-client.md §8.3` "`LlmService.testConnection` — kind별 probe
    전략" 표 (성공 케이스만 있고 실패 행이 없음, 확인됨)
  - 위반 규약: `spec/conventions/swagger.md §5-5`(응답 계약은 선언과 실제가 같아야 한다) ·
    `spec/5-system/2-api-convention.md` Overview
  - 상세: 이번 PR 은 실제 결함(서비스 `error` vs DTO/FE `message` 3층 불일치, 화면에 사유가 한
    글자도 안 뜨던 버그)을 `message` 로 통일하고 `assertMatchesContract` 를 배선해 코드
    레벨에서는 닫았다. 그런데 그 원인이 된 spec 공백(§8.3 이 실패 shape 을 아예 안 적음) 은 아직
    열려 있다 — 다음 사람이 같은 자리에서 또 지어낼 수 있는 구조가 남아 있다. `01_15_40` 라운드가
    이미 지적했고 developer 가 §E 처분에서 planner 항목으로 정확히 등재했다(governance 경계 준수).
  - 제안: 이미 planner 백로그에 등재됨. planner 턴에서 §8.3 에 실패 행(`{ success: false, message:
    string }`, 8갈래 문장은 `sanitize-error.util.ts` 가 SoT) 추가.

- **[WARNING] 새 가드(`guide-error-code-existence.test.ts`)가 자신이 SoT 로 지목한 `user-guide-evidence.md` 에 아직 등재되지 않았다**
  - target 위치: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)") · §2.1 관계표
    · frontmatter `code:` 리스트
  - 위반 규약: 없음 자체가 위반은 아니고, **현재 코드-문서 drift** — 새 가드 코드
    (`codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` ·
    `guide-error-code-existence.test.ts`)의 주석·plan 문서가 "`user-guide-evidence.md` 의 가드
    가족에 합류" 라고 명시적으로 주장하는데, 그 문서 자체는 여전히 "가드 3건" 이라고 세고
    frontmatter `code:` 에도 두 파일이 없다.
  - 상세: `spec/` 는 developer 쓰기 범위 밖이라 이 PR 은 등재를 못 한다. developer 는 이를
    인지하고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`user-guide-
    evidence.md §2.1` 관계표에 새 가드가 빠져 있다 (planner, 2026-09-13 등재)" 항목을 정확히
    남겼다 — 자기 진단이 맞고 처리도 governance 경계를 지켰다. `error-codes.md` 에 등재하지
    않기로 한 판단(그 문서가 소유 범위를 명명원칙/rename/historical-artifact 로 스스로 못박음)
    도 `error-codes.md` Overview 의 책임 분리 원칙과 정확히 일치한다.
  - 제안: 이미 planner 백로그에 등재됨. planner 턴에서 §2 가드 카운트를 4건으로, §2.1 관계표에
    행 추가(자매 `impl-anchor-existence` 와 방향 동일·표면 다름 — 에러 코드 토큰 vs `<ImplAnchor>`
    symbol).

## 명명·API 문서 규약 관련 — 문제 없음으로 확인된 항목 (참고)

- **`//` vs JSDoc 분리 정확히 적용**: `model-config-response.dto.ts`·`integration-response.dto.ts`
  에서 `latencyMs` 를 제거하며 붙인 정정 경위 서술이 전부 `//` 주석이고 남은 필드의
  `/** */` JSDoc 을 건드리지 않았다 — `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다 — 내부
  서사를 담지 않는다", 2026-09-05 규약화)를 정확히 따른다.
- **`<ImplAnchor kind="api-endpoint">` 정확한 사용**: `models.mdx`/`models.en.mdx` 에 추가된
  anchor 의 `file`/`symbol`(`llm-model-config.controller.ts` / `testConnection`)이 실제 컨트롤러의
  `@Post(':id/test')` 핸들러와 일치하고, `describes` 의 `POST /api/model-configs/:id/test` 도
  경로가 맞다 (`user-guide-evidence.md §1.1/§1.2` 요구사항 충족). 컴포넌트는 `mdx-components.tsx`
  전역 등록이라 별도 import 도 불필요 — 형제 페이지(`telegram.mdx`)와 동일 패턴.
- **로케일 쌍 동반 갱신**: `integrations{,.en}.mdx`·`error-handling{,.en}.mdx`·
  `run-results{,.en}.mdx`·`models{,.en}.mdx` 4쌍이 전부 함께, 동일 내용으로 갱신됐다 —
  `i18n-userguide.md` 의 로케일 쌍 컨벤션 위반 없음.
- **가이드에 등장한 신규 에러 코드가 전부 카탈로그와 일치**: `run-results.mdx`/`error-handling.mdx`
  가 새로 인용한 `HTTP_TRANSPORT_FAILED`·`HTTP_4XX`·`HTTP_5XX`·`HTTP_BLOCKED`·`DB_QUERY_FAILED`·
  `DB_CONNECTION_ERROR`·`DB_CONSTRAINT_VIOLATION`·`DB_PERMISSION_DENIED`·`EMAIL_SEND_FAILED`·
  `LLM_CALL_FAILED`·`LLM_RATE_LIMIT`·`LLM_RESPONSE_INVALID`·`LLM_TIMEOUT`·`CODE_EXECUTION_FAILED`·
  `CODE_TIMEOUT`·`CODE_MEMORY_LIMIT`·`SUB_WORKFLOW_FAILED`·`SUB_WORKFLOW_NOT_FOUND`·
  `SUB_WORKFLOW_TIMEOUT` 은 전부 `3-error-handling.md §1.4` 카탈로그에 이미 UPPER_SNAKE_CASE 로
  등재돼 있다(직접 대조 완료) — 제거된 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR` 도 같은 §1.4
  가 "더 이상 사용하지 않는다" 고 명시한 은퇴 코드와 정확히 일치.
- **가이드의 8갈래 문장이 SoT 코드와 문자 그대로 일치**: `models{,.en}.mdx` 표의 8행이
  `sanitize-error.util.ts` 의 `sanitizeLlmErrorMessage` 8개 반환 문자열과 정확히 같다(직접 대조).
- **DTO 필드 제거가 `swagger.md §5-1` 취지와 부합**: `latencyMs` 는 실측(발행 0건)으로 OpenAPI
  거짓 광고였고, 제거 커밋 메시지·주석이 "선언 vs 선언" 정적 가드(`swagger-dto-contract`)의
  사각지대(선언은 있는데 발행이 없는 방향)를 정확히 설명한다 — 규약이 지목한 검증 층 분리
  (`swagger.md §5-1` 인용문)와 일치.

## 요약

이번 diff(17파일/936줄)는 spec/conventions 규약을 신규로 위반하지 않았다. 오히려 §3 의
JSDoc/`//` 분리, `<ImplAnchor>` 사용법, 로케일 쌍 동반 갱신, 에러 코드 카탈로그 대조 등 여러
규약을 정확하게 지켰고, 규약 문서를 직접 고쳐야 하는 3건(§1 LLM/통합 카탈로그 공백·
`testConnection` shape 미문서·`user-guide-evidence.md` 가드 카운트)은 developer 가 자기
쓰기 권한 밖임을 인지하고 정확히 planner 백로그로 위임했다 — 이는 governance 경계를 지킨
올바른 처리이지 위반이 아니다. 다만 세 항목 모두 **현재 시점에는 여전히 열려 있는 spec 공백**
이므로, 다음 사람이 같은 자리에서 또 지어낼 위험이 남아 있다는 뜻에서 WARNING 으로 유지한다
(모두 CRITICAL 급 invariant 파괴 아님 — 이미 구현·가이드는 실측된 진실을 반영하고 있고, 공백은
spec 문서 쪽에만 있다).

## 위험도

LOW
