---
worktree: fix-cafe24-refresh-dedup-and-shortcircuit-ec6632
started: 2026-05-21
completed: 2026-05-21
owner: resolution-applier
status: complete
---
# Spec Fix Draft — reactive_401 unique jobId dedup 전략 반영

## 적용 결과 (2026-05-21)

`review/consistency/2026/05/21/07_55_15/SUMMARY.md` 의 BLOCK: YES (Critical 8 건) 을 해소하기 위해 본 draft 의 scope 를 1개 파일 (`spec/2-navigation/4-integration.md`) 에서 3개 파일로 확장 적용:

- `spec/2-navigation/4-integration.md` — Rationale 신설 (`reactive_401 jobId unique 화 — dedup 완전 우회 (2026-05-21)`) + 기존 `removeOnComplete: { age: 0 }` 항 폐기 처리 + lines 817, 821, 1195, 테스트 목록 갱신
- `spec/4-nodes/4-integration/4-cafe24.md` — §4 step 9 (line 89), §6.1 line 337, §9.6 lines 473~481 갱신
- `spec/data-flow/5-integration.md` — §2.2 queue table line 220 dedup 컬럼 갱신

추가로 Rationale Continuity Critical 3 건 (`removeOnComplete: { age: 0 }` 채택 결정 명시적 폐기, `withIntegrationLock` 기각 대안 재등장 구분, `waitUntilFinished` invariant 해제 범위) 은 새 Rationale 의 **기존 invariant 의 명시적 해제 범위 (Rationale Continuity)** 절에서 명시.

`refreshViaQueue('reactive_401')` 표기 (Naming Collision C-7) 는 `refreshViaQueue` (`source='reactive_401'`) 로 정정.

이하 본문은 초기 draft 원형. 적용된 spec 변경의 상세는 `spec/2-navigation/4-integration.md` 의 ## Rationale "reactive_401 jobId unique 화 — dedup 완전 우회 (2026-05-21)" 참고.

---

## 원본 발견사항

`review/code/2026/05/21/07_34_58/documentation.md` 의 CRITICAL/WARNING 발견사항.

### SUMMARY#1 [CRITICAL] — Rationale 의 `removeOnComplete: { age: 0 }` 정책 설명이 코드와 불일치

> `spec/2-navigation/4-integration.md` line 1479 의 Rationale 항이 `reactive_401` 의 dedup
> 우회 전략으로 `removeOnComplete: { age: 0 }` 를 명시하고 있으나, 2026-05-21 변경에서
> 이 정책은 `jobId unique 화` 전략으로 교체되었다. spec 을 읽는 개발자가 이미 폐기된
> `age: 0` 정책을 현재 동작으로 오인한다.

### SUMMARY#2 [CRITICAL] — spec §10.5 본문 line 817 의 `refreshViaQueue (jobId = integrationId)` 설명이 불정확

> "재시도 분기는 `refreshViaQueue` (`jobId = integrationId`) 를 거치므로 클러스터 전체
> 단일 refresh" 라는 설명은 proactive/background 에만 해당하며, `reactive_401` 경로는
> unique jobId + PostgreSQL row-level pessimistic_write lock 으로 직렬화된다.

### SUMMARY#3 [CRITICAL] — spec §10.5 본문 line 821 의 `모든 cafe24 refresh 호출은 ... jobId = integrationId dedup` 설명이 불완전

> "모든 cafe24 refresh 호출은 `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로
> 클러스터 전체 직렬화된다" 라는 문장은 reactive_401 에 대해 더 이상 정확하지 않다.

### SUMMARY#4 [WARNING] — spec Rationale 테스트 목록이 2026-05-21 추가 테스트를 누락

> Rationale 의 **테스트** 항목이 2026-05-18 기준 목록만 반영. 2026-05-21 추가된
> 파라미터라이즈드 테스트 3종 및 reactive_401 unique jobId 어서션이 누락되어 있다.

---

## 제안 변경

### 1. spec/2-navigation/4-integration.md line 817 수정 (SUMMARY#2)

**현재:**
```
재시도 분기는 `refreshViaQueue` (`jobId = integrationId`) 를 거치므로 클러스터 전체 단일 refresh — thundering herd 사고 없음.
```

**제안:**
```
재시도 분기는 `refreshViaQueue('reactive_401')` 를 거치며, cross-pod 직렬화는
`refreshAccessToken` 내부의 PostgreSQL pessimistic_write row lock 으로 보장된다.
proactive 경로와 달리 BullMQ `jobId = integrationId` dedup 을 사용하지 않음
(2026-05-21 갱신 — `jobId unique 화` 전략, 아래 Rationale 참조).
```

### 2. spec/2-navigation/4-integration.md line 821 수정 (SUMMARY#3)

