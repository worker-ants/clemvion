# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 검토 방법

target 은 spec 문서 자체가 아니라 4개 spec 문서(`0-common.md`·`1-http-request.md`·`2-database-query.md`·`2-navigation/4-integration.md`)에 반영할 **사실 정정안**을 담은 `spec-draft-*` 플랜이다. `spec/conventions/**` 번들의 대부분이 컨텍스트 예산 초과로 절단돼 있어, 이 draft 와 실제로 맞닿는 두 규약(`error-codes.md`, `spec-impl-evidence.md`, `review-citations.md`)은 저장소에서 직접 읽었다. 아울러 draft 가 인용하는 4개 대상 spec 파일의 실제 절(§4/§4.2/§6/§6.2/§5.3/§5.9/§14.1)과 근거로 든 backend 코드(`http-redirect.ts`, `http-request.handler.ts`)를 직접 열어 draft 의 변경 위치·서술이 그 문서의 기존 표 구조·컬럼과 맞는지 대조했다.

## 발견사항

- **[WARNING]** `1-http-request.md` 안에서 같은 트리거가 두 곳에 나뉘어 있는데 draft 는 한 곳만 고친다
  - target 위치: draft "### ② «가드의 고장» 트리거 — 세 자리" 중 `1-http-request.md` 항목
  - 위반 규약: 직접적인 조항 위반은 아니고, `spec/conventions/node-output.md` Principle 3(에러 컨트랙트 통일)·`error-codes.md` §1(의미 기반 명명)이 전제하는 "코드의 조건은 spec 본문이 SoT" 원칙에 비춘 **문서 내부 정합성** 문제
  - 상세: `1-http-request.md` 는 `INTEGRATION_CALL_FAILED` 트리거를 두 표에서 다룬다 — §4.2 "Usage 로깅 매트릭스"(draft 가 새 행을 추가하는 곳)와 §6 "에러 코드"(`output.error.code` enum 카탈로그, draft 가 손대지 않는 곳). §6 의 `INTEGRATION_*` 행은 현재 `INTEGRATION_CALL_FAILED` 의 트리거를 "integrationId 부재 — `requireEntity` `RESOURCE_NOT_FOUND` fallback" 한 예시로만 괄호에 적어 두었다. draft 를 적용하면 §4.2 에는 "SSRF 가드의 고장" 이라는 새 트리거가 명시되는데 §6 은 그대로 남아, 같은 코드의 같은 파일 안에서 두 표가 다른 그림을 보여주게 된다. (대조: `2-database-query.md` 는 Usage/런타임 표가 §6.2 하나뿐이라 draft 의 그 항목은 이 문제가 없다 — `1-http-request.md` 만 §4.2/§6 분리 구조라 생기는 비대칭)
  - 제안: §6 의 `INTEGRATION_CALL_FAILED` 괄호에도 "(또는 SSRF 가드가 판정 아닌 오류를 던진 경우)" 를 함께 추가하거나, §6 행이 "모두 본 경로로 surface" 라는 포괄 서술이라 예시 나열이 애초에 완전성을 주장하지 않는다는 점을 Rationale 에 한 줄 남겨 §4.2/§6 비대칭이 의도임을 명시. 둘 중 하나만 해도 다음 사람이 §6 을 SoT 로 오독해 트리거 목록이 최신이라고 오해하는 것을 막는다.

## 점검했으나 위반이 없었던 항목 (근거 포함)

