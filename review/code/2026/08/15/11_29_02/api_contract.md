STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (R9, 누적 5라운드째)

## 리뷰 범위 및 방법

이 changeset 의 API 표면은 신규 REST 엔드포인트가 아니라 **EIA 종결 이벤트(webhook/SSE/WS)
wire payload** — `execution.completed`/`failed`/`cancelled` 세 이벤트에 `durationMs` 필드를
추가하는 것이다. 같은 브랜치에 이미 4 라운드(`09_58_24`/`10_18_38`/`10_34_51`/`11_09_44`)의
`api_contract.md` 가 누적돼 있고 전부 WARNING 1건·위험도 LOW 로 수렴했다. 이번 라운드는

1. 직전 라운드(`11_09_44`) 이후 신규 커밋(`2c9b490fd`, "JS 클램프 누락" 수정)이 wire 표면을
   추가로 바꿨는지 `git show`로 직접 대조
2. 직전 라운드가 남긴 살아있는 발견사항(REST/push 응답 스키마 비대칭)의 현재 상태를
   `spec/5-system/14-external-interaction-api.md` §5.3 과
   `execution-status-response.dto.ts` 를 `Read`로 재확인
3. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이번 라운드 사이 새로
   등재된 항목("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다")을 API 계약
   관점(응답 일관성)에서 추가 검토

하는 방식으로 진행했다.

신규 커밋(`2c9b490fd`)은 `resolveTerminalDurationMs`(JS 경로)에 `PG_INT4_MAX` 클램프를
추가하고 SQL 경로(`TERMINAL_DURATION_MS_SQL`)와 상수를 공유시키는 **내부 계산 로직
수정**이다. wire 필드명·타입·부재 표현(`null`)·이벤트 스키마는 전혀 바뀌지 않았다 — 결과값의
상한이 두 계산 경로 간에 일치하게 됐을 뿐이며, 이는 오히려 "같은 필드가 경로에 따라 다른
상한을 가질 수 있었던" 잠재적 응답 불일치를 없애는 방향이다(같은 파일의 `architecture`/
`database` 리뷰 영역이 CRITICAL 로 이미 다뤘으므로 여기서는 중복 채점하지 않는다). 따라서
API 계약 관점의 실질 위험도는 직전 라운드와 동일하게 유지된다.

## 발견사항

- **[WARNING]** (직전 라운드부터 이월, 여전히 미해소) REST 단발 조회와 push 계열
  (webhook/SSE/WS) 간 응답 스키마 비대칭 — `durationMs` 가 재조회 시 사라진다
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3 JSON 예시(`GET
    /api/external/executions/{executionId}` 응답 — `id/workflowId/status/currentNode/
    context/result/error/seq/updatedAt` 나열에 `durationMs` 없음, 직접 확인 결과 현재도
    caveat 미추가) / `codebase/backend/src/modules/external-interaction/dto/responses/
    execution-status-response.dto.ts`(`ExecutionStatusDto` 전체 필드 실측 — `durationMs`/
    `duration_ms` 0건)
  - 상세: `execution.completed`/`failed`/`cancelled` push 이벤트에는 `durationMs` 가
    실리지만, 같은 리소스를 REST 로 재조회하는 `getStatus()` 응답엔 없다. 같은 execution 을
    가리키는 두 접근 경로가 서로 다른 필드 집합을 노출한다. CHANGELOG·plan 트래커
    (`spec-sync-external-interaction-api-gaps.md` "`durationMs` 후속 2건", W4)에 명시적으로
    등재돼 "DTO+projection 확장은 다른 표면이라 이 PR 범위 밖" 으로 의도적으로 유예된
    상태이므로 신규 회귀는 아니다.
  - 제안: 트래킹된 후속 PR(`ExecutionStatusDto` + `getStatus()` projection 확장)을 진행할
    것. 그 전까지 §5.3 JSON 예시 옆에 "push 전용, REST 재조회엔 아직 없음" 한 줄 caveat 을
    추가하면 §5.3 만 읽는 독자가 §6 까지 왕복하지 않아도 된다(4 라운드째 반복되는 제안).

- **[WARNING]** (이번 라운드 사이 신규 등재, 이번 라운드에서 API 계약 관점으로 첫 평가)
  retry-turn 재진입 경로에서 **동일 execution 에 대해 emit 값과 DB 영속값이 어긋날 수 있다**
  — REST 재조회 시 push 로 받은 값과 다른 `durationMs` 를 보게 된다
  - 위치: `spec/5-system/14-external-interaction-api.md:810`(§6.5 "알려진 예외 1건" 콜아웃)
    / `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-222`("retry-turn
    재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다" 절, `10_34_51` W1 + `11_09_44`
    concurrency W1 병합 등재)
  - 상세: `finalizeGuarded` 의 CANCELLED 분기가 `COALESCE(duration_ms, :new)` 로 최초
    `stop()` 커밋 시각(T1) 값을 DB 에 보존하는데, in-memory `execution.durationMs` 는
    갱신되지 않아 emit 은 재진입 시점 T2(더 큰 값)를 싣는다. 희귀 레이스가 아니라
    "retry-turn 처리 중 Stop" 이라는 일반 흐름에서 결정적으로 발생한다. 클라이언트가 push
    로 받은 `durationMs` 를 신뢰하고 나중에 `GET /api/external/executions/:id` 로 같은
    실행을 재조회하면(같은 위치의 §5.3 스키마가 채워지고 나면) **다른 값**을 받게 되어,
    "같은 리소스는 접근 경로와 무관하게 같은 표현을 반환해야 한다" 는 응답 일관성 원칙에
    어긋난다. 자매 문제(`finalizeCancelledExecution` 도 guarded UPDATE 가 0행이어도 emit 이
    발행돼 DB 미영속 로컬 값이 wire 로 나갈 수 있음)까지 함께 등재돼 있다.
  - 이미 spec §6.5 에 "알려진 예외" 로 명시 문서화되고(2026-08-15), plan 트래커에 근본
    원인(`updateExecutionStatus` 가 `RETURNING` 없이 boolean 만 반환)과 함께 등재돼 있어
    은폐된 갭은 아니다. 다만 이 PR 이 "DB = wire" 불변식을 16 경로 중 15곳에서 막 세운
    직후이므로, 남은 1곳(+ 자매 1곳)이 wire 계약의 신뢰도를 낮추는 채로 남아 있다는 점은
    API 계약 리뷰 관점에서 별도로 짚어 둘 가치가 있다.
  - 제안: 트래커에 이미 있는 대로 CANCELLED 분기에 `.returning(['duration_ms'])` 를
    추가해 실제 persist 값을 되읽어 emit 전 갱신할 것. 회귀 테스트는 emit 값 자체를
    단언해야 한다(SQL 형태만 보는 기존 테스트는 이 어긋남을 못 잡는다는 점도 트래커에
    이미 명시돼 있다).

