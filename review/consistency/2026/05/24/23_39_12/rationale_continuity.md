# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md` (rev 2)
검토 기준 Rationale 출처:
- `spec/5-system/4-execution-engine.md §7.4` + `## Rationale`
- `spec/5-system/6-websocket-protocol.md §4.2` + `## Rationale`
- `spec/0-overview.md ## Rationale` (§2.4 실행 엔진 항목)

---

## 발견사항

### [INFO] Redis pub/sub → BullMQ 전환은 Rationale 에 명시적으로 기각된 적 없는 대안의 채택 — 신규 결정이며 target 이 자체 Rationale 을 포함하고 있어 허용 범위

- **target 위치**: 변경 1 §1.4 / §1.11 Rationale "Durable Continuation (2026-05-24)"
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` "Continuation Bus (사용자 입력 fan-out)" 절 — Redis pub/sub 기반 현행 설계 정의
- **상세**: 현행 spec 의 §7.4 는 Redis pub/sub 을 정의하고 있을 뿐, "BullMQ 영속 큐 대안은 기각한다" 고 명시하지 않았다. target 문서는 (a) Redis pub/sub 을 명시적으로 기각 대상(대안 3)으로 분류하고, (b) BullMQ 를 채택 이유와 함께 §1.11 Rationale 에 기재하고 있어, Rationale 신규 기록 의무를 충족한다. Rationale 연속성 문제는 없다.
- **제안**: 정보 기록 차원에서 확인. 추가 조치 불필요.

---

### [INFO] `항상 publish` 원칙 — BullMQ 시대에도 동일하게 계승되었음을 확인

- **target 위치**: 변경 1 §1.4 라우팅 원칙 불릿 + §1.11 "Sticky fast-path 제거" 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` line 762 — "모든 진입점은 항상 bus.publish 한다. 자기 인스턴스에 로컬 Map 키가 있어도 마찬가지 — '내 Map 에 있으면 직접' 분기는 race window 가 생긴다."
- **상세**: 현행 Rationale 에 박힌 핵심 invariant — "항상 publish, 로컬 직접 dispatch 금지". target 의 §1.4 는 "모든 진입점은 항상 BullMQ enqueue. 자기 인스턴스의 pendingContinuations 에 키가 있어도 마찬가지" 로 동일 원칙을 BullMQ 용어로 이어받는다. rev 1 에서 sticky fast-path 를 두었다가 rev 2 에서 제거한 경위도 §1.11 에 명시. 원칙 연속성 완전히 충족.
- **제안**: 정보 기록 차원에서 확인. 추가 조치 불필요.

---

### [INFO] `키 없음 → silent skip` 원칙의 의미 강화 — 번복이 아닌 자연 연장

- **target 위치**: 변경 1 §1.6 ("case 2 의 rehydration 경로는 §7.4 의 기존 원칙 '키 없음 → 즉시 throw 폐기' 의 자연스러운 확장") + §1.11 "옛 '키 없음 즉시 throw 폐기' 원칙의 확장" 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` line 764 — "`'No pending continuation' 즉시 throw 는 단일 인스턴스에서 정확히 판단 불가하므로 폐기된다.`" (silent skip 채택)
- **상세**: 현행 spec 의 선택은 "키 없음 → silent skip (다른 인스턴스의 Map 에 있을 수 있으므로)". target 은 BullMQ 영속화 이후 "키 없음 = DB 에서 재구성(rehydration)" 으로 의미가 강화됐다고 기술. silent skip 자체는 버리되 그 이유("단일 인스턴스에서 판단 불가이므로 skip") 가 BullMQ 시대에는 "판단 불가 없이 DB 에서 재구성 가능" 으로 전제가 해소된 맥락에서의 전환이다. target 이 §1.11 에서 이 계보를 명시하여 번복의 Rationale 를 갖추고 있으므로 연속성 요건 충족.
- **제안**: 정보 기록 차원에서 확인. 추가 조치 불필요.

---

### [WARNING] `ack error 객체 = 실패 전용` invariant — 기존 패턴 명문화 수준이 낮아 target 의 선언이 자기 참조적

- **target 위치**: 변경 2 §2.1 — "`queued: true`" 필드 도입 근거 주석: "옛 draft (rev 1) 에서 `RESUME_QUEUED` 를 에러 코드 표에 '성공 변형' 으로 두려 했으나, 기존 ack 의 `error` 객체 = 실패 전용 invariant 와 충돌"
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.2` + `## Rationale` — `error` 객체가 실패 전용이라는 점은 spec 본문의 패턴(`resumed: false` + `error: { code, message }` 조합)으로만 표현되어 있으며, Rationale 절에 명시적으로 "error 객체는 실패 전용 invariant" 로 기재된 항목이 없다.
- **상세**: target 이 `RESUME_QUEUED` 를 에러 코드 표에 두지 않고 별도 `queued: boolean` 필드로 분리한 결정은 올바른 방향이다. 그러나 target 이 근거로 드는 "기존 ack 의 `error` 객체 = 실패 전용 invariant" 가 현행 `## Rationale` 어디에도 명시적으로 기록된 항목이 아니다. target 이 이것을 "기존 invariant" 로 부르지만, 사실상 target 자신이 처음으로 명문화하는 것이다. 이 invariant 가 향후 다른 spec 변경에서도 유지되어야 한다면, WS protocol spec 의 `## Rationale` 에 "ack payload 의 error 객체 = 실패 전용" 항목을 정식으로 기재하는 것이 바람직하다.
- **제안**: target 의 spec 반영 단계(변경 2)에서 `spec/5-system/6-websocket-protocol.md ## Rationale` 에 "ack error 객체는 실패 전용 — 성공 변형 신호는 별도 boolean 필드로 표현한다 (queued 선례)" 항목을 1문단으로 추가. 그래야 이후 reviewer 가 동일 패턴을 invariant 로 읽을 수 있다.

