# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/data-flow, diff-base=origin/main)
대상 문서: `spec/data-flow` 폴더 전체 (0-overview · 1-audit · 10-triggers · 11-workflow · 12-workspace · 13-agent-memory 등)
참조 Rationale 출처: `spec/5-system/12-webhook.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/1-auth.md`, `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/*`

---

## 발견사항

### 1. **[INFO]** `spec/data-flow/10-triggers.md` §2.2 — 3-tier job priority 임시 편차의 Rationale 부재

- **target 위치**: `spec/data-flow/10-triggers.md` §2.2 Redis 표, execution-run 큐 payload 비고
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §4 worker 모델 (3-tier priority: manual=1 > webhook=2 > schedule=3)
- **상세**: 데이터 플로우 triggers 문서는 "트리거 타입이 job priority 결정 (3-tier: manual=1 > webhook=2 > schedule=3; 현재는 `executedBy` 유무로 manual/그 외 이분이라 schedule 발사도 webhook priority — **의도된 임시**, triggerType threading 후속)" 이라고 본문에 inline 주석으로 표기했다. 그러나 이 임시 편차에 대한 Rationale 항목이 `10-triggers.md` 의 `## Rationale` 섹션이나 실행 엔진 spec Rationale 어느 쪽에도 없다. 3-tier 의도는 확립된 결정이지만 현재 2-tier 구현이 왜 허용 가능한지, 언제까지 임시인지의 근거 기록이 없다.
- **제안**: `spec/data-flow/10-triggers.md` 의 `## Rationale` 섹션에 "현재 job priority 2-tier 임시 구현" 항목을 추가한다: triggerType 필드 threading 이 완료되기 전까지 `executedBy` 유무로 manual/비-manual 이분하는 것이 acceptable 한 이유(schedule latency tolerance 등)를 명시하거나, 실행 엔진 spec Rationale 에 해당 임시 상태를 포함한다.

---

### 2. **[INFO]** `spec/data-flow/12-workspace.md` Rationale — `@Unique(['ownerId', 'type'])` 제거 번복 기록은 있으나 참조 Rationale 원출처 없음

- **target 위치**: `spec/data-flow/12-workspace.md` `## Rationale` "personal 워크스페이스 유일성" 항
- **과거 결정 출처**: 제거된 `@Unique(['ownerId', 'type'])` 엔티티 데코레이터의 원래 도입 결정 — spec 에 Rationale 기록 없이 코드에만 존재했다
- **상세**: workspace 데이터 플로우 문서는 "과거의 broad `@Unique(['ownerId', 'type'])` 엔티티 데코레이터는 의미상 부정확했다... 이 데코레이터는 제거했다" 라고 Rationale 에 설명하며, 대신 앱 레이어 보증 + 향후 partial index 로 대체한다고 명시했다. 데코레이터 제거 이유와 대체 방향은 충분히 문서화됐다. 다만 제거된 결정 자체가 spec Rationale 어디에도 원래 "왜 그 UNIQUE 를 두었는가" 로 기록되지 않아, 번복이 되는 것인지 단순 오류 정정인지 추적이 어렵다.
- **제안**: 현재 Rationale 에 "(구 데코레이터는 원래 도입 Rationale 없이 코드로만 존재했음 — 의미상 부정확한 채로 미적용 상태였다)" 를 한 줄 덧붙여 "결정의 번복이 아니라 미적용 오류 정정임"을 명확히 한다.

---

### 3. **[INFO]** `spec/data-flow/1-audit.md` Rationale — "cross-cutting concern" 서술 폐기의 원출처 명시 부재

- **target 위치**: `spec/data-flow/1-audit.md` `## Rationale` 마지막 항 "모든 도메인 service 가 호출하는 cross-cutting concern 서술 폐기"
- **과거 결정 출처**: 기존 서술 ("각 도메인의 service (Workflows / Triggers / ... 등) 전체") — 어느 spec 문서 버전에 있었는지 참조 없음
- **상세**: audit 데이터 플로우 문서는 과거 서술이 "실제 writer 는 한정된 위치(워크스페이스 도메인 service + `user.*` 인증 controller)뿐이라 폐기했다" 라고 Rationale 에 기록했다. 폐기 이유는 정확히 기술됐다. 다만 폐기된 과거 서술이 어느 spec 문서(auth spec §4.1 인지, 구 data-model 인지)에서 유래했는지 출처 링크가 없어, 다른 spec 에 여전히 남아 있는 동일 서술이 있다면 정리되지 않을 수 있다.
- **제안**: "과거 서술은 `spec/5-system/1-auth.md §4.1` 의 audit 커버리지 목표 카탈로그와 혼동된 것으로 보이며, §4.1 은 목표 상태·본 §1.1 표가 구현 현황의 SoT" 를 Rationale 에 명시하면 다른 spec 리더의 혼동을 방지한다.

---

## 요약

`spec/data-flow` 폴더의 대상 문서들은 전반적으로 기존 spec Rationale 과 높은 정합성을 유지하고 있다. `spec/5-system/12-webhook.md` Rationale "inline auth path 폐지" 결정은 `10-triggers.md` 의 `AuthConfigsService.verifyWebhookRequest` 단일 위임으로 충실히 계승됐다. `spec/5-system/4-execution-engine.md` Rationale 의 "Durable Continuation" 및 "Sticky fast-path 제거" 결정은 `0-overview.md` 에서 정확히 서술됐으며 (`pendingContinuations fast-path 제거, §7.5 rehydration 단일 경로`), Redis pub/sub `execution:continuation` 폐기도 일치한다. 인증 spec Rationale (워크스페이스 초대 raw 토큰 보관, SMTP 시스템 전역 사용, 이메일 일치 강제 등)도 `12-workspace.md` 와 모순 없다. 발견된 세 항목은 모두 INFO 수준으로, 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 사례는 없다. 주된 개선 여지는 "3-tier priority 임시 편차의 Rationale 부재" 한 항목으로, 구현이 알려진 기각 대안(sticky fast-path, in-memory pub/sub)을 재도입한 것이 아님은 확인됐으나 임시 2-tier 허용 근거가 문서화되지 않아 향후 triggerType threading 판단 시 참고 근거가 부족하다.

## 위험도

LOW
