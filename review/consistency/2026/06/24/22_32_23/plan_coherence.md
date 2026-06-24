# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
범위: 06-concurrency M-2 ShutdownStateService shutdown 중 시작 노드 추적 포기 → §11.4 마킹 약속 위반 드리프트 수정

---

## 발견사항

### [WARNING] Option A 채택 + Option B 거절 — plan 권장안 이탈이지만 기술 근거가 실질적으로 새로운 사실
- **target 위치**: 검토 모드 설명 전체 (Option A 채택·Option B 의도적 거절 선언)
- **관련 plan**: `plan/in-progress/refactor/06-concurrency.md` M-2 섹션
  - 권장: "B — A + `onApplicationShutdown` 진입 즉시 BullMQ worker `pause()` 병행"
  - A 단독의 단점: "신규 job consume 은 여전히 열려 있어 shutdown 중 새 세그먼트 유입 가능 — drain 집합 상한 없음"
- **상세**: plan 은 Option B(A + worker pause)를 권장하며 그 근거로 "§11.2 '신규 job consume 중단'의 명시 구현 — 새 세그먼트 유입을 입구에서 차단해 drain 집합에 상한"을 들었다. target 은 Option A만 채택하면서 Option B 거절 이유로 "@nestjs/bullmq WorkerHost 라 framework 가 shutdown 시 worker close(§11.2 신규 consume 중단 이미 충족), BullMQ queue.pause()는 전역(Redis 플래그 — 타 인스턴스 stall)이라 multi-instance 에서 오답"을 제시한다. 이는 plan 의 옵션 분석이 포착하지 못한 두 가지 신규 사실을 주장한다: ① NestJS 프레임워크가 shutdown 시 WorkerHost를 자동으로 close하여 §11.2를 이미 충족한다는 점, ② queue.pause()가 Redis 전역 플래그이므로 multi-instance 환경에서 타 인스턴스를 stall시킨다는 점. plan 의 옵션 비교표에는 ②가 언급되지 않았고 ①의 프레임워크 동작도 기술되지 않았다.
  - M-2에는 C-2 처럼 "결정 대기 (사용자)" 마커가 없으므로 이 Option 선택은 규약 위반의 "미해결 결정 우회"에는 해당하지 않는다.
  - 그러나 plan 이 Option B 를 권장하면서 A 단독의 단점으로 명시한 "drain 집합 상한 없음" 문제가 target 에서 "§11.2 이미 충족"으로 재반박된 것은 plan 의 분석 내용이 갱신돼야 한다는 뜻이다.
- **제안**: plan `/Volumes/project/private/clemvion/plan/in-progress/refactor/06-concurrency.md` M-2 의 Option A/B 비교표와 "권장" 서술을 다음과 같이 갱신할 것:
  - Option B 의 단점 칸에 "@nestjs/bullmq WorkerHost 자동 close 로 §11.2 가 이미 충족됨 + queue.pause() 가 Redis 전역 플래그라 multi-instance stall 유발" 을 추가.
  - "권장" 을 B → A 로 변경하고, A 의 "drain 집합 상한 없음" 단점을 "프레임워크 WorkerHost close 로 실질적으로 상한 존재" 로 정정.
  - 이 갱신은 developer 가 아닌 project-planner 영역이므로 구현 PR 완료 후 별도 planner 위임으로 처리.

---

### [INFO] plan M-2 "spec 갱신: 불요" 와 target "spec 변경 불요" 는 정합
- **target 위치**: 검토 모드 설명 — "spec 변경 불요(spec 옳고 구현이 따라감)"
- **관련 plan**: `plan/in-progress/refactor/06-concurrency.md` M-2 섹션 — "spec 갱신: 불요 (spec 이 옳고 구현이 따라감)"
- **상세**: spec `4-execution-engine.md §11.4` 의 "미완료 RUNNING NodeExecution 을 `failed` + `SERVER_INTERRUPTED` 마킹" 약속은 양쪽 모두 변경 불필요로 일치. 정합.
- **제안**: 기록용 메모 — 별도 조치 불요.

---

### [INFO] README 진행 현황 동기화 필요 (구현 완료 시)
- **target 위치**: N/A (구현 완료 후)
- **관련 plan**: `plan/in-progress/refactor/README.md` — "P1 … 9. shutdown 중 시작 노드 추적 포기 — §11.4 약속 위반 드리프트 → [06](./06-concurrency.md) M-2 *(잔여)*"
- **상세**: 구현 완료 시 `06-concurrency.md` M-2 체크박스 + README 집계표의 "완료/잔여" 카운트가 갱신돼야 한다. 이는 구현 PR 완료 단계에서 자연히 처리될 항목이나, plan 갱신이 누락되면 M-2 가 영구 "잔여" 상태로 남는다.
- **제안**: 구현 PR 완료 후 `06-concurrency.md` M-2 항목을 `[x] 완료` 로 갱신하고, README 집계 행과 P1 항목 상태를 동기화. developer 가 plan 파일을 직접 갱신하거나 planner 에 위임.

---

## 요약

Plan 정합성 관점에서 이번 target(M-2 Option A 채택·Option B 거절)은 plan 에서 "결정 대기(사용자)" 로 잠긴 항목이 아닌 권장안을 이탈한 것이므로 CRITICAL 위반에는 해당하지 않는다. 단, target 이 Option B 거절 근거로 제시한 두 신규 사실(NestJS WorkerHost 자동 close 로 §11.2 이미 충족 / queue.pause() Redis 전역 플래그 multi-instance 부적합)은 plan 의 옵션 비교 분석에 없던 내용이라 plan 문서 갱신이 필요하다(WARNING). spec 갱신 불요 판단은 plan 과 완전히 정합하며, 구현 완료 후 plan 체크박스·README 집계 동기화는 표준 절차로 챙기면 된다.

## 위험도

LOW
