# 정식 규약 준수 검토 — convention_compliance

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/**` 델타: 0 (이번 브랜치는 그 영역을 바꾸지 않음 — 정상)
- 실제 구현 diff: `codebase/**` 21개 파일 (`llm.service.ts`, 두 자매 DTO
  `ModelTestConnectionResultDto`/`TestConnectionResultDto`, 유저 가이드 mdx 8개(ko/en),
  신규 가드 3개 `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`/
  `guide-sanitized-message-parity.test.ts`, 테스트 픽스처 다수) — `git diff origin/main...HEAD --
  codebase/` 로 절대경로 워킹트리에서 직접 확인.
- 대조한 정식 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md` §3.2,
  `spec/conventions/swagger.md` §3·§5·§6, `spec/conventions/user-guide-evidence.md`,
  `spec/5-system/3-error-handling.md` §1.4·§2.2(카탈로그/응답 형식, SoT).
- 이 라운드는 직전 라운드(`review/code/2026/09/13/11_07_36`,
  `review/consistency/2026/09/13/11_08_03`)가 지적한 5종 누락 코드 보강 등 "라운드 3" 수정
  (커밋 `137784219`)을 검증 대상으로 한다. 신규 가드 2건(`guide-error-code-existence.test.ts`,
  `guide-sanitized-message-parity.test.ts`)을 실행해 GREEN(21/21) 확인.

## 발견사항

- **[INFO] `user-guide-evidence.md §2` "가드 3건" 서술이 코드 대비 낡음 (기존 이슈, 신규 아님)**
  - target 위치: 없음 — 이번 diff 는 `spec/**` 를 건드리지 않음(코드 21개 파일만)
  - 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" · §2.1
    관계표
  - 상세: 이번 배치가 `codebase/frontend/src/lib/docs/__tests__/`에 신규 가드
    `guide-error-code-scan.ts`(순수 스캐너)·`guide-error-code-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 3개를 추가했는데, 그 컨벤션 문서의 "가드 3건"
    서술과 §2.1 관계표·frontmatter `code:` 목록은 여전히 이전 상태(3건)를 말한다. developer
    는 `spec/**` 쓰기 권한이 없어 (CLAUDE.md 역할 경계) 이 갱신을 스스로 할 수 없고, 대신
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (line ~3243)에 정확한 파일
    3종·필요한 §2/§2.1/frontmatter 갱신 내용을 명시해 planner 항목으로 등재해 두었다. 등재
    내용을 실측 대조한 결과 누락·왜곡 없음.
  - 제안: 코드 수정이 아니라 규약 갱신이 적절한 사안 — 다음 `project-planner` 턴에서
    `user-guide-evidence.md` §2/§2.1/frontmatter 를 3건→5건으로 갱신. 이미 정확히 등재돼
    있으므로 이번 라운드에서 추가 조치 불요.

- **[INFO] `TestConnectionResultDto.code` 가 열린 `string` 타입 (enum 미선언)**
  - target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    `TestConnectionResultDto.code`
  - 위반 규약: 없음 — `spec/conventions/swagger.md` §5-1 "형제 DTO 가 같은 enum 을 공유하면
    `*.literal.ts` 로 뺀다" 는 **닫힌 값 집합**을 여러 DTO 가 공유할 때만 적용되는 규칙이고,
    `code` 는 JSDoc 이 명시하듯 `MCP_*`(prefix 계열) · `EMAIL_CONNECT_FAILED` ·
    `INTEGRATION_INCOMPLETE` 등 열린 집합이라 이 규칙 대상이 아니다. `AuditLog.action` 이
    같은 이유로 열린 문자열 컬럼으로 유지되는 선례(§4.1 read-side 계약)와 동형.
  - 상세: 위반은 아니지만, MCP 전용 필드 3종(`capabilities`/`serverInfo`/`preview`) 미선언과
    함께 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 개발 백로그로
    등재돼 있어 향후 그 작업과 함께 `code` 도메인을 문서화할 여지가 있다는 점만 참고로 남긴다.
  - 제안: 조치 불요 (참고용).

## 검증한 준수 사항 (근거)

- **에러 코드 명명**: mdx 가이드가 신규로 인용한 모든 코드(`MAKESHOP_404` 등 MakeShop 7종 +
  4종 pre-flight 종, `HTTP_TRANSPORT_FAILED`/`HTTP_4XX`/`HTTP_5XX`/`HTTP_BLOCKED`,
  `DB_QUERY_FAILED`/`DB_CONNECTION_ERROR`/`DB_CONSTRAINT_VIOLATION`/`DB_PERMISSION_DENIED`/
  `DB_HOST_BLOCKED`, `EMAIL_SEND_FAILED`/`EMAIL_HOST_BLOCKED`, `LLM_CALL_FAILED`/
  `LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID`/`LLM_TIMEOUT`/`MAX_COLLECTION_RETRIES_EXCEEDED`,
  `CODE_EXECUTION_FAILED`/`CODE_TIMEOUT`/`CODE_MEMORY_LIMIT`, `SUB_WORKFLOW_*`/
  `WORKFLOW_FORBIDDEN_WORKSPACE`)는 `UPPER_SNAKE_CASE`(`error-codes.md §1`)이며, 카테고리별
  표는 `spec/5-system/3-error-handling.md §1.4` 카탈로그와 **행 단위로 정확히 일치**한다(직접
  대조). `git grep` 로 MakeShop pre-flight 4종(`MAKESHOP_UNKNOWN_OPERATION` 등)의 backend
  발행처 실존도 확인.
- **`nodeLabel` vs `nodeName`**: run-results/error-handling 의 ko/en 4파일 모두 예시 JSON 이
  `nodeLabel` 을 쓰고, 이는 `3-error-handling.md §2.2`(2026-08-17 정정)와 정확히 일치.
- **은퇴 코드 미사용**: `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR` 예시가 `LLM_TIMEOUT` 으로
  치환됐고, 대표 코드 단일 행 대신 카테고리별 표로 바뀐 구조가 `error-codes.md §2`(rename 대신
  새 코드 신설 원칙) 및 `3-error-handling.md §1.4` 의 "구 코드 더 이상 사용 안 함" 서술과 부합.
- **API 문서(swagger) 데코레이터**: `TestConnectionResultDto`/`ModelTestConnectionResultDto`
  두 DTO 모두 내부 서사(경위·근거)는 `//` 라인 주석으로, 사용자 대상 설명만 JSDoc `/** */`
  에 두고 있어 `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다")를
  준수. 라운드 2 리뷰가 지적했던 `code` JSDoc 의 자기모순은 이번 상태에서 이미 해소돼 있음
  (재확인, 신규 회귀 없음).
