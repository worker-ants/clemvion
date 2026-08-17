# Rationale 연속성 검토 — spec/5-system/ (EIA masking follow-ups)

## 조사 방법
- target 은 `spec/5-system/` 전역이며, 실제 diff 는 `git diff origin/main...HEAD`(브랜치
  `claude/eia-masking-followups-3cd512`)로 직접 조회 — 조립된 prompt 파일은 컨텍스트 예산
  초과로 diff 원문과 다수 `spec/5-system/*.md` 본문이 절단돼 있어(⚠️ 명시됨), 절단된 부분은
  워크트리에서 `git diff`/`git log`/`Read` 로 직접 재조회했다.
- 변경 spec: `spec/1-data-model.md`, `spec/5-system/{3-error-handling,6-websocket-protocol,
  12-webhook,13-replay-rerun,14-external-interaction-api,15-chat-channel}.md`,
  `spec/conventions/node-output.md`. 대응 코드: `executions.service.ts`,
  `background-runs.service.ts`, `websocket.service.ts`, `redact-stored-error.ts`,
  `sanitize-error-message.ts` 등.
- 이 브랜치는 `origin/main` 에 이미 머지된 3개 선행 PR(#1177/#1178/#1179 — 종결 `error.message`
  마스킹 → §R17 카탈로그 등재 → 내부 읽기 경로 egress 마스킹)의 연장선으로, 이번 커밋들이
  WS node/비종결 emit 마스킹·`outputData` 확장·`inputData` 마스킹 도입/철회·문서 정합화를 이어
  붙였다.

## 발견사항

