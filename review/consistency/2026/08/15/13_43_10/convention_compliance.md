# 정식 규약 준수 검토 — convention_compliance

**검토 모드**: `--impl-prep` (구현 착수 전) · **scope**: `spec/5-system/`
**중점 대상**: `spec/5-system/14-external-interaction-api.md` (진행 중 plan
`plan/in-progress/eia-db-wire-invariant.md` 의 `spec_impact`) — REST 단발 조회(§5.3)에
`durationMs` 추가, `execution.cancelled` 의 "알려진 예외 1건"(§6.5) 해소, `finalizeCancelledExecution`
guarded UPDATE 결과 미확인 수정이 이 문서가 뒤따르는 작업.

## 발견사항

- **[INFO]** `spec/5-system/` 내 문서 구조 컨벤션의 표기 편차 (신규 아님)
  - target 위치: `2-api-convention.md` · `16-system-status-api.md` · `6-websocket-protocol.md` ·
    `5-expression-language.md` · `7-llm-client.md` · `11-mcp-client.md` (전체 17개 파일 중 6개)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 위 6개 파일은 `## Overview` 헤딩 대신 `## 1. 개요`(번호 매김 본문 섹션)로 시작하고 별도
    Overview 섹션이 없다. 반면 `14-external-interaction-api.md`·`1-auth.md`·`4-execution-engine.md`
    등 나머지 11개는 `## Overview (제품 정의)` 를 명시적으로 갖는다. 이번 작업(`eia-db-wire-invariant`)이
    건드리는 `14-external-interaction-api.md` 자체는 이미 Overview/본문/Rationale 3섹션을 정확히
    갖추고 있어 **현재 진행 중인 변경과는 무관**하다.
  - 제안: 이 편차는 이 저장소에 오래 존재해 온 것으로 보이며(전 파일에 걸친 패턴), 이번 PR 범위에서
    고칠 필요는 없다. 다만 "권장" 규정이 절반 가까운 파일에서 지켜지지 않고 있다는 사실은 규약 문서
    자체(`CLAUDE.md`)가 예외를 명시하거나, 향후 `spec/5-system/` 정리 작업의 백로그 항목으로 남길 만하다.

- **[INFO]** `§5.3` 응답 스키마에 `durationMs` 부재 — 의도된 갭, 이번 작업이 닫을 대상
  - target 위치: `14-external-interaction-api.md` §5.3 (`GET /api/external/executions/:executionId`)
    L436~488, EIA-IN-04 (L77)
  - 위반 규약: 없음 (해당 없음) — `§5.4 부재 표현 규약`(`2-api-convention.md §5.4`) 위반은 아니다.
    `durationMs` 는 §5.3 의 계약 필드 목록(EIA-IN-04)에 애초에 포함돼 있지 않으므로 `null` vs
    "키 생략" 선택의 문제가 아니라 "아직 약속되지 않은 필드" 다.
  - 상세: `§6` 종결 이벤트 필드 집합 표(L566~577)는 `durationMs` 를 "3종 · 구현됨" 으로 표시하는 반면,
    같은 문서의 §5.3 REST 단발 조회 스키마는 이 필드를 전혀 언급하지 않는다. 두 절이 서로 다른
    채널(push 3종 vs REST pull)의 계약이라 모순은 아니지만, `plan/in-progress/eia-db-wire-invariant.md`
    §③ 이 정확히 이 갭("REST 재조회에 durationMs 가 없다")을 닫는 작업으로 이미 식별해 두었다.
  - 제안: 구현 시 `EIA-IN-04` 필드 목록(§3.2) + §5.3 JSON 예시(L459~487) + 필요하면 §7.2(Execution
    엔티티 확장, 신규 컬럼 없음이라 프로젝션만 추가) 를 **한 커밋에서 동반 갱신**할 것 — plan 체크리스트에
    이미 "spec §5.3 응답 예시·필드표 동기" 로 등재돼 있어 별도 지적 불필요, 확인만 남긴다.

- **[INFO]** `§6.5` "알려진 예외 1건" — 이번 작업(item ②)이 닫을 대상이며 현재는 정확히 문서화됨
  - target 위치: `14-external-interaction-api.md` §6.5 L812~816
  - 위반 규약: 없음 — 오히려 이 저장소의 관행("알려진 갭은 invariant 옆에 적는다", R14·R17·§6.4 동형)을
    정확히 따르고 있다.
  - 상세: retry-turn CANCELLED 재진입에서 DB 커밋값과 emit 값이 어긋나는 결함이 `spec-sync-external-interaction-api-gaps.md`
    로 추적되며 본문에 명시돼 있다. `eia-db-wire-invariant.md` 항목 ②가 이 결함을 고치면 "spec §6.5 의
    '알려진 예외 1건' 문구 제거" 가 plan 체크리스트에 이미 등재돼 있다.
  - 제안: 구현 완료 시 이 caveat 문단(L808~816)을 지우지 말고 CLAUDE.md 인접 Planned-caveat 관행
    (§6 Rationale 이 예시로 든 "캐비엇은 (해소) 로 보존") 과 동일하게, 완전 삭제보다 "(2026-08-15
    해소)" 형태로 남기는 편이 이 문서 자신의 관행과 더 일관된다 — 단 이는 `spec/` 쓰기 권한(planner)
    소관이라 developer 턴에서 강제하지 않는다.