- **DTO 클래스명 유일성**: `TestConnectionResultDto`(integrations) vs
  `ModelTestConnectionResultDto`(model-config) — 서로 다른 이름으로 `swagger.md §5-1` 클래스명
  충돌 규칙 준수.
- **i18n 로케일 짝**: `models{,.en}.mdx`, `integrations{,.en}.mdx`,
  `run-results{,.en}.mdx`, `error-handling{,.en}.mdx` 4쌍 모두 구조·표·`<ImplAnchor>`/
  `<Callout>` 사용이 ko/en 대칭으로 갱신됨.
- **가드 배치 위치**: 신규 가드 3개가 기존 가드 가족과 같은 디렉터리
  (`codebase/frontend/src/lib/docs/__tests__/`)에 위치 — `user-guide-evidence.md §2` 의 위치
  관례 준수. 실행 확인: `npx vitest run guide-error-code-existence.test.ts
  guide-sanitized-message-parity.test.ts` → 21/21 PASS.
- **금지 항목**: `spec/5-system/3-error-handling.md` 가 명시적으로 폐기한
  `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 를 신규 코드 어디에도 재사용하지
  않음. `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`(Planned 로드맵 이름, `7-llm-client.md §6`)도
  "현재 동작" 서술에서 제거돼 Planned-as-current 서술 금지 원칙을 지킴.

## 요약

이번 diff(라운드 3 수정분)는 `spec/5-system/3-error-handling.md` §1.4 카탈로그·§2.2 응답
형식, `spec/conventions/error-codes.md`(명명)·`node-output.md`(§3.2 코드 카테고리)·
`swagger.md`(§3 JSDoc 분리·§5-1 클래스명 유일성) 과 검증 가능한 수준에서 정확히 일치한다.
유일하게 남는 것은 `spec/conventions/user-guide-evidence.md`의 가드 가족 서술(3건→5건)이
코드보다 뒤처진 상태인데, 이는 developer 권한 밖(spec/** 쓰기 금지) 사안이라 정확한 내용으로
`plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 이미 등재돼
있어 규약 위반이 아니라 규약 갱신 대기 상태로 분류한다. 신규 Critical/Warning 은 발견되지
않았다.

## 위험도

NONE
