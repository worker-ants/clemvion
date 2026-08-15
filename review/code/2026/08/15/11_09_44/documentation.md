STATUS=success

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (5차 라운드, `11_09_44`)

## 방법론 노트

이 PR 은 이미 4회의 ai-review 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`)와 3회의
consistency-check 라운드(`08_45_50`→`09_00_27`→`09_58_31`, 이후 `10_52_07`)를 거쳤고, 그
산출물 전체가 이번 diff 에 그대로 포함돼 있다. 앞선 네 라운드가 이미 지적·조치한 항목(§6.3/§6.4
JSON 콤마 오류, nullable 타입 spec-코드 drift, 자매 트래커 수치 불일치 4 vs 5, `GREATEST(0,…)`
stale 주석, §6.5 blockquote lazy-continuation 흡수)은 소스에서 재확인만 하고 중복 보고하지
않았다.

프롬프트 번들이 크기 제한으로 생략한 파일(`execution-engine.service.ts` 전체 등)은 `Read`/
`Bash(git diff origin/main --)`/`grep -n`으로 직접 열어 아래 주장을 실측 대조했다.

## 발견사항

- **[WARNING] `emitCancellationEvent` 의 `durationMs` 파라미터 JSDoc 이 이 PR 자신의 실제 호출부
  동작과 어긋난다 — "생략" 이라고 적었지만 4곳 모두 명시적으로 값을 계산해 넘긴다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1107-1110`
    (이번 diff 로 새로 추가된 JSDoc — `git diff origin/main --` 로 `+` 라인임을 확인)
  - 상세: 추가된 주석은 다음과 같다 — *"EIA §6 — 종결 3종 전부에 실린다. 호출부가 값을 갖고
    있으면 넘기고, raw UPDATE 로 취소해 엔티티가 없으면 **생략**한다(그 경로는 `null` 로
    나간다)."* 즉 "엔티티를 로드하지 않는 raw-UPDATE 호출부는 `durationMs` 를 아예 넘기지 않고,
    함수 내부의 `opts.durationMs ?? null` 폴백으로 `null` 이 나간다" 는 취지로 읽힌다.

    그런데 실제 호출부 4곳(전부 raw UPDATE, 엔티티 미로드)을 `Read` 로 직접 확인하면 전부
    **명시적으로 계산된 값을 넘긴다** — "생략"하지 않는다:
    - `cancelParkedExecution` (:1077) → `durationMs: cancelledDurationMs,`
      (`toFiniteNumber(...) ?? null` 로 SQL `RETURNING` 값을 미리 계산해 둔 지역변수)
    - `markWebChatIdleTimeout` (:1208) → 동일 패턴, `cancelledDurationMs` 전달
    - `markExecutionCancelled` (:2858-2863) → `durationMs: toFiniteNumber(result.raw...) ?? null,`
    - `markQueueWaitTimeout` (:2907-2912) → 동일 패턴

    즉 이 PR 이 정확히 하려는 일("엔티티 미로드 5경로도 SQL+`RETURNING` 으로 계산해 실어
    DB=wire 를 맞춘다", CHANGELOG·`terminal-duration.ts` JSDoc·spec §6.5 가 모두 이렇게
    서술)과 이 신규 JSDoc 의 문구가 정면으로 모순된다. 현재 코드베이스에 `durationMs` 를
    실제로 "생략"(옵션 자체를 안 넘김)하는 호출부는 존재하지 않는다 — `?? null` 폴백은 오직
    "계산된 값이 `null` 로 나온 경우"를 흡수하는 방어이지, "파라미터를 안 넘긴 경우"를 위한
    것이 아니다. 다음 편집자가 이 주석만 보고 "raw UPDATE 경로는 `durationMs` 를 안 넘겨도
    된다"고 오판하면, 그 경로의 값이 새로 `null` 로 뒤집혀 이 PR 이 막 확보한 "DB 와 wire 가
    같은 값" 불변식이 조용히 깨질 수 있다.
  - 제안: "생략한다" 를 실제 동작으로 정정 — 예: *"호출부가 값을 갖고 있으면 넘기고, raw
    UPDATE 로 취소해 엔티티가 없는 4경로는 SQL(`TERMINAL_DURATION_MS_SQL`)로 계산한 값을
    `RETURNING` 으로 되받아 넘긴다. 계산 자체가 안 되면(예: 이미 terminal 이라 affected=0)
    `null` 로 폴백한다."* 정도로 바꾸면 실제 호출부 4곳과 일치한다.

