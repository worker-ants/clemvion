# 요구사항(Requirement) 충족 리뷰

## 검토 범위

핵심 변경(28개 파일 중 실질 코드/문서 변경분 21개)을 소스 파일 직접 열람으로 전수 확인했다
(diff 가 절단된 파일 3·18·19·22·23 은 `Read` 로 원본 대조). 나머지(review/consistency 산출물
24~56)는 이전 세션(10_12_19, 01_15_40, 10_12_54)의 리뷰 보고서가 이번 커밋에 함께 포함된
것으로, 본 리뷰의 점검 대상인 "기능 구현" 자체가 아니라 그 구현에 대한 메타 기록이라 요구사항
충족 관점에서 별도 분석하지 않았다(내용은 훑었고 새 결함은 없었다).

핵심 변경 두 갈래:
- **(A) `POST /api/model-configs/:id/test` 필드명 3중 불일치 수정** — 서비스 `error`→`message`,
  DTO `latencyMs` 제거, `assertMatchesContract` 배선(서비스 단위 + 컨트롤러 HTTP 왕복), FE 실패
  토스트 테스트 신설.
- **(B) 유저 가이드 에러 코드 진위 정정 + `guide-error-code-existence` 가드 신설** — 존재하지
  않는/은퇴한/지어낸 코드 5종 정정, backend·packages 소스 대조 가드 추가.

## 발견사항

- **[INFO]** `ModelTestConnectionResultDto.message`가 `nullable: true`로 선언돼 있으나 서비스는
  `message`를 절대 `null`로 채우지 않는다(부재 아니면 문자열)
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:57`
  - 상세: `assertMatchesContract`의 판정표상 "required 아님 + nullable도 선언"은 위반이 아니라 §5.4
    범위 밖으로 명시돼 있어 이 자체는 계약 위반이 아니다. 다만 실제로 `null`이 나갈 경로가
    없으므로 `nullable: true`는 불필요하게 넓은 선언이다. 이번 diff 가 해당 줄을 건드리지
    않았고(파일 6 의 diff 는 `latencyMs` 제거만) 이번 PR 이 만든 결함이 아니라 기존 상태 유지다.
  - 제안: 블로킹 아님. 후속으로 `nullable` 제거를 검토할 수 있으나 이번 배치 스코프 밖.

- **[INFO]** 유저 가이드 새 문장표(`models{,.en}.mdx` 8갈래)가 SoT 문자열 추출 방식(정규식
  `return\s+'([^']+)'\s*;`)에 의존하는데, 이 추출은 `guide-sanitized-message-parity.test.ts` 자체가
  vacuity floor(길이 8 단언)로 방어하고 있어 실무상 위험은 낮음 — 다만 향후 `sanitize-error.util.ts`
  가 템플릿 리터럴이나 다중 `return` 경로로 리팩터되면(예: 조건 분기 재구성) 조용히 8개 미만을
  추출하고 vacuity floor 가 먼저 잡아 RED 가 뜨는 설계이므로 실패 방향이 안전함을 확인했다.
  실제 결함 아님, 참고 기록.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:32-34`

- **[SPEC-DRIFT]** `spec/2-navigation/6-config.md §3`(및 `spec/5-system/7-llm-client.md`)이
  `POST /api/model-configs/:id/test`의 **실패** 응답 shape(`{ success:false, message }`)을
  문서화하지 않는다 — 성공 케이스(`{ success }` / `{ success, dimension? }`)만 표에 있다
  (`spec/2-navigation/6-config.md:281`). 코드는 이미 `message` 필드로 정정됐고(이번 PR 의 핵심
  수정), 이 필드명이 spec 미문서 상태였던 것이 애초에 `LLM_AUTH_ERROR` 등 가짜 에러 코드를
  가이드가 지어낸 근본 원인(앵커 부재)이었다는 것이 plan 문서 자체의 분석이다. 즉 코드가
  맞고(런타임 계약 테스트로 고정됨) spec 표만 뒤처진 상태다.
  - 위치: `spec/2-navigation/6-config.md` §3 표 (281행 부근) — `message` 실패 필드 행 부재
  - 상세: 이 갭은 이미 `developer`가 `plan/in-progress/spec-draft-nullable-notation-followups.md`에
    "testConnection 실패 응답 shape 이 어느 spec 표에도 없다 (planner, 2026-09-13 등재)" 항목으로
    올바르게 등재했다(developer 는 spec 쓰기 권한이 없어 직접 반영 불가). 절차상 올바르게
    처리됐으므로 이번 PR 을 블로킹할 사유는 아니다.
  - 제안: 코드 유지. planner 턴에서 `spec/2-navigation/6-config.md §3` 표(또는
    `spec/5-system/7-llm-client.md` §5.6 부근)에 실패 shape(`{ success:false, message }`, `message`
    는 `sanitizeLlmErrorMessage` 8갈래 고정 문장 SoT)을 반영할 것.

- **[INFO]** `guide-error-code-scan.ts`의 실패 문맥 판정(`CODE_CONTEXT` 정규식)은 실패 어휘가
  전혀 없는 산문 줄에 코드를 적으면 여전히 놓친다 — 스캐너 자신의 주석(§16-40)과 plan 문서(§D)가
  이 한계를 **의도적 설계**로 명시하고 있고(허용목록보다 미검출 방향을 택함), 대조군 테스트로
  경계를 고정해 뒀다(`guide-error-code-existence.test.ts:121-127`, `:172-181`). 결함이 아니라
  기록된 트레이드오프.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:80-84`

