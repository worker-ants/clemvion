# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-24

---

## 발견사항

### 1. [WARNING] Sticky fast-path — 기존 "항상 bus.publish" 원칙과 정면 충돌

- **target 위치**: 변경 1 §1.4 — §7.4 Continuation Bus 표의 `Sticky fast-path` 행
  > "publisher 가 자기 인스턴스의 `pendingContinuations` 에 키가 있으면 BullMQ enqueue **없이** 즉시 resolve. 그 외에는 BullMQ enqueue"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4 Continuation Bus`, 줄 762
  > "모든 진입점은 항상 `bus.publish` 한다. 자기 인스턴스에 로컬 Map 키가 있어도 마찬가지 — '내 Map 에 있으면 직접' 분기는 race window 가 생긴다."
- **상세**: 기존 spec 은 "자기 Map 에 있어도 반드시 pub/sub 으로 route" 를 명시적으로 규정하고 "직접 dispatch 분기는 race window" 라는 이유로 명시 폐기했다. target 의 sticky fast-path 는 같은 분기를 BullMQ 경로 안에서 부활시키는 것이다. target 은 "race window 가 있지만 무해" 라고 주석을 달았으나, 기존 Rationale 에서 폐기한 이유("race window 가 생긴다")와 충돌 — 왜 BullMQ 환경에서는 그 race window 가 무해한지에 대한 새 논증이 없다.
- **제안**: (a) sticky fast-path 를 제거하고 항상 BullMQ enqueue 하거나, (b) 기존 §7.4 Continuation Bus 항의 "항상 bus.publish" 원칙을 갱신하면서 "BullMQ 환경에서 local resolve 가 무해한 구체적 이유 (enqueue 와 달리 local resolve 실패 시 at-least-once BullMQ 가 fallback 이 되지 않는 점, race window 가 실제로 왜 무해한가)" 를 새 Rationale 로 명시한다.

---

### 2. [WARNING] "모든 진입점 항상 bus.publish" 폐기 — 새 Rationale 부재

- **target 위치**: 변경 1 §1.4 전체 — Redis pub/sub → BullMQ 교체 및 sticky fast-path 도입
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4`, 줄 762–763
  > "모든 진입점은 항상 `bus.publish` 한다 … '내 Map 에 있으면 직접' 분기는 race window 가 생긴다."
  > "'No pending continuation' 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다."
- **상세**: target 은 §1.8 Rationale 항에서 Redis pub/sub → BullMQ 전환의 이유를 설명하지만, "항상 pub 해야 한다"는 기존 라우팅 원칙이 왜 BullMQ 경로 안에서 달라지는지 — 즉 sticky fast-path 의 "local resolve 우선" 로직이 기존 원칙을 번복하는 근거 — 를 구체적으로 기술하지 않는다. target 의 §1.8 Rationale 은 "대안 3 — Redis pub/sub 유지 + 재시도 정책 기각" 과 "대안 4 — BullMQ 채택" 만 설명하고, sticky fast-path 자체가 기존 설계 원칙을 번복하는 결정임은 언급하지 않는다.
- **제안**: §1.8 Rationale 에 "기존 '항상 bus.publish' 원칙을 번복하는 이유" 항목을 추가하거나, sticky fast-path 를 제거해 기존 원칙을 그대로 BullMQ 에 적용한다 (항상 enqueue, local resolve 없음).

---

### 3. [INFO] "No pending continuation 즉시 throw 폐기" 원칙과 Rehydration 의 관계 — Rationale 보완 필요

- **target 위치**: 변경 1 §7.5 rehydration slow path — `case 2: 로컬 pendingContinuations 키 없음 → rehydrate`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4`, 줄 764
  > "'No pending continuation' 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다."
- **상세**: 기존 Rationale 은 "로컬 Map 에 키가 없다고 해서 오류로 처리해서는 안 된다"는 원칙을 확립했다. target 의 rehydration slow path 는 이 원칙과 같은 방향이지만, 과거 결정을 명시적으로 계승·확장하는 문구가 없다. 독자가 두 결정 사이의 연속성을 추적하기 어렵다.
- **제안**: §1.8 Rationale 또는 §7.5 본문에 "키 없음 → 즉시 오류 폐기(§7.4 기존 원칙) 의 자연스러운 확장으로서 rehydration 경로를 정의한다"는 문장 한 줄 추가. 연속성 추적이 용이해진다.

---

### 4. [INFO] Recovery 정책 번복 — 신규 Rationale 작성은 충분하나 §7.4 본문과의 정합 명시 필요

- **target 위치**: 변경 1 §1.5 — `recoverStuckExecutions()` 대상을 `status='running'` 만으로 좁힘
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4 Recovery`, 줄 773
  > "Stale 임계값: `started_at < now() - 30분` 인 row 만 FAIL UPDATE. 30분 미만의 신규 대기는 보존된다."
