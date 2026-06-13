# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md`
관련 spec: `spec/5-system/15-chat-channel.md`

---

## 발견사항

### [WARNING] R9 의 CCH-NF-03 큐 정당화 발언 역방향 인용
- **target 위치**: target 문서 `## "큐 적재 → 재발사" 미채택 이유 (Rationale 본문화)` 절 첫 문장
  > "R9 가 이미 lifecycle 큐(running 중 사용자 메시지 적재→재발사)를 기각한 근거 — input-sequence 가정 충돌, dedup 책임 모호, TTL/순서 정렬 추가 메커니즘 — 가 rate-limit 큐에도 그대로 적용된다."
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md ## Rationale > R9. CCH-CV-03 running 케이스의 큐잉 vs 즉시 안내` (마지막 문단)
  > "[CCH-NF-03] 의 rate-limit 큐 정책은 **다른 트리거 조건** (`분당 60건 초과 시 적재`) 으로, 본 케이스 (`execution running 중 사용자 메시지 도착`) 와 정책 방향이 다른 것은 정당하다 (전자는 외부 사용자 폭주 방어, 후자는 execution life-cycle 정합)."
- **상세**: R9 는 lifecycle 큐(running 케이스)를 기각하면서 CCH-NF-03 의 rate-limit 큐는 **다른 트리거 조건이라 정당하다**고 명시적으로 차별화·긍정했다. 즉 R9 는 rate-limit 큐를 기각하지 않았고, 오히려 "두 케이스는 달라서 각각 정당하다"고 선언했다. target draft 는 이를 "R9 기각 근거가 rate-limit 큐에도 적용된다"고 거꾸로 인용함으로써, R9 가 실제로 열어둔 rate-limit 큐 설계 방향성을 R9 의 권위를 빌려 닫는 구조다. R9 의 의도와 반대되는 인용이다.
- **제안**: target 의 "큐 미채택 이유" 절을 독립 근거(WH-NF-01 200ms 응답 시한, Redis fixed-window 구현 단순성, 동기 버퍼링 불가)로만 재작성하고, "R9 가 기각했으므로"라는 표현을 삭제한다. 대신 "R9 는 lifecycle 케이스와의 트리거 조건 차이를 인정했으나, rate-limit 큐 역시 WH-NF-01 응답 시한 제약으로 동기 버퍼링이 불가하므로 skip 을 채택한다"는 독립 서술로 대체. 신설하는 R-CC-19 에 이 독립 근거를 명시해야 한다.

### [INFO] CCH-NF-03 기존 "큐 적재" 문구 번복에 대한 Rationale 링크 명시 보강
- **target 위치**: target 문서 `## 변경 surface > 1. §3.6 CCH-NF-03` 절
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §3.6 CCH-NF-03` — 현재 "초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 degraded" 문구가 Planned 상태로 존재
- **상세**: CCH-NF-03 의 기존 "큐 적재" 문구는 미구현(Planned) 이었으나 spec 본문에 수록된 설계 의향이다. target 은 이를 "버퍼링/재발사 없이 처리 생략"으로 교체하면서 변경 이유를 draft 본문에 서술하고 신규 R-CC-19 로 본문화할 계획을 밝히고 있어, 번복 + Rationale 동반 작성의 구조는 갖추었다. 다만 변경된 §3.6 문구 자체에 "(구 큐 적재 정책 폐기, 근거 R-CC-19 참조)" 와 같은 인라인 참조가 없으면 spec 본문 독자가 변경 경위를 놓칠 수 있다. 권고 수준.
- **제안**: 신규 §3.6 문구 끝에 `(구 큐 적재 정책 → skip 으로 변경, 근거 R-CC-19)` 형식의 괄호 주석을 추가하면 과거 의향과의 단절이 명시화된다.

### [INFO] R-CC-19 의 R9 직교성 주장 재검토 필요
- **target 위치**: target 문서 `## 변경 surface > 4. Rationale R-CC-19 신설` 절
  > "R9 와의 직교성(외부 폭주 방어 vs execution lifecycle 정합)"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md ## Rationale > R9` 마지막 문단 (위와 동일)
- **상세**: R9 는 두 케이스가 "직교적"이라기보다 "다른 트리거 조건이라 서로 독립적으로 정당하다"고 선언했다. target 이 "R9 와의 직교성"을 R-CC-19 근거로 삼으면, R9 가 rate-limit 큐를 긍정한 발언을 간접적으로 삭제하는 효과가 된다. R-CC-19 는 R9 와의 관계를 "R9 는 rate-limit 케이스를 lifecycle 케이스와 다른 것으로 구분했고, 이번 draft 는 rate-limit 케이스 내에서 큐 vs skip 을 독립 결정한다"는 서술로 정확히 표현해야 한다.
- **제안**: R-CC-19 에서 R9 를 인용하는 방식을 "R9 는 rate-limit 케이스를 lifecycle 과 다른 트리거 조건으로 분리했다. 본 R-CC-19 는 그 rate-limit 케이스 내에서 큐 vs skip 을 추가로 결정하며 R9 와 독립 사안이다"로 명시한다.

---

## 요약

target draft 의 핵심 설계 방향(skip + degraded, Redis fixed-window, fail-open)은 WH-NF-01 제약·R-CC-12 안전 계약·기존 throttle 동형 패턴과 잘 정합하며 합의된 invariant 를 위반하지 않는다. 단 "R9 기각 근거가 rate-limit 큐에도 적용된다"는 서술이 R9 의 실제 발언과 역방향으로 인용되어 있다. R9 는 rate-limit 큐를 기각하지 않았고, 오히려 두 케이스를 구분하며 rate-limit 큐의 정당성을 긍정하는 문단으로 마무리된다. 결과적으로 skip 선택은 독립 근거(동기 버퍼링 불가, WH-NF-01, 구현 단순성)로 충분히 정당화 가능하므로, R9 참조 방식을 수정하면 Rationale 연속성 관점의 문제는 해소된다. CRITICAL 수준의 기각된 대안 재도입이나 invariant 직접 위반은 없다.

---

## 위험도

LOW
