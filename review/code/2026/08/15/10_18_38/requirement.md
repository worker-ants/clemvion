STATUS=success

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` (3종 전부)

## 검토 방법

프롬프트 번들이 크기 제한으로 다수 파일(특히 `execution-engine.service.ts`/`.spec.ts`)의 diff
를 생략해, `git diff origin/main...HEAD`(현재 브랜치 `claude/eia-terminal-duration-outputs`,
`origin/main` 대비 8 커밋 ahead)를 직접 실행해 전체 diff 를 확보하고 `Read`/`Grep` 으로 실제
소스(`execution-engine.service.ts`, `retry-turn.service.ts`, `terminal-duration.ts`,
`chat-channel/types.ts`, `chat-channel.dispatcher.ts`, `execution.entity.ts`,
`spec/5-system/14-external-interaction-api.md`)를 대조했다. 이 세션은 이미 자체 ai-review
라운드(`09_58_24`)와 3회의 consistency-check 라운드(`08_45_50`/`09_00_27`/`09_58_31`)를 거쳐
CRITICAL 1건(int4 오버플로 고착)·WARNING 다수를 이미 조치한 상태(`606f54418`,`04ee6df5e`,
`0dce2a83f` 등)라, 이번 리뷰는 그 위에서 **신규로 발견되지 않은 잔여 결함**에 집중했다.

## 발견사항

- **[WARNING]** 종결 3종 payload 를 소비하는 `chat-channel.dispatcher.ts` 가 이번 PR 이 넓힌
  `durationMs: number | null` 계약을 반영하지 못했다 — 같은 클래스의 "자매 소비처 누락"
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534, 571, 587`
    (`execution.completed`/`execution.failed`/`execution.cancelled` 세 분기 전부)
  - 상세: 이번 PR 은 `codebase/backend/src/modules/chat-channel/types.ts` 의
    `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스의 `durationMs` 를
    `number` → `number | null` 로 넓혔다(consistency `09_58_31` cross_spec W1 조치, 타입 옆
    주석에 "형제 error.nodeId 와 같은 판단" 이라고 명시). 그런데 이 값을 실제로 읽어 채널
    이벤트로 변환하는 유일한 소비처인 `chat-channel.dispatcher.ts` 의 세 분기는 전부
    `(event.payload as { durationMs?: number }).durationMs` 로 **여전히 `null` 을 배제한 좁은
    타입**으로 캐스팅한다. `git diff origin/main...HEAD -- .../chat-channel.dispatcher.ts` 는
    빈 결과 — 이 파일은 이번 PR 에서 전혀 건드려지지 않았다. `durationMs` 는 이제
    "알 수 없으면 `null`"이 사실상 흔한 경로(엔티티 미로드 5경로·시계 역행·NaN/Infinity
    폴백)이므로, 이 dispatcher 를 거쳐 나가는 값도 런타임에 실제로 `null` 이 섞인다.
    현재는 다운스트림 provider(`providers/telegram/**` 등)가 `durationMs` 를 전혀 소비하지
    않아(grep 전수 확인, 사용처 0곳) 즉시 런타임 크래시로 이어지진 않고, TS 구조적 타이핑상
    `number | undefined` 가 `number | null | undefined` 의 부분집합이라 `tsc` 도 에러를 내지
    않는다. 다만 이 타입은 이 시점부터 "여기서 읽는 durationMs 는 절대 null 이 아니다" 라는
    **사실과 다른 보장**을 코드에 남기고, 다음 사람이 이 캐스팅 타입을 신뢰해 `.toFixed()` 류
    산술을 추가하면 그 자리에서 `null` 산술 크래시가 난다 — 이 저장소가 반복 지적해 온
    "하드닝을 한 곳만 적용하고 자매 소비처를 놓친다" 패턴과 동일 모양이다.
  - 제안: 세 곳 모두 `{ durationMs?: number }` → `{ durationMs?: number | null }` 로 캐스팅
    타입을 정정해 실제 계약과 일치시킬 것. (기능 회귀는 아니므로 급하지 않으나, `durationMs`
    를 실제로 렌더링하는 provider 가 추가되기 전에 정정해 두는 편이 안전하다.)

- **[WARNING]** `finalizeStalledExhausted` 의 SQL 주석이 이미 대체된 옛 구현(`GREATEST(0, …)`)을
  현재형으로 서술 — 의도·주석과 실제 구현의 괴리
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3352`
    (`durationMs: () => TERMINAL_DURATION_MS_SQL` 바로 위 줄)
  - 상세: 원래 커밋(`0f0050dea`)이 이 자리에
    `// GREATEST(0, …) — 시계 역행이 음수를 만들면 수신자의 산술이 깨진다.` 주석을 달았을 땐
    실제로 SQL 이 `GREATEST(0, …)` 를 썼다. 이후 CRITICAL 조치 커밋(`606f54418`, W8)이
    `TERMINAL_DURATION_MS_SQL` 자체를 `CASE WHEN … THEN NULL ELSE LEAST(2147483647, …) END` 로
    바꾸며 `terminal-duration.ts` 의 정본 JSDoc 은 "종전엔 `GREATEST(0, …)` 로 `0` 을 냈다"
    (과거형)로 정확히 갱신했으나, 호출부인 이 줄의 중복 주석은 갱신되지 않고 남아 지금은
    **존재하지 않는 SQL 표현을 현재형으로 설명**한다(`grep -n GREATEST` 로 확인 — 실제 SQL
    상수 어디에도 `GREATEST` 는 없다, `terminal-duration.spec.ts:132` 가 오히려
    `not.toContain('GREATEST(0')` 를 단언한다). 기능 결함은 아니지만, 이 자리만 읽는
    다음 유지보수자는 "음수를 0 으로 clamp 한다" 고 오해하게 된다 — 실제로는 `NULL` sentinel 이다.
  - 제안: 해당 줄을 `// 음수(시계 역행)는 NULL — {@link TERMINAL_DURATION_MS_SQL} 의 CASE 분기
    참조` 정도로 정정하거나, 정본 설명이 이미 `terminal-duration.ts` JSDoc 에 있으니 이 줄은
    중복 설명 대신 링크 주석으로 축소.

- **[WARNING]** spec §6.3/§6.4 의 "정규(normative) 예시" JSON 블록이 `JSON.parse` 기준으로
  여전히 무효 — 직전 라운드가 지적한 결함이 다른 형태로 재발
  - 위치: `spec/5-system/14-external-interaction-api.md:757`(§6.3 `execution.completed`
    예시, `"durationMs": 4242,` 뒤에 주석만 있고 필드 없이 `}` 로 닫힘) ·
    `spec/5-system/14-external-interaction-api.md:779`(§6.4 `execution.failed` 예시,
    `"durationMs": 4242,` 바로 다음 줄이 `}`)
  - 상세: consistency `09_58_31` convention_compliance 라운드가 "`durationMs` 삽입 시 콤마
    누락으로 파싱 불가"를 WARNING 으로 지적했고, 후속 커밋(`04ee6df5e`)이 콤마를 추가해
    조치했다고 기록했다(`RESOLUTION` 계열 문서에 준하는 커밋 메시지 "내가 넣은 JSON 이
    파싱 불가였다 … 종결"). 그러나 실측(`JSON.parse` 로 두 블록을 각각 comment 제거 후
    파싱)하면 **여전히 실패**한다 — 이번엔 정반대 방향(마지막 필드 뒤에 불필요한 trailing
    comma)의 결함이다. `"durationMs"` 가 각 객체의 **마지막 필드**인데 그 뒤에 콤마를 남긴
    채 `}` 로 닫아, "필드 사이 콤마 누락"을 고치다가 "마지막 필드 뒤 trailing comma"를
    새로 만들었다. 문서 전체에서 이 패턴(주석·다음 필드 없이 콤마 후 바로 `}`)이 나타나는
    곳은 이 두 줄이 유일하다(`grep -B1 '^\s*}\s*$'` 로 전수 확인) — 기존 관행이 아니라 이번
    편집이 만든 신규 결함이다. 같은 절이 스스로 "outbound 이벤트 계약의 SoT" 라 선언하고
    §6.2 는 이 두 예시에는 없는 "논리 구조 표기일 뿐" 면책 각주까지 따로 달아 두었으므로,
    독자는 이 JSON 을 literal 로 신뢰하고 복붙할 가능성이 높다.
  - 제안: §6.3 은 `"durationMs": 4242,` → `"durationMs": 4242` (마지막 필드이므로 콤마 제거,
    또는 콤마를 유지하려면 그 뒤 주석 줄도 없애 JSON5 스타일임을 명시), §6.4 는
    `"durationMs": 4242,` → `"durationMs": 4242` 로 trailing comma 제거. 코드 변경은 불필요
    (payload 실제 wire 값과 무관 — 순수 문서 예시 텍스트 결함).

## 확인했으나 문제 없음으로 판정한 항목 (기록 목적)

- **기능 완전성**: 종결 emit 15개 호출 지점(`execution-engine.service.ts` 12곳 +
  `retry-turn.service.ts` 3곳, `emitCancellationEvent` 헬퍼 경유 5곳 포함) 전부에
  `durationMs` 가 실려 있음을 `grep`/`Read` 로 전수 확인. `EXECUTION_QUEUE_WAIT_TIMEOUT` 등
  엔티티 미로드 5경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/
  `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)는
  `TERMINAL_DURATION_MS_SQL` 을 `.set({ durationMs: () => … })` + `.setParameter(...)` +
  `.returning(['id','duration_ms'])` 로 같은 UPDATE 문 안에서 계산·회수해 DB 와 wire 값이
  일치한다.
- **엣지 케이스**: `resolveTerminalDurationMs`/`toFiniteNumber` 가 이미 계산된 값 우선(재계산
  방지)·`startedAt`/`finishedAt` 부재·`Date` 아닌 값·`Invalid Date`·시계 역행(음수)·
  `NaN`/`Infinity`·`0`(falsy 트랩 없음, `??` 사용) 을 각각 단위 테스트로 고정
  (`terminal-duration.spec.ts` 25 케이스). "노드 0개 그래프에서 `finishedAt`/`durationMs` 가
  `if (lastNodeId)`/`if (resultNodeId)` 블록 밖으로 이동했는가"를 4개 지점
  (`execution-engine.service.ts:2403,3555,4747`, `retry-turn.service.ts:888`) 전부
  `Read` 로 직접 확인 — 전부 조건 밖으로 정확히 이동해 있다.
- **에러 시나리오**: SQL 상한 클램프(`LEAST(2147483647, …)`)가 없으면 오래 대기한 실행(park·
  idle-wait)의 취소 UPDATE 자체가 `integer out of range` 로 실패해 실행이 영구 고착되는
  CRITICAL 이 있었으나 `606f54418` 로 이미 조치·테스트됨(`terminal-duration.spec.ts` 의
  `LEAST(2147483647` / `not.toContain('GREATEST(0'` 단언).
- **반환값**: `resolveTerminalDurationMs` 는 모든 경로에서 `number | null` 을 반환하고
  `undefined` 를 반환하는 경로가 없다(JSDoc 이 그 이유—"`undefined` 는 JSON 직렬화에서 키가
  사라진다"—를 명시하고 코드가 그대로 지킨다).
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표·§6.3~§6.5·
  `spec/conventions/chat-channel-adapter.md`·`spec/3-workflow-editor/3-execution.md` 가
  이번 구현과 필드명·null 표현·"Planned→구현됨" 전환·`markQueueWaitTimeout` 의 "큐 대기
  시간(실행 시간 아님)" 의미 caveat까지 line-level 로 일치. `spec/data-flow/3-execution.md:111`
  의 시퀀스 다이어그램은 diff 밖이지만, 3개 상태 모두 `duration_ms` 를 쓰는 실제 구현이
  그 서술을 뒤늦게 참으로 만들었음을 확인(수정 불요, 기존 consistency 라운드가 이미 검증).
- webhook fanout 경로(`notification-fanout.service.ts:134` `payload: event.payload`)는
  필드 화이트리스트 없이 payload 를 그대로 전달하므로 `durationMs` 가 webhook 수신자에게도
  누락 없이 전파된다.
- TODO/FIXME/HACK/XXX 류 미완성 마커는 이번 diff 전체(`codebase/backend/src`)에서 0건.

## 요약

핵심 요구사항(종결 이벤트 `completed`/`failed`/`cancelled` 3종 전부에 `durationMs` 를 싣고,
값을 모르면 `null`, DB int4 상한을 넘는 대기 실행도 취소가 실패하지 않게)은 15개 emit
경로 전수에 걸쳐 정확히 구현되어 있고, 이미 두 차례의 자체 ai-review/consistency 라운드가
CRITICAL(int4 오버플로 고착)과 다수 WARNING(SQL sentinel 불일치·헬퍼 우회 6곳·타입 nullable·
CHANGELOG)을 실제로 조치했음을 코드 레벨에서 재확인했다. 이번 라운드에서 새로 찾은 3건은
전부 WARNING 급으로, (1) `chat-channel.dispatcher.ts` 가 이번에 넓어진 `durationMs: number |
null` 계약을 반영하지 못한 자매 소비처 누락, (2) `finalizeStalledExhausted` 자리의 주석이
이미 대체된 `GREATEST(0, …)` SQL 을 여전히 현재형으로 설명하는 문서-구현 괴리, (3) spec
§6.3/§6.4 정규 JSON 예시가 "콤마 누락"을 고치는 과정에서 "마지막 필드 뒤 trailing comma"라는
새 형태로 여전히 무효라는 것이다. 셋 다 런타임 기능에는 영향이 없고(값 계산·전파·null 처리
자체는 정확), 문서·타입 정합성 수준의 잔여 결함이라 병합을 막을 사유는 아니다.

## 위험도

LOW