**현재:**
```
**멀티 인스턴스 race**: 모든 cafe24 refresh 호출은 `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터 전체 직렬화된다
```

**제안:**
```
**멀티 인스턴스 race**: cafe24 refresh 호출의 직렬화 메커니즘은 source 에 따라 다르다.
- `proactive` / `background`: `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로
  클러스터 전체 직렬화 — thundering herd / refresh_token rotation race 보호.
- `reactive_401` (2026-05-21 갱신): BullMQ dedup 을 우회하는 unique jobId
  (`${integrationId}#reactive-${ts}-${rand}`) 사용. cross-pod 직렬화는
  `refreshAccessToken` 의 pessimistic_write row lock 으로 폴백 보호.
  완료된 proactive job 으로의 dedup 회귀를 영구 차단.
([Rationale "reactive_401 jobId unique 화 — dedup 완전 우회 (2026-05-21)"](#reactive_401-jobid-unique-화--dedup-완전-우회-2026-05-21) 참고)
```

### 3. spec/2-navigation/4-integration.md Rationale line 1479 교체 (SUMMARY#1)

**현재 (line 1479):**
```
- **`reactive_401` 의 `removeOnComplete: { age: 0 }` 정책**: BullMQ jobId dedup 은 `waiting/active` 뿐 아니라 `completed` 상태 job 도 dedup 대상으로 본다. ... `removeOnComplete: { age: 0 }` 는 reactive_401 의 완료 job 을 즉시 제거해 ...
```

**제안 (기존 line 1479 를 새 Rationale 항으로 교체):**

```markdown
**`reactive_401` jobId unique 화 — dedup 완전 우회 (2026-05-21)**:

BullMQ `addStandardJob-9.lua:22-27` — `EXISTS jobIdKey → handleDuplicatedJob` — 는
같은 jobId 의 job 이 어떤 상태(`waiting`/`active`/`completed`/`failed`)든 존재하면
기존 job 참조를 반환하고 **신규 options 를 적용하지 않는다**. 따라서 옛 fix
(`removeOnComplete: { age: 0 }` — reactive_401 완료 후 즉시 제거) 는 *이미 생성된*
reactive_401 job 의 완료 이후에만 효과가 있었으나, proactive 가 `removeOnComplete:
{ age: 60 }` 로 완료 후 60s 잔존하는 동안 같은 `integrationId` 의 reactive_401 add 가
기존 proactive completed job 에 dedup 되는 edge case 를 차단하지 못했다.

**해결**: `reactive_401` 만 jobId 를 `${integrationId}#reactive-${Date.now()}-${rand6}` 으로
unique 화하여 BullMQ dedup 자체를 우회. proactive/background 는 기존 `jobId = integrationId`
dedup 유지 (thundering herd / refresh_token rotation race 의 핵심 보호막).

**cross-pod serialization trade-off**: unique jobId 채택 시 두 pod 이 동시에 empirical 401
을 받으면 worker 가 둘 다 실행된다. 그러나 (a) caller-side `withIntegrationLock` 이
in-process 직렬화하고, (b) `refreshAccessToken` 의 `dataSource.transaction` 안
pessimistic_write row lock 이 PostgreSQL 레벨에서 직렬화하며, (c) proactive 가 정상
작동하면 reactive_401 발생 자체가 매우 드물어 cross-pod 동시 401 은 사실상 발생하지
않는다. 동시 401 이 발생하더라도 한 pod 의 refresh 만 성공하고 다른 pod 은
invalid_grant 격하 → 사용자 reauth 로 회복 가능한 fail-safe 결과.
"dedup 회귀로 refresh 가 영원히 안 되는" 위험보다 훨씬 작은 비용.

**기각 대안**: `removeOnComplete: { age: 0 }` 유지 — BullMQ Lua script 분석으로 근본
차단이 불가함을 확인.
```

### 4. spec/2-navigation/4-integration.md Rationale 테스트 목록 갱신 (SUMMARY#4)

현재 lines 1494-1498 에 아래 항목 추가:

```markdown
- `cafe24-token-refresh.processor.spec.ts` 보강 (2026-05-21) — JWT exp parse 실패 3 케이스
  (opaque token / segments 손상 / payload exp 누락) 에서 tokenExpiresAt 미래여도 short-circuit
  금지 (`parseJwtExp` null → 항상 refresh).
- `cafe24-api.client.spec.ts` 보강 (2026-05-21) — reactive_401 의 jobId 가
  `${integrationId}#reactive-\\d+-[a-z0-9]+$` 형식이고 integration.id 와 다름을 어서션.
```

---

## 적용 절차

1. `project-planner` 역할로 spec 변경 전 `consistency-check --spec` 실행
2. BLOCK: NO 확인 후 위 변경 내용을 `spec/2-navigation/4-integration.md` 에 Edit
3. spec 변경 commit (fix(spec): SUMMARY#1~#4 reactive_401 unique jobId dedup 전략 반영)
4. 이 draft 파일을 `plan/complete/` 로 이동
5. `resolution-applier` 재호출 (동일 session_dir) — idempotency 로 코드 항목 skip, spec 항목만 마무리
