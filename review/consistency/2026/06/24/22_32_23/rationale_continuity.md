# Rationale 연속성 검토 결과

검토 대상: `06-concurrency M-2: ShutdownStateService shutdown 중 시작 노드 추적 포기 → §11.4 마킹 약속 위반 드리프트 수정`
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### [WARNING] plan M-2 권장안(Option B) 번복 — 새 Rationale 부재(plan 미갱신)

- **target 위치**: 검토 모드 설명 "Option B(worker pause)는 의도적 거절: execution workers 가 @nestjs/bullmq WorkerHost 라 framework 가 shutdown 시 worker close(§11.2 신규 consume 중단 이미 충족), BullMQ queue.pause()는 전역(Redis 플래그—타 인스턴스 stall)이라 multi-instance 에서 오답"
- **과거 결정 출처**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/06-concurrency.md` M-2 항목, **권장: B** ("§11.2 '신규 job consume 중단'을 `pause()`로 명시 구현하는 것이 spec 양쪽 조항의 완결 이행이다. C는 spec 충돌로 기각.") + Option A 단점으로 "신규 job consume 은 여전히 열려 있어 shutdown 중 새 세그먼트 유입 가능 — drain 집합 상한 없음" 명시
- **상세**: plan M-2 는 Option A 의 단독 채택이 "drain 집합 상한 없음" 위험을 남긴다고 판단해 Option B(= A + BullMQ worker `pause()` 병행)를 권장했다. target 은 Option A 만 채택하고 Option B 를 거절하면서 두 가지 새 근거를 제시한다: (1) `@nestjs/bullmq WorkerHost` 의 NestJS lifecycle 이 shutdown 시 worker close → 신규 consume 이 이미 framework 레벨에서 중단됨 = `queue.pause()` 불필요, (2) `BullMQ queue.pause()` 는 Redis 전역 플래그(타 인스턴스 stall 위험) = multi-instance 에서 오답. 이 두 근거는 `spec/5-system/4-execution-engine.md §11` 어디에도, plan M-2 옵션 비교표에도 기록되어 있지 않다. plan M-2 의 기존 권장 결정을 번복하는 것이지만, plan 문서가 갱신(새 Rationale 명시)되지 않은 채 구현만 달라진다.
- **제안**: 구현 착수 전 또는 함께, `/Volumes/project/private/clemvion/plan/in-progress/refactor/06-concurrency.md` M-2 항의 "권장" 란과 옵션 비교표를 다음과 같이 갱신할 것:
  - Option B 의 "§11.2 신규 consume 중단 명시 구현" 장점에 반박 근거 추가: `@nestjs/bullmq WorkerHost` 가 NestJS `OnApplicationShutdown` lifecycle 을 통해 이미 worker close(신규 consume 중단)를 보장하므로 `queue.pause()` 는 중복이자 타 인스턴스 stall 위험(Redis 전역 플래그)을 유발함.
  - 최종 채택을 B → **A** 로 변경하고 사유 명시.
  - `spec/5-system/4-execution-engine.md §11` Rationale 에도 "BullMQ worker close 가 framework lifecycle 으로 §11.2 신규 consume 중단을 충족하므로 별도 `queue.pause()` 를 도입하지 않는다" 한 줄 추가 권장 (spec 변경이므로 planner 경유).

---

### [INFO] spec §11 본문에 "신규 consume 중단" 구현 수단 미명시

- **target 위치**: 검토 모드 설명 "§11.2 신규 consume 중단 이미 충족"
- **과거 결정 출처**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §11` 항목 2 — "신규 job consume 중단." 한 줄로만 기술, 구체적 구현 수단(BullMQ WorkerHost lifecycle vs `queue.pause()` vs 기타) 미명시
- **상세**: §11 본문 항목 2 의 "신규 job consume 중단" 이 어떻게 구현되는지 spec 에 기술이 없어, plan M-2 는 이를 "명시 구현 필요" 로 보고 `queue.pause()` 를 권장했다. 실제로 `@nestjs/bullmq WorkerHost` lifecycle 이 이미 이 요건을 충족한다면 spec 이 그 사실을 명시하지 않아 독자(플래너·개발자 모두)가 동일한 오해를 반복할 수 있다.
- **제안**: spec §11 항목 2 에 괄호 보충 권장: "신규 job consume 중단. (`@nestjs/bullmq WorkerHost` 가 NestJS shutdown lifecycle 에서 worker close 를 처리함 — 별도 `queue.pause()` 불필요, 타 인스턴스 Redis 전역 플래그 오염 위험 회피)" — spec 변경은 planner 경유.

---

### [INFO] spec §11.4 마킹 약속과 수정 방향 정합 확인

- **target 위치**: 검토 모드 전체 (Option A: `registerInFlight` early-return 제거)
- **과거 결정 출처**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §11` 항목 4 — "RUNNING 상태의 노드 … 미완료 시: `failed` + `error.code='SERVER_INTERRUPTED'` 로 마킹"
- **상세**: target 의 핵심 수정 방향(early-return 제거 → shutdown 중 시작 노드도 추적 → drain → SERVER_INTERRUPTED 마킹)은 spec §11.4 의 약속과 정확히 정합하며, plan M-2 의 "spec 이 옳고 구현이 따라감" 판단과도 일치한다. 합의된 원칙 위반 없음.
- **제안**: 정보성 확인 사항. 별도 조치 불필요.

---

## 요약

Rationale 연속성 관점에서 주된 위험은 **plan M-2 의 권장안(Option B) 번복이 plan 문서 갱신 없이 진행**되는 점이다. target 이 제시하는 번복 근거(WorkerHost NestJS lifecycle 이 신규 consume 중단을 이미 충족, queue.pause() 의 Redis 전역 플래그 타 인스턴스 stall 위험)는 기술적으로 타당하나, plan 과 spec §11 에 반영되지 않은 채 구현만 달라지면 동일한 분석이 반복될 knowledge debt 가 남는다. 수정 방향 자체(Option A 채택, §11.4 마킹 보존, zombie RUNNING 제거)는 spec 과 완전히 정합하고 기각된 대안의 재도입이나 합의된 invariant 위반은 없다. plan M-2 채택 변경(B → A, 사유 명시) 및 spec §11 Rationale 보충을 구현과 함께 수행하면 연속성이 복원된다.

## 위험도

LOW
