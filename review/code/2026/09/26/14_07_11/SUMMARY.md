# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(CHANGELOG 경로 표기 불일치, 코드 결함 아님). 14개 reviewer(강제 7 + 통상 7) 전원 정상 실행·전문 확보, 누락 없음. forced(router_safety) 7명 전원 결과 확보 확인 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | CHANGELOG `workflow-assistant 세션` 항목 첫 불릿이 실제 라우트에서 모듈 세그먼트(`workflow-assistant/`)를 빠뜨려 `GET /sessions` 등으로 적었다 — 같은 항목의 나머지 세 불릿(WebAuthn·triggers·EIA)은 전부 모듈 세그먼트를 포함한 전체 상대 경로를 쓰는데 이 불릿만 다르다. 실제 경로는 `/api/workflow-assistant/sessions` 등이라 CHANGELOG 대로 두드리면 404. | `CHANGELOG.md:31-33` | `GET /workflow-assistant/sessions` · `GET /workflow-assistant/sessions/latest` · `GET /workflow-assistant/sessions/:id` · `POST /workflow-assistant/sessions` · `PATCH /workflow-assistant/sessions/:id` · `DELETE /workflow-assistant/sessions/:id` 로 모듈 세그먼트를 채워 다른 세 불릿과 축약 규칙 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 평문 1회성 secret/token 응답 필드(`NotificationRotateSecretDto.secret`, `InteractionRevokeTokenDto.token`)가 OpenAPI 문서에 처음 공식 노출된다 — 로직·노출 범위는 이전과 동일(문서화만), Swagger는 prod 기본 비활성 | `triggers.controller.ts`(`rotateNotificationSecret`/`revokePerTriggerToken`), `trigger-secret-issue-response.dto.ts` | 조치 불요 — 기존 위험 수용 범위 재확인 |
| 2 | 보안 | `AssistantToolCallDto.arguments`/`result` 가 `additionalProperties: true` 로 완전히 열린 스키마로 광고됨 — 도구별 인자/결과가 제각각이라 의도적 설계 | `assistant-session-response.dto.ts` | 조치 불요(설계 의도). 향후 이 값을 HTML 렌더링하는 프런트 경로가 생기면 별도 XSS 가드 필요 |
| 3 | 성능 | repo-guard AST 스캔 확장·신규 Swagger 데코레이터 모두 CI/앱 부트스트랩 시점에만 평가되어 런타임 요청 경로에 영향 없음. e2e `contractForDto` 는 기존 캐시로 메모이즈되어 N+1 형태 아님 | `http-status-advertised-guard.ts`, `api-wrapped.ts`, `workflow-assistant.e2e-spec.ts` | 조치 불요 |
| 4 | 아키텍처 | `workflow-assistant.controller.ts` 신규 광고 5개 핸들러(`list`~`update`)가 반환 타입을 광고 DTO로 명시하지 않음 — 같은 PR이 `triggers.controller.ts`에는 적용한 "반환 타입 DTO 명시(컴파일 타임 drift 방지)" 관례가 파일 내에서 비대칭 적용됨. 회귀는 아님(기존 시그니처 무변경) | `workflow-assistant.controller.ts:77,100,121,138,153` | 여유 있을 때 `Promise<AssistantSessionDto>` 등으로 명시해 관례 통일 |
| 5 | 유지보수성 | `triggers.service.ts`의 `rotateNotificationSecret`/`revokePerTriggerToken` 반환 타입이 서비스 계층까지는 DTO로 좁혀지지 않음 — 컨트롤러가 명시적 DTO 반환 타입을 갖고 있어 회귀 방지력은 이미 확보됐으나, 관례 적용 범위(컨트롤러 한정)를 다음 사람이 오해할 여지 | `triggers.service.ts` | 급하지 않음 — 다음 터치 시 서비스 시그니처도 DTO로 통일 |
| 6 | 유지보수성 | `trigger-secret-issue-response.dto.ts` 파일명(단수 "issue")이 서로 다른 두 액션(알림 secret 회전/interaction token 재발급)의 DTO를 함께 담아 이름과 내용이 살짝 어긋남 — 기존 관례(`webauthn-response.dto.ts`)와 일관, 새 안티패턴 아님(1R에서 이미 처분) | `trigger-secret-issue-response.dto.ts` | 조치 불요, 3번째 secret DTO 추가 시 분리 검토 |
| 7 | 테스트/요구사항 | `sessions/latest` e2e가 이 컨트롤러 구현상 절대 나올 수 없는 204/404까지 허용하는 과관용적 상태코드 단언(`expect([200,204,404]).toContain(...)`) — 이 PR이 새로 만든 결함 아님(기존 줄, 이번엔 안쪽에 계약 대조만 추가) | `workflow-assistant.e2e-spec.ts` 테스트 F | 급하지 않음 — `toBe(200)`으로 좁혀 향후 라우트 순서 회귀(`:id`가 `latest`를 가로채는 경우 등) 탐지력 확보 |
| 8 | 테스트 | `ApiOkWrappedNullableResponse`의 핵심 동작(`data: null`)이 이 라우트의 실제 null 응답으로 e2e 대조된 적이 없음 — 테스트 F는 조회 직전 세션을 새로 만들어 항상 "찾음" 분기만 탄다. 스키마 자체는 단위테스트(`api-wrapped.spec.ts`, `transform.interceptor.spec.ts`)가 보증해 조합 리스크는 낮음 | `workflow-assistant.e2e-spec.ts` 테스트 F, `workflow-assistant.controller.ts` `latest()` | 급하지 않음 — 세션 없는 워크플로우 질의 케이스 추가해 null 분기 직접 실증 |
| 9 | 테스트 | `AssistantToolCallDto`의 선택 필드(`result`/`planStepId`/`planStepIds`/`signature`)가 "키 생략" 방향으로는 신규 e2e에서 대조되지 않음 — 테스트 H는 항상 "전부 채움" 변형만 삽입 | `workflow-assistant.e2e-spec.ts` 테스트 H, `assistant-session-response.dto.ts` | 급하지 않음 — 선택 키를 모두 생략한 두 번째 tool_calls 행 추가해 양방향 실증 |
| 10 | 범위 | `AssistantSessionDetailDto` 계열 신규 DTO(7클래스, 265줄) 상세도가 목표 대비 커 보이나, 세션 상세 라우트가 엔티티 중첩 구조를 그대로 반환하는 데서 불가피 — 이전 라운드에서 이미 검토·수용됨(죽은 코드 아님, e2e 테스트 H가 전 계층 대조) | `assistant-session-response.dto.ts` | 조치 불요 |
| 11 | 범위 | 작업 중 발견한 무관 spec 갭 2건(`GET sessions/latest` API 표 누락, `revoke-token` 상태 전이 서술 상충)을 코드 변경 없이 트래커에만 등재 — 표준 절차(발견 즉시 고치지 않고 트래커에 등재)와 일치 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요(planner 소관 저우선 백로그) |
| 12 | 부작용 | `HttpStatusScan`/`judgeHandler` 반환 인터페이스에 `unadvertised` 필드 추가 — 전수 확인 결과 소비자는 개별 필드 접근만 해 회귀 없음 | `http-status-advertised-guard.ts` | 조치 불요 |
| 13 | 부작용 | e2e 테스트 H가 서비스 레이어를 우회해 raw SQL로 메시지 row를 직접 INSERT하지만, 정상 `DELETE /sessions/:id`(cascade) 엔드포인트로 정리해 고아 row가 남지 않음 | `workflow-assistant.e2e-spec.ts` 테스트 H | 조치 불요 |
| 14 | API 계약 | `GET /workflow-assistant/sessions`가 페이지네이션 파라미터 없이 "최근 상호작용 순 최대 50건" 고정 응답 — 이 PR 이전부터의 기존 설계, 이번엔 OpenAPI로 명시적으로 굳어짐 | `workflow-assistant.controller.ts` `list()` | 차단 사유 아님 — 세션 50건 초과 가능성이 커지면 커서/페이지 파라미터 후속 검토 |
| 15 | User Guide Sync | `auth-session-flow-change` trigger가 경로 glob(WebAuthn)은 매칭되나 실제로는 Swagger 데코레이터·타입만 추가되고 인가/세션 흐름 로직 변경이 없어 실질 트리거 아님(회색지대 기록, 누락 아님) | `webauthn.controller.ts`, `webauthn-response.dto.ts` | 조치 불요 |
| 16 | 의존성 | 신규 외부 패키지 추가 없음(`package.json`/`pnpm-lock.yaml` diff 0건) — 신규 import는 모두 기존 `@nestjs/swagger` export 또는 사내 신규 모듈(`api-wrapped.ts`, 신규 DTO 파일) | `codebase/backend/package.json`, `pnpm-lock.yaml`(무변경) | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 평문 secret 필드·열린 스키마 문서화는 기존 설계 재확인, 신규 취약점 없음 |
| performance | NONE | 런타임 로직 미변경, repo-guard 확장도 선형 유지, N+1 없음 |
| architecture | NONE | SRP 분리·순환의존 없음. workflow-assistant 5개 핸들러 반환 타입 DTO 미명시(INFO) |
| requirement | NONE | 1R Warning 3건 반영 재확인, 신규 Critical/Warning 없음 |
| scope | LOW | 목표(11라우트 광고)와 정확히 일치. DTO 상세도 큼(기수용)·spec 갭 트래커 등재만 |
| side_effect | LOW | 인터페이스 확장·반환타입 narrowing 전수 확인상 안전, e2e H raw SQL 우회는 정상 정리됨 |
| maintainability | LOW | 1R Warning 2건(SRP·중복) 해소 확인. 서비스 계층 DTO 미적용은 INFO |
| testing | LOW | 1R 유일 Warning(메시지 하위 DTO 미대조) 견고히 해소. data:null·선택필드 생략 미실증은 INFO |
| documentation | LOW | CHANGELOG 경로 표기 불일치 1건(WARNING). 이전 라운드 지적 사항 전부 해소 확인 |
| dependency | NONE | 신규 패키지 없음, 의존 방향 정상 |
| database | NONE | DB 계층 변경 없음(해당 없음) |
| concurrency | NONE | 동시성 관련 구성요소 없음(해당 없음) |
| api_contract | LOW | 계약 위반 없음. 페이지네이션 부재는 기존 설계(INFO) |
| user_guide_sync | NONE | frontend 변경 0건, 동반 갱신 누락 0건 |

