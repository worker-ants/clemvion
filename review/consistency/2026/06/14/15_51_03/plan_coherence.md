# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target: `spec/2-navigation/6-config.md` (diff base: `origin/main`)
검토 시각: 2026-06-14

---

## 발견사항

### 1. [INFO] `spec-sync-config-gaps.md` §A.3 워크플로 게이트 3건 미완료 상태
- **target 위치**: 구현 diff 전반 (migration V096, 서비스·DTO·프론트엔드 변경)
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` §A.3 호출 이력 체크리스트 (라인 32-34)
  - `[ ] TEST WORKFLOW (lint·unit·build·e2e)`
  - `[ ] /ai-review (--branch main)`
  - `[ ] /consistency-check --impl-done`
- **상세**: plan 에 §A.3 구현이 완료(체크박스 `[x]`)로 기록됐으나, 후속 워크플로 게이트 3개(TEST WORKFLOW·/ai-review·/consistency-check --impl-done)가 아직 미체크(`[ ]`) 상태다. 본 `--impl-done` 리뷰가 해당 게이트 중 하나이므로 완료 후 plan 갱신이 필요하다.
- **제안**: `--impl-done` 완료 후 `plan/in-progress/spec-sync-config-gaps.md` 의 `[ ] /consistency-check --impl-done` 체크박스를 `[x]` 로 갱신. TEST WORKFLOW 및 /ai-review 도 완료 시 동일하게 처리.

---

### 2. [WARNING] `spec-sync-data-flow-12-workspace-gaps.md` §결정 3 의 마이그레이션 번호 정보 스탈
- **target 위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` (신규 추가)
- **관련 plan**: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` §결정 3 (라인 88, 96)
  - "마이그레이션 규약: 현 max **V094**, 신규는 `V095__<descriptor>.sql`"
- **상세**: 해당 plan 의 §결정 3 옵션 B (personal workspace 부분 유니크 인덱스) 는 아직 미결정·미구현 상태인데, 본 PR(V096)과 선행 PR(V095: node_execution_exec_status_active_index)으로 인해 "신규는 V095" 라는 기술 정보가 스탈해졌다. 결정 3 을 실제 구현할 때 해당 섹션의 V번호 참조를 그대로 사용하면 **V095 충돌**이 발생한다.
- **제안**: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` §결정 3 본문의 "현 max **V094**, 신규는 `V095__<descriptor>.sql`" 를 "현 max **V096**, 신규는 `V097__<descriptor>.sql`" 로 갱신. 단 이 plan 이 planner 소유(`owner: planner`)이므로 project-planner 역할이 갱신 수행.

---

### 3. [INFO] `auth-config-webhook-followups.md` §3 spec 보완 항목과의 부분 중복
- **target 위치**: `spec/2-navigation/6-config.md` §A.3 Rationale R-6 (소스 IP 캡처 경로 설명), `spec/1-data-model.md` §2.13 (source_ip 컬럼 설명)
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 (라인 52)
  - "spec/5-system/12-webhook.md 에 IP 추출 정책 (CF-Connecting-IP → X-Forwarded-For → req.ip) 명시 또는 1-auth.md §2.3 cross-reference" (미완료 상태)
- **상세**: `auth-config-webhook-followups.md §3` 의 open spec 보완 항목이 `12-webhook.md` 에 IP 추출 정책을 명시하도록 요청하고 있다. 이번 구현으로 동일 정책이 `6-config.md` Rationale R-6 ("소스 IP 캡처 경로: `hooks.service` 가 webhook 진입 시 `extractClientIp`(CF-Connecting-IP 신뢰 시 → X-Forwarded-For 첫 IP) 결과를 ... 공용으로 쓴다")과 `1-data-model.md §2.13` source_ip 컬럼 설명에 이미 문서화됐다. 결정 충돌은 아니며, `12-webhook.md` 의 별도 명시 여부는 해당 plan 의 플래너 판단에 맡겨져 있어 여전히 유효한 항목이다. 단 "이미 config §A.3 Rationale R-6 에 설명됨"이라는 cross-ref 추가가 권장된다.
- **제안**: `auth-config-webhook-followups.md §3` 해당 항목에 "cf. `6-config.md` R-6·`1-data-model.md §2.13` 에 이미 extractClientIp 경로·공용 패턴 기록됨 — `12-webhook.md` 에도 미러 명시 여부 판단" 주석 추가 (project-planner 트랙).

---

## 요약

Plan 정합성 관점에서 CRITICAL 충돌은 없다. 이번 구현(`spec/2-navigation/6-config.md §A.3` 호출 이력)은 `spec-sync-config-gaps.md` 에 사전에 결정이 합의·등재된 항목을 그대로 이행한 것이며, plan 에서 "결정 필요"로 남겨둔 항목을 우회하거나 일방적으로 결정한 사례가 없다. 다만 두 가지 후속 갱신이 필요하다: (1) `spec-sync-config-gaps.md` §A.3 의 3개 워크플로 게이트 체크박스를 완료 시 갱신해야 하며(INFO), (2) `spec-sync-data-flow-12-workspace-gaps.md §결정 3` 의 V095/V096 마이그레이션 번호 기술 정보가 스탈해져 미구현 pending 결정 실행 시 혼란을 줄 수 있어 갱신이 권장된다(WARNING). `auth-config-webhook-followups.md §3` 의 `12-webhook.md` IP 추출 정책 open item 은 이번 변경과 경합하지 않으나 cross-ref 추가가 도움이 된다(INFO).

---

## 위험도

LOW