## 실측 검증 결과 (교차 확인)

다음 주장들을 소스에서 직접 grep/Read 로 재확인했고 전부 사실과 일치했다:

- `LlmService.testConnection` 반환 타입·구현이 `error`→`message`로 일관되게 변경됨
  (`llm.service.ts:326,354`). JSDoc `@returns` 서술이 실제 분기(성공/embedding dimension 감지/실패)와
  정확히 일치.
- `ModelTestConnectionResultDto`/`TestConnectionResultDto` 양쪽에서 `latencyMs` 제거 —
  저장소 전수 검색 결과 두 필드 모두 생산자 0건이었다는 주석 주장과 일치(다른 발행처 없음).
- `IntegrationTestResult` 인터페이스에 실제로 `code?: string`이 있고
  (`integrations.service.ts:79`), `TestConnectionResultDto`에 새로 `code?: string`을 추가해 이전
  세션(10_12_19) api_contract.md WARNING#3(이번 PR 에 포함되어 커밋됨)이 지적한 미선언 갭을
  실제로 메웠음을 확인. 남은 `capabilities`/`serverInfo`/`preview` 3필드는 별도 트래커
  (`spec-draft-nullable-notation-followups.md:3243-3257`)에 정확히 등재돼 있음.
- `frontend/src/components/models/model-config-manager.tsx:82-83`가 이미 `result.message ?? ""`를
  읽고 있어 CHANGELOG의 "프런트엔드는 이미 message 를 읽고 있었다" 주장과 일치. i18n 키
  `models.connectionFailed` = `"Connection failed: {{error}}"` (en) 확인, 신규 테스트의 정확
  문자열 단언과 부합.
- 은퇴 코드 `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`, 지어낸 코드 `MAKESHOP_API_ERROR`,
  로드맵 전용 `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` — backend·packages 소스 전체에서 grep 0건
  확인(실재하지 않음이 사실). 반면 가이드가 새로 인용한 코드들
  (`MAKESHOP_404/422/4XX/5XX/AUTH_FAILED/RATE_LIMITED/TRANSPORT_FAILED`,
  `HTTP_TRANSPORT_FAILED/4XX/5XX/BLOCKED`, `DB_QUERY_FAILED/CONNECTION_ERROR/CONSTRAINT_VIOLATION/
  PERMISSION_DENIED`, `EMAIL_SEND_FAILED`, `LLM_CALL_FAILED/RATE_LIMIT/RESPONSE_INVALID/TIMEOUT`,
  `CODE_EXECUTION_FAILED/TIMEOUT/MEMORY_LIMIT`, `SUB_WORKFLOW_FAILED/NOT_FOUND/TIMEOUT`,
  `nodeLabel`)는 전부 backend 소스에 실재함을 확인. `nodeName`은 저장소 전체에서 0건(리네임
  완료 확인).