## 발견 없는 에이전트

- database — DB 계층 변경 없음(해당 없음)
- concurrency — 동시성 관련 구성요소 없음(해당 없음)

## 권장 조치사항

1. CHANGELOG `workflow-assistant 세션` 항목의 6개 불릿에 모듈 세그먼트(`workflow-assistant/`)를 채워 다른 세 불릿과 축약 규칙을 통일한다(WARNING #1, 유일한 실질 조치 대상).
2. (여유 있을 때, 급하지 않음) `workflow-assistant.controller.ts` 5개 핸들러 반환 타입을 광고 DTO로 명시하고, `triggers.service.ts` 반환 타입도 DTO로 좁혀 "반환 타입 DTO 명시" 관례를 파일 전역에서 통일한다.
3. (여유 있을 때) `sessions/latest`의 `data: null` 분기와 `AssistantToolCallDto` 선택 필드 "키 생략" 방향을 직접 때리는 e2e 케이스를 추가해 테스트 사각지대를 좁힌다.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행됨(사유 텍스트 미기재).
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.
- **실행**: 14개 reviewer 전원(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) — 전원 `status=success`, 인라인 전문 확보, 디스크 파일(`review/code/2026/09/26/14_07_11/*.md`)도 이미 전부 존재 확인(추가 Write 불필요).
- **제외**: 없음(router 미사용이므로 skipped 목록 자체가 없음).