- **명명 규약**: draft 가 언급/추가하는 코드(`INTEGRATION_CALL_FAILED`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`·`CAFE24_INSUFFICIENT_SCOPE`·`MAKESHOP_AUTH_FAILED`)는 전부 기존에 이미 발행 중인 코드이고 전부 `UPPER_SNAKE_CASE` + 도메인 prefix(`error-codes.md` §1)를 따른다. **새 코드 신설이 없다** — draft 스스로 "새 코드를 만들지 않는다" 고 명시하고, 실제로 표 안에서도 신설 없이 기존 코드의 조건·범위만 넓혀 적는다. `error-codes.md` §2(rename 은 breaking, 신설로 처리)의 rename 금지 원칙도 어기지 않는다(이름을 그대로 두고 의미 서술만 보강).
- **출력 포맷 규약**: §4.2(Usage 매트릭스)·§6.2(런타임 에러)·§14.1(vocabulary) 표에 추가하는 행/구는 모두 그 표의 기존 컬럼 구조(`조건 | status | error.code`, `코드 | 조건 | 드라이버 힌트`, `코드 | 원인 | 영향`)를 그대로 따른다. `IntegrationTestResult.code` 를 노드 `output.error.code` 와 "별개 namespace" 로 다루면서도 같은 값을 공유하는 서술(item③)은 이미 그 문서가 `HTTP_BLOCKED`/`DB_HOST_BLOCKED` 에 대해 쓰던 것과 같은 패턴("노드는 error 포트 / 연결 테스트는 result.code")이라 선례와 정합적이다.
- **문서 구조 규약**: 4개 대상 spec 은 모두 `spec-impl-evidence.md` §1 적용 대상(`spec/4-nodes/**`, `spec/2-navigation/**`)이고 이미 `id`/`status: implemented`/`code:` frontmatter 를 갖췄다 — draft 가 이 lifecycle 을 바꾸지 않는다(구현 상태 변경이 아니라 문서 정정이므로 `status` 변경 불필요, 타당). item① 이 `1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` 를 명시 경로로 추가하는 것은 §2.1 "code: string[] (glob 허용)" 규칙과 R-1(글로브·명시 파일 둘 다 허용)에 부합하며, 실제로 그 파일이 존재하고 `followRedirectsSafely`/`outboundBlockReason` 을 export 함을 확인했다. 인라인 YAML 주석(`# 추가 — §4 step 9`)도 2026-09-06 파서 수정 이후 안전하다(`spec-impl-evidence.md` §2.1 정정 문단).
  - draft 자신의 파일명(`plan/in-progress/spec-draft-integration-error-facts.md`)·frontmatter(`worktree`/`started`/`owner`/`spec_impact` 실재 경로 리스트)도 `project-planner/SKILL.md`("`plan/in-progress/spec-draft-<name>.md` … 본문 끝 `## Rationale`")·`plan-lifecycle.md` §4 스키마를 그대로 따른다.
- **API 문서 규약**: 이 draft 는 Controller/DTO/OpenAPI 데코레이터를 전혀 건드리지 않는다(순수 spec 문서 사실 정정) — 해당 없음.
- **금지 항목**: `review-citations.md` §3 은 `plan/**` 문서를 인용 규약 적용 대상에서 명시적으로 제외한다 — draft 의 "근거" 컬럼 bare 시각이 아니라 이미 전체 경로+라운드 형식이라 문제 없고, 애초에 이 규약의 적용 대상도 아니다. draft 가 실제로 4개 spec 문서에 심으려는 신규 산문에는 리뷰 인용을 넣지 않는다(사실 서술만) — `spec/**` 인용 규약(§2 bare 금지)도 침범하지 않는다.

## 요약

target 은 이미 발행 중인 코드의 트리거 조건을 정확히 하는 사실 정정 draft이며, 인용하는 backend 근거(`http-redirect.ts` export, `http-request.handler.ts` 의 `SsrfBlockedError` 분기, `2-database-query.md` §6.2/Rationale 의 `DB_HOST_BLOCKED` 신설 배경, `5-makeshop.md` 의 403 처리 실측)를 직접 대조한 결과 모두 사실과 일치했다. 명명·표 구조·frontmatter·plan 파일명 규약 어디에도 직접 위반은 없고, 유일한 흠은 `1-http-request.md` 내부에서 같은 트리거를 다루는 두 표(§4.2/§6) 중 draft 가 하나만 갱신해 반영 후 그 문서 안에서 완전성이 갈릴 수 있다는 점이다 — 이는 규약 위반이라기보다 draft 범위의 사각지대이며, 반영 시 한두 문장으로 쉽게 닫을 수 있다.

## 위험도

LOW
