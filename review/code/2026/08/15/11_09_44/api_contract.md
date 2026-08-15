STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (R8 재확인)

## 리뷰 범위 및 방법

이 changeset 의 API 표면은 신규 REST 엔드포인트가 아니라 **EIA 종결 이벤트(webhook/SSE/WS)
wire payload** — `execution.completed`/`failed`/`cancelled` 세 이벤트에 `durationMs` 필드를
추가하는 것이다. 이미 같은 브랜치 안에 4 라운드(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`)의
`api_contract.md` 가 누적돼 있어(전부 WARNING 1건·위험도 LOW로 수렴), 이번 라운드는

1. 직전 라운드(`10_52_08`) 이후 신규 커밋(`8a0c2348b`·`a67ec89b7`·`bd611be81`)이 API 표면을
   추가로 바꿨는지 `git log`/`git show` 로 직접 대조
2. 직전 라운드가 남긴 유일한 살아있는 발견사항(REST/push 응답 스키마 비대칭)이 이번 라운드에서
   해소됐는지 `spec/5-system/14-external-interaction-api.md` §5.3·§6과
   `execution-status-response.dto.ts` 를 `Read` 로 재확인
3. 새로 추가된 `chat-channel.dispatcher.spec.ts` 의 `durationMs` 회귀 테스트가 실제 wire 계약
   (숫자/`null`/키-부재 3분기)을 정확히 고정하는지 확인

하는 방식으로 진행했다.

신규 커밋 3건은 (a) `chat-channel.dispatcher.spec.ts` 에 wire 변환 회귀 테스트 추가,
(b) `spec/5-system/14-external-interaction-api.md` §6.5 에 retry-turn 재진입 시 DB/emit
불일치라는 **기존에 이미 발생하던 동작**을 명시적으로 문서화, (c) `retry-turn.service.spec.ts`
단언 2건 보강 — 셋 다 프로덕션 wire 표면 자체를 바꾸지 않는다(테스트·문서만). 따라서 API 계약
관점의 실질 위험도는 직전 라운드와 동일하게 유지된다.

## 발견사항

- **[WARNING]** (직전 4 라운드에서 이월, 여전히 미해소) REST 단발 조회와 push 계열
  (webhook/SSE/WS) 간 응답 스키마 비대칭 — `durationMs` 가 재조회 시 사라진다
  - 위치: `spec/5-system/14-external-interaction-api.md:434-486`(§5.3 `GET
    /api/external/executions/:executionId` 응답 JSON 예시 — `id/workflowId/status/currentNode/
    context/result/error/seq/updatedAt` 나열에 `durationMs` 없음) /
    `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (`ExecutionStatusDto` 전체 필드 실측 — `durationMs`/`duration_ms` 0건)
  - 상세: `execution.completed`/`failed`/`cancelled` **push 이벤트**에는 이번 PR 이
    `durationMs` 를 채웠지만, 같은 리소스를 REST 로 재조회하는 `getStatus()` 응답엔 없다.
    같은 execution 을 가리키는 두 접근 경로가 서로 다른 필드 집합을 노출해 응답 형식 일관성
    원칙에 어긋난다. 클라이언트가 SSE 재연결 gap 또는 `execution.replay_unavailable` 이후
    `getStatus` 로 상태를 보정할 때 `durationMs` 를 다시 잃는다.
  - 신규 회귀는 아니다 — CHANGELOG(`Unreleased`, "REST `GET /api/external/executions/:id` 에는
    아직 없다" 절)와 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    ("`durationMs` 후속 2건" 항목, W4)에 명시적으로 등재돼 있고, 4개 리뷰 라운드가 반복
    확인한 뒤 "DTO+projection 확장은 다른 표면이라 이 PR 범위 밖" 으로 의도적으로 유예한
    상태다. 다만 §5.3 응답 JSON 예시 자체에는 (직전 라운드가 제안했던) "push 전용, REST
    재조회엔 아직 없음" caveat 이 여전히 추가되지 않아, §5.3 만 읽는 독자는 §6 필드 집합
    표까지 따라가야 이 갭을 알 수 있다.
  - 제안: 트래킹된 후속 PR(`ExecutionStatusDto` + `getStatus()` projection 확장)을 서두를 것.
    그 전까지 §5.3 JSON 예시 옆에 한 줄 caveat 을 추가하면 독자가 §6 까지 왕복하지 않아도 된다.

- **[INFO]** 같은 필드명(`durationMs`)이 경로에 따라 "실행 시간"과 "대기 시간"이라는 서로 다른
  의미를 실어 나른다 — 스키마 레벨 구분자 없음
  - 위치: `spec/5-system/14-external-interaction-api.md:575`("`markQueueWaitTimeout` 의 값은
    **큐 대기 시간**이다") / `codebase/backend/src/shared/utils/terminal-duration.ts:65-90`
    (`TERMINAL_DURATION_MS_SQL` — park 취소·위젯 idle 취소·재개 실패 취소·큐 대기 타임아웃·
    stalled 소진 5경로가 전부 같은 SQL/같은 필드명을 공유)
  - 상세: wire 상 `durationMs` 는 하나의 숫자 필드이지만, 값의 의미(실행 소요 vs 대기 소요)가
    호출 경로(사실상 `status`/`error.code`)에 따라 갈린다. 스펙 문서 §6.5 는 이를 산문으로
    고지하지만, 응답 스키마 자체에는 두 의미를 구분할 필드·플래그가 없다. API 계약 관점에서는
    "형식은 같지만 의미가 다른 필드"가 문서를 안 읽은 소비자를 오도할 수 있는 지점이다. 이미
    이번 브랜치가 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 실제 내부
    소비처(대시보드/통계/실행목록 평균 집계) 오염 위험으로 별도 등재해 뒀다 — 등재 사실 확인함
    (INFO 로 낮춤. Wire 스키마 자체를 바꾸는 결정은 이 PR 범위 밖이라는 판단에 동의).
  - 제안: 트래커 항목대로 진행. API 계약 쪽에서 추가로 고려할 것은 §6 필드 집합 표에 "이
    필드의 의미는 종결 경로에 따라 갈린다" 캐비엇을 이미 달아 두었으므로 현재로선 충분.

## 그 외 점검 결과 (문제 없음으로 판정)

- **하위 호환성**: `durationMs` 추가는 세 이벤트 payload 에 필드를 하나 더하는 순수 additive
  변경이다. 타입도 `?: number | null` (optional + nullable) 로 유지돼(`types.ts:397,420,438`),
  producer 는 값을 모르면 `null` 을 보내고 consumer 타입은 레거시(키-부재) 이벤트까지 흡수한다.
  실제 dispatcher(`chat-channel.dispatcher.ts:534-535,572-573,589-590`)도 동형으로 캐스팅을
  넓혔다. 신규 커밋(`8a0c2348b`)이 이 세 경계에 대해 숫자/`null`/키-부재 3분기 회귀 테스트를
  추가해(`chat-channel.dispatcher.spec.ts:374-416`) 계약을 코드로 고정했다 — 직전 라운드가
  지적했던 "breaking 으로 고지한 경계에 테스트가 없다"는 갭이 이번에 닫혔다.
- **버전 관리**: URL 경로 버전 세그먼트를 쓰지 않는 기존 컨벤션 유지. 이 changeset 안에 있던
  위반 사례(`/api/v1/executions/:id/re-run`)는 별도 커밋(`cdaa4291d`)으로 이미 정정됐고 실측
  결과 현재 소스에 `api/v1` 잔존 0건.
- **응답 형식**: `completed`/`failed`/`cancelled` 세 이벤트 모두 동일한 필드명·동일한 부재
  표현(`null`=값 모름, 키는 항상 존재)을 쓴다 — 형제 필드 `error.code` 의 null 관례와 일관.
  `TERMINAL_DURATION_MS_SQL`(SQL 5경로)과 `resolveTerminalDurationMs`(엔티티 로드 경로)가 같은
  sentinel(음수/이상값 → `null`, 클램프 saturate)을 낸다는 점도 spec/코드 양쪽에서 확인됨.
- **에러 응답**: 이번 diff 는 에러 응답 형식을 건드리지 않는다.
- **요청 검증**: 신규/변경된 요청 파라미터·바디 없음(순수 응답측 payload 확장).
- **URL/경로 설계**: 신규 엔드포인트 없음. raw UPDATE 5경로의 `WHERE`/파라미터 바인딩 구조도
  변경 없이 `SET`/`RETURNING` 만 확장.
- **페이지네이션**: 목록 API 변경 없음.
- **인증/인가**: 5개 raw UPDATE 경로의 `WHERE id = :id AND status = :waiting/:pending/:running`
  상태 가드 보존. 인증 미들웨어 변경 없음.

## 요약

이번 라운드(R8)에서 신규로 추가된 커밋은 프로덕션 wire 표면을 바꾸지 않고 (1) `durationMs`
계약 경계에 회귀 테스트를 채우고 (2) retry-turn 재진입 시 DB/emit 값이 어긋나는 기존 동작을
spec §6.5 에 명시적으로 문서화하는 데 그친다. 세 이벤트 payload 에 `durationMs` 를 추가하는
것은 여전히 순수 additive 변경이고 하위 호환성·타입 계약·null 부재 표현이 형제 필드와 일관되게
유지된다. 유일하게 살아있는 API 계약 이슈는 4 라운드 전부터 이월돼 온 REST/push 응답 스키마
비대칭(`durationMs` 가 push 계열에만 있고 `getStatus()` REST 재조회엔 없음)이며, CHANGELOG·
plan 트래커에 명시적으로 등재된 채 "다른 표면(DTO+projection)이라 이 PR 범위 밖"으로 의도적
유예된 상태라 WARNING 으로 유지한다. 필드 의미가 경로별로 갈리는 점(대기시간 vs 실행시간)은
문서화·트래커 등재가 이미 돼 있어 INFO 로 낮춘다. 신규 breaking change·버전 관리 위반·요청
검증 공백·인증/인가 우회는 발견되지 않았다.

## 위험도

LOW