- `spec/5-system/3-error-handling.md:143`의 은퇴 코드 문구, `spec/2-navigation/4-integration.md`
  §9.1의 `{success, code, message}` shape·`INTEGRATION_INCOMPLETE` 서술이 코드 주석의 인용과
  글자 단위로 일치.
- `sanitize-error.util.ts`의 8개 `return '...'` 리터럴이 `models{,.en}.mdx` 신규 표의 8행과
  정확히 일치(수기 대조 + 신설 parity 테스트로 이중 확인).
- `ImplAnchor` 컴포넌트 props(`kind`/`file`/`symbol`/`describes`)와 `models{,.en}.mdx`의 신규
  `<ImplAnchor kind="api-endpoint" .../>` 사용이 타입·기존 `impl-anchor-existence.test.ts`의
  api-endpoint 분기 판정 로직(경로 trailing segment 매칭) 양쪽과 정합 — 실제로 그 분기를
  처음으로 실콘텐츠가 태우게 됨을 확인(주석 갱신이 정확함).
- 신설 컨트롤러 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)는 실제 `LlmService`를
  DI하고 의존성만 mock해 필드명 축에서 vacuous 하지 않도록 설계돼 있으며, 성공/실패 양쪽 키
  전수 비교(`Object.keys(...).sort()`) 대조군까지 갖춰 "선언은 됐는데 값이 비는" 회귀와 "선언
  누락" 회귀 양쪽을 구분해서 잡는 구조를 실제로 확인.

## TODO/FIXME 등

변경 파일 전체(핵심 12개 소스/테스트 파일)에서 `TODO`/`FIXME`/`HACK`/`XXX` 문자열 0건.

## 반환값·엣지 케이스

- `testConnection`의 세 분기(성공/embedding dimension 감지/실패) 모두 명시적 반환값을 갖고,
  `dimension` 0/빈 배열 엣지 케이스가 JSDoc·구현·기존 테스트(파일 목록엔 없으나 unchanged 기존
  스펙)에서 일관되게 "생략" 처리됨을 코드에서 확인.
- 신규 FE 대조군 테스트(`model-config-manager.test.tsx`)가 "사유 필드가 아예 없는 경우"까지
  커버해 `result.message ?? ""` 빈 문자열 폴백의 엣지 케이스를 양성으로 고정.

## 요약

이번 PR 은 실제 프로덕션 결함(연결 테스트 실패 사유가 3층 필드명 불일치로 화면에 전혀 도달하지
않던 문제)을 서비스·DTO·프런트 세 층 모두에서 일관되게 고쳤고, 그 회귀를 막을 런타임 계약 검사
(`assertMatchesContract`)를 서비스 단위 + 컨트롤러 HTTP 왕복 두 층에 배선해 값-vs-선언 불일치를
구조적으로 재발 방지했다. 함께 처리된 유저 가이드 에러 코드 진위 정정(지어낸/은퇴한/로드맵 전용
5종)도 backend·packages 소스 대조로 전수 실측했고, 신규 가드(`guide-error-code-existence`)가
동일 결함 클래스의 재발을 build-time 에 차단하도록 설계돼 있다(3축 판정, 베이스라인 0, 대조군
fixture 로 각 판정 축의 채택/기각 근거를 코드로 고정). 모든 핵심 주장(필드 실재 여부, 은퇴 선언,
spec 인용, DTO 필드 발행 여부, i18n 문자열, ImplAnchor 검증 로직)을 소스 직접 열람으로 교차
검증했으며 사실과 다른 서술을 찾지 못했다. 유일한 spec 갭(`testConnection` 실패 응답 shape 미문서화)은
developer 권한 밖의 사안으로 이미 planner 백로그에 정확한 근거와 함께 등재돼 있어 절차상 문제가
없다(SPEC-DRIFT, 코드는 맞고 spec 표만 반영 대기 상태). Critical 은 발견하지 못했다.

## 위험도

NONE
