# 요구사항(Requirement) 리뷰 — guide-error-code-truth

## 검토 방법

이 PR 은 이미 3회의 `/ai-review` 라운드(`10_12_19`→`10_40_34`→`11_07_36`)와 4회의
`/consistency-check`(`01_15_40`·`10_12_54`·`10_41_13`·`11_08_03`)를 거쳤고, 이번 diff
(`origin/main...HEAD`)는 그 세 라운드의 처분이 전부 반영된 **누적** 상태다(`plan/in-progress/
guide-error-code-truth.md` §G·§H·§I 로 처분 확인). 프롬프트가 절단한 4개 소스 파일
(`llm-model-config.controller.spec.ts`·`guide-error-code-scan.ts`·
`guide-error-code-existence.test.ts`·plan 문서 2건)은 저장소 원본을 직접 `Read` 로 열어
전문을 확인했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short` — 이 산출물 디렉터리만
untracked).

이전 라운드가 이미 지목·처분한 항목을 반복 등재하지 않고, **독립적으로 재실행/재대조**해 남은
결함이 있는지만 본다:

- `guide-error-code-existence.test.ts` + `guide-sanitized-message-parity.test.ts` +
  `impl-anchor-existence.test.ts` (vitest) — **전부 GREEN** (21+243 테스트).
- `llm.service.spec.ts` + `llm-model-config.controller.spec.ts` +
  `integrations.service.spec.ts` (jest) — **전부 GREEN** (193 테스트).
- `swagger-dto-contract.spec.ts` (정적 선언-vs-선언 가드) — **GREEN** (39 테스트, 신규 `code`
  선언·`latencyMs`/`meta` 제거가 다른 정적 계약을 깨지 않음을 확인).
- `sanitize-error.util.ts` 8갈래 반환 문자열을 직접 읽어 `models{,.en}.mdx` 표와 **글자 단위
  수기 대조** — 8/8 일치, 순서도 동일.
- `spec/5-system/3-error-handling.md §1.4` 노드-종류별 카탈로그(HTTP/DB/Email/LLM/Code/
  Sub-workflow)를 `run-results{,.en}.mdx` 신규 표와 **행 단위 수기 대조** — 완전 일치(라운드 3
  이 보강한 5종 포함, `HTTP_TIMEOUT`처럼 spec 이 "미발행" 이라 명시한 코드는 정확히 제외됨).
- `spec/2-navigation/4-integration.md §9.1`·L1272 을 직접 열어 `TestConnectionResultDto.code`
  신규 선언과 대조 — `{success:false, code:'INTEGRATION_INCOMPLETE'}` 문서화와 일치.
- `IntegrationTestResult` 인터페이스(`integrations.service.ts:75-83`)를 직접 열어 DTO 필드
  (`success`/`code`/`message`)와 대조 — 일치. 미선언 `capabilities`/`serverInfo`/`preview`
  (MCP 전용)는 트래커에 별도 등재돼 있음을 확인(`spec-draft-nullable-notation-followups.md:3266`).
- `codebase/backend/src/nodes/integration/makeshop/**` 를 grep 해 `MAKESHOP_404/422/4XX/5XX`
  (상태코드 분기, `makeshop.handler.ts:449-452`)·`AUTH_FAILED`·`RATE_LIMITED`·
  `TRANSPORT_FAILED`·`UNKNOWN_OPERATION`·`MISSING_FIELDS`·`INVALID_SHOP_UID`·
  `UNRESOLVED_PATH_PARAM` 전부 실재 확인 — `integrations{,.en}.mdx` 의 신규 서술과 일치.
- `spec/5-system/7-llm-client.md` "LlmService.testConnection — kind별 probe 전략" 표를
  직접 열어 성공 경로(`{success:true}`, `{success:true,dimension?}`, dimension 0 이면 omit)를
  `llm.service.ts:336-350` 실제 로직과 대조 — 일치(embedding probe 의 `vectors[0]?.length` 0/빈
  배열 처리 포함).
- 프런트엔드 소비처(`model-config-manager.tsx:83`, `result.message ?? ""`)와 i18n 키
  (`models.ts` ko/en `connectionFailed: "연결 실패: {{error}}"` / `"Connection failed: {{error}}"`)
  를 직접 열어 신규 실패 토스트 테스트의 기대 문자열과 대조 — 일치.

## 발견사항

새로 발견한 CRITICAL/WARNING 은 없다.

- **[INFO]** (확인, 신규 아님) `POST /api/model-configs/:id/test` 의 실패 응답 shape 이 여전히
  `spec/5-system/7-llm-client.md` §testConnection 표에 문서화돼 있지 않다
  - 위치: `spec/5-system/7-llm-client.md` (성공 경로만 표에 있음, L441-452) — 파일 미변경
  - 상세: `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 스코프에서 고칠 수 없는 항목이고,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:3225-3241` 에 5개 checker
    전원의 지적으로 이미 정확히 등재돼 있다(코드 위치·형제 엔드포인트와의 차이점까지 명시).
    절차상 올바르게 planner 로 위임됐으므로 이번 PR 을 막을 사유가 아니다.
  - 제안: 없음 (병합 후 planner 턴에서 처리 여부만 추적).

- **[INFO]** (확인, 신규 아님) `guide-error-code-existence` 가드는 "가이드 → 코드" 단방향만
  보고, 반대 방향("코드 → 가이드 누락")은 구조상 못 잡는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`
  - 상세: 이 사각지대가 실제로 라운드 3 에서 발현했었고(신규 노드-종류별 표가 spec §1.4 대비
    5종 누락) 이미 고쳐졌다. 가드 자체를 양방향으로 넓히는 일은
    `spec-draft-nullable-notation-followups.md:3289-3303` 에 developer 명의로 등재돼 있고,
    선행 조사 항목(SoT 파싱 대상이 spec 표라 그대로 미러링하면 오탐 6건 난다는 점)까지
    구체적으로 적혀 있다. 이번 PR 스코프에서 지금 만들 필요는 없다.
  - 제안: 없음 — 백로그 항목이 정상적으로 존재함을 재확인.

## 요약

이 PR 이 고친다고 주장하는 핵심 결함 — `LlmService.testConnection` 이 반환하는 `error` 필드가
선언 DTO·프런트엔드의 `message` 와 어긋나 연결 실패 사유가 화면에 한 글자도 도달하지 않던
버그 — 는 서비스·DTO·프런트엔드 세 레이어 및 신규 `assertMatchesContract` 배선(서비스 단위 +
컨트롤러 HTTP 왕복 양쪽)으로 실측 검증됐고, 직접 재실행한 테스트(vitest 21+243건, jest 193건,
정적 swagger-dto-contract 39건)가 전부 GREEN 이다. 유저 가이드가 적던 존재하지 않는/은퇴한/
지어낸 에러 코드 5종은 각각 backend 소스·spec 카탈로그와 직접 대조해 정정이 정확함을
재확인했고, 신규 회귀 가드(`guide-error-code-existence`, `guide-sanitized-message-parity`)도
합성 대조군을 포함해 실측 GREEN 이다. 남은 두 개 INFO 는 모두 이전 라운드에서 이미 정확한
위치·근거와 함께 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된
기존 백로그 항목의 재확인일 뿐, 이번 PR 을 막을 새로운 결함이 아니다.

## 위험도

NONE