## 그 외 점검 결과 (문제 없음으로 판정)

- **하위 호환성**: `durationMs` 추가는 세 이벤트 payload 에 필드를 하나 더하는 순수
  additive 변경. 타입도 `?: number | null`(optional + nullable) 로 유지돼(`types.ts:392-397,
  412-420,430-438`), producer 는 값을 모르면 `null` 을 보내고 consumer 타입은 레거시
  (키-부재) 이벤트까지 흡수한다. `chat-channel.dispatcher.ts:534-535,572-573,589-590` 도
  동형으로 캐스팅을 넓혔고, `chat-channel.dispatcher.spec.ts:374-416` 가 숫자/`null`/
  키-부재 3분기 회귀 테스트로 이 경계를 고정한다.
- **버전 관리**: URL 경로 버전 세그먼트를 쓰지 않는 기존 컨벤션 유지. 이 changeset 안에
  있던 위반 사례(`/api/v1/executions/:id/re-run`)는 별도 커밋(`cdaa4291d`)으로 정정됐고
  실측 결과 현재 소스에 `api/v1` 잔존 0건.
- **응답 형식**: `completed`/`failed`/`cancelled` 세 이벤트 모두 동일한 필드명·동일한
  부재 표현(`null`=값 모름, 키는 항상 존재)을 쓴다 — 형제 필드 `error.code` 의 null
  관례와 일관. 이번 라운드의 신규 커밋이 JS/SQL 두 계산 경로의 상한(`PG_INT4_MAX`)을
  단일 상수로 통일해, "같은 필드가 계산 경로에 따라 다른 값 범위를 가질 수 있었던" 잠재
  불일치를 닫았다(위 CRITICAL 은 architecture/database 리뷰 소관이라 여기선 중복
  채점하지 않음).
- **에러 응답**: 이번 diff 는 에러 응답 형식을 건드리지 않는다.
- **요청 검증**: 신규/변경된 요청 파라미터·바디 없음(순수 응답측 payload 확장).
- **URL/경로 설계**: 신규 엔드포인트 없음. raw UPDATE 5경로의 `WHERE`/파라미터 바인딩
  구조도 변경 없이 `SET`/`RETURNING` 만 확장.
- **페이지네이션**: 목록 API 변경 없음.
- **인증/인가**: 5개 raw UPDATE 경로의 `WHERE id = :id AND status = :waiting/:pending/
  :running` 상태 가드 보존. 인증 미들웨어 변경 없음.
- **필드 의미 오버로드(INFO 급, 이월)**: `durationMs` 가 경로에 따라 "실행 시간"과
  "대기 시간"이라는 다른 의미를 실어 나르는 문제(§6.5 콜아웃에 이미 문서화, 세 대기
  케이스 모두 명명됨 — `11_09_44` documentation W7 반영 확인)는 스키마 레벨 구분자 없이
  산문 문서로만 고지된 상태가 유지된다. Wire 스키마 자체를 바꾸는 결정은 이 PR 범위
  밖이라는 직전 판단에 동의하며 INFO 로 유지.

## 요약

이번 라운드에서 신규로 추가된 커밋(`2c9b490fd`)은 프로덕션 wire 계약의 필드·타입·부재
표현을 바꾸지 않고, JS/SQL 두 계산 경로의 int4 클램프 상한을 일치시켜 오히려 응답 일관성을
강화했다. `durationMs` 추가 자체는 여전히 순수 additive 하위 호환 변경이고 회귀 테스트로
계약이 고정돼 있다. API 계약 관점에서 살아있는 이슈는 둘이다 — (1) 4 라운드째 이월되는
REST/push 응답 스키마 비대칭(`durationMs` 가 push 계열에만 있고 REST 재조회엔 없음)과
(2) retry-turn 재진입 시 emit 값이 DB 영속값과 어긋날 수 있는 알려진 예외(spec §6.5 에 이미
명시 문서화, plan 트래커에 근본 원인과 수정 방향까지 등재됨). 둘 다 이번 PR 이 새로 만든
회귀가 아니라 기존에 문서화·트래킹된 갭이고, 의도적 유예 사유가 타당하므로 CRITICAL 로 올릴
근거는 없지만 두 접근 경로 간 응답 신뢰도 차이가 실재하므로 WARNING 으로 유지한다. 신규
breaking change·버전 관리 위반·요청 검증 공백·인증/인가 우회는 발견되지 않았다.

## 위험도

LOW
