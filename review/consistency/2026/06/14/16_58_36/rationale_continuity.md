# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` + `spec/data-flow/0-overview.md` + `spec/data-flow/15-external-interaction.md`
검토 모드: --impl-done (diff-base=3064c9c6)
검토 일시: 2026-06-14

---

## 발견사항

### [WARNING] §9.1 step 8a — SSE 어댑터를 "Redis pub/sub 으로" 기술, 실제 구현(in-memory) 및 R10 Planned 표기와 불일치

- **target 위치**: `14-external-interaction-api.md` §9.1 처리 흐름 step 8a
  `→ SSE 어댑터가 Redis pub/sub 으로 받아 외부 SSE 스트림에 데이터 라인 push`
- **과거 결정 출처**: 동일 spec `## Rationale § R10` 항목 및 §10 구현 파일 구조 주석
  - R10 "(b) SSE 어댑터" 상세: "현재 `executionEvents$` 를 **in-process(in-memory) 직접 구독** 하여 외부 SSE 스트림으로 fan-out. **Redis pub/sub 경유 구독은 미구현 (Planned)**"
  - §10 주석: "`sse-adapter.service.ts` — 단일 sink executionEvents$ 구독 → SSE stream fan-out (현재 in-memory, Redis pub/sub 은 Planned §R10)"
- **상세**: R10 Rationale 과 §10 구현 파일 주석에서는 SSE 어댑터가 현재 in-process(in-memory)로 단일 sink를 직접 구독하며 Redis pub/sub 분산 fan-out은 명시적으로 Planned(미구현)임을 명시한다. 그러나 §9.1 처리 흐름 step 8a 는 "SSE 어댑터가 Redis pub/sub 으로 받아"라고 기술해 마치 Redis 경유가 현재 구현된 것처럼 오해를 야기한다. 이는 결정의 번복이 아니라 Planned 항목을 기구현 상태로 표기한 내부 서술 불일치다.
- **제안**: step 8a 의 해당 라인을 "→ SSE 어댑터가 `executionEvents$` in-process 구독으로 외부 SSE 스트림에 데이터 라인 push (다중 인스턴스 분산 fan-out 은 Redis pub/sub — Planned §R10)"으로 수정한다.

---

### [INFO] R10 상단 bullet — SSE 어댑터를 "Redis pub/sub으로 구독" 기술, 하단 상세 box 와 자체 불일치

- **target 위치**: `14-external-interaction-api.md` §Rationale R10 세부 구조 bullet (세 번째 bullet)
  `SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독해 외부 SSE 스트림으로 변환. 엔진과 직접 결합 없음`
- **과거 결정 출처**: 동일 R10 하단 "(b) SSE 어댑터" 상세 box
- **상세**: R10 세부 구조 bullet이 "Redis pub/sub 으로 구독"이라고 표현하지만, 동일 R10의 하단 상세 box는 이를 Planned로 명시한다. Rationale 내에서 같은 항목에 대한 상반된 표기가 공존해 독자 혼란을 야기할 수 있다. 기각된 대안 재도입 수준은 아니지만 Rationale 자체 정합 보완이 필요하다.
- **제안**: 상단 bullet의 SSE 어댑터 설명을 "(현 v1: in-memory 직접 구독; Planned: Redis pub/sub 분산 fan-out)" 형식으로 수정해 하단 상세 box와 정합시킨다.

---

### [INFO] §9.3 본문 — R15에서 기각된 "전용 outbox pattern" 을 여전히 구현 옵션으로 열어둠

- **target 위치**: `14-external-interaction-api.md` §9.3 트랜잭션과 발송 순서 본문
  `이를 위해 NotificationDispatcher 는 after-commit hook (또는 outbox pattern 의 별도 worker — 구현 선택) 으로 트리거된다.`
- **과거 결정 출처**: 동일 spec `## Rationale §R15`
  - R15 기각 목록: "(b) 전용 outbox 테이블 — 위 dual-write 사유로 기각."
- **상세**: R15는 전용 outbox 테이블을 명시적으로 기각하고 `execution_token` reconciliation을 outbox 대체제로 채택했다. 그러나 §9.3 본문은 "outbox pattern의 별도 worker — 구현 선택"이라는 표현으로 기각된 옵션을 여전히 열어둔다. 후속 구현자가 R15 기각 결정을 인지하지 못한 채 전용 outbox 테이블을 구현할 여지를 남긴다.
- **제안**: §9.3 본문에서 "또는 outbox pattern 의 별도 worker — 구현 선택" 구절을 제거하고 "after-commit hook으로 트리거된다 (전용 outbox 테이블은 §Rationale R15에서 기각 — execution_token reconciliation이 대체)"로 수정한다.

---

## 요약

Target 문서(EIA spec + data-flow)는 과거 Rationale에서 합의한 핵심 원칙들 — 엔진 단일 sink 정책(R10), execution_token reconciliation을 outbox 대안으로 채택(R15), 전용 outbox 테이블 기각(R15), 403 미사용 토큰 401 통일(R14), SSE+REST 선택 이유(R3/R5) — 을 전반적으로 잘 준수하고 있다. 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. 다만 §9.1 step 8a에서 SSE 어댑터가 "Redis pub/sub 으로" 이벤트를 받는다고 기술하여, R10 Rationale과 §10 구현 파일 주석에서 일관되게 "현재 in-memory, Redis pub/sub은 Planned"로 명시한 사실 관계와 불일치하는 WARNING 1건이 발견됐다. 이는 결정 번복이 아닌 내부 서술 오류이며 독자 오해를 야기할 수 있다. 추가로 R10 내부 자체 불일치(상단 bullet vs 하단 상세 box)와 §9.3 본문이 R15에서 기각된 전용 outbox 패턴을 구현 옵션으로 열어두는 정합 보완 건(INFO) 2건이 있다.

## 위험도

LOW
