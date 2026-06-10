# Rationale 연속성 검토 결과

## 발견사항

- **[WARNING]** `RESUME_*` 후행 이벤트 경로 — 엔진 §7.5 line 967 의 기각 미문서화
  - target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md` §"2. 엔진 §7.5(line 967) — §7.5.1 과 일치" + 변경안 본문
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.5` line 967 현행 문장 및 §7.5.1 line 995. 두 절은 이미 병존하고 있으나 §7.5 line 967 은 아직 정정 전("ack 에 `resumed: false` + error 로 노출"로 기술) 상태다.
  - 상세: target 이 §7.5 line 967 을 "동기 ack 가 아닌 후행 `EXECUTION_CANCELLED` 이벤트로 통지"로 정정한다. 이는 기존 §7.5.1("RESUME_* 는 후행 이벤트") 의 기술과 일치하는 방향이므로 내용 자체는 옳다. 그러나 target 의 Rationale 항에서 "게이트웨이가 동기 resumed 판정을 반환하는 대안(B)은 기각" 이라는 기술은 있지만, 정작 **§7.5 line 967 의 "ack 에 resumed: false + error"가 왜 최초에 spec 에 들어갔고 그것을 §7.5.1 로 번복하는 이유**가 기존 어떤 Rationale 에도 기록돼 있지 않다. 즉 §7.5 line 967 은 과거 결정(동기 ack 노출)의 잔재인데, 그 결정을 번복하는 역사적 근거(왜 최초에 동기 ack 로 기술했는가, 언제 worker 비동기 경로로 이동됐는가)가 spec Rationale 어디에도 없다. target 의 자체 Rationale 은 "always-enqueue 모델에서 충족 불가" 라고 설명하나 이것이 §7.5 의 해당 결정을 공식 번복하는 섹션으로 §7.5 Rationale 에 추가될지 명시되지 않는다.
  - 제안: `spec/5-system/4-execution-engine.md` §Rationale 에 "`RESUME_*` 동기 ack 노출(§7.5 옛 기술) 폐기" 항목을 추가해 "최초 §7.5 기술이 enqueue-before-rehydration 흐름을 전제하지 않은 초기 설계 잔재였고, BullMQ 항상 enqueue(§7.4 §0-overview Rationale "실행 엔진") 도입 이후 §7.5.1 이 correct authoritative 경로가 됐음"을 명문화한다.

- **[WARNING]** `resumed` 필드 의미 재정의 — WS spec Rationale 에 선행 결정 부재
  - target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md` §"1. WS §4.2 — resumed 정의 정정"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §4.2 line 241 (`resumed | boolean | 재개 성공 여부`) — 이 정의 자체가 어느 시점에 채택됐는지에 대한 Rationale 항목 없음.
  - 상세: target 은 `resumed` 정의를 "재개 성공 여부" → "재개 시작 수락(enqueue) 여부"로 변경한다. WS spec §Rationale 은 이 필드의 최초 채택 맥락을 전혀 기록하지 않는다 — 현재 WS spec Rationale 에는 `resumed` 단어가 등장하지 않는다. 따라서 "재개 성공 여부"가 의도적으로 채택된 합의 결정인지, 아니면 단순 초기 기술인지를 확인할 수 없다. target 자체의 Rationale ("always-enqueue 모델에서 동기 시점 재개 성공 판정 불가")은 논리적으로 충분하나, 이것이 WS spec §Rationale 내에 보존되지 않으면 다음 검토자가 "이 정의 변경은 합의됐는가" 를 추적하기 어렵다.
  - 제안: `spec/5-system/6-websocket-protocol.md` §Rationale 에 "`resumed` 의미 재정의 (enqueue 수락으로)" 항목을 신설해 ① 옛 "재개 성공 여부" 정의, ② always-enqueue 모델 채택 후 동기 성공 판정 불가 이유, ③ "enqueue 수락" 으로 재정의한 근거, ④ 대안 B(동기 판정) 기각 사유를 명시한다. target 의 Rationale 블록에 있는 내용을 그대로 WS spec Rationale 로 이식하는 형태면 충분하다.

- **[INFO]** `retry_last_turn` 의 `resumed` 필드 의미 — 정의 변경 후 일관성 확인 필요
  - target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md` §변경안 1 — "4종 continuation ack 한정"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §4.2 line 339 (`success: true, ..., resumed: true`) — retry_last_turn ack 도 `resumed` 필드를 포함.
  - 상세: target 은 변경 범위를 "4종 continuation ack 한정"으로 명시하고 `retry_last_turn` 은 제외한다고 각주에서 설명한다. 그런데 `retry_last_turn` ack 의 `resumed` 필드(line 339) 는 "재개 성공 여부"와 "enqueue 수락" 중 어느 정의를 따르는가가 불명확해진다. `retry_last_turn` 은 BullMQ enqueue 경로(publisher side `INVALID_EXECUTION_STATE` 동기 검증 후 enqueue)를 타므로 엄밀히는 동일 재정의가 적용돼야 할 수 있다. 단 target 이 이 분기를 "publisher 측 동기 검증 실패(INVALID state / queued=false)이지 RESUME_* 가 아니다"고 명시해 일관성을 주장하므로 CRITICAL 급은 아니다.
  - 제안: WS spec §4.2 의 `retry_last_turn` ack 설명 또는 해당 Rationale 항에서 `resumed` 필드가 "동기 검증 결과"를 반영하는 필드로 4종 continuation 과 구분됨을 한 문장으로 명시한다.

- **[INFO]** `spec/0-overview.md` Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"과의 cross-check
  - target 위치: `plan/in-progress/spec-update-ws-resumed-ack.md` 전체
  - 과거 결정 출처: `spec/0-overview.md` Rationale §"실행 엔진: Redis 큐 + 분산 워커 풀" — "모든 진입점 항상 BullMQ enqueue"
  - 상세: target 의 근거 전제("always-enqueue 모델") 는 `spec/0-overview.md` Rationale 의 위 결정과 정합한다. 충돌 없음. 다만 target 의 자체 Rationale 이 이 cross-spec 결정을 명시 인용하지 않아 연결 고리가 약하다. spec 정정 시 `0-overview.md` Rationale 항을 명시 참조하면 추적성이 강화된다.
  - 제안: WS spec §Rationale 신설 항에 `spec/0-overview.md §Rationale "실행 엔진"` 인용 링크를 추가해 "always-enqueue 원칙의 근거 SoT" 를 명시한다.

## 요약

target 문서가 제안하는 두 정정(WS `resumed` 재정의, 엔진 §7.5 line 967 후행 이벤트 경로로 수정)은 합의된 "always-enqueue" 원칙(`spec/0-overview.md` Rationale, 엔진 §7.5.1)과 방향이 일치하며 기각된 대안(대안 B: 동기 판정)도 자체 Rationale 에서 명시적으로 폐기한다. 그러나 두 변경 모두 각 spec 의 `## Rationale` 에 공식 항목을 추가하지 않고 plan 문서의 Rationale 블록에만 기록돼 있다. 특히 엔진 §7.5 line 967 의 "ack 동기 노출" 기술이 언제, 왜 도입됐는지 spec Rationale 에 선행 기록이 없어 번복의 역사적 근거 추적이 불가한 점이 WARNING 수준의 문제다. WS `resumed` 재정의도 마찬가지로 원래 정의의 채택 맥락이 spec Rationale 에 부재해 이번 변경이 합의 번복인지 오류 수정인지 판단 근거가 희박하다. 두 spec 파일에 각각 Rationale 항목을 추가하는 것이 필요하다.

## 위험도

LOW
