# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 2건(spec 상태 표기 미갱신, i18n 키 중복 가능성); Critical 없음. 구현 핵심 정합성 확보.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | spec §A.3 의 "미구현(Planned)" 표기가 구현 완료 후에도 갱신되지 않아 단일 진실 원칙 위반 | `spec/2-navigation/6-config.md §A.3` — "기간별 호출 수" 행 및 "호출 이력 테이블" 행 | `spec/conventions/spec-impl-evidence.md §2` (status·code frontmatter 정확성) | "기간별 호출 수" → `✅ periodCounts (24h/7d/30d 롤링 윈도)`, "소스 IP·응답 코드 컬럼은 미구현" → "소스 IP·응답 코드 컬럼 포함 ✅ 구현". spec 수정은 project-planner 권한 필요 |
| W-2 | Naming Collision | i18n `period7d`/`period30d` 키가 `statistics` 네임스페이스와 동일 이름·다른 의미로 존재 (포맷·세트 불일치). 런타임 충돌 없음, 유지보수 혼동 위험 | `codebase/frontend/src/lib/i18n/dict/{en,ko}/authentication.ts` | `codebase/frontend/src/lib/i18n/dict/{en,ko}/statistics.ts:20–23` | blocking 불필요. 향후 공통 키 추출 검토 또는 현 상태를 의도적 차이로 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | chat-channel `ignored` 경로(rate-limit skip 등)에서 Execution row 미생성으로 `totalCalls` 에서 제외되는 점이 spec 양쪽에 미명시 | `spec/2-navigation/6-config.md §A.3`, `spec/5-system/15-chat-channel.md §5.5` | 두 spec 중 한 곳에 "rate-limit skip·비활성 trigger·ignored 경로는 Execution row 미생성이므로 totalCalls 집계 제외" 한 줄 추가 (낮은 우선순위) |
| I-2 | Cross-Spec | Discord PING·Slack URL Verification 등 execute 미호출 경로에서 response_code 저장 없음이 `spec/1-data-model.md §2.13` 에 미설명 | `spec/1-data-model.md §2.13` response_code 컬럼 | `spec/5-system/15-chat-channel.md §5.5` 와 일치 확인됨. 설명 불완전하나 동작 정합. 낮은 우선순위 |
| I-3 | Cross-Spec | `spec/1-data-model.md §2.13` source_ip 설명이 CF-Connecting-IP 와 X-Forwarded-For 의 관계를 연쇄로 오독될 수 있게 기술 | `spec/1-data-model.md §2.13` | `spec/5-system/1-auth.md §2.3` `extractClientIp` 참조 방식으로 단순화 권고 (낮은 우선순위) |
| I-4 | Convention Compliance | `AuthConfigUsagePeriodCountsDto` 3개 필드(`last24h`/`last7d`/`last30d`)에 JSDoc 한국어 주석 없이 영문 `@ApiProperty description` 인라인 사용 — 같은 파일 내 불일치 | `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` | `spec/conventions/swagger.md §1-1`. 한국어 JSDoc 추가 후 영문 description 제거 또는 JSDoc 에 통합 |
| I-5 | Convention Compliance | `spec/2-navigation/6-config.md` frontmatter `status: partial` — §A.3 구현 완료로 `implemented` 승격 여부 검토 필요 | `spec/2-navigation/6-config.md` frontmatter | `plan/in-progress/spec-sync-config-gaps.md` 잔여 갭 확인 후 갭 없으면 `status: implemented` 승격 + `pending_plans` 제거 |
| I-6 | Plan Coherence | §A.3 구현이 `spec-sync-config-gaps.md` 미해결 체크박스를 전부 소화함 — plan `[x]` 상태와 spec 동기화 이미 기록 | `plan/in-progress/spec-sync-config-gaps.md` | 추가 조치 불요 |
| I-7 | Plan Coherence | `auth-config-webhook-followups.md §3` spec 보완 항목(IP 추출 정책 명시 등) 미착수 상태 유지 — 본 구현과 충돌 없음 | `plan/in-progress/auth-config-webhook-followups.md §3` | 별도 project-planner 트랙으로 유지 |
| I-8 | Plan Coherence | `spec-sync-webhook-gaps.md` WH-NF-02 미결 — 본 구현이 body-parser limit 경로에 무관, 충돌 없음 | `plan/in-progress/spec-sync-webhook-gaps.md` | 사용자 결정 후 별도 진행 |
| I-9 | Plan Coherence | `authentication/page.tsx` God Component 분리 후속 — plan 이 scope 분리 인지, 현 PR 병합 후 착수 가능 | `plan/in-progress/spec-sync-config-gaps.md §후속` | 선행 조건(현 PR 병합) 충족 후 착수 |
| I-10 | Naming Collision | `AuthConfigUsagePeriodCountsDto`, `UsagePeriodCounts`, `source_ip`/`response_code` 컬럼, `idx_execution_trigger_started`, 상수 3종, migration V096 — 모두 기존 main 브랜치에 동명 없음 | 각 신규 식별자 | 없음. 충돌 없음 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 교차 영역 모순 없음. spec 설명 완전성 INFO 3건 |
| Rationale Continuity | NONE | R-6 결정 4가지 모두 정합 이행. 기각된 대안 미재도입 |
| Convention Compliance | LOW | WARNING 1건: §A.3 상태 표기 미갱신. INFO: DTO 필드 한국어 JSDoc 누락, frontmatter status 검토 필요 |
| Plan Coherence | NONE | plan 결정 항목 전부 사용자 확정 후 구현. 인접 plan 충돌 없음 |
| Naming Collision | LOW | WARNING 1건: i18n period7d/period30d 키 네임스페이스 간 의미 불일치 (런타임 충돌 없음) |

## 권장 조치사항

1. **(W-1 해소 — project-planner 위임)** `spec/2-navigation/6-config.md §A.3` "기간별 호출 수" 행과 "호출 이력 테이블" 행의 "미구현(Planned)" 표기를 완료 표기로 갱신한다. 현 PR 에 spec 수정을 포함시키거나 project-planner 에게 위임한다.
2. **(W-2 기록)** i18n `period7d`/`period30d`의 `authentication` vs `statistics` 네임스페이스 의미 불일치를 의도적 차이로 기록하거나, 장기적으로 공통 키 추출을 검토한다. 현재 blocking 불필요.
3. **(I-4 선택적 개선)** `AuthConfigUsagePeriodCountsDto` 3개 필드에 한국어 JSDoc 추가 — 동일 파일 내 일관성 확보.
4. **(I-5 확인)** `spec-sync-config-gaps.md` 잔여 갭 검토 후 갭 없으면 `spec/2-navigation/6-config.md` frontmatter `status: partial` → `implemented` 승격.