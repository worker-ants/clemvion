# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**MEDIUM** — spec/1-data-model.md 에 AuthConfig 호출 집계 경로 근거 부재. Critical 은 아니나 §A.3 구현 시 설계 판단이 필요한 미결 사항 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `totalCalls` / `recentCalls` 집계 경로·SoT 엔티티가 `spec/1-data-model.md` 에 없음. Integration 은 `IntegrationUsageLog` 전용 엔티티로 명확히 정의된 반면 AuthConfig 쪽은 조인 집계 경로가 spec 에 미기술 | `spec/2-navigation/6-config.md §A.3` | `spec/1-data-model.md §2.17 AuthConfig`, `§2.10.1 IntegrationUsageLog` | `spec/1-data-model.md` 에 "AuthConfig 호출 집계 경로" 절 추가 (`Execution.trigger_id → Trigger.auth_config_id` 조인 집계를 SoT 로 명시) 또는 전용 로그 엔티티(`AuthConfigCallLog`) 도입 결정 |
| W-2 | Cross-Spec | §A.3 미구현 항목(소스 IP·응답 코드·기간별 호출 수)의 데이터 모델이 `spec/1-data-model.md` 에 부재 | `spec/2-navigation/6-config.md §A.3` | `spec/1-data-model.md §2.13 Execution`, `§2.14 NodeExecution`, `§2.17 AuthConfig`; `plan/in-progress/spec-sync-config-gaps.md` | `spec-sync-config-gaps.md` 의 3가지 미결 결정(소스 IP 스키마·응답 코드 의미·기간 표시형식)을 project-planner 통해 확정 후 `spec/1-data-model.md` 에 반영 |
| W-3 | Plan Coherence | §A.3 "결정 필요" 항목 3건(소스 IP·응답 코드·기간별 호출 수)이 plan 에서 미해소 상태. 이번 impl 범위가 §A.3 을 포함하면 미결 결정을 우회할 위험 | `spec/2-navigation/6-config.md §A.3` | `plan/in-progress/spec-sync-config-gaps.md` §"미구현 — 결정 필요" | 이번 impl 착수 범위에서 §A.3 3항목 포함 여부를 먼저 확인; 포함 시 plan 각 항목에 결정 내용 기재 후 착수 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `GET /api/auth-configs/:id/usage` 응답 shape 미명시 — Integration `/activity` 와 달리 DTO 계약 불분명 | `spec/2-navigation/6-config.md §3 Authentication API` | §3 API 표에 응답 shape (`{ summary: { totalCalls, lastUsedAt }, recentCalls: [...] }`) 수준으로 명시 |
| I-2 | Cross-Spec | `spec/5-system/1-auth.md §5` 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 누락 (auth-config-webhook-followups.md §3 에 이미 추적 중) | `spec/2-navigation/6-config.md §3` | `1-auth.md §5` 에 `/reveal` 행 추가 (기존 플랜 항목에 포함됨, 중복 생성 불요) |
| I-3 | Rationale Continuity | R-3 번복(ModelConfig 단일 통합) 폐기 선언 처리 — 적절히 처리됨 | `spec/2-navigation/6-config.md §B`, `## Rationale R-3` | 없음 |
| I-4 | Rationale Continuity | R-1 select-only 정책의 Rerank 탭 예외 — "범위 한정" 선언으로 격리됨 | `spec/2-navigation/6-config.md §B.6.2`, `## Rationale R-1` | 없음 |
| I-5 | Rationale Continuity | §A.3 소스 IP/응답 코드 "Planned" 표기 — 기각 결정이 아닌 미결정 상태. plan 추적 중 | `spec/2-navigation/6-config.md §A.3` | 결정 완료 후 §A.3 Planned 해제 + Rationale 에 저장 위치·보존 정책 추가 |
| I-6 | Convention Compliance | `id: config` 가 basename `6-config` 와 불일치 — sibling 파일들의 숫자 prefix 제거 암묵 관례와 동일 패턴 | frontmatter line 2 | 현행 유지 가능; `spec-impl-evidence.md §2.1` 에 "숫자 prefix 제거 허용" 예시 추가 권장 |
| I-7 | Convention Compliance | h2 헤딩 스타일 혼재 — `## Part A/B` (레이블)와 `## 3. API` (숫자) 동일 depth 혼용 | `spec/2-navigation/6-config.md` h2 섹션 전반 | `## Part A` → `## 1. Authentication`, `## Part B` → `## 2. Models` 로 통일 권장 (현행 유지도 무방) |
| I-8 | Naming Collision | `totalCalls` 가 두 도메인(auth-config usage, integration activity)에서 동일 명 사용 — 의미 동일·경로 분리이나 응답 shape 미정의로 구현 시 불일치 위험 | `spec/2-navigation/6-config.md §A.3` | `/usage` 응답 shape 을 §3 API 표에 명시 (I-1 과 통합 조치) |
| I-9 | Naming Collision | `recentCalls` 가 spec prose 에만 언급되고 응답 DTO 미정의 | `spec/2-navigation/6-config.md §A.3` | §3 API `/usage` 행에 응답 shape 과 `recentCalls` 필드 목록(`triggerName`, `status`, `startedAt`) 명시 |
| I-10 | Naming Collision | `auth_config.reveal` audit action 이 `spec/data-flow/1-audit.md` 카탈로그에 미등재 | `spec/2-navigation/6-config.md §A.4` | `spec/data-flow/1-audit.md` 에 `auth_config.reveal` 추가 또는 §A.4 에서 카탈로그로 교차 참조 |
| I-11 | Plan Coherence | God Component 분리 후속(authentication/page.tsx) 이번 impl 이 같은 파일 수정 시 후속 리팩토링 스코프 확대 가능 | `spec/2-navigation/6-config.md §A.2` | 이번 impl 에서 `authentication/page.tsx` 수정 시 `spec-sync-config-gaps.md §후속 — God Component 분리` 에 변경 범위 메모 추가 |
| I-12 | Plan Coherence | `auth-config-webhook-followups.md §3` 의 spec 보완 항목(`1-auth.md`, `12-webhook.md`) 미완 — target 직접 충돌 없음 | 해당 없음 (`1-auth.md`, `12-webhook.md`) | `reveal`/IP whitelist 관련 로직 수정 시 `--impl-done` 단계에서 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | §A.3 `totalCalls`/`recentCalls` 집계 경로의 데이터 모델 근거 누락 (W-1); Planned 항목 데이터 모델 미동기화 (W-2); `/usage` 응답 shape 미명시 (I-1) |
| Rationale Continuity | NONE | 모든 Rationale 연속성 충돌 없음. R-3 번복 처리·R-1 예외 격리 모두 적절 |
| Convention Compliance | NONE | 의무 frontmatter·status/pending_plans·감사액션·API 명명 모두 통과. INFO 수준 스타일 관찰만 |
| Plan Coherence | LOW | §A.3 미결정 3항목이 plan 에서 미해소 — §A.3 을 이번 impl 범위에서 제외하면 차단 없음 |
| Naming Collision | LOW | 식별자 충돌 없음. `/usage` 응답 shape 미정의로 구현 시 불일치 가능성 (INFO) |

