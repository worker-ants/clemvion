STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (누적 7라운드째)

## 리뷰 범위 및 방법

이 changeset 의 API 표면은 신규 REST 엔드포인트가 아니라 **EIA 종결 이벤트(webhook/SSE/WS)
wire payload** — `execution.completed`/`failed`/`cancelled` 세 이벤트에 `durationMs` 필드를
추가하는 것이다. 같은 브랜치에 이미 6 라운드(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`/
`11_09_44`/`11_29_02`)의 `api_contract.md` 가 누적돼 있고 전부 위험도 LOW 로 수렴했다. 이번
라운드는 직전(`11_29_02`) 이후 유일한 신규 커밋 `f5c609aa8`이 wire 계약을 추가로 바꿨는지
`git show`로 직접 대조하고, 직전 라운드가 남긴 두 WARNING(REST/push 응답 스키마 비대칭 ·
retry-turn 재진입 DB↔emit 불일치)의 현재 상태를 소스(`execution-status-response.dto.ts`,
`spec/5-system/14-external-interaction-api.md` §5.3/§6.5)를 다시 `Read`/`grep`으로 실측해
재확인하는 방식으로 진행했다.

신규 커밋 `f5c609aa8`의 실질 diff 3곳을 확인했다:

1. `CHANGELOG.md` — "취소 UPDATE 실패" 서술을 "종결 UPDATE 실패(정상 완료 포함)"로 정확화
2. `execution-engine.service.ts` JSDoc — "호출부 4곳"→"5곳" 오탈자 정정
3. `terminal-duration.ts` — `PG_INT4_MAX` 상수를 JSDoc 바로 위로 재배치(orphan 주석 정정)

세 곳 모두 **주석/문서 정정과 테스트 mock 보강**(같은 커밋의 `execution-engine.service.spec.ts`
diff는 `raw` mock에 `duration_ms` 값을 채워 이전엔 통과하면서 아무것도 검증 못 하던 assertion을
실질화)이며, wire 필드명·타입·부재 표현(`null`)·이벤트 스키마·HTTP 상태 코드·인증 경계 중
어느 것도 바뀌지 않았다. 따라서 API 계약 관점의 실질 위험도는 직전 라운드와 동일하게
유지된다.

## 발견사항

- **[WARNING]** (5 라운드째 이월, 여전히 미해소) REST 단발 조회와 push 계열(webhook/SSE/WS)
  간 응답 스키마 비대칭 — `durationMs` 가 재조회 시 사라진다
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3 JSON 예시(`GET
    /api/external/executions/{executionId}` 응답 — `id/workflowId/status/currentNode/
    context/result/error/updatedAt` 나열에 `durationMs` 없음, 이번 라운드 직접 재확인
    결과 caveat 미추가) / `codebase/backend/src/modules/external-interaction/dto/
    responses/execution-status-response.dto.ts`(`grep -n 'durationMs\|duration_ms'` 0건,
    이번 라운드 재실측)
  - 상세: `execution.completed`/`failed`/`cancelled` push 이벤트에는 `durationMs` 가 실리지만,
    같은 리소스를 REST 로 재조회하는 `getStatus()` 응답엔 없다. 같은 execution 을 가리키는
    두 접근 경로가 서로 다른 필드 집합을 노출한다 — "같은 리소스는 접근 경로와 무관하게
    같은 표현을 반환해야 한다"는 응답 일관성 원칙 위반이나, CHANGELOG("REST `GET
    /api/external/executions/:id` 에는 아직 없다 — push 계열만 채워졌다. 재조회 시 사라지는
    비대칭이라 후속으로 추적 중이다")와 plan 트래커
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 명시적으로 등재돼
    "DTO+projection 확장은 다른 표면이라 이 PR 범위 밖"으로 의도적으로 유예된 상태이므로
    신규 회귀는 아니다.
  - 제안: 트래킹된 후속 PR(`ExecutionStatusDto` + `getStatus()` projection 확장)을 진행할
    것. 그 전까지 §5.3 JSON 예시 옆에 "push 전용, REST 재조회엔 아직 없음" 한 줄 caveat 을
    추가하면 §5.3 만 읽는 독자가 §6 까지 왕복하지 않아도 된다(5 라운드째 반복되는 제안이나
    낮은 비용 대비 반복 지적 빈도가 높아 다음 편집 때는 반영을 권한다).

## 그 외 점검 결과 (문제 없음으로 판정, 직전 라운드 대비 변경 없음)

- **하위 호환성**: `durationMs` 추가는 세 이벤트 payload 에 필드를 하나 더하는 순수 additive
  변경. 타입도 `?: number | null`(optional + nullable)로 유지돼(`types.ts:392-397,412-420,
  430-438`), producer 는 값을 모르면 `null` 을 보내고 consumer 타입은 레거시(키-부재) 이벤트를
  흡수한다. `chat-channel.dispatcher.ts:534-535,572-573,589-590` 도 동형으로 캐스팅을
  넓혔고, `chat-channel.dispatcher.spec.ts:374-416` 이 숫자/`null`/키-부재 3분기 회귀
  테스트로 이 경계를 고정한다.
- **버전 관리**: URL 경로 버전 세그먼트를 쓰지 않는 기존 컨벤션 유지. 이 changeset 이력 안에
  있던 위반 사례(`spec/5-system/14-external-interaction-api.md` 의 `/api/v1/executions/:id/
  re-run` 오기)는 별도 커밋(`cdaa4291d`)으로 정정됐고, 실측 결과 현재 소스에 `api/v1` 잔존
  0건.
- **응답 형식**: `completed`/`failed`/`cancelled` 세 이벤트 모두 동일한 필드명·동일한 부재
  표현(`null`=값 모름, 키는 항상 존재)을 쓴다 — 형제 필드 `error.code` 의 null 관례와 일관.
  `retry-turn.service.ts`/`execution-engine.service.ts` 16개 emit 경로가 모두 공용 헬퍼
  (`resolveTerminalDurationMs`)와 SQL 상수(`TERMINAL_DURATION_MS_SQL`, int4 상한 공유)를
  경유해 값 범위·null 처리가 경로 간에 동형이다.
- **에러 응답**: 이번 diff 는 에러 응답 형식을 건드리지 않는다.
- **요청 검증**: 신규/변경된 요청 파라미터·바디 없음(순수 응답측 payload 확장).
- **URL/경로 설계**: 신규 엔드포인트 없음. raw UPDATE 5경로의 `WHERE`/파라미터 바인딩 구조도
  변경 없이 `SET`/`RETURNING` 만 확장.
- **페이지네이션**: 목록 API 변경 없음.
- **인증/인가**: 5개 raw UPDATE 경로의 `WHERE id = :id AND status = :waiting/:pending/
  :running` 상태 가드 보존. 인증 미들웨어 변경 없음.
- **retry-turn 재진입 DB↔emit 불일치(직전 라운드 WARNING)**: 이번 신규 커밋은 이 갭을
  건드리지 않았다 — spec §6.5 "알려진 예외 1건" 콜아웃과 plan 트래커 등재 상태 그대로
  유지된다(이번 라운드에서 코드 변경 없음을 확인했으므로 중복 채점하지 않음).
- **필드 의미 오버로드(INFO 급, 이월)**: `durationMs` 가 경로에 따라 "실행 시간"과 "대기
  시간"이라는 다른 의미를 실어 나르는 문제는 §6.5 콜아웃에 이미 문서화돼 있고(세 대기
  케이스 모두 명명됨), 스키마 레벨 구분자 없이 산문 문서로만 고지된 상태가 유지된다. Wire
  스키마를 바꾸는 결정은 이 PR 범위 밖이라는 직전 판단에 동의하며 INFO 로 유지.

## 요약

이번 라운드에서 신규로 추가된 유일한 커밋(`f5c609aa8`)은 프로덕션 wire 계약(필드명·타입·
부재 표현·이벤트 스키마)을 전혀 바꾸지 않는 주석 정정·JSDoc 재배치·mock 보강뿐이다.
`durationMs` 추가 자체는 여전히 순수 additive 하위 호환 변경이고 회귀 테스트로 계약이
고정돼 있다. API 계약 관점에서 살아있는 이슈는 REST/push 응답 스키마 비대칭 하나뿐이다 —
push 계열(webhook/SSE/WS)에는 `durationMs` 가 실리는데 같은 리소스의 REST 단발 조회
(`GET /api/external/executions/:id`)에는 아직 없다. 5 라운드째 이월되는 항목이지만
CHANGELOG·plan 트래커에 명시적으로 고지·등재된 의도적 유예이고 이 PR 이 새로 만든 회귀가
아니므로 CRITICAL 로 올릴 근거는 없다. 신규 breaking change·버전 관리 위반·요청 검증
공백·인증/인가 우회는 발견되지 않았다.

## 위험도

LOW
