# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 진행 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/Warning 0건(Convention Compliance 의 WARNING 1건 제외). 운영 리스크 1건(WARNING: Gate C spec_impact 누락 가능성)과 INFO 수준 동기화 결여 7건 도출.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 완료 이동 시 `spec_impact` 선언(Gate C) 준비 안내 체크리스트 미포함 | `plan/in-progress/db-pool-creds-pubsub.md` frontmatter 및 체크리스트 | `.claude/docs/plan-lifecycle.md §5 Gate C`, `spec/conventions/spec-impl-evidence.md §4.2` | 체크리스트에 `- [ ] 완료 이동 시 frontmatter 에 spec_impact 선언 (plan-lifecycle §5 Gate C)` 항목 추가 |

> **반영**: WARNING #1 + INFO #1·#2·#4(채널 registry) 모두 본 PR 에서 반영. send-email 후속(INFO #3·#5)은 plan 메모로 추적.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §2.6` Redis 용도 목록에 `integration:cache:invalidate` 채널 미등록 | `spec/0-overview.md §2.6` | Redis 항목에 `integration:cache:invalidate` 추가 |
| 2 | Cross-Spec | `spec/5-system/4-execution-engine.md §9.2` Redis 키/채널 목록에 `integration:cache:invalidate` 미등록 | `spec/5-system/4-execution-engine.md §9.2` | 표에 채널 행 추가 또는 §9.1 전역 예외 주석에 언급 |
| 3 | Cross-Spec | `spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` 에 `integration-cache-bus.service.ts` 미포함 | `spec/4-nodes/4-integration/3-send-email.md` frontmatter | 후속: Send Email 연결 시 갱신 |
| 4 | Cross-Spec | `spec/data-flow/5-integration.md` rotate/remove 흐름에 `bus.publish(integrationId)` 단계 미반영 | `spec/data-flow/5-integration.md` | 시퀀스에 `IntegrationCacheBus.publish(integrationId)` 단계 추가 |
| 5 | Plan Coherence | send-email transport invalidation 후속 plan 항목 미생성 | `plan/in-progress/` | plan 체크리스트에 추적 메모 추가 |
| 6 | Plan Coherence | `spec-sync-audit` worktree sentinel — 실제 checkout 없는 plan 다수 | `plan/in-progress/spec-sync-*.md` | target plan 진행에 영향 없음 |
| 7 | Rationale Continuity | plan Rationale 에 spec Rationale 교차 참조 미포함 | plan §Rationale | 선택 — 교차 참조 1줄 |
| 8 | Convention Compliance | 문서 제목 prefix `04 m-4` 외부 의존 | plan 1번째 줄 | 선택 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Critical/Warning 없음. INFO 4건 — 신규 채널 registry 미등록(구현 완료 후 동기화) |
| Rationale Continuity | NONE | 설계 결정 6축 모두 spec Rationale 와 정합 |
| Convention Compliance | LOW | WARNING 1: Gate C 체크리스트. INFO 2: 제목 prefix·경로 |
| Plan Coherence | LOW | INFO 2: send-email 후속, spec-sync-audit sentinel |
| Naming Collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소)** plan 체크리스트에 Gate C spec_impact 항목 추가. → **반영**
2. **(INFO)** `0-overview §2.6` + `execution-engine §9.2` 에 `integration:cache:invalidate` 등록. → **반영**
3. **(INFO)** `data-flow/5-integration.md` 에 publish 단계 추가. → **반영**
4. **(INFO 선택)** send-email 후속 추적 메모. → **plan 메모 반영**
5. **(INFO 선택)** stale worktree cleanup. → 본 PR scope 외