## 권장 조치사항

1. **(이번 impl 착수 전 확인 필수)** §A.3 (소스 IP·응답 코드·기간별 호출 수) 3항목이 이번 PR 구현 범위에 포함되는지 먼저 결정한다. **포함되는 경우** → `plan/in-progress/spec-sync-config-gaps.md` 의 미결 결정 3건(스키마·캡처 경로·표시형식)을 project-planner 를 통해 확정하고 `spec/1-data-model.md` 에 반영한 뒤 착수해야 한다. **제외하는 경우(호출 이력 조회·표시 기능만)** → 별도 조치 없이 착수 가능.
2. **(§A.3 구현 시)** `spec/1-data-model.md` 에 AuthConfig 호출 집계 경로 절 추가 — `Execution.trigger_id → Trigger.auth_config_id` 조인 집계를 SoT 로 명시하거나 전용 로그 엔티티 도입을 결정 (W-1 해소).
3. **(spec 보완 — project-planner 위임)** `spec/2-navigation/6-config.md §3 API` 표에 `GET /api/auth-configs/:id/usage` 응답 shape 명시 (I-1, I-8, I-9 통합 해소).
4. **(spec 보완 — project-planner 위임)** `spec/data-flow/1-audit.md` 카탈로그에 `auth_config.reveal` 추가 (I-10).
5. **(기존 plan 항목 포함)** `spec/5-system/1-auth.md §5` 엔드포인트 표에 `/reveal` 행 추가 — `auth-config-webhook-followups.md §3` 의 기존 추적 항목에 포함됨 (I-2).

---

## 본 슬라이스(config §A.3 호출 이력) 대응 메모

- §A.3 3항목은 **이번 PR 구현 범위에 포함**된다. 미결 결정 3건은 **사용자가 이미 확정**(execution 컬럼 추가 / 응답코드 HTTP+enum 폴백 / 롤링 윈도)했으므로 W-3·I-5 는 본 PR 의 plan·spec Rationale 갱신으로 해소한다.
- W-1·W-2 해소: `spec/1-data-model.md §2.13 Execution` 에 `source_ip`·`response_code` 컬럼과 AuthConfig 호출 집계 경로(`Execution.trigger_id → Trigger.auth_config_id` 조인)를 본 PR 에서 명시한다.
- I-1·I-8·I-9 해소: `spec/2-navigation/6-config.md §3 API` `/usage` 행에 응답 shape(`totalCalls`/`lastUsedAt`/`periodCounts`/`recentCalls[]`)을 명시한다.
- I-10·I-2(audit reveal·/reveal 행)는 본 슬라이스 범위 밖(별도 followup 추적 중) — 미조치.
