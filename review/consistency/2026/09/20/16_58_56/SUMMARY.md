# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. WARNING 2건은 "경계 명시 누락" 성격의 문서화 갭이며, 구현 자체를 막는 사유는 아니다.

## 전체 위험도
**LOW** — spec 변경 없이(`spec_impact: none`) rotate() 를 기존 산개 동시성 패턴에 맞추는 코드 전용 처방. CRITICAL 없음, WARNING 2건 모두 "이미 있는 결정과의 대조/경계를 plan·코드 주석에 명시하라"는 재발방지성 권고.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 새 설계(row-level `pessimistic_write` + 락 밖 외부 호출)가 같은 문서의 "advisory lock 기각" 문구와 표면적으로 닮았는데도 명시적 대조가 없어, 다음 독자가 "기각된 대안의 재도입"으로 오인할 위험 | `plan/in-progress/rotate-lost-update.md` §B | `spec/2-navigation/4-integration.md` `## Rationale` — cafe24 advisory lock(`pg_advisory_xact_lock`) 기각 문구 | `IntegrationsService.rotate()` 락 블록 주석 또는 plan §B에 "advisory-lock 기각과 다른 이유 — row-level pessimistic_write이고 연결 테스트는 트랜잭션 밖"을 한 줄 명시. spec 파일은 건드릴 필요 없음(코드 주석 + plan 본문으로 충분) |
| 2 | plan_coherence | 이번 리팩터가 손대는 `rotate()` 범위에 아직 열려 있는 별개의 planner 결정(테스트 실패 응답 400 vs 422 불일치)이 있는데, plan 이 이를 건드리지 않는다는 명시가 없어 developer 의 drive-by 변경으로 그 결정이 우회될 위험 | `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` :1119-1129 / `spec/2-navigation/4-integration.md:866` | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목(`INTEGRATION_TEST_FAILED` 400/422 불일치, 별도 열린 planner 결정) | `rotate-lost-update.md` 에 "이 PR 은 `INTEGRATION_TEST_FAILED` 의 상태 코드·세분성을 바꾸지 않는다 — 그 결정은 별도 열린 planner 항목" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `data-flow/5-integration.md` rotate 산문(65~67행)이 잠금 스텝을 언급하지 않아 인접 OAuth 콜백 시퀀스(100~104행, `SELECT ... FOR UPDATE` 명시)와 정보 비대칭 | `spec/data-flow/5-integration.md` 65~67행 vs 100~104행 | 여력 있으면 "rotate 도 CONC H-3와 동일 메커니즘" 한 줄 추가(비차단, `spec_impact: none` 유지 가능) |
| 2 | rationale_continuity | 락 대기 상한(`lock_timeout`) 정책 미검토 — CONC H-3(무제한 대기)와 trigger-config 선례(명시적 타임아웃)가 공존하는데 이 plan 이 어느 쪽을 따를지 결정을 안 적음 | `plan/in-progress/rotate-lost-update.md` §B | 구현 단계에서 "무제한 대기 허용" vs "타임아웃 추가" 중 결정하고 근거를 plan 또는 코드 주석에 기록 |
| 3 | convention_compliance | `8-marketplace.md`(`status: backlog`) 의 로드맵 등재 가드 통과가 우연한 substring 일치(§6.3 대신 다른 표의 링크 경로)에 의존 — 취약한 결합 | `spec/2-navigation/8-marketplace.md` frontmatter / `spec/0-overview.md` §6.3 | `spec/0-overview.md` §6.3 "마켓플레이스" 행에 `` `marketplace` `` id를 인라인 코드로 명시 |
| 4 | convention_compliance | `## Overview`/`## 개요` 헤딩 표기가 파일마다 3갈래로 불일치(권장 사항, 강제 아님) | `spec/2-navigation/*.md` 전반 | 필요 시 SKILL.md/CLAUDE.md 에 "Overview 섹션은 헤딩 없이 산문으로 대체 가능" 예외 명문화 검토 |
| 5 | convention_compliance | `spec/2-navigation/` 파일 번호열에 `12-` 결번 (해당 규약 없음, 위반 아님) | `spec/2-navigation/` 디렉토리 | 조치 불요, 순수 참고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 문서 변경 없이 진행 가능. RBAC·상태전이·API계약·데이터모델 모두 충돌 없음. 동시성 패턴은 오히려 기존 spec 산개 관례(Trigger config, OAuth 콜백, WebAuthn)와 일치. INFO 1건(비대칭 서술) |
| rationale_continuity | LOW | 기각된 advisory-lock 대안의 재도입은 아니나, 그 구분을 명시하지 않은 WARNING 1건 + lock_timeout 정책 미결정 INFO 1건. 인용 선례(CONC H-3, trigger-config-lost-update)는 실측상 정확 |
| convention_compliance | NONE | CRITICAL/WARNING 없음. frontmatter·id 충돌회피·API 응답 봉투·DTO/에러코드/감사로그 명명 전부 규약과 일치. INFO 3건은 견고성·권고 수준 |
| plan_coherence | LOW | 같은 함수 안 미해결 planner 결정(400/422)과의 경계 미명시 WARNING 1건. 철회 이력·선례 검증은 정직하게 기록됨, 겹치는 진행중 plan 없음 |
| naming_collision | NONE | 신규 spec 식별자 미도입 — 요구사항ID/엔티티/endpoint/이벤트명/ENV/파일경로 6개 관점 전부 충돌 후보 없음 |

## 권장 조치사항
1. `plan/in-progress/rotate-lost-update.md` 에 "이 PR 은 `INTEGRATION_TEST_FAILED` 의 상태 코드·`code` 세분성을 바꾸지 않는다 — 그 결정은 `spec-draft-nullable-notation-followups.md` 의 별도 열린 planner 항목" 한 줄 추가 (plan_coherence WARNING 해소)
2. `IntegrationsService.rotate()` 락 블록 주석 또는 plan §B 에 "`4-integration.md` 의 advisory-lock 기각과 다른 이유 — row-level `pessimistic_write`, 연결 테스트는 트랜잭션 밖" 한 줄 명시 (rationale_continuity WARNING 해소)
3. (선택) lock_timeout 정책을 "무제한 대기 허용(CONC H-3 동일 리스크)" 또는 "타임아웃 추가" 중 결정하고 근거 기록
4. (선택) `spec/data-flow/5-integration.md` 65~67행 근처에 rotate 잠금 메커니즘 한 줄 추가
5. (선택, 비차단) `spec/0-overview.md` §6.3 에 `marketplace` id 인라인 코드 명시로 로드맵 가드 견고화
