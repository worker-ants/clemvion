STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 리뷰 범위 및 방법

이번 changeset 의 실질 API 표면은 REST 가 아니라 **EIA 종결 이벤트(webhook/SSE/WS) wire
payload**다 — `execution.completed`/`failed`/`cancelled` 세 이벤트에 `durationMs` 필드를
싣는다. 신규 REST 엔드포인트·요청 DTO·인증/인가 변경은 없다. 이미 이 changeset 안에
`review/code/2026/08/15/{09_58_24,10_18_38,10_34_51}/` 세 라운드의 리뷰가 누적돼 있어(각
라운드에 `api_contract.md`/`database.md`/`security.md` 등이 포함), 라운드 간 회귀 여부를
소스(`Bash`/`Read`)로 직접 재확인하는 방식으로 검토했다:

- `spec/5-system/14-external-interaction-api.md` 를 `Read`/`grep` 으로 직접 열어 §5.3(REST
  `getStatus`)·§6(필드 집합 표)·§6.3~6.5(payload 예시)를 대조
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  에 `durationMs`/`duration_ms` 존재 여부를 grep
- `execution-engine.service.ts`/`retry-turn.service.ts` 의 `execution.durationMs =` 대입
  지점 전수(`grep`)가 `resolveTerminalDurationMs` 헬퍼를 경유하는지 확인 (직전 라운드
  `10_18_38` side_effect.md 가 지적한 `driveCallStackResume` MEDIUM 이 이후 `10_34_51`
  라운드에서 실제로 해소됐는지 재검증 — **해소 확인**: `execution-engine.service.ts:2576-2577`
  가 이제 `resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs` 사용)
- `spec/5-system/14-external-interaction-api.md` 에 남아 있던 금지된 `/api/v1/` 세그먼트
  (consistency `08_45_50` convention_compliance CRITICAL)가 이 changeset 안에서 이미
  정정됐는지 grep — **정정 확인**(`grep -n "api/v1" spec/5-system/14-external-interaction-api.md`
  결과 0건)

## 발견사항

- **[WARNING]** REST 단발 조회와 push 계열(webhook/SSE/WS) 간 응답 스키마 비대칭 — `durationMs`
  가 재조회 시 사라진다
  - 위치: `CHANGELOG.md:20`(비대칭을 스스로 고지한 자리) / `spec/5-system/14-external-interaction-api.md`
    EIA-IN-04(§5.3, `GET /api/external/executions/:executionId` 응답 필드 나열 — `status /
    currentNode / context / result|error / seq / updatedAt` 에 `durationMs` 없음) /
    `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    (실측: `durationMs`/`duration_ms` grep 0건)
  - 상세: 이번 PR 이 `execution.completed`/`failed`/`cancelled` **push 이벤트**(webhook/SSE/WS)
    payload 엔 `durationMs` 를 채웠지만, 같은 실행(execution) 리소스를 **REST 로 재조회**하는
    `GET /api/external/executions/:id`(`ExecutionStatusDto`)엔 이 필드가 없다. 같은 리소스를
    가리키는 두 접근 경로(push subscribe vs REST poll)가 서로 다른 필드 집합을 노출하는 것은
    API 응답 형식의 일관성 원칙(점검 관점 3)에 어긋난다 — 클라이언트가 SSE 재연결 gap 또는
    `execution.replay_unavailable` 신호 후 `getStatus` 로 보정할 때(§5.2 문서 자체가 이 흐름을
    권장한다) `durationMs` 를 다시 잃는다.
  - 다만 이 갭은 **은폐되지 않았다** — CHANGELOG(`:20`)와
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:211`("`durationMs` 후속
    2건" 항목)에 명시적으로 등재돼 있고, 세 리뷰 라운드(`09_58_24` W4, `10_18_38`,
    `10_34_51` W6)가 반복 확인한 뒤 "다른 표면(DTO+projection 변경)이라 이 PR 범위 밖" 으로
    의도적으로 유예한 상태다. **신규 회귀는 아니다** — 이 PR 이전엔 애초에 `durationMs` 개념
    자체가 어느 표면에도 없었으므로 정합했다. 이 PR 이 push 쪽만 채워 비대칭을 **새로
    만들었다**는 점에서 API 계약 관점의 발견사항으로는 유효하게 남지만, 조치 유예의 근거가
    합리적이라 CRITICAL 이 아닌 WARNING(문서화된 기지 이슈, live 상태 확인 목적)으로 기록한다.
  - 제안: 트래킹된 후속 PR(`ExecutionStatusDto` 확장 + `getStatus()` projection)을 서두를 것.
    그 전까지는 EIA 문서 §5.3 응답 필드 표에 "`durationMs` 는 push 전용, REST 재조회엔 아직
    없음" 같은 명시 caveat 을 추가하는 것도 고려(현재 §6 필드 집합 표엔 있지만 §5.3 REST 응답
    필드 나열 자리엔 없다는 caveat 이 없어, §5.3 만 읽는 독자는 유추해야 한다).

## 그 외 점검 결과 (문제 없음으로 판정)

- **하위 호환성**: `durationMs` 추가는 세 이벤트 payload 에 필드를 하나 더하는 순수 additive
  변경이다 — 기존 필드 제거·이름 변경·타입 축소가 없다. 타입은 `?: number | null` (optional +
  nullable)로 유지돼, producer 는 "값을 모르면 `null`" 을 항상 보내지만 consumer 타입 계약은
  배포 경계에서 재생되는 키-부재 레거시 이벤트까지 흡수한다(`types.ts` 주석·CHANGELOG 명시).
  실제 소비처 `chat-channel.dispatcher.ts` 도 `{ durationMs?: number | null }` 로 캐스팅을
  넓혀 세 곳 모두 정합(`:534,571-573,589-590` — 직전 라운드 W8 로 이미 3곳 정정 완료 확인).
  기존 클라이언트가 새 필드를 무시해도 깨지지 않는다.
- **버전 관리**: 이 API 는 URL 경로 버전 세그먼트를 쓰지 않는 컨벤션(`spec/5-system/2-api-convention.md
  §1`)을 유지한다. 이번 changeset 안에 있던 위반 사례(`spec/5-system/14-external-interaction-api.md`
  §12 의 `/api/v1/executions/:id/re-run` — consistency `08_45_50` convention_compliance
  CRITICAL)는 **이미 별도 커밋으로 정정돼 이 changeset 에 포함**돼 있다(실측: 현재 소스에
  `api/v1` grep 0건). 필드 추가 자체는 스키마 버전 필드 없이 문서(CHANGELOG)로만 고지하는
  기존 관행을 그대로 따르며, additive-only 라 버전 협상 메커니즘 부재가 즉각적인 문제는 아니다.
- **응답 형식**: 세 이벤트(`completed`/`failed`/`cancelled`) 모두 동일한 필드명(`durationMs`)·
  동일한 부재 표현(`null` = 값 모름, 키 자체는 항상 존재)을 쓴다 — 형제 필드 `error.code` 의
  null 관례(§API 규약 §5.4)와 일관. `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`
  세 타입 모두 동형으로 확장됐다(`types.ts` diff 3곳 동일 패턴). WS 문서(`3-execution.md`)는
  같은 값을 `duration` 으로 표기하는 명명 불일치가 있으나 이는 **이 PR 이전부터 있던 전역
  명명 불일치**이고 spec 자신이 "표기만 다르고 같은 값" 이라 명시해 별건으로 분리했다(
  `14-external-interaction-api.md:575`) — 신규 이슈 아님.
- **에러 응답**: 이번 diff 는 에러 응답 형식을 건드리지 않는다. `error` 필드 객체화는 선행
  PR(#1170)에서 이미 완료된 별개 작업이고, 이번 diff 는 그 결과를 재사용만 한다.
- **요청 검증**: 신규/변경된 요청 파라미터·바디가 없다(순수 응답측 payload 확장). 검증 대상
  없음.
- **URL/경로 설계**: 신규 엔드포인트 없음. 기존 raw UPDATE 5경로의 `WHERE`/파라미터 바인딩
  구조는 변경 없이 `SET`/`RETURNING` 만 확장됐다(DB 계층, URL/경로와 무관).
  `/api/external/*` 네임스페이스의 RPC-style 서브채널 액션 패턴은 이번 changeset 과 무관한
  기존 구조이고, consistency 라운드가 이미 "실질 위반 아님(INFO)" 으로 정리했다.
- **페이지네이션**: 목록 API 변경 없음. 해당 없음.
- **인증/인가**: 5개 raw UPDATE 경로의 `WHERE id = :id AND status = :waiting/:pending/:running`
  상태 가드가 그대로 보존됐다(취소·마감 가능한 상태 전이 조건이 넓어지거나 좁아지지 않음).
  REST/웹훅/SSE/WS 어느 표면의 인증 미들웨어도 이번 diff 대상이 아니다.

## 요약

이번 PR 은 EIA 종결 이벤트(webhook/SSE/WS) payload 에 `durationMs` 필드 하나를 추가하는
순수 additive 변경으로, 기존 필드 제거·타입 축소가 없어 하위 호환성이 잘 보존됐고 null 부재
표현·타입 계약(consumer 관점 optional+nullable)도 형제 필드(`error.code`)와 일관된 컨벤션을
따른다. 세 이벤트 타입 모두 동형으로 확장됐고 실제 소비처(`chat-channel.dispatcher.ts`)의
캐스팅 타입도 3곳 모두 넓혀져 있다. 유일한 살아있는 API 계약 이슈는 이 PR 이 push 계열에만
`durationMs` 를 채워, 같은 리소스의 REST 단발 조회(`GET /api/external/executions/:id`)와
필드 집합이 어긋나는 **응답 스키마 비대칭**이다 — 신규로 만들어진 gap 이지만 CHANGELOG·plan
트래커에 명시적으로 등재돼 세 리뷰 라운드가 이미 인지·유예한 상태이며, 근본 처방(DTO 확장)이
다른 표면이라 이번 PR 범위 밖으로 미룬 판단 자체는 합리적이다. 그 외 URL 버전 세그먼트
위반(별도 커밋으로 이미 정정 확인)·요청 검증·인증/인가·페이지네이션 관점에서는 신규 문제가
없다.

## 위험도

LOW
