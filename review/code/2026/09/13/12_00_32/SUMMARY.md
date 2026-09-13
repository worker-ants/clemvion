# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 0건. WARNING 3건(형제 엔드포인트 `code` 필드 계약 갭·MakeShop 콜아웃 메시지 SoT 패리티 가드 부재·CHANGELOG 최신화 지연) 모두 회귀 유발형이 아니라 "이미 고친 결함 클래스의 잔여 사각지대" 성격이며, 14개 reviewer(강제 7명 포함) 전원 결과 확보 완료 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | 이 PR 이 고친 "생산자는 있는데 DTO 선언이 없다" 결함 클래스가 형제 엔드포인트 `POST /api/integrations/preview-test` 에 그대로 남아 있다 — `dispatchTest`/`testEmailTransport`/`testMcpTransport` 가 `code`(`EMAIL_HOST_BLOCKED`/`EMAIL_CONNECT_FAILED`/`MCP_*`)를 싣는데 `PreviewTestResultDto` 는 여전히 `code` 를 선언하지 않는다. spec(`§9.1`,`§5.5`)도 이미 이를 전제한다 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`PreviewTestResultDto`), 생산 쪽 `integrations.service.ts` (`dispatchTest`/`testEmailTransport`/`testMcpTransport`) | `PreviewTestResultDto` 에 `code?: string`(같은 JSDoc) 추가 + `integrations.service.spec.ts` 의 `previewTest()` 실패 케이스에 `assertMatchesContract` 배선. 이번 PR 범위 밖이면 최소한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재 |
| 2 | testing | MakeShop "미해결 경로변수" `<Callout>` 문구(`MAKESHOP_UNRESOLVED_PATH_PARAM: operation '...' has unresolved path placeholder(s): ...`)가 `makeshop.handler.ts` 템플릿 리터럴을 손으로 옮긴 것인데, 이를 대조하는 SoT-패리티 가드가 없다 — 같은 PR 이 LLM 8갈래 문장표에는 정확히 이 위험을 막는 `guide-sanitized-message-parity.test.ts` 를 만들었지만 MakeShop 쪽엔 적용하지 않았고, 기존 `guide-error-code-existence.test.ts` 는 토큰 **존재**만 보므로(방출 위치 무관) 이 gap 을 못 잡는다 | `codebase/frontend/src/content/docs/02-nodes/integrations{,.en}.mdx` (Callout), SoT `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:436` | `guide-sanitized-message-parity.test.ts` 패턴을 확장해 MakeShop 템플릿 접두를 소스에서 추출·대조하는 소규모 가드 추가. 최소한 `guide-error-code-scan.ts` 상단 "이 가드가 못 보는 것" 표에 이 gap 이 여전히 열려 있음을 명시 |
| 3 | documentation | `CHANGELOG.md` 가 라운드 0 시점에 멈춰 있다 — 이 PR 이 라운드 1 에서 신설한 `guide-sanitized-message-parity.test.ts` 가드, 라운드 4 에서 스스로 낸 CRITICAL(`MAKESHOP_UNRESOLVED_PATH_PARAM` 오귀속) 해소, 라운드 3 에서 보강한 SSRF 차단 코드 2종(`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED`) 노출이 CHANGELOG 어디에도 반영되지 않았다. `PROJECT.md`·plan 트래커는 최신 상태와 일치해 대비된다 | `CHANGELOG.md` (Unreleased 섹션, 해당 항목 부재) | (a) `guide-sanitized-message-parity` 가드 한 줄 추가 (b) `guide-error-code-existence` 설명에 "존재≠방출" 캐비엇 병기 (c) 통합 노드 가이드 불릿에 Callout 추가 사실 명시 (d) 실행결과 가이드 불릿에 SSRF 코드 2종 보강 사실 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | "존재 검사 ≠ 완전성/방출 검사" 라는 구조적 결함 클래스가 이 PR 생애주기 안에서 **세 번째**(DTO 유령 필드 → 가이드 표 누락 → 가드 자신의 방출 오판)로 나타남. 세 항목 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 인접 등재돼 있으나 "같은 근본 원인"으로 명시 연결되어 있지는 않음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3305,3318,3336` | 저우선순위: 세 항목 위에 짧은 상호 참조 한 줄 추가 권고(비차단) |
| 2 | security | `testConnection` 실패 사유가 이번 변경으로 처음 화면에 도달하지만, `sanitizeLlmErrorMessage` 확인 결과 provider 원문이 아닌 8갈래 고정 문구로만 귀결 — 정보 노출 아님 | `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`), `utils/sanitize-error.util.ts` | 없음(확인용) |
| 3 | performance | 신규 가드가 매 테스트 실행마다 `backend/src`+`packages` 전체(500+ 파일)를 재귀 스캔 — 현재 규모에서 병목 아님, 자매 가드 누적 시 공유 캐시 고려 여지 | `guide-error-code-existence.test.ts`, `guide-error-code-scan.ts` | 현재 조치 불요, 자매 가드 증가 시 재검토 |
| 4 | api_contract | 신규 `code?: string` 이 자유 문자열로만 선언돼 OpenAPI 상 값 집합(enum) 이 codegen 에 반영되지 않음 | `integration-response.dto.ts` (`TestConnectionResultDto.code`) | `@ApiPropertyOptional({ example: ... })` 추가 고려(선택) |
| 5 | api_contract | 프런트 `integrations.ts` 의 `test`/`previewTest` 타입이 여전히 `{success, message}` 뿐이라 백엔드가 정식 선언한 `code`/`capabilities`/`serverInfo`/`preview` 를 타입 레벨에서 못 받음(PR 범위 밖, 회귀 아님) | `codebase/frontend/src/lib/api/integrations.ts` | 후속 항목으로 기록 권고 |
| 6 | requirement/scope | `spec/conventions/user-guide-evidence.md §2` 의 가드 인벤토리("3건")가 이 PR 이 신설한 가드 2건을 반영 못해 실제(5건)와 어긋남 — developer 권한 밖(spec)이라 이미 planner 턴 항목으로 정확히 등재됨(`spec-draft-nullable-notation-followups.md:3243-3257`) | `spec/conventions/user-guide-evidence.md:68` | 코드 조치 불요, planner 다음 턴에서 해소 예정 |
| 7 | scope | 원 티켓("가이드 에러 코드 5종 정정")이 조사 중 발견한 런타임 계약 결함(3층 필드명 불일치)까지 고치는 방향으로 확장됐으나 CHANGELOG·plan 에 근거와 함께 명시적으로 disclosure 됨 | `plan/in-progress/guide-error-code-truth.md` §A, `CHANGELOG.md` | 없음(스코프 확장이 은폐되지 않음, 조치 불요) |
| 8 | user_guide_sync | Cafe24 twin 케이스(`CAFE24_UNRESOLVED_PATH_PARAM`, MakeShop 과 동형 결함)를 확인했으나 오늘 시점 가이드가 이 토큰을 인용하지 않아 거짓 서술 없음 — 이미 후속 항목으로 정확히 등재됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3346-3350` | 조치 불요, handler 를 고칠 때 함께 처리 예정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. `testConnection` 신규 노출 채널이 고정 문구로만 귀결됨을 확인 |
| performance | NONE | 런타임 경로 영향 없음. 신규 가드의 전체 소스 스캔은 규모상 문제 없음 |
| architecture | LOW | 프로덕션 코드 변경 없음(라운드5는 주석뿐). "존재≠완전성/방출" 결함 클래스 3회째 재발 관찰 |
| requirement | LOW | 3층 필드명 불일치·가이드 에러코드 정정 전부 spec/코드와 행 단위 일치 확인. spec 인벤토리 갱신 지연은 이미 등재됨 |
| scope | LOW | 스코프 확장(문서정정→런타임계약수정) 있으나 전부 disclosure 됨, over-engineering 아님 |
| side_effect | LOW | 필드 rename/DTO 정리의 저장소 내 전 소비처 전수 확인, 숨은 영향 없음 |
| maintainability | NONE | 스타일 수준 INFO만(정규식 길이, DTO 주석 비율) — 기존 관례와 일관 |
| testing | LOW | MakeShop 콜아웃 메시지 SoT 패리티 가드 부재(WARNING). 나머지는 이미 트래킹된 재확인 |
| documentation | LOW | CHANGELOG 가 라운드1·3·4 반영분을 누락(WARNING). 코드/PROJECT.md/plan 문서화 품질은 우수 |
| dependency | NONE | 신규 외부 의존성 없음, 신규 import 전부 기존 내부 모듈/기존 devDependency 재사용 |
| database | NONE | DB 관련 코드 diff 없음(엔티티/마이그레이션/쿼리 0건) |
| concurrency | NONE | 공유 가변 상태·락·async 흐름 변경 없음, 정규식 lastIndex 리셋 등 방어적 패턴 확인 |
| api_contract | LOW | `PreviewTestResultDto` 에 동일 결함 클래스 잔존(WARNING). 나머지는 INFO(enum 미명시 등) |
| user_guide_sync | NONE | 매트릭스 4개 trigger 전부 동일 커밋 체인에서 동반 갱신 확인, 누락 0건 |

## 발견 없는 에이전트

database, concurrency, dependency, maintainability(스타일 INFO만), user_guide_sync

## 권장 조치사항

1. `PreviewTestResultDto` 에 `code?: string` 추가 + `previewTest()` 실패 케이스에 `assertMatchesContract` 배선(또는 최소 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재) — 이 PR 이 이미 고친 결함 클래스의 세 번째 소비자 잔존 (api_contract WARNING#1)
2. MakeShop 콜아웃 메시지 문자열에 `guide-sanitized-message-parity.test.ts` 패턴을 확장 적용하거나, 최소한 가드 주석의 "못 보는 것" 표에 이 gap 을 명시 (testing WARNING#2)
3. `CHANGELOG.md` 를 라운드 1·3·4 반영분(신규 가드 1건, SSRF 코드 2종 보강, CRITICAL 해소 사실)까지 최신화 (documentation WARNING#3)
4. (저우선, 비차단) `code` 필드에 `@ApiPropertyOptional({ example })` 추가 검토, 프런트 `integrations.ts` 타입에 `code` 등 반영은 후속 항목으로 기록

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미제공). 전체 reviewer 14명 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인됨 (강제 화이트리스트 미이행 없음)