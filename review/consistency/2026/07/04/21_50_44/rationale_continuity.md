# Rationale 연속성 검토 — orphan pending backstop

> **payload mis-scope 안내**: 전달받은 `_prompts/rationale_continuity.md` 의 target 문서 번들은 `spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 만 포함하고, 본 작업이 실제로 대상으로 삼는 `spec/5-system/4-execution-engine.md`(§7.1/§7.4/§7.5/§8/Rationale)는 누락돼 있었다. 프롬프트 grep 결과 실제 관련 절이 0건이라 판단해, 지시에 따라 spec 원본(`spec/5-system/4-execution-engine.md`)과 계획 문서(`plan/in-progress/orphan-pending-backstop.md`)·관련 코드(`execution-engine.service.ts`)를 직접 읽어 분석했다.

## 검토 대상

- Target 계획: `plan/in-progress/orphan-pending-backstop.md` — `recoverStuckExecutions` 가 stale RUNNING 뿐 아니라 queue-wait timeout 을 넘긴 orphan `pending` row 도 함께 회수(= `cancelled` 마감)하도록 확장.
- 대조 SoT: `spec/5-system/4-execution-engine.md` §7.1(장애 복구 트리거) / §7.4(분산 실행 Recovery) / §8(동시 실행 제한) / `## Rationale`(PR3 크래시 re-drive, PR4 stalled 재배달, PR2b admission gate 항목).

## 발견사항

- **[INFO]** 회수 액션이 CANCEL 인 것은 §8 timeout 의미론과 정합 — 단, "재큐 없음"을 spec 자체가 아직 명시하지 않음
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 설계 결정 1 ("회수 액션 = wait-timeout cancel(re-enqueue 아님)")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §8 라인 1088 "consumer(`runExecutionFromQueue`)가 job 을 pick up 할 때 admission gate 이전에 `now - queued_at` 을 확인해 초과 시 **재큐 대신 `cancelled` 로 마감**한다... job 자체가 소실된 orphan `pending`... 회수는 후속"; 및 `## Rationale` "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b)" 의 "`cancelled`(+`error.code`) vs `failed`: 큐 대기 초과는 노드 실행이 시작조차 안 됨 → '실패' 보다 '취소'가 의미 정합".
  - 상세: §8 은 "정상적으로 pick up 된 뒤 timeout 초과" 케이스에 한해 명시적으로 "재큐 대신 cancelled" 를 결정해 뒀다. target 이 이 규칙을 "job 자체가 소실된(pick up 될 기회가 없던) orphan pending" 케이스로 **일반화**해 동일 cancel 의미론을 적용하는 것은 자연스러운 확장이며, PR2b Rationale 의 "노드 실행이 시작조차 안 됨 → 취소가 의미 정합" 논리도 orphan 케이스에 오히려 더 강하게 적용된다(job 자체가 없어 시작될 수조차 없었음). re-admit(재큐)을 요구하는 어떤 Rationale 항목도 없다 — 오히려 §7.4 Recovery 섹션의 "다른 인스턴스가 정상 처리 중인 작업을 잘못 건드리지 않도록 보수적 가드" 원칙과 §7.5 case B 의 "오래된 실행을 RUNNING 으로 부활시키지 않음" 이 re-admit 대신 cancel 을 선호하는 근거로 활용 가능하다. 다만 이 논리 연쇄가 **spec 문서 자체에는 아직 서술되어 있지 않고** target plan 문서에만 있다 — 구현 완료 후 spec 갱신 시 이 근거를 §7.4/§8 에 명시적으로 옮겨야 Rationale 연속성이 사후에도 추적 가능하다.
  - 제안: `## 체크리스트` 의 "spec §8/§7.4 '구현 완료' 반영" 항목 수행 시, cancel(not re-admit) 선택 근거 — "job 소실 orphan 은 pick up 기회 자체가 없었으므로 재큐해도 즉시 stale 판정될 값과 동일 → 직접 cancel 이 단순·안전, RUNNING 부활 방지" — 를 `## Rationale` 에 신규 소절로 추가할 것. (CRITICAL 아님 — 결정 자체가 기존 원칙과 상충하지 않고 순연장이기 때문.)

- **[INFO]** boot-only 트리거 확장은 §7.1/§7.4 의 기존 "부팅 backstop, 별도 heartbeat/주기 스캐너 신설 안 함" 원칙과 합치
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 설계 결정 3 ("같은 lock·트리거 재사용 — `recoverStuckExecutions` 안 running 회수 뒤에 `recoverOrphanPendingExecutions()` 호출 → boot + 테스트훅 모두 커버. 신규 migration/env 없음")
  - 과거 결정 출처: §7.1 "별도 heartbeat 채널을... 신설하지 않는다" / §7.4 Recovery "다중 인스턴스에서 신규 기동한 인스턴스가... 보수적 가드" (분산 lock `exec:recover:lock`, boot 트리거) / `## Rationale` "§7.1 heartbeat → stalled-job 일원화"(주기 스캐너 대신 BullMQ 네이티브 메커니즘 재사용 원칙).
  - 상세: target 은 신규 주기 스캐너를 만들지 않고 기존 boot-only 트리거(`onApplicationBootstrap` + 테스트훅)에 얹는다. 이는 spec 이 반복적으로 채택해 온 "새 인프라(heartbeat, 별도 스캐너) 대신 기존 메커니즘 재사용" 원칙과 정확히 일치한다. `recoverStuckExecutions` 의 분산 lock(`exec:recover:lock`, 60초 TTL) 을 그대로 재사용하는 것도 §7.4 "전역 boot-lock 은 유지" 원칙과 합치한다. Rationale 위반 없음.
  - 제안: 없음(정합) — 구현 시 lock 범위 안에서 stale RUNNING 회수와 orphan PENDING 회수가 동일 lock-hold 구간에 들어가는 것이 §7.4 "명시적 release: 작업 종료 시 owner 검증 Lua script 로 lock 즉시 해제" 원칙과 충돌하지 않는지만 구현 단계에서 확인.

- **[WARNING]** `recoverStuckExecutions` 의 stale RUNNING 전용 스코프 서술("stale `running` 만 스캔")이 확장 후 spec 문언과 어긋나게 되므로 Rationale 동시 갱신 필요
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 전체 취지 (`recoverStuckExecutions` 함수가 RUNNING + PENDING 양쪽을 다루도록 변경)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.4 Recovery "**Stale 대상 한정**: `status='running'` 인 row 만 stuck recovery 대상"; `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3)" 전체 절이 `recoverStuckExecutions` 를 "RUNNING(non-waiting) active 세그먼트" 전용으로 정의.
  - 상세: 이것은 **금지된 대안의 재도입이나 원칙 위반이 아니라**, "결정의 무근거 번복" 여부를 가릴 지점이다 — target 이 `recoverStuckExecutions` 라는 **동일 함수**의 책임을 RUNNING 전용에서 RUNNING+PENDING 겸용으로 넓히는데, 이는 §7.4 문언 "status='running' 인 row 만 stuck recovery 대상" 을 문자 그대로 깨는 변경이다. 다만 이는 §8 라인 1088 이 스스로 "pending 스캔 확장은 본 PR(PR2b) 스코프 아님... 후속" 이라 **예고해 둔 확장**이므로 "무근거" 번복은 아니다 — 근거(§8 의 명시적 후속 예고)는 이미 spec 에 있다. 하지만 정작 §7.4 "Stale 대상 한정" 표현 자체는 갱신 없이는 새로 참이 아니게 된다(RUNNING 뿐 아니라 stale PENDING 도 대상이 됨). 함수명·docstring·§7.4/§7.5/Rationale 문언이 "RUNNING 전용" 을 여러 곳에서 강하게 단언하고 있어(예: §7.2 "point 3... status='running' AND stale... 인 Execution 을 부팅 시 원자 re-claim", §7.5 case B "재개는... 이미 running") 갱신 누락 시 문서 내부 모순이 발생한다.
  - 상세(추가): 코드 레벨에서도 `recoverStuckExecutions()` 내부의 `if (reclaimedIds.length === 0) return;` (execution-engine.service.ts:2826) 이 RUNNING 없을 시 조기 반환하는데, target 계획은 이 early-return "제거" 를 요구한다(계획 §설계 결정 3). 이는 코드 흐름을 함수 내부에서 실질적으로 바꾸는 것이라 spec 문언과의 괴리가 실제로 발생할 지점이다.
  - 제안: `spec/5-system/4-execution-engine.md` §7.4 Recovery 절의 "Stale 대상 한정" 문장을 "RUNNING(re-drive 대상) + orphan PENDING(cancel 대상)" 두 갈래로 명시적으로 나눠 갱신하고, `## Rationale` 에 "orphan pending backstop (§7.4/§8, 20XX-XX-XX)" 신규 소절을 추가해 (a) 왜 같은 함수/트리거를 재사용했는지, (b) 왜 PENDING 은 re-drive 가 아니라 cancel 인지, (c) §8 라인 1088 이 이 후속을 어떻게 예고했는지 3가지를 명문화할 것. 이는 target plan 의 체크리스트 항목 "spec §8/§7.4 '구현 완료' 반영"에서 반드시 커버돼야 한다.

