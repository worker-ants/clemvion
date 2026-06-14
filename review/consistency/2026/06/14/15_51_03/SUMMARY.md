# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**MEDIUM** — spec 단일 진실 원칙(SoT) 위배 2건(WARNING): 구현 완료된 기능이 spec 2곳에 여전히 "미구현/Planned"로 표기되고, 미결 plan 의 마이그레이션 번호 참조가 스탈 상태. 구현 동작 자체의 오류나 CRITICAL 위반은 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `spec/1-data-model.md §2.13` Execution 필드 테이블에 `source_ip`/`response_code` 컬럼 미반영 — 데이터 모델 SoT 공백 | V096 migration, `execution.entity.ts` | `spec/1-data-model.md` §2.13 줄 452–475 | §2.13 테이블에 `source_ip VARCHAR(45)?`, `response_code VARCHAR(10)?` 두 행 추가 및 AuthConfig 호출 집계 경로 SoT callout 기재 |
| W-2 | Cross-Spec | `spec/2-navigation/6-config.md §A.3` 구현 상태 표가 완전 구현된 기능을 "🚧 미구현/Planned"로 표기 | 구현 완료된 periodCounts, sourceIp, responseCode | `spec/2-navigation/6-config.md` §A.3 줄 101–102 | 줄 101·102의 🚧 항목을 ✅ 상태로 갱신 (기간별 호출 수: Rolling window 명시, 호출 이력 테이블: sourceIp/responseCode 포함) |
| W-3 | Plan Coherence | `spec-sync-data-flow-12-workspace-gaps.md §결정 3` 의 마이그레이션 번호가 스탈 — "신규는 V095" 기술이 V095(선행 PR)·V096(본 PR) 이후 미결 구현 시 V095 충돌을 유발 | `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` | `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` §결정 3 (줄 88, 96) | "현 max V094 → V095" 참조를 "현 max V096 → V097" 로 갱신 (project-planner 역할 수행) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | spec §A.3 "일/주/월 기준" 표현이 구현의 롤링 윈도(24h/7d/30d)와 의미 차이 | `spec/2-navigation/6-config.md §A.3` 줄 101 | spec 설명을 "롤링 윈도(24h/7d/30d) — 캘린더 경계 아님"으로 명확화 (W-2 갱신 시 함께 처리) |
| I-2 | Cross-Spec | `spec/5-system/12-webhook.md` WH-MG-05에 구현 경로(Execution 컬럼, config §A.3) 참조 없음 | `spec/5-system/12-webhook.md` 줄 93 | WH-MG-05 행에 "이행: `Execution.response_code` (V096) → recentCalls.responseCode" 주석 추가 |
| I-3 | Rationale Continuity | R-6 캘린더 버킷 기각 결정이 구현(`USAGE_PERIOD_WINDOWS_MS`, COUNT FILTER 롤링 쿼리)에 정확히 반영됨 | `auth-configs.service.ts` | 추가 조치 불필요 |
| I-4 | Rationale Continuity | 전용 call-log 엔티티 미도입 결정(Execution SoT 재사용)이 V096에 정확히 반영됨 | `V096__execution_source_ip_response_code.sql` | 추가 조치 불필요 |
| I-5 | Rationale Continuity | Flyway forward-only 정책(-- DOWN: 주석) 준수 확인 | V096 파일 하단 | 추가 조치 불필요 |
| I-6 | Rationale Continuity | `extractClientIp` 단일 호출 경로 — R-6 공용 사용 결정과 일치 | `hooks.service.ts` | 추가 조치 불필요 |
| I-7 | Rationale Continuity | `responseCode ?? status` 폴백 정책 — R-6·WH-MG-05 이행 확인 | `auth-configs.service.ts` | 추가 조치 불필요 |
| I-8 | Convention Compliance | 마이그레이션 V096 번호 연속성(V095→V096) 및 파일명 snake_case 규약 준수 | `V096__execution_source_ip_response_code.sql` | 추가 조치 불필요 |
| I-9 | Convention Compliance | `AuthConfigUsagePeriodCountsDto` DTO 명명·위치·`@ApiProperty` 패턴 규약 준수 | `dto/responses/auth-config-response.dto.ts` | 추가 조치 불필요 |
| I-10 | Convention Compliance | spec frontmatter `status: partial` 및 §A.3 🚧 기재가 이번 diff에 갱신되지 않음 — build-time 가드가 최종 판정 | `spec/2-navigation/6-config.md` frontmatter | §A.3 ✅ 갱신·plan 체크박스 완료 처리 커밋 권장 (W-2와 동시 처리) |
| I-11 | Plan Coherence | `spec-sync-config-gaps.md §A.3` 워크플로 게이트 3건(TEST WORKFLOW·/ai-review·/consistency-check --impl-done) 미체크 | `plan/in-progress/spec-sync-config-gaps.md` 줄 32–34 | 본 --impl-done 완료 후 해당 체크박스 `[x]` 갱신 |
| I-12 | Plan Coherence | `auth-config-webhook-followups.md §3` open spec 보완 항목이 이번 구현으로 부분 충족됨 — 결정 충돌 없음 | `plan/in-progress/auth-config-webhook-followups.md §3` | "cf. 6-config.md R-6·1-data-model.md §2.13에 extractClientIp 경로 기록됨" cross-ref 주석 추가 권장 |
| I-13 | Naming Collision | `execution.source_ip`가 타 테이블의 `ip_address`와 다른 이름 패턴 — 이미 spec §2.13에서 확정된 선택, 런타임 충돌 없음 | V096 migration, `spec/1-data-model.md §2.13` | 필요 시 `spec/conventions/migrations.md`에 `source_ip`/`ip_address` 선택 기준 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | spec/1-data-model.md §2.13 Execution 테이블에 source_ip/response_code 미반영(W-1); §A.3 상태 표 "미구현" 표기 불일치(W-2) |
| Rationale Continuity | NONE | 모든 R-6 설계 결정(롤링 윈도·Execution SoT 재사용·forward-only·단일 IP 추출 경로·폴백 정책)이 구현에 정확히 반영됨 |
| Convention Compliance | LOW | CRITICAL·WARNING 없음. spec frontmatter 갱신 미포함(INFO, build-time 가드 판정 예정) |
| Plan Coherence | LOW | 미결 plan의 마이그레이션 번호 스탈(W-3); 워크플로 게이트 체크박스 미완(INFO) |
| Naming Collision | NONE | 신규 식별자 6개 범주 전체 충돌 없음. source_ip/ip_address 이름 패턴 차이는 spec 확정 사항 |

## 권장 조치사항

1. **(W-1) `spec/1-data-model.md §2.13` 갱신** — Execution 필드 테이블에 `source_ip VARCHAR(45)?`, `response_code VARCHAR(10)?` 두 행 추가. project-planner 수행.
2. **(W-2 + I-1 + I-10) `spec/2-navigation/6-config.md §A.3` 갱신** — 줄 101·102의 🚧 항목을 ✅ 롤링 윈도 설명 포함 상태로 갱신. frontmatter `status`·`pending_plans` 전이 조건 평가 후 갱신. project-planner 수행.
3. **(W-3) `spec-sync-data-flow-12-workspace-gaps.md §결정 3` 갱신** — 마이그레이션 번호 참조를 "현 max V096 → V097"로 갱신. project-planner 수행.
4. **(I-11) `spec-sync-config-gaps.md §A.3` 워크플로 게이트 체크박스 완료 처리** — TEST WORKFLOW·/ai-review·/consistency-check --impl-done 완료 시 각각 `[x]` 갱신.
5. **(I-2) `spec/5-system/12-webhook.md` WH-MG-05 구현 경로 cross-ref 추가** — 필요 시 project-planner 트랙으로 처리.