- **[WARNING] spec §6.5·CHANGELOG 의 "이 값은 실행 시간이 아니라 대기 시간" 캐비엇이
  `EXECUTION_QUEUE_WAIT_TIMEOUT` 경로 하나만 짚는다 — 그런데 같은 PR 의 정본 백로그
  트래커는 park 취소·위젯 idle 취소도 동일 특성을 가진다고 이미 실측해 두었다**
  - 위치: `spec/5-system/14-external-interaction-api.md:816-818` (§6.5 blockquote,
    `EXECUTION_QUEUE_WAIT_TIMEOUT` 문단) 및 `CHANGELOG.md` (게이트 12행, "`EXECUTION_QUEUE_WAIT_TIMEOUT`
    경로의 값은 **큐 대기 시간**이다"). 대조 근거: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    의 `## ⚠️ duration_ms 에 "대기 시간" 이 섞여 집계를 오염시킨다` 절
    (`10_34_51 W3` 등재, 게이트 60행 부근) — *"이번 PR 이 처음 `duration_ms` 를 채우는 5경로
    중 **다수의 값은 실행 시간이 아니라 대기 시간**이다(위젯 idle-wait 는 기본 grace 만 1시간,
    park 취소는 무기한)."*
  - 상세: 5경로 중 raw UPDATE 로 값을 얹는 4경로(`cancelParkedExecution`·
    `markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout`) 는 전부 같은
    산식(`finishedAt - startedAt`, `TERMINAL_DURATION_MS_SQL`)을 쓴다 — `startedAt` 은 실행
    생성/시작 시각이고 `finishedAt` 은 취소 시각이므로, 실행이 `WAITING_FOR_INPUT`/`PENDING`
    상태로 **오래 머문 뒤** 취소되면 그 대기 구간이 고스란히 값에 섞인다. `cancelParkedExecution`
    (`Read` 로 확인: :1023-1089)와 `markWebChatIdleTimeout`(:1150-1210)도 `markQueueWaitTimeout`
    과 **동일한 계산식·동일한 문제**를 갖는데, spec/CHANGELOG 의 캐비엇 문구는 오직
    `markQueueWaitTimeout`(큐 대기 타임아웃)만 이름으로 지목한다. 이 PR 자신의 백로그
    트래커(파일 13, plan)가 "park 취소는 무기한 대기가 섞인다" 고 이미 실측해 등재해 둔
    사실과 spec 본문의 서술 범위가 어긋난다 — 즉 "알려진 갭은 invariant 옆에 적는다" 는 이
    문서 스스로의 관행을 이 특정 캐비엇에서는 지키지 못했다(§6.5 예외 1건은 그 관행을 잘
    지켰는데, 이 캐비엇만 범위가 좁다).

    영향: 이 spec 은 durationMs 를 "종결까지의 경과" 로 정의하고 계약상 일관됨을
    `markQueueWaitTimeout` 캐비엇에서만 부연한다. spec 만 읽고 park-cancel·idle-cancel 값을
    "실행 시간"으로 신뢰하는 외부 구독자(webhook/SSE)나 후속 편집자는 이 두 경로에 대해서도
    같은 오해를 할 수 있다 — 정작 실측된 위험(대시보드 `avgExecutionTime`, 통계
    `avgDurationMs` 오염)은 park-cancel·idle-cancel 이 `stalled 소진`과 함께 대부분을 차지한다.
  - 제안: §6.5 캐비엇을 "이 5경로 중 대기가 포함되는 경로는 `markQueueWaitTimeout` 만이
    아니다" 로 넓히거나, 최소한 `cancelParkedExecution`/`markWebChatIdleTimeout` 을 캐비엇에
    함께 나열. 집계 오염 자체의 수정은 이미 트래커에 등재돼 있어 이 PR 범위 밖이 맞지만,
    **문서 캐비엇의 범위**를 실제 영향받는 경로 수만큼 넓히는 것은 이 PR 의 문서 편집
    비용만으로 가능하다.

- **[INFO] `plan/in-progress/eia-terminal-payload.md` §"차단 해제 조건" 이 이미 해소된 BLOCK
  상태를 여전히 현재형으로 서술 — 3번째 지적 (재확인만, 비차단)**
  - 위치: `plan/in-progress/eia-terminal-payload.md:275` 부근(실제 파일 줄 번호, diff 밖).
  - 상세: `09_00_27` consistency 라운드와 `10_52_08` ai-review 문서화 라운드가 각각 이미
    지적했고 둘 다 "급하지 않음(비차단)" 으로 처분했다. 이번 라운드 시점까지도 한 줄 캐비엇이
    반영되지 않아 재확인만 한다 — 새로 조치를 요구하지 않는다.

## 그 외 확인 결과 (문제 없음 — 이미 검증됐거나 이번에 재확인)

- **CHANGELOG**: 신규 항목이 직전 항목의 예고를 정확히 이어받고, 필드 추가 성격(제거·변경
  아님)·`null` 방어 필요성·REST 비대칭을 명시적으로 고지한다. 앞선 라운드가 지적한 "breaking"
  용어 불일치(테스트 주석 vs CHANGELOG 본문)는 이미 INFO 로 기록됐고 실질 영향이 없어
  재차단 사유 아니다.
- **JSDoc 품질**: `terminal-duration.ts` 의 `resolveTerminalDurationMs`/`toFiniteNumber`/
  `TERMINAL_DURATION_MS_SQL` 는 이 세션에서 반복 검증된 대로 "왜"(실측 회귀, int4 상한,
  음수 sentinel 통일)를 근거와 함께 갖춘 상세 JSDoc 을 유지하고 있다.
- **타입-스펙 정합**: `types.ts`(`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)와
  `chat-channel-adapter.md` 인라인 union 모두 `durationMs?: number | null` 로 이미 정정돼
  있고(1차 라운드 WARNING 해소 확인), `chat-channel.dispatcher.ts` 캐스트 3곳도 같은 타입과
  일치한다.
- **예제 코드**: §6.3/§6.4 JSON 예제에 `"durationMs": 4242` 가 정확히 반영돼 있고 콤마 구문도
  정상(직전 라운드 파싱 검증 유지 확인).
- **README/설정 문서**: 신규 환경변수·CLI 플래그·설정 옵션 없음 — README 갱신 불필요(다수
  라운드 동일 결론).
- **타입 주석 3중 복제**(`types.ts` 세 인터페이스 앞 동일 5줄 JSDoc)와 REST §5.3 self-documenting
  캐비엇 부재는 앞선 두 라운드가 이미 INFO 로 기록했고 강제 조치 대상이 아니라 재열거하지
  않는다.

## 요약

이 PR 의 문서화 수준은 다섯 라운드에 걸친 반복 검증을 거치며 이 저장소 평균을 크게 웃도는
상태로 수렴했다 — CHANGELOG·spec 3개 파일·convention 문서·plan 트래커 3개가 숫자까지
일관되고, 신규 헬퍼(`terminal-duration.ts`)의 JSDoc 은 이 세션이 읽은 문서 중 최고 수준이다.
다만 이번 라운드에서 두 건의 실측 결함을 새로 확인했다: (1) `emitCancellationEvent` 의
`durationMs` 파라미터에 이번 PR 이 새로 추가한 JSDoc 이 "raw UPDATE 경로는 값을 생략한다"고
적었는데, 실제로는 그 4경로 전부가 SQL 계산값을 명시적으로 넘긴다 — 이 PR 이 막 확보한
"DB=wire" 불변식을 다음 편집자가 이 주석 때문에 실수로 되돌릴 위험이 있어 WARNING 이다.
(2) spec §6.5 의 "이 값은 대기 시간이지 실행 시간이 아니다" 캐비엇이 `markQueueWaitTimeout`
하나만 짚는데, 이 PR 자신의 백로그 트래커는 park 취소·위젯 idle 취소도 같은 특성(오히려
더 큰 폭의 대기)을 갖는다고 이미 실측해 등재해 두었다 — 캐비엇의 범위가 실제 영향 범위보다
좁다. 둘 다 런타임 동작을 바꾸지 않는 순수 문서 결함이지만, (1)은 향후 회귀를 유발할 수
있는 성격이라 WARNING 으로, (2)는 외부 구독자·후속 편집자를 오도할 수 있는 캐비엇 스코프
문제라 WARNING 으로 판정한다. CRITICAL 은 없다.

## 위험도

LOW