---

### [INFO] `WAITING_FOR_INPUT` 신규 상태 enum 미도입 결정 — 현행 Rationale 와 무충돌, 신규 기각 근거 명시

- **target 위치**: 변경 1 §1.1 본문 박스 ("상태 enum 자체에는 신규 값을 추가하지 않는다") + §1.11 대안 2 기각
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` — 신규 enum 도입을 기각한 선례 없음(현행 Rationale 에는 `waiting_for_input → failed` 전이 추가 결정만 있음)
- **상세**: 신규 상태 enum `INTERRUPTED` / `RESUMING` / `SUSPENDED` 를 추가하지 않기로 한 것은 이 spec 의 새로운 결정이며, 현행 Rationale 에 충돌하는 과거 결정은 없다. target §1.11 대안 2 기각 근거(DB migration / cross-spec drift 방지) 가 명시되어 있어 Rationale 연속성 요건 충족.
- **제안**: 정보 기록 차원에서 확인. 추가 조치 불필요.

---

### [INFO] `recoverStuckExecutions` WAITING_FOR_INPUT 처리 정책 번복 — 신규 Rationale 포함

- **target 위치**: 변경 1 §1.5 — `waiting_for_input` 을 Stale 대상에서 제외. 현행 spec line 773 의 "30분 미만 신규 대기는 보존" 확장
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.4` Recovery 절 — Stale 임계값 30분 (all statuses 대상); WAITING_FOR_INPUT 포함한 전체 대기가 30분 이상이면 FAIL 처리
- **상세**: 현행 spec 은 WAITING_FOR_INPUT 포함 30분 이상 대기를 FAIL 처리한다. target 은 WAITING_FOR_INPUT 을 "무기한 보존" 으로 변경한다. 이는 현행 Recovery 원칙의 번복이나, target §1.11 에서 "옛 동작(WAITING_FOR_INPUT 일괄 FAIL) 의 운영 회귀" 로 명명하고 기각 이유를 제시하며, §1.5 교체 불릿에서도 그 이유를 인라인 기재하고 있다. 새 Rationale 동반 번복이라 연속성 문제는 없다.
- **제안**: 정보 기록 차원에서 확인. 추가 조치 불필요.

---

### [INFO] `spec/0-overview.md § Rationale` "실행 엔진" 항의 `continuation bus` 문장 — target 이 갱신 대상으로 명시

- **target 위치**: 변경 5 + §1.11 "상위 spec 갱신 항목"
- **과거 결정 출처**: `spec/0-overview.md ## Rationale § 실행 엔진` — "continuation bus·BullMQ 기반 cron·Cafe24 cross-pod refresh 직렬화 등 다른 시스템도 같은 Redis 를 재사용해 net 부담이 낮다."
- **상세**: 현행 `spec/0-overview.md` 의 Rationale 은 "같은 Redis 재사용" 을 trade-off 해소 근거로 쓴다. BullMQ continuation-queue 전환 후에는 continuation bus 가 Redis pub/sub 에서 BullMQ 영속 큐로 이동하여 이 trade-off 기술이 일부 달라진다. target 이 spec 적용 단계에서 동반 갱신을 명시하고 있으나, 이 항의 정확한 수정 텍스트(특히 "net 부담이 낮다" 논리가 여전히 유효한지)가 draft 에서 명시되지 않았다.
- **제안**: 변경 5 를 spec 에 적용할 때 `## Rationale §실행 엔진` trade-off 문장을 "continuation bus 는 BullMQ 영속 큐로 전환되었으나 동일 Redis 인프라를 BullMQ 가 사용하므로 신규 외부 의존성 추가 없음" 수준으로 명시적으로 갱신. 현행 "같은 Redis 재사용" 표현이 오해를 낳지 않도록 보강.

---

## 요약

target 문서(rev 2)는 현행 `spec/5-system/4-execution-engine.md §7.4` 의 Rationale 에 박힌 핵심 원칙 — "항상 publish, 로컬 직접 dispatch 금지" 와 "silent skip 의 이유" — 을 모두 인식하고 명시적으로 계승하거나 근거와 함께 확장한다. 기각된 대안의 재도입이나 합의된 invariant 의 무근거 위반은 확인되지 않는다. 유일한 주의 사항은 WS protocol spec 의 "ack error 객체 = 실패 전용" 패턴이 현행 Rationale 에 명문화되지 않은 채 target 이 이를 기존 invariant 처럼 인용하는 점으로, spec 반영 단계에서 WS protocol `## Rationale` 에 해당 항목을 1문단으로 추가하는 것이 권고된다. 전반적으로 Rationale 연속성은 양호하며 차단 사유 없다.

---

## 위험도

LOW
