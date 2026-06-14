# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 1건(webhook spec execute() 인자 구버전 기술), INFO 5건(스타일·누락·추적). 구현 동작 자체의 모순 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | webhook spec §7 step 8b·7e 의 `execute()` 3번째 인자가 `{ triggerId }` 구버전 — 실제 구현은 `{ triggerId, sourceIp, responseCode }` | `hooks.service.ts` execute() 호출부 | `spec/5-system/12-webhook.md` §7 step 8b·7e (line 352 부근) | `spec/5-system/12-webhook.md` §7 step 8b·7e 인자를 `{ triggerId: trigger.id, sourceIp, responseCode }` 로 갱신. §A.3 구현 참조(R-6) footnote 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `idx_execution_trigger_started` 인덱스가 data-model §3 인덱스 목록에 미등록 | `spec/1-data-model.md` §3 인덱스 표 (Execution 행) | `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 행 추가. V096·§A.3 참조 명기 |
| I-2 | Convention Compliance | `AuthConfigUsagePeriodCountsDto` 필드 3종에 JSDoc 없이 `@ApiProperty` 직접 기재 (`swagger.md §1-1` 위반) | `auth-config-response.dto.ts` 43~62행 | 각 필드에 JSDoc 추가 후 `@ApiProperty` 를 example 보강으로 축소 |
| I-3 | Convention Compliance | `AuthConfigUsageCallDto.sourceIp` `@ApiProperty` 에 `type: String` 누락 (`swagger.md §1-4` 위반) | `auth-config-response.dto.ts` 81행 | `@ApiProperty({ type: String, nullable: true, example: '203.0.113.7' })` 로 수정 |
| I-4 | Convention Compliance | `AuthConfigUsagePeriodCountsDto` description 이 영문 — 동일 파일 내 한국어 혼재 (`swagger.md §3` 위반) | `auth-config-response.dto.ts` 47·52행 | description 한국어로 통일 (예: `'롤링 24시간 윈도 호출 건수 (캘린더 일 기준 아님).'`) |
| I-5 | Plan Coherence | `auth-config-webhook-followups.md §3` (IP 추출 정책 spec 명시) 가 미착수 상태 — 이번 구현으로 `extractClientIp` 가 호출 이력에도 영향 | `plan/in-progress/auth-config-webhook-followups.md §3` | 해당 plan 항목 해소 시 `source_ip` 영속 동작도 포함해 spec 명시 권장 (별도 project-planner 작업) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | webhook spec §7 execute() 인자 구버전 기술(W-1) + data-model §3 인덱스 누락(I-1) |
| Rationale Continuity | NONE | R-6 설계 결정(전용 엔티티 미도입·롤링 윈도·HTTP 응답 코드·단일 IP 추출) 전 계층 일관 구현 |
| Convention Compliance | LOW | swagger.md §1-1·§1-4·§3 스타일 INFO 3건. 핵심 규약(마이그레이션 명명·DTO 위치·audit 명명·frontmatter) 모두 준수 |
| Plan Coherence | NONE | 소유 plan 결정 전부 사전 확정·완료 처리. open plan 교차점 무충돌 |
| Naming Collision | NONE | 신규 식별자(DB 컬럼·DTO·인터페이스·상수·i18n 키·인덱스) 기존 충돌 없음 |

## 권장 조치사항
1. (W-1 해소) `spec/5-system/12-webhook.md` §7 step 8b·7e 의 `execute()` 인자를 `{ triggerId: trigger.id, sourceIp, responseCode }` 로 갱신 — project-planner 작업. 이번 BLOCK 은 없으나 spec-code 갭 방치 시 신규 개발자 오해 위험.
2. (I-1 해소) `spec/1-data-model.md` §3 인덱스 표에 `idx_execution_trigger_started` 행 추가 — project-planner 작업. 동일 인덱스 중복 추가 방지 목적.
3. (I-2·I-3·I-4 선택적 개선) `auth-config-response.dto.ts` DTO 필드 JSDoc 추가, `type: String` 명시, description 한국어 통일 — developer 작업, 기능 영향 없는 스타일 정합.
4. (I-5 추적) `auth-config-webhook-followups.md §3` IP 추출 정책 spec 명시 시 `source_ip` 영속 동작 포함 권장.