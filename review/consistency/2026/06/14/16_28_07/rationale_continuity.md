# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (--impl-done, diff-base=fc5d832b)
검토 범위: 구현 변경사항 (`terminal-revoke-reconciler.service.ts`, `interaction-token.service.ts`)

---

### 발견사항

- **[INFO]** D3=A 결정 — plan 최초 권장(C)에서 사용자 선택(A)으로 격상, R15 신설로 근거 완비
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R15 + §3.4 EIA-RL-06 (워크트리 spec 신설)
  - 과거 결정 출처: `plan/in-progress/spec-fix-eia-token-error-codes.md` §결정 3 권장안 ("본 plan 단계에서는 옵션 C를 즉시 반영하고, 옵션 A를 후속 하드닝 plan으로 분리 신설")
  - 상세: 최초 plan 의 project-planner 권장은 "결정 3=C(doc-only) + 후속 plan 별도 신설로 옵션 A(outbox 전환)"였다. 그러나 완료된 plan 헤더(line 15-19)가 명시하는 대로 사용자가 D3=A 를 명시 선택했으며, 그 결정 근거가 워크트리 spec R15 에 전문 기재되어 있다. 따라서 Rationale 갱신 없는 무근거 번복이 아니다.
  - 제안: 현 상태 유지. R15 의 기각 목록(전용 outbox 테이블·TTL 단축·live 경로만 유지)이 plan 의 옵션 A/B/C 트레이드오프를 충분히 반영하고 있다.

- **[INFO]** 원형 transactional-outbox(신규 테이블 적재) 대신 `execution_token` 자체를 outbox로 채택 — 명시적 기각 기록 포함
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R15 + 구현 `TerminalRevokeReconcilerService` / `reconcileTerminalRevocations()`
  - 과거 결정 출처: `plan/in-progress/spec-fix-eia-token-error-codes.md` §결정 3 옵션 A 설명 ("terminal event를 execution 상태 TX와 같은 commit에 outbox row로 적재하고, 별도 worker가 outbox를 폴링")
  - 상세: plan의 옵션 A 서술은 "신규 outbox 테이블 + TX 내 row 적재" 방식을 제시했고, 구현은 그 대신 기존 `execution_token` 테이블을 reconciliation source 로 삼는 방식을 선택했다. 이는 plan 옵션 A의 인프라 비용(신규 테이블·마이그레이션·dual-write)을 줄이는 variant 로, R15에 "전용 outbox 테이블 기각" 이유("execution_token이 이미 execution별 durable 추적, dual-write·신규 마이그레이션 불요")가 명문화되어 있다. §9.3의 "outbox pattern의 별도 worker — 구현 선택"이라는 기존 허용 문구와도 충돌하지 않는다.
  - 제안: 현 상태 유지. data-flow/15-external-interaction.md §2.2 BullMQ 표에 `terminal-revoke-reconcile` 큐 항목이 추가되어 있으므로 (워크트리 기준) 해당 갱신이 main 브랜치 병합 시 함께 포함되는지 확인 권장.

- **[INFO]** BullMQ repeatable 패턴 — `0-overview.md` §Rationale 확립 패턴과 일치
  - target 위치: `terminal-revoke-reconciler.service.ts` `onModuleInit` → `upsertJobScheduler('* * * * *')`
  - 과거 결정 출처: `spec/0-overview.md` §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀" + `spec/data-flow/0-overview.md` 의 BullMQ repeatable 선례 (login-history-pruner, alerts-evaluator, integration-expiry-scanner, notification-secret-rotator)
  - 상세: 기존 Rationale 은 `@Cron`(인메모리 타이머, replica 수만큼 중복 발화) 대신 BullMQ repeatable scheduler(Redis 중앙 스케줄, 전역 1회)를 선호하는 패턴을 확립했다. 구현 코드 주석도 이 원칙을 인식하고 BullMQ repeatable을 채택한다 — 기각된 대안(@Cron)을 재도입하는 게 아니라 합의된 원칙을 따르는 것이다.
  - 제안: 변경 없음.

- **[INFO]** `onModuleInit` scheduler 등록 실패 → throw 전파(fail-fast) vs `reconcile()` 에러 → swallow(fail-open) 비대칭
  - target 위치: `terminal-revoke-reconciler.service.ts` `onModuleInit` (throw 전파) vs `reconcile()` (catch swallow)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §8.3 "Redis down 시 blacklist 검사 fail-open" 원칙 + `spec/0-overview.md` Redis trade-off
  - 상세: 부팅 시 scheduler 등록 실패(Redis 미가용)는 throw로 fail-fast 처리하는 반면, 실제 sweep 실패는 catch-swallow로 fail-open 처리한다. 이 비대칭은 "부팅 가드"(fail-closed)와 "런타임 운영 경로"(fail-open) 구분이며, §8.3의 "Redis down 시 fail-open" 기조와 정합한다. 다만 부팅 fail-fast가 기존 Rationale 어디에도 명시적 invariant로 등장하지 않아, 향후 "Redis 없이도 부팅 허용" 정책 변경 시 충돌 지점이 될 수 있다.
  - 제안: INFO 수준 메모. R15에 "scheduler 등록 실패 = fail-fast(부팅 차단)" 동작을 한 문장 추가하면 Rationale이 완전해진다.

---

### 요약

`TerminalRevokeReconcilerService` + `reconcileTerminalRevocations()` 구현은 기존 spec Rationale에서 명시적으로 기각된 대안을 재도입하지 않는다. 핵심 결정(D3=A — at-least-once sweep 즉시 구현)은 plan의 최초 project-planner 권장(C=doc-only 후 follow-up)과 다르지만 사용자의 명시 선택이었고, 그 근거가 워크트리 spec R15에 전문 기재된다. 채택한 구현 변형(전용 outbox 테이블 신설 대신 `execution_token`을 reconciliation source로 사용)도 R15에서 트랜잭션 아웃박스 방식과의 비교·기각 이유가 문서화되어 있다. BullMQ repeatable 패턴은 `0-overview.md`가 확립한 선례 그대로다. Rationale 연속성 관점에서 중대한 위반은 없으며, spec 갱신이 구현과 동행하고 있다.

---

### 위험도

NONE
