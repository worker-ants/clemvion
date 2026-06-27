# Rationale 연속성 검토 — spec-draft-eia-seq-nfr

## 발견사항

- **[WARNING] EIA-NF-06 이 Redis 정상 시에만 성립하는 monotonic 불변식을 무조건으로 서술 — degraded-mode 합의와 거리감**
  - target 위치: 변경안 §3.5 표 EIA-NF-06 행 ("멀티 인스턴스 환경에서 ... seq 는 1000 events/s 부하에서 중복·역전 없이 단조 유일하다. Redis `INCR` 의 원자성으로 보장")
  - 과거 결정 출처: `plan/complete/eia-distributed-seq-counter.md` 수용 기준 + R-3, 및 `eia-distributed-seq-checklist.md` D2 / line 43-44. 합의된 invariant: "**분산 monotonic 은 Redis 정상 시에만 보장** (degraded 는 single-instance baseline 과 동등)". Redis 장애 시 `ExecutionSeqAllocator` 는 in-memory best-effort 로 degrade 하며 멀티 인스턴스 단조 유일성은 보장되지 않는다 (사용자 수용된 Redis-only 결정, R-3).
  - 상세: NFR 문안이 단조 유일성을 무조건(unconditional) 보장처럼 읽혀, 이미 합의·기록된 "Redis 정상 전제" 단서를 누락한다. spec 본문에 무조건 invariant 로 박히면 Redis degraded 경로(설계상 허용된 동작)가 NFR 위반으로 오독될 수 있다. 기각·번복은 아니나 기존 Rationale 의 명시적 단서와 거리가 있다.
  - 제안: EIA-NF-06 문안에 "Redis 정상 운영 전제(분산 monotonic 은 Redis 가용 시 보장; Redis 장애 시 in-memory degraded — single-instance baseline 과 동등, §R7 / seq-counter plan R-3)" 단서를 한 구절 추가. 또는 §R7 보강 문장에 degraded 전제를 함께 명시해 NFR 이 그것을 참조하도록.

- **[INFO] 출처 plan 경로 표기 부정확 — `plan/complete/eia-distributed-seq-load-verify.md` 는 실제로 `plan/in-progress/`**
  - target 위치: frontmatter 하단 "출처" 줄 + 결정 근거 EIA-NF-07 항의 plan 인용 경로
  - 과거 결정 출처: 해당 없음 (provenance 정확성 문제, Rationale 충돌 아님)
  - 상세: 헤더는 `plan/complete/eia-distributed-seq-load-verify.md` 를 출처로 적었으나 그 파일은 `plan/in-progress/eia-distributed-seq-load-verify.md` 에 있고 부하 측정 체크박스(`1000 events/s 시 seq 단조 증가 보장 측정`)가 아직 `[ ]` 미완 상태다. 또한 draft 가 인용한 경험치(≈67k events/s, median ~0.07ms)는 두 plan 본문에서 확인되지 않고 "PR #730 관측" 으로만 제시된다. EIA-NF-07 의 "< 5ms vs in-memory baseline" 자체는 `eia-distributed-seq-counter.md` 수용 기준(line 79)과 정확히 일치하므로 근거 정합은 양호.
  - 제안: 출처 경로를 실제 위치(`plan/in-progress/...` 또는 완료 시 이동 후 경로)로 정정하고, 경험치 수치의 출처를 PR #730 e2e 산출물로 명확히 링크. NFR 승격과 동시에 load-verify plan 의 측정 체크박스를 닫거나, 미완이면 그 상태를 draft 에 반영.

- **[INFO] R7 보강 문장의 "신규 counter 도입" 기각 근거와 정합 — 위반 없음 (확인용 기록)**
  - target 위치: Rationale 보강 (§R7 말미 추가 문장)
  - 과거 결정 출처: EIA spec §R7 "근거" — "신규 counter 도입 시 두 채널 간 정합성 검증이 별도 필요 → 비용 크고 이득 없음" (별도 counter 신설 기각)
  - 상세: draft 는 기존 atomic INCR counter 에 정량 NFR 을 **연결**할 뿐 새 counter 를 도입하지 않으므로 R7 의 기각 결정과 충돌하지 않는다. 단일 counter(WS envelope · SSE `id:` · Notification `seq` 공유) 전제도 그대로 유지. 재도입·번복 없음.
  - 제안: 없음 (정합 확인). 보강 문장이 §R7 의 단일-counter 전제를 재확인하는 방향으로 작성된 점은 연속성에 부합.

## 요약
target draft 는 이미 구현·검증된 계약(§R7 의 execution-scoped atomic INCR seq counter)을 정량 NFR(EIA-NF-06/07)로 명문화하는 순수 가산형 문서화로, 과거 Rationale 에서 기각된 대안(별도 counter 신설, batch emit, DB fallback)을 재도입하지 않고 합의 원칙(단일 counter 공유, Redis-only)을 그대로 따른다. EIA-NF-07 의 "회귀 예산 < 5ms vs in-memory baseline" 프레이밍과 수치는 seq-counter plan 수용 기준과 정확히 일치하며, 각 신규 NFR 에 대해 새 Rationale 도 함께 작성돼 무근거 번복도 없다. 다만 EIA-NF-06 이 "Redis 정상 시에만 분산 monotonic 보장" 이라는 이미 합의·기록된 degraded-mode 단서를 누락한 채 단조 유일성을 무조건처럼 서술하는 점이 기존 Rationale 와 거리감이 있어 단서 보강이 필요하고, 출처 plan 경로·경험치 provenance 표기에 부정확이 있다.

## 위험도
LOW
