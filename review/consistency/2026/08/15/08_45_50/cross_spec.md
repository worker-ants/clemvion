# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위·방법

target 은 `spec/5-system/` 전체(번들 예산 초과로 `2-api-convention.md`·`6-websocket-protocol.md` 만
본문 포함, 나머지 14개는 절단됨). 절단된 파일 중 이번 라운드가 실제로 손대는
`14-external-interaction-api.md`(EIA, §6 종결 이벤트 계약이 이번 plan(`eia-terminal-payload`)의
`durationMs` 다음-PR 착수 직전 검토 대상)는 저장소에서 직접 `Read` 했다. 비교 대상은
`spec/1-data-model.md` · `spec/data-flow/3-execution.md` · `spec/data-flow/15-external-interaction.md` ·
`spec/conventions/chat-channel-adapter.md` · `spec/conventions/redis-keys.md` ·
`spec/3-workflow-editor/3-execution.md` · `spec/5-system/4-execution-engine.md`(§9 Redis 키) ·
`spec/5-system/2-api-convention.md`(§7 rate limit)·`spec/2-navigation/14-execution-history.md`.

이미 여러 라운드의 consistency-check 를 거친 영역(§R8 idempotency 캐시 스코프, §8.4 rate limit
수치, §11 WS↔외부 명령 매핑, `error.code`/`nodeId` nullable 정합, redis-keys.md 인벤토리)은
재확인해 **전부 정합**을 확인했고 아래엔 새로 발견된 것만 적는다.

## 발견사항

- **[WARNING]** `data-flow/3-execution.md` 의 실행 시퀀스 다이어그램이 `cancelled` 종결에도
  `duration_ms` 를 기록한다고 암시 — EIA §6 필드 집합 표(normative, 코드 감사 근거)와 어긋난다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합
    (normative)" `durationMs` 행 — *"`completed` 는 emit 직전에 계산돼 있으나 **`cancelled` 계열은
    계산·영속조차 하지 않는다**"*
  - 충돌 대상: `spec/data-flow/3-execution.md:111` — `Eng->>PG: UPDATE execution SET
    status='completed'/'failed'/'cancelled', finished_at, duration_ms, active_running_ms,
    output_data` (§1.2 첫 active 세그먼트 다이어그램의 loop 이후 단일 UPDATE 문으로, 세 상태
    모두에 `duration_ms` 를 쓰는 것처럼 표기)
  - 상세: `plan/in-progress/eia-terminal-payload.md` 재판정 ④(이번 라운드가 착수 직전에 발판으로
    삼는 실측)는 `execution-engine.service.ts` 를 직접 감사해 취소 종결 emit 지점 4곳
    (`emitCancellationEvent` 호출부 전부 — raw UPDATE, `.returning('id')` 만)은 **`duration_ms` 를
    계산·영속하지 않는다**고 확인했다(2곳 `finalizeCancelledExecution`/retry `isCancelled` arm 만
    이미 O). `data-flow/3-execution.md:111` 은 이 구분 없이 세 상태를 한 UPDATE 문으로 뭉뚱그려
    `duration_ms` 가 `cancelled` 에도 항상 쓰이는 것처럼 읽힌다. 이 diagram 은
    `finalizeCancelledExecution` 등이 실행되는 지점이 아니라 "첫 active 세그먼트" 루프 종료
    직후 한 곳을 대표 표기한 것으로 보이나, 그 대표성 자체가 지금 오도(誤導)한다.
  - 제안: 이번 plan 이 `durationMs` 취소 경로 배관을 구현하면서 spec 동반 변경으로 추적 중인
    표(`eia-terminal-payload.md` "spec 동반 변경 (전수)")에 **이 줄이 빠져 있다** — 그 표에
    `data-flow/3-execution.md:111` 을 추가하거나(구현 완료 후 실제 5곳 raw UPDATE 반영), 지금
    당장은 `3-workflow-editor/3-execution.md:292-297` 이 이미 쓰고 있는 것과 같은 형태의 caveat
    ("이 다이어그램의 필드 유무를 계약으로 읽지 말 것, SoT 는 EIA §6")을 추가해 현재 상태의
    오독을 차단한다.