- **상세**: 기존 spec 은 30분 임계값을 RUNNING/WAITING_FOR_INPUT 에 동시 적용하는 것처럼 읽힌다 (명시적 구분 없음). target 은 WAITING_FOR_INPUT 을 recovery 대상에서 완전히 제외하고, RUNNING 전용 임계값으로 재정의한다. 이 번복의 이유는 §1.5 와 §1.8 에 명시되어 있어 Rationale 자체는 작성되어 있다. 다만 기존 §7.4 본문 "30분 미만의 신규 대기는 보존된다"는 표현이 WAITING_FOR_INPUT 보존 기준이 바뀐 것과 정합하지 않게 남을 것이다.
- **제안**: spec 업데이트 시 §7.4 Recovery 본문의 "30분" 기술을 "RUNNING 전용 heartbeat 미응답 임계값" 으로 명확히 갱신하고, WAITING_FOR_INPUT 이 여기서 제외되는 이유를 §7.5 cross-link 로 보완한다. (이미 §1.5 이행 내용이 이를 포함하므로 spec 적용 단계에서 누락 없이 반영될 가능성이 높지만, draft 수준에서 명시적으로 안내해 두는 것이 좋다.)

---

### 5. [INFO] `spec/0-overview.md §2.4 Rationale — 실행 엔진: Redis 큐 + 분산 워커 풀` 갱신 필요

- **target 위치**: 변경 1 §1.4 — Redis pub/sub → BullMQ continuation-queue 전환
- **과거 결정 출처**: `spec/0-overview.md §2.4 Rationale`, "실행 엔진: Redis 큐 + 분산 워커 풀"
  > "continuation bus … continuation bus·BullMQ 기반 cron·Cafe24 cross-pod refresh 직렬화 등 다른 시스템도 같은 Redis 를 재사용"
  > (trade-off 절에서 continuation bus 가 Redis 를 공유 사용한다는 사실을 net 부담 절감의 근거로 언급)
- **상세**: 0-overview.md Rationale 는 continuation bus 를 Redis pub/sub 기반으로 기술하고 있다. target 이 채택되면 continuation bus 가 BullMQ 영속 큐 기반으로 바뀌는데, 해당 개요 항은 갱신 대상 목록에 없다. spec 적용 후 overview Rationale 와 실제 구현이 어긋난다.
- **제안**: 다음 단계 (spec 적용 phase) 에서 `spec/0-overview.md §2.4 Rationale` 의 "continuation bus" 언급을 "BullMQ continuation-queue (§7.5 참조)" 로 갱신하는 항목을 명시적으로 추가한다.

---

## 요약

target draft 는 Redis pub/sub at-most-once continuation bus 의 근본적 한계를 BullMQ 영속 큐 + rehydration 으로 해소하는 설계로, 방향성과 대안 검토 Rationale 의 품질은 높다. 그러나 기존 `spec/5-system/4-execution-engine.md §7.4` 가 명시적으로 확립한 "모든 진입점 항상 bus.publish — 로컬 Map 직접 dispatch 분기는 race window 로 폐기" 원칙을 sticky fast-path 가 사실상 번복하면서, 그 번복의 Rationale (BullMQ 환경에서 race window 가 왜 무해한지 또는 허용 가능한지) 가 작성되지 않았다. 이 점이 가장 중요한 연속성 갭이다. 나머지 발견사항은 INFO 수준으로 spec 적용 단계에서 보완 가능하다. sticky fast-path 를 제거하거나 신규 Rationale 로 번복 근거를 명시하면 전체 위험도는 LOW 로 낮아진다.

---

## 위험도

MEDIUM
