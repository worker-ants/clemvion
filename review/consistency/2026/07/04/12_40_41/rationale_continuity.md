# Rationale 연속성 Check — spec-update-execution-engine-pr4

- target: `plan/in-progress/spec-update-execution-engine-pr4.md`
- 대상 spec: `spec/5-system/4-execution-engine.md` (§7.1/§7.2/§7.4/§7.5/§8/§9.2/§9.3/§Rationale), `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`
- 검토 모드: `--spec` (spec draft, PR4 Planned→구현 flip)
- 교차검증: `codebase/backend` 의 실제 PR4 구현 커밋(`dbc541602`, 2026-07-04) 대조

## 발견사항

### [INFO] `recoverStuckExecutions` 은퇴 철회 — Rationale 3곳 모두 갱신 대상이나 draft 에 새 근거 명시됨

- target 위치: 편집 목록 E2 (§7.1 829행), E8 (§Rationale 1466–1470행 근방)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` 세 곳이 모두 "`recoverStuckExecutions` 은퇴는 PR4 에서 도입" 이라고 명시했다 —
  - §7.1 829행: `"완전 대체는 PR4 로 남는다(… recoverStuckExecutions 은퇴 포함 …)"`
  - §Rationale 1300행 ("크래시/재시작 RUNNING 세그먼트 제어된 re-drive"): `"자동 재배달·recoverStuckExecutions 은퇴는 PR4 에서 관측성과 함께 도입한다."`
  - §Rationale 1470행 ("Phase 2 cont 후속 정리" 항목 3): PR4 를 "완전 대체" 로 서술.
- 상세: target 은 이 세 곳 모두를 "은퇴 아님 — 부팅 backstop 상시 유지" 로 뒤집는다. 이는 과거 Rationale 이 명시한 계획의 **번복**이지만, target 자체가 새 Rationale(물리적 근거: 전체 재시작·Redis 비영속·job 유실은 stalled job 자체가 없어 stalled 재배달로 커버 불가 + KB `stuck-document-recovery` 선례)을 **함께 작성**하고 있으므로 "무근거 번복"에는 해당하지 않는다. 실제 구현(`dbc541602`, commit message: "recoverStuckExecutions 는 backstop 으로 상시 유지(부팅/Redis-비영속/job-유실 등 stalled job 이 없는 케이스 담당)")도 이 신규 근거와 정확히 일치한다.
- 판단: 이것은 "합의된 원칙 위반"이 아니라 **구현 결과에 따른 타당한 예정 변경**이다 — PR4 landing 시점에 "은퇴" 대신 "backstop 병존"이 더 견고한 설계임이 드러난 사례. 다만 세 곳(§7.1 829행, Rationale 1300행, Rationale 1470행) 모두를 빠짐없이 갱신해야 하며, 편집 목록에는 829행(E2)과 1470행 근방(E8)만 명시돼 있고 **1300행("자동 재배달·recoverStuckExecutions 은퇴는 PR4 에서…")은 편집 목록에 명시적으로 포함되지 않았다** — 이 문장도 "은퇴" 표현을 담고 있어 누락 시 정합 공백이 생긴다.
- 제안: 편집 목록에 "1300행 크래시/재시작 세그먼트 제어된 re-drive Rationale — '자동 재배달·recoverStuckExecutions 은퇴는 PR4 에서…' 문장도 backstop 유지로 정정" 항목을 추가해 세 곳 모두 커버되게 한다.

### [INFO] `exec:run:seq` "PR4 활성화" 스케치 정정 — 실제 구현과 일치 확인됨

- target 위치: 편집 목록 E6 (§9.2 1117행)
- 과거 결정 출처: §9.2 키 표 1117행 원문 — `"exec:run:seq:<executionId> … (PR4 활성화 — PR1~PR3 미사용) … BullMQ re-enqueue(크래시 재개)가 도입되는 PR4 에서 jobId 를 <executionId>:run:<seq> 로 확장할 때 활성화한다"`.
- 상세: 이 스케치는 "PR4 = 명시적 re-enqueue(jobId 확장) 도입" 을 전제했으나, 실제 PR4 구현은 BullMQ 네이티브 stalled 검출(같은 jobId 유지, `maxStalledCount:1`)을 채택해 별도 re-enqueue/seq 가 불요해졌다. 코드 확인 결과(`execution-run.queue.ts`) `run:seq` 참조가 실제로 전혀 없어 draft 의 "정정" 주장이 사실과 일치한다.
- 판단: 이는 과거 Rationale 이 기각한 대안의 재도입이 아니라, **과거에 스케치했던 구현 경로가 실제로는 채택되지 않은 것**을 정직하게 반영하는 것 — Rationale 연속성 문제 없음. 오히려 이런 "예정 vs 실제" 괴리를 spec 에 남기지 않고 즉시 정정하는 것이 바람직하다.
- 제안: 없음 (draft 그대로 반영 권장). 다만 §9.2 키가 "PR4 에서도 미사용 유지"로 바뀌면 이 키 항목 자체가 "예정됐으나 결국 쓰이지 않은 키"로 남는데, 후속 PR 이 명시적 re-enqueue 를 도입할 계획이 실제로 없다면 이 죽은 키 서술을 spec 표에 계속 남겨둘 실익이 낮다는 점만 참고— 이는 INFO 수준의 문서 경량화 제안이며 필수 아님.

### [INFO] `WORKER_HEARTBEAT_TIMEOUT` 재정의 — 코드명 유지 원칙과 정합

- target 위치: 편집 목록 E7, E8 (§2.13/§Rationale)
- 과거 결정 출처: `spec/conventions/error-codes.md` 63행 — "코드명은 유지·PR4 재정의"를 이미 명시. `spec/5-system/4-execution-engine.md` §7.1 827행 "기존 코드 유지·PR4 재정의"도 동일.
- 상세: target 의 "PR4 부터 발동" 전환은 과거 Rationale 이 이미 예고한 정확히 그 지점("PR4 target" → "PR4 구현")이다. 새로운 결정 번복이 아니라 계획된 전환의 실현. 실제 구현 커밋에서도 `finalizeStalledExhausted` 가 `status='running'` 조건부로 `WORKER_HEARTBEAT_TIMEOUT` 을 마킹한다고 명시돼 있어 정합.
- 판단: Rationale 연속성 문제 없음.
- 제안: `spec/conventions/error-codes.md` 63행과 `spec/data-flow/3-execution.md` 247/262/293행도 동일하게 "PR4 예약" → "PR4 구현"으로 업데이트해야 코드 전체가 일관된 상태가 된다 (target draft 의 spec_impact 는 `4-execution-engine.md` 단일 파일만 지정 — 이 세 문서의 동기화 여부를 확인 요망, 아래 CRITICAL/WARNING 항목 참조).

### [WARNING] spec_impact 범위 누락 — WORKER_HEARTBEAT_TIMEOUT/PR4 서술이 있는 인접 문서 3곳이 draft 의 spec_impact 에 없음

- target 위치: frontmatter `spec_impact: [spec/5-system/4-execution-engine.md]`
- 과거 결정 출처: 없음(이 항목은 Rationale 위반이 아니라 **동기화 범위** 문제) — 단, "결정의 무근거 번복"을 피하려면 관련된 모든 문서가 함께 갱신되어야 spec 전체의 Rationale 일관성이 유지된다.
- 상세: 아래 세 문서가 모두 "WORKER_HEARTBEAT_TIMEOUT: PR4 예약(미발동)" 및 "recoverStuckExecutions: PR3 re-drive, BullMQ stalled 는 PR4" 서술을 담고 있으나, target 의 `spec_impact` 에는 포함되어 있지 않다:
  - `spec/5-system/3-error-handling.md:76` — `"WORKER_HEARTBEAT_TIMEOUT | … PR4 예약 — PR3 부팅 시 stale RUNNING 재개는 fail 이 아니라 re-drive(§7.5 case B)라 PR3 기간 미발동"`
  - `spec/conventions/error-codes.md:63` — 동일 취지, "(PR4 target) BullMQ stalled-job 재배달 attempts 소진 시 발동"
  - `spec/data-flow/3-execution.md:247, 262, 293` — `"WORKER_HEARTBEAT_TIMEOUT 은 PR4 stalled 예약 — PR3 미발동"`, `recoverStuckExecutions (PR3 — re-drive)` 행에 "BullMQ stalled 자동 재배달·WORKER_HEARTBEAT_TIMEOUT 발동은 PR4" 명시.
  - `spec/1-data-model.md:469` — `Execution.error` 컬럼 설명에 동일하게 "PR4 예약, PR3 기간 미발동" 서술.
- 이들을 갱신하지 않으면 `4-execution-engine.md` 는 "PR4 구현 완료·WORKER_HEARTBEAT_TIMEOUT 발동" 으로 바뀌는데, 나머지 4개 문서는 "PR4 예약·미발동" 상태로 남아 **동일 spec 세트 내 직접 모순**이 발생한다. 이는 §"결정의 무근거 번복" 관점에서 자체로는 문제가 아니지만, 번복이 일부 문서에만 반영되고 나머지에 반영되지 않으면 사실상 부분 정합 파괴이며 이후 리더가 "PR4 가 이미 구현됐는가"를 문서마다 다르게 읽게 된다.
- 제안: `spec_impact` 에 `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`, `spec/1-data-model.md` (469행 인용부) 를 추가하고, 각 문서의 "PR4 예약/target/미발동" 표현을 `4-execution-engine.md` E7/E8 과 동일하게 "PR4 구현 완료" 로 동기화하는 편집 항목을 draft 에 명시적으로 추가할 것을 권고한다. (본 checker 의 범위는 Rationale 연속성이지만, 이 누락은 cross-spec 정합 문제와 직결되므로 별도 cross_spec checker 결과와 대조 요망.)

### [INFO] under-count 미해소 — 기존 2026-07-04 PR3 정정과 완전히 정합

- target 위치: 편집 목록 E5 (§8 1409–1424행)
- 과거 결정 출처: 두 층위가 이미 존재한다 —
  1. PR2a 원 결정(1407–1413행): "경합 없는 flush 는 세그먼트-start 영속이 도입되는 **PR4** 에서 해소 예정"
  2. PR3(2026-07-04) 자체가 이미 남긴 **"정정" 각주**(1415행): `"PR3 의 제어된 re-drive 는 세그먼트-start 를 영속하지 않으므로 under-count 를 해소하지 않는다 … 정밀한 flush(1차 bound 를 §8 로 승격)는 PR4 세그먼트-start 영속에 의존한다."`
  3. `실행 컨텍스트 in-memory + DB durable` Rationale(1424행)도 "세그먼트-start 영속은 **미확정 후속 candidate**(PR4 stalled 재배달 인프라와 함께 검토 … 아직 PR4 확정 scope 아님)로 남긴다" 고 이미 명시.
- 상세: target 의 "Q2 defer → under-count 미해소" 주장은 새 번복이 아니라, PR3 스스로가 이미 "세그먼트-start 영속은 PR4 확정 scope 가 아니다"라고 못박아 둔 것을 PR4 시점에 재확인하는 것이다. 실제 PR4 구현 커밋에도 `segmentStartMs`/세그먼트-start 영속 관련 변경이 없다(diff stat 상 관련 파일 없음) — 사실과 일치.
- 판단: Rationale 연속성 문제 없음. 오히려 이 항목은 세 문서(1409–1413, 1415, 1424)가 이미 "PR4 도 아직 미확정"이라고 정직하게 남겨둔 덕분에 target 이 자연스럽게 흡수 가능한 사례 — 모범적인 선제 Rationale 관리의 결과.
- 제안: E5 편집 시 1415행("정정 (PR3, 2026-07-04)")과 1424행("미확정 후속 candidate")의 관계를 명확히 — PR4 구현 완료로 flip 하더라도 "세그먼트-start 영속"은 여전히 미착수이므로, 두 각주 모두 "PR4 이후 후속(candidate, 미확정)"으로 표현을 통일해 "PR4"라는 단어가 향후 또 다른 PR5 등과 혼동되지 않도록 명시할 것을 권고 (경미한 표현 정합 제안, INFO).

### [INFO] `maxStalledCount>0` 자동 재배달 도입 — PR3 Rationale 이 예고한 "다음 단계"와 정합

- target 위치: 편집 목록 E2/E6 (§7.1 828행 표, §9.3 1136행)
- 과거 결정 출처: §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" (1300행): `"왜 BullMQ stalled 자동 재배달을 지금 켜지 않는가 (PR4 분리): … 제어된 트리거(부팅 스캔)로 먼저 landing 해 멱등 재구동 메커니즘·경계를 검증하고, 자동 재배달·recoverStuckExecutions 은퇴는 PR4 에서 관측성과 함께 도입한다."`
- 상세: target 은 정확히 이 예고를 실현한다(`maxStalledCount:0→1`). PR3 가 "먼저 제어된 re-drive 로 멱등 재구동 메커니즘을 검증한 뒤 자동 재배달을 켠다"는 순서를 그대로 따랐고, `maxStalledCount=1`(무한이 아닌 bounded 1회)로 poison 세그먼트 무한 증폭 위험(1300행이 우려한 "poison/non-idempotent 세그먼트 무인 재실행 자동 증폭")을 명시적으로 제한한 것도 그 우려에 대한 직접 대응이다.
- 판단: 원칙 위반 없음 — 오히려 과거 Rationale 이 세운 "먼저 검증 후 자동화" 원칙을 정확히 따른 모범 사례.
- 제안: 없음.

### [INFO] zombie race 관련 서술 — "완전 fencing" 과표기 회피는 기존 결정과 정합

- target 위치: 편집 목록 E4 (1002행, 1301–1302행)
- 과거 결정 출처: §Rationale 1301행 — `"완전 fencing 은 PR4 BullMQ stalled 로 완결한다"` (PR3 시점 서술).
- 상세: target 은 이를 "PR4 가 lock 기반 재배달로 대폭 완화, per-node skip 이 이중 구동 무해화" 로 조정하며 "PR4 가 완전 해소로 과표기하지 않는다"고 명시한다. 이는 PR3 가 남긴 낙관적 서술("완전 fencing")을 구현 후 현실적으로 하향 조정하는 것으로, BullMQ stalled fencing 이 lock 만료 기반이라 zombie 를 완전 배제하지 못한다는 일반적 사실과 부합한다. 새 Rationale 을 자체 포함하고 있어(정합) 무근거 번복이 아니다.
- 판단: 문제 없음.
- 제안: 없음.

## 요약

target draft 는 PR3 Rationale 이 예고했던 여러 지점(자동 재배달 도입, `WORKER_HEARTBEAT_TIMEOUT` 발동, zombie fencing 서술)을 계획대로 실현하면서, 동시에 PR3 Rationale 이 명시했던 세 가지 예정(① `recoverStuckExecutions` 은퇴, ② `exec:run:seq` PR4 활성화, ③ 세그먼트-start 영속을 통한 under-count 해소)을 실제 구현 결과에 따라 되돌리거나 미루고 있다. 이 세 가지 모두 target 자체가 새 Rationale(물리적 근거·KB 선례·네이티브 stalled 특성·인프라 비용)을 함께 제시하고 있고, 실제 구현 커밋(`dbc541602`, 2026-07-04)과 교차검증한 결과 draft 의 factual claim(recoverStuckExecutions 유지, run:seq 미사용, under-count 미해소, maxStalledCount=1)이 코드와 정확히 일치한다 — "무근거 번복"이나 "기각된 대안의 재도입"에 해당하는 CRITICAL 사안은 없다. 유일한 실질 리스크는 Rationale 내용 자체가 아니라 **적용 범위 누락**이다 — `recoverStuckExecutions` 은퇴 서술이 §7.1(829행) 뿐 아니라 §Rationale 1300행에도 있는데 편집 목록에 1300행이 명시되지 않았고, `WORKER_HEARTBEAT_TIMEOUT`/`recoverStuckExecutions`/PR4 예약 서술을 공유하는 인접 문서 4곳(`3-error-handling.md`, `conventions/error-codes.md`, `data-flow/3-execution.md`, `1-data-model.md`)이 draft 의 `spec_impact` 에서 빠져 있어, `4-execution-engine.md` 만 flip 되면 spec 세트 내부에 "PR4 구현 완료" vs "PR4 예약·미발동"의 직접 모순이 남는다. 이는 Rationale 연속성 자체의 위반이 아니라 **동시 갱신 범위의 불완전성**이므로 WARNING 등급으로 분류한다.

## 위험도

LOW

(핵심 판단: Rationale 연속성 관점에서 CRITICAL/차단 사유 없음. §7.1 1300행 누락 + 4개 인접 문서 spec_impact 누락은 WARNING 이며, 병합 전 편집 목록 보강을 권고하나 이 checker 단독으로 BLOCK 을 걸 사안은 아니다.)