- **[WARNING]** `chat-channel-adapter.md` 의 `execution.completed` 렌더 매핑이 EIA 가 정의한 적
  없는 `result.outputs.summary` 를 전제한다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 `result.outputs`
    행 — `completed` / **미구현 (Planned)** / *"데이터는 emit 직전 존재하나 payload 에 넣지
    않는다"*. §6.3 본문도 "`result.outputs` · `durationMs` 는 **Planned** 다" 라고만 하고
    `outputs` 의 **내용·shape 을 정의한 문장이 하나도 없다** (`plan/in-progress/eia-terminal-payload.md`
    가 같은 이유로 이번 PR 범위에서 `result.outputs` 를 제외 — "spec 이 이 필드의 **내용을 정의한
    적이 없다** … 채우면 내가 계약을 발명하게 된다").
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md:367` — `execution.completed` 행:
    `result.outputs` → *"`text` 1건 — `languageHints.executionCompleted` **또는 result 의
    summary**"*
  - 상세: 이 매핑 표 행은 `result.outputs` 에 "summary" 라는 하위 필드가 존재해 `renderNode` 가
    그걸 읽어 텍스트를 합성할 수 있다고 전제한다. 그런 하위 필드는 EIA §6(SoT)·`1-data-model.md`
    `Execution.output_data`·chat-channel-adapter.md 자신의 §1.2 TS union(`result?: { outputs?:
    unknown }`, "Planned" 로 unknown 처리) 어디에도 정의돼 있지 않다 — "summary" 라는 문자열이
    이 문서 전체에서 이 한 줄에만 등장한다(같은 문서 §1.2 line 159-160 은 오히려 "현행 emit 은
    `status` 만 채운다 — `outputs` 는 Planned" 라고 정반대로 정확히 캐비엇한다). 같은 문서 §1.2
    가 스스로 선언한 규칙("어긋나면 EIA 쪽이 참", R3)을 적용해도 "그럼 무엇을 렌더해야 하는가"
    라는 실무 질문에는 답이 없다 — EIA 가 `summary` 개념 자체를 발명한 적이 없기 때문에
    "EIA 쪽이 참" 이 가리키는 정답이 없다.
  - 제안: `result.outputs` 의 내용·shape 정의는 이미 `eia-terminal-payload.md` 가 "다음 PR"
    로 이연했고 그 결정 근거에 "채우면 내가 계약을 발명하게 된다" 를 명시했다 — 그 후속 planner
    턴이 shape 을 정의할 때 `chat-channel-adapter.md:367` 의 "summary" 문구도 **같은 턴에** 실제
    정의된 필드명으로 교체하거나 제거할 것. 그 전까지는 이 행이 미정의 필드를 참조하고 있다는
    사실을 캐비엇으로 남겨 두는 편이 안전하다(현재는 `result.outputs` 가 실제로 비어 있어 항상
    `languageHints.executionCompleted` 폴백으로만 동작하므로 런타임 영향은 없다 — 문서 정합성
    문제다).

## 확인했으나 충돌 아님 (참고)

- WS §4.6 `execution.retry_last_turn` 행이 EIA §11 매핑 표에는 없음 — git 이력(`4c2c547c9`
  #289)에서 이미 검토 WARNING 을 거쳐 "외부 미노출, 내부 UI 한정" 으로 의도적으로 압축된 것이며
  EIA §3.2 `EIA-IN-02` 요구사항 행이 그 사유를 명시한다. 신규 발견 아님.
- EIA §6.4 `error.code`/`nodeId` nullable, §R8 idempotency 캐시 키 스코프(`interaction:idempotency:
  <executionId>:<route>:<key>`), §8.4 rate limit 수치(60/120/3), §11 WS↔외부 명령 매핑(retry_last_turn
  제외 전체)은 `2-api-convention.md`·`redis-keys.md`·`data-flow/15-external-interaction.md`·
  `6-websocket-protocol.md` 전부와 정합.
- `1-data-model.md` §2.13 `Execution.duration_ms`(wall-clock)·`error` shape(`{nodeId, code, message,
  details?}`, nullable)은 EIA §6.4/§7.2 와 정합 — §7.2 "신규 컬럼 없음" 도 사실과 일치(다음 PR 은
  기존 컬럼에 값만 채움).

## 요약

target `spec/5-system/`(특히 EIA §6) 은 이미 여러 라운드의 cross-spec 정합화를 거쳐 API 규약·
Redis 키·WS 프로토콜·data-model 과 대체로 잘 맞아 있다. 이번 라운드에서 새로 발견한 것은 둘 다
**아직 손대지 않은 "다음 PR"(durationMs 취소 경로 배관 · result.outputs 정의)이 정확히 건드릴
자리에 있는 기존 drift** 다 — data-flow 시퀀스 다이어그램의 뭉뚱그려진 `duration_ms` UPDATE 표기와
chat-channel-adapter 의 미정의 `summary` 참조. 둘 다 지금 당장 구현을 막는 CRITICAL 은 아니지만
(전자는 문서 오독 위험, 후자는 런타임 영향 없는 죽은 참조), 이번 plan 이 `durationMs`·
`result.outputs` 를 구현하는 시점에 함께 정리하지 않으면 새 구현이 착지한 뒤에도 두 문서가
낡은 상태로 남는다. developer 의 자체 "spec 동반 변경" 추적표에 이 두 위치가 빠져 있으므로
착수 전에 추가할 것을 권한다.

## 위험도

LOW