## 교차 확인 결과 (위반 없음 확인 — 참고용)

아래는 conventions 대비 정합성을 직접 대조해 **위반이 없음을 확인**한 항목들이다 (발견사항 아님,
투명성을 위해 기록):

- **에러 코드 명명** (`spec/conventions/error-codes.md`): §5.1 표의 `VALIDATION_ERROR` /
  `INVALID_COMMAND` / `TOKEN_REFRESH_NOT_IN_WINDOW` / `TOKEN_REVOKED` / `STATE_MISMATCH` /
  `IDEMPOTENCY_KEY_CONFLICT` / `EXECUTION_TERMINATED` / `RATE_LIMITED` 등 전부 `UPPER_SNAKE_CASE`
  준수. `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`
  도 동일.
- **Redis 키 명명** (`spec/conventions/redis-keys.md`): `interaction:idempotency:<executionId>:<route>:<key>`
  (§R8 "캐시 키 스코프")·`eia:rl:interact:<executionId>`·`eia:rl:status:<executionId>`·
  `eia:notif:rl:<triggerId>`(§8.4) 가 redis-keys.md §3 전역 인벤토리와 1:1 일치.
- **감사 액션 명명** (`spec/conventions/audit-actions.md`): `trigger.notification_secret_rotated`
  (EIA-NX-12) · `trigger.interaction_token_revoked`(EIA-AU-07) 가 레지스트리 §3 에 "구현
  (2026-08-11)" 로 등재된 것과 정확히 일치.
- **Swagger/DTO 규약** (`spec/conventions/swagger.md`): §5.3 `context` 필드의 `oneOf` +
  discriminator 미사용(§10.1·§5.3 L490)이 swagger.md §1-4 "discriminator 는 판별자가 sound 할
  때만" 규칙과 정확히 일치(같은 사례를 규약 문서 Rationale 이 직접 인용). DTO 파일 위치
  (`dto/responses/execution-status-response.dto.ts` 등, §10 구현 파일 구조)도 swagger.md §5-1
  패턴 준수. §10.1 이 `@ApiBearerAuth('interaction-token')` 신규 scheme 사용을 명시적으로 정당화.
- **API 응답 포맷** (`2-api-convention.md §5`): `{ data: ... }` 래핑(§4.1·§5 도입부), 부재 표현
  `null` vs 키 생략 선택 및 그 근거 서술(§5.3 콜아웃, L444~453)이 `§5.4 부재 표현` 규약의 (a)/(b)
  기준과 정확히 일치하며 해당 규약 문서가 이 EIA 문서를 선례로 직접 인용하고 있다(상호 참조 정합).
- **URL 구조 예외** (`2-api-convention.md §2.2`): `/api/external/executions/:id/*` 가 표준
  `{resource}/{id}/{sub-resource}` 패턴과 다른 prefix 구조이나, 본 문서 Rationale R11 이 그 이유를
  명시적으로 정당화하고 있어 미문서화된 이탈이 아니다.
- **마이그레이션 번호** (`spec/conventions/migrations.md`): 본문에 언급된 V060(`execution_token`)·
  V066(inline auth 필드 폐지)는 순번 설명일 뿐 이 PR 범위에서 신규 마이그레이션을 요구하지 않는다
  (durationMs 컬럼은 이미 `Execution` 엔티티에 존재 — plan §③ 은 프로젝션 추가만).

## 요약

이번 `--impl-prep` 대상인 `spec/5-system/14-external-interaction-api.md` 는 명명 규약(에러 코드
`UPPER_SNAKE_CASE`, Redis 키 형태, 감사 액션 taxonomy), 출력 포맷 규약(`{data}` 래핑, `null`/키 생략
부재 표현), API 문서 규약(Swagger DTO 위치·`oneOf`/discriminator 판단), 문서 구조 규약(Overview/본문
/Rationale 3섹션)을 모두 준수하며, 표준에서 벗어나는 지점(외부 URL prefix 분리 등)은 문서 자신의
Rationale 절에서 명시적으로 정당화하고 있다. 이번에 착수하려는 작업(§5.3 durationMs 추가·§6.5 알려진
예외 해소)이 겨냥하는 두 갭은 이미 문서 스스로가 "알려진 갭"으로 정확히 위치를 밝혀 두고 있어, 구현
전 시점의 spec 자체에는 CRITICAL/WARNING 수준의 정식 규약 위반이 없다. `spec/5-system/` 나머지
16개 파일로 범위를 넓히면 "## Overview" 헤딩 유무의 표기 편차가 있으나, 이는 이번 작업과 무관한
기존 상태이고 CLAUDE.md 규정 자체가 "권장" 수준이라 INFO 로만 기록한다.

## 위험도

NONE