- **[WARNING]** EIA §R17 의 egress(응답 시점) 값-패턴 마스킹이, 같은 spec 트리의 webhook
  ingestion-마스킹 Rationale 이 명시적으로 기각한 "display 시점 마스킹" 패턴을 다른 데이터
  클래스에 재도입한다 — 재도입 자체는 새 Rationale 로 조정됐으나, 기각 근거 중 하나(표면별
  whack-a-mole)는 명시적으로 반박되지 않았고 오히려 이번 커밋 시퀀스가 그 우려를 실증했다.
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가 —
    ingestion-time 과 egress-time 이 공존한다" 절 (§R17 하단, `Execution.error`/`outputData`
    egress 마스킹 전체).
  - 과거 결정 출처: `spec/5-system/12-webhook.md` `## Rationale` → "민감 헤더 마스킹 —
    ingestion(저장) 시점 채택 (2026-07-07)". 이 항목은 "**display(응답) 시점 마스킹**(원본을
    `Execution.inputData` 에 저장하고 응답 DTO 에서만 마스킹)" 을 **명시적으로 기각**하며
    두 근거를 든다: (a) DB 잔존 = 유출 표면, (b) *"`inputData`·`output.request.headers`·
    `$trigger.headers` + 향후 신규 read 경로까지 단일 소스로 커버 — **표면별 마스킹의
    whack-a-mole 을 원천 차단**"*.
  - 상세: §R17 이 채택한 아키텍처(DB 는 원문 보존, 값이 나가는 시점마다 마스킹)는 구조적으로
    webhook Rationale 이 (b) 논거로 기각한 바로 그 "display 시점 마스킹" 이다. 대상 데이터가
    다르다(구조화된 헤더 key vs 자유 텍스트 진단 필드)는 점은 §R17 자신이 이미 인지하고
    "언제 가리는가" 절에서 (a) 논거(DB 잔존 위험)에는 정면으로 응답한다 — "그 대가로 얻는
    진단 가치와 저울질한 결과가 egress-only" 라고. 그러나 (b) whack-a-mole 논거는 명시적으로
    이름 붙여 반박되지 않는다. 그리고 이 우려는 **이 브랜치 자체에서 실증됐다** — `git log`
    상 같은 이슈군이 최소 4라운드에 걸쳐 새 누출 표면을 발견했다: 종결 `error.message`
    (#1177) → 내부 읽기 경로 4곳 (#1178/#1179) → 실측 후 "여섯" 으로 정정(R17 §R17 "적용
    범위는 총칭이 아니라 열거다" 의 자기-정정 문구, "넷 이라는 수치가 이미 낡아 있었다") →
    WS node/비종결 emit (이번 브랜치) → `outputData` 컬럼 추가(이번 브랜치) → `inputData` 는
    한 차례 마스킹했다가 되돌림(`b05756d9e`, 재제출 오염 발견). 이는 정확히 webhook
    Rationale 이 예견한 "표면별 마스킹은 하나씩만 고쳐진다" 패턴이다.
  - 제안: §R17 "언제 가리는가" 절에 한 문장 추가 — *"webhook Rationale 이 근거로 든 (b)
    whack-a-mole 우려는 이 결정 궤적에서 실제로 관측됐다(표면 4→6, `inputData` 1회 왕복).
    §R17 은 이를 **산발적 호출부 패치가 아니라 소수의 공유 관문**(`toResponseExecution`
    · `WebsocketService.emitExecutionEvent`/`emitNodeEvent` · `toTerminalErrorPayload`)으로
    수렴시켜, 새 emit/read 경로가 추가돼도 관문을 통과하기만 하면 마스킹이 구조적으로
    상속되게 하는 방식으로 그 위험을 완화한다"* 는 취지로, 왜 이번엔 whack-a-mole 이
    구조적으로 닫혔다고 보는지 반박 근거를 명시하면 두 Rationale 간 긴장이 완전히 해소된다.
    (CRITICAL 로 올리지 않은 이유: 데이터 클래스 구분·DB-잔존 논거 반박·egress-only 원칙
    반복 명시 등 대부분의 조정이 이미 target 안에 존재하며, 이 finding 은 그 조정에서 빠진
    **한 개의 named 논거**를 마저 닫으라는 보완 요청에 가깝다.)

- **[INFO]** `boundary masking parity` 원칙의 인용 계보가 2단계 "원용"(analogy) 을 거치며
  출처가 흐려질 여지가 있다.
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 — "`execution:<id>`
    구독 인가가 workspace 소유만 보고 role 을 구분하지 않아... EIA §R17 의 boundary masking
    parity 원칙과 같은 근거다".
  - 과거 결정 출처: 이 용어의 원 출처는 `spec/2-navigation/14-execution-history.md` R-5
    (Config 탭 viewer 노출이 안전한 이유 — "안전성은 롤 게이팅이 아니라 서버 boundary
    masking parity 에 의존"). EIA §R17 자신도 이를 인용할 때 "R-5 의 직접 대상은 Config 탭이라
    `Execution.error` 를 이미 규정하고 있지는 않다 — 원칙을 **원용**한 것이지 기존 판정이
    아니다" 라고 스스로 명시해 뒀다(§R17 "내부 읽기 경로도 같은 마스킹을 적용한다" 불릿).
  - 상세: WS §4.1 은 이 원칙을 "EIA §R17 의" 원칙이라고 인용하는데, R17 자신은 이를 R-5 에서
    "원용" 한 것이라고 밝혀 뒀다. 즉 WS 문서가 인용의 인용을 마치 EIA 가 직접 확립한 원칙인
    것처럼 표기해, 계보를 거슬러 올라가면 origin(R-5)의 스코프 caveat 이 두 단계 뒤에서
    사라진다. 실질적 의미(같은 수신 인구 → 같은 보호 필요)는 매 단계에서 타당하게
    재적용되고 있어 결론이 틀린 것은 아니다.
  - 제안: WS §4.1 캐비엇의 인용을 "[EIA §R17](...) 의 boundary masking parity 원칙(원 출처
    [실행 내역 R-5](../2-navigation/14-execution-history.md#r-5))" 처럼 원 출처까지 한 홉 더
    명시하면, 이후 이 원칙을 또 인용하는 문서가 계보를 잃지 않는다. 급하지 않음.

## 확인했지만 문제 없음으로 판정한 항목 (참고용)

- `llmCalls` strip-only 결정(WS Rationale, 2026-06 확정)은 새 값-패턴 마스킹에서
  `WIRE_PRESERVED_FIELDS`(= `EXTERNAL_STRIPPED_FIELDS`)로 명시적으로 제외돼 번복되지 않음 —
  코드(`websocket.service.ts` `maskWireEnvelope`)로 확인.
- `node-output.md` Principle 7 "config 그대로 echo" 원칙과 신규 egress 값-마스킹의 관계는
  "절대 echo 금지" 목록을 egress 에서 집행하는 backstop 으로 명시적으로 정합화돼 있음(신규
  예외 아님으로 스스로 규정).
- `13-replay-rerun.md`/`14-external-interaction-api.md` §R17 잔여②의 `inputData` 비대상
  결정은 `spec/5-system/13-replay-rerun.md` Rationale "왜 B2(원본 미리보기+편집) 가 기본인가"
  가 이미 확립한 프리필-편집 UX 와 직접 인과관계가 있어 번복이 아니라 그 UX 의 논리적 귀결.
- `spec/2-navigation/14-execution-history.md` R-5 는 이미(2026-08-16 addendum) 자신의
  "boundary masking parity" 가 **write-시점**(`maskSensitiveFields`, config echo 전용)
  근거이고 `Execution.error`/`outputData` 의 egress 마스킹과는 **별개 정책**임을 명시적으로
  경계 지어 둬, "error 도 write 시점에 마스킹된다" 는 오독을 스스로 차단하고 있음(선행 PR
  범위, 이번 diff 밖).
- chat-channel `CCH-MP-06` 의 `"output.rendered` 텍스트 그대로" 문구가 emit 마스킹과
  충돌하는 듯 보였으나, target 자체가 "그대로"의 정의를 "마스킹 이후 값" 으로 명시 정정해
  둠(`chat-channel verbatim 계약과의 충돌 해소`, 커밋 `81c9fcd60`) — 이미 해소된 이력.

## 요약

이번 EIA 마스킹 후속 변경 시퀀스는 Rationale 연속성 관점에서 예외적으로 잘 관리돼 있다 —
`llmCalls` strip-only, config raw-echo, `inputData` 재제출-오염, R-5 scope 등 여러 지점에서
과거 결정을 뒤집지 않았음을 스스로 인용·검증하는 caveat 을 남겼고, 실제로 검증 결과 그
주장들은 코드·과거 Rationale 과 정합했다. 유일하게 실질적인 긴장은 webhook ingestion-시점
마스킹 Rationale 이 기각한 "display 시점 마스킹" 패턴을 EIA §R17 이 다른 데이터 클래스에
채택하면서, 기각 근거 중 DB-잔존 논거는 정면으로 재반박했지만 whack-a-mole 논거는 이름 붙여
반박하지 않았다는 점이다 — 그리고 공교롭게도 이 브랜치 자체의 커밋 이력(표면 4→6, `inputData`
1회 왕복)이 그 whack-a-mole 우려의 실사례가 됐다. CRITICAL 로 볼 사안은 아니며(데이터 클래스
구분 근거는 실재하고 타당함), §R17 에 한 문단만 보강하면 완전히 닫힌다.

## 위험도

LOW