- **[INFO]** PR3(RUNNING re-drive)와 PENDING cancel 경로의 "다른 상태·다른 근거" 분리는 상충이 아니라 병렬 확장
  - target 위치: `plan/in-progress/orphan-pending-backstop.md` 전체
  - 과거 결정 출처: `## Rationale` "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3)" — "옛 '일괄 fail' 마킹 대체... §7.2 point 3 이 이미 약속한 재시작 resume 을 실제 구현"
  - 상세: PR3 의 핵심 결정은 "RUNNING 을 fail 아닌 re-drive 로" 였다. target 은 PENDING 을 "cancel" 로 마감하므로 표면적으로는 PR3 와 반대 방향(re-drive 대신 종결)처럼 보일 수 있으나, 두 결정은 **다른 상태(RUNNING vs PENDING)** 를 다루고 있어 직접 충돌하지 않는다 — RUNNING 은 "이미 시작된 작업의 진행"이므로 re-drive 가 무손실 재개 가치를 가지지만, PENDING 은 "아직 시작되지 않은 대기"이므로 재개할 진행 상태가 없고 §8 의 기존 timeout 의미론(노드 실행 시작조차 안 됨 → 취소)이 그대로 적용된다. Rationale 원칙 위반 없음.
  - 제안: 없음 — 다만 spec 갱신 시(위 WARNING 항목 반영) 이 "RUNNING=재개 가치 있음/PENDING=재개 가치 없음"이라는 구분 논리를 명시하면 향후 유사 혼동을 예방할 수 있다.

## 요약

target(`orphan-pending-backstop` 계획)은 §8 라인 1088 이 spec 자체에서 이미 "후속" 으로 명시 예고해 둔 갭을 메우는 작업이며, 회수 액션(CANCEL, re-admit 아님)·트리거 방식(boot-only 재사용, 신규 스캐너 없음) 모두 기존 Rationale 이 확립한 원칙(§8 PR2b "cancelled vs failed" 의미론, §7.1/§7.4 "heartbeat/신규 스캐너 대신 기존 메커니즘 재사용")과 정합적이다. 유일한 실질 우려는 `recoverStuckExecutions` 가 RUNNING 전용이라는 §7.4 "Stale 대상 한정" 의 현재 문언이 PENDING 겸용으로 확장된 후에는 문자 그대로 stale 해진다는 점으로, 이는 금지된 대안의 재도입이 아니라 **spec 문언 갱신 누락 위험**(WARNING)이다. 계획 문서의 체크리스트에 "spec §8/§7.4 반영" 항목이 이미 존재하므로, 구현 완료 후 그 항목을 이행하면서 §7.4 문언 갱신 + Rationale 신규 소절(왜 같은 함수를 재사용했는지, 왜 cancel 인지, §8 라인 1088 과의 관계)을 반드시 포함시키면 연속성 리스크는 해소된다. 또한 이번 검토에서 전달된 payload 번들이 실제 대상 spec 파일(`4-execution-engine.md`)을 누락하고 있었음을 별도로 보고한다(오케스트레이터 측 조치 필요).

## 위험도

LOW

BLOCK: NO
STATUS: SUCCESS
