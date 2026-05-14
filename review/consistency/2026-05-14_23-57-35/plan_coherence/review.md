---

## 발견사항

### [WARNING] `cafe24-pending-polish.md` 변경 4 BullMQ payload 설계와 현 spec §2.2 불일치

- **target 위치**: `spec/data-flow/integration.md §2.2 Redis` — payload 형식 `{ triggeredAt: ISO }`, 3개 별도 job name으로 분기
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 변경 4 (미체크 `[ ]`)  
  > `BullMQ 메시지 스키마 확장: { integrationId, reason: 'token_expiring' | 'pending_install_timeout' }. 하위 호환: consumer에 reason ?? 'token_expiring' 기본값 처리. 배포 순서: consumer 먼저 배포 → producer.`
- **상세**: 변경 4가 제안한 단일 job + `reason` 필드 방식이 현 spec에서 3개 독립 scheduled job (`connected-expiry-daily` / `pending-install-ttl-daily` / `usage-log-prune-daily`) + `{ triggeredAt }` payload 방식으로 대체됐다. 두 설계는 격리 목표는 같으나 기술 구현이 다르며, `배포 순서: consumer 먼저 배포 → producer` 정책도 현 설계(`onModuleInit`에서 `removeJobScheduler` idempotent 제거)에서는 의미가 달라진다.
- **제안**: `cafe24-pending-polish.md` 변경 4의 해당 미체크 항목에 ~~취소선~~ 처리 + "현 worktree에서 3-job 분리로 대체됨" 메모 추가. 또는 `cafe24-pending-polish-followup.md`에 "BullMQ 3-job 분리 결정 — 변경 4의 payload 설계 폐기" 항목을 체크 완료 기록으로 추가.

---

### [WARNING] Group D `process()` 에러 격리 정책이 spec §1.4에 반영되었으나 plan 미체크

- **target 위치**: `spec/data-flow/integration.md §1.4` 격리 정책 절  
  > `에러는 그대로 throw — BullMQ가 attempts=3까지 retry한 뒤 실패 처리. 영구 실패한 job은 큐의 failed 리스트에 남아 30일간 보존되어 alerting으로 픽업 가능.`
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 D (미체크 `[ ]`)  
  > `process() 에러 격리 정책 spec 명시. 현재 .catch(logger.error)로 BullMQ 재시도가 안 일어남 — 의도된 설계라면 spec/data-flow/integration.md §1.4에 명문화 + Sentry / Datadog 연동 검토.`
- **상세**: spec 명문화 요청이 target에 이미 반영됐다. 단, plan item의 "+ Sentry / Datadog 연동 검토" 부분은 spec에 없으며 별도 후속 결정이 필요한 상태다. Plan의 체크박스가 그대로 `[ ]`여서 이 worktree에서 처리됐는지 추적 불가.
- **제안**: `cafe24-pending-polish-followup.md` 그룹 D 해당 항목을 `[x] spec 명문화 완료 (data-flow §1.4). Sentry/Datadog 연동은 별도 결정 필요`로 분리 갱신.

---

### [WARNING] `cafe24-pending-polish-followup.md` frontmatter `worktree: (none)` — 현 worktree 미기록

- **target 위치**: 해당 없음 (plan 문서 자체 문제)
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 상단 frontmatter
- **상세**: 현 worktree `cafe24-followup-bullmq-split-198c0a`에서 이 plan의 그룹 A·C·D·E·F 항목을 처리 중(커밋 히스토리 확인)이나, frontmatter `worktree` 필드가 `(none)`이어서 consistency-checker `plan_coherence` 가 충돌 검출을 할 수 없고, 동시 작업 추적도 불가.
- **제안**: frontmatter를 `worktree: cafe24-followup-bullmq-split-198c0a`로 갱신.

---

### [INFO] Group B TTL 기준 분리 미결 — 현 spec `created_at` 기준 유지

- **target 위치**: `spec/data-flow/integration.md §1.4` `pending-install-ttl-daily` job  
  > `created_at < now - INTERVAL '24h'`
- **관련 plan**: `cafe24-pending-polish-followup.md` 그룹 B — `installTokenIssuedAt` 컬럼 추가 또는 `createdAt` 재갱신 트레이드오프 결정 미결
- **상세**: 현 spec은 `created_at` 기준을 유지하고 있어 그룹 B 미결 결정과 충돌하지 않는다. 단, 그룹 B 항목이 구현될 때 이 spec 행도 수정 대상이 된다. 이 worktree 범위 외.
- **제안**: 현 상태 유지. 그룹 B 진입 시 spec/data-flow/integration.md §1.4 재검토 필요.

---

### [INFO] 그룹 D Sentry/Datadog 연동 부분 — spec 에 미포함

- **target 위치**: `spec/data-flow/integration.md §1.4` 격리 정책
- **관련 plan**: `cafe24-pending-polish-followup.md` 그룹 D 동일 항목
- **상세**: spec은 "30일간 보존되어 alerting으로 픽업 가능"까지만 기술. Sentry/Datadog 연동은 인프라 결정이므로 spec 범위를 벗어나는 것이 맞다. 별도 관측성 plan 또는 `self-hosting-deployment.md` 와 연계하는 것이 적절.
- **제안**: 별도 추적 불필요. 그룹 D 항목 분리 시 "연동 검토" 부분만 별도 INFO 항목으로 보존.

---

## 요약

`spec/data-flow/integration.md §1.4`의 3-job BullMQ 분리 설계와 격리 정책 명문화는 `cafe24-pending-polish-followup.md` 그룹 D의 요청을 충족하며 `cafe24-pending-polish.md` 변경 4가 의도했던 독립 실행·실패 격리 목표도 달성한다. 다만 plan 문서들이 이 설계 결정을 반영하지 않아 추적 단절이 발생하고 있다: `cafe24-pending-polish.md` 변경 4의 payload 설계(`{ integrationId, reason }`)는 현 spec과 직접 충돌하는 미체크 항목으로 남아 있고, `cafe24-pending-polish-followup.md`의 frontmatter는 현 worktree를 기록하지 않아 plan_coherence 추적을 방해한다. CRITICAL 위반은 없으며 구현 착수를 차단하지 않는다.

## 위험도

**MEDIUM** — plan 문서 3건 갱신 후 착수.