# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — Critical 없이 구현 착수 가능. 다만 owner 보호 도메인에서 확립된 "비관적 락" TOCTOU 방지 패턴을 벗어나면서 spec Rationale 갱신이 없는 점(WARNING)과, `CANNOT_REMOVE_OWNER` 에러 코드의 중앙 카탈로그 미등재·RBAC 표 렌더링 붕괴(WARNING 2건)가 함께 발견되었다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 확립된 TOCTOU 방지 패턴(비관적 락)에서 벗어나면서 spec Rationale 갱신 없음 — plan 이 새 락 없이 조건부 `DELETE ... WHERE role != 'owner'` + affected-count 판별로 처리, 기각 사유가 spec 에 남지 않음 | `plan/in-progress/member-owner-toctou.md` §B·§C, `spec/5-system/1-auth.md` §3.2 각주 | `spec/data-flow/12-workspace.md` §1.6·§1.10 — `leave`·`delete`·`transfer-ownership` 세 형제 사례 전부 비관적 락 트랜잭션 | `data-flow/12-workspace.md` §1.6/§1.9 인근에 "removeMember owner 보호는 조건부 DELETE + affected-count 판별" 각주 추가(후속 planner 턴). 구현 PR 코드 주석/커밋에 `4-execution-engine.md` §8 선례(타 행 집계 조건 vs 이번 사례의 같은-행 조건)와의 구분을 명시해 다음 리뷰어의 오적용 예방 |
| 2 | cross_spec(INFO)+convention_compliance(WARNING) 병합 | `CANNOT_REMOVE_OWNER` 에러 코드가 중앙 에러 카탈로그에 미등재 — 자매 코드 `CANNOT_ASSIGN_OWNER` 는 §1.9 등재, 이쪽만 누락 | `spec/5-system/1-auth.md` §3.2 각주(366-391행) | `spec/5-system/3-error-handling.md` §1(§1.9 Rationale 이 "별도 pass" 로 이미 유예 인지), `2-api-convention.md` §5.3(카탈로그 등재 의무) | 이번 PR(`spec_impact: none`) 스코프 밖 — 별도 소규모 spec PR 로 `CANNOT_REMOVE_OWNER`·`OWNER_ROLE_PROTECTED`·`SOLE_OWNER_CANNOT_LEAVE` 3개 코드를 §1.9 인접에 함께 등재 |
| 3 | convention_compliance | RBAC 권한 매트릭스 표에 각주(†)가 끼어들며 GFM 테이블이 두 조각으로 쪼개져 후반 8행(Integration~Audit Log)이 표가 아닌 평문으로 렌더링 | `spec/5-system/1-auth.md` §3.2 (366-391행) | 없음(형식 결함) | 각주를 표 뒤로 옮기거나, 382행 앞에 헤더+구분자(`\|---\|...\|`) 행을 재삽입해 표를 완전히 분리 |
| 4 | rationale_continuity | impl-prep 번들의 related_specs 후보 선정에서 판정에 결정적인 SoT 문서(`data-flow/12-workspace.md`, TOCTOU Rationale 보유)가 완전히 누락됨 — harness 커버리지 갭 | 이번 리뷰 입력 번들 "관련 spec Rationale 발췌" / "예산 초과로 생략된 파일" 목록 | 없음(프로세스 이슈) | `--impl-prep` 실행 시 target 문서가 명시 인용하는 SoT 링크를 related_specs 후보에 우선 포함하는 규칙 검토(harness 개선) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `---` 구분선이 연속 두 번(296, 298행) 삽입되어 형식 일관성 저하(렌더링 영향 없음) | `spec/5-system/3-error-handling.md` 296-298행 | 하나만 남긴다. 우선순위 낮음 |
| 2 | plan_coherence / naming_collision | plan 이 신규 요구사항 ID·엔티티·endpoint·이벤트·에러 코드를 도입하지 않으며, 기존 `CANNOT_REMOVE_OWNER` 를 동일 의미로 재사용함을 확인 | `plan/in-progress/member-owner-toctou.md` 전체 | 조치 불요 — 정합 확인 기록용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `data-flow/12-workspace.md`·`1-data-model.md` 등과 target 정합 확인, `CANNOT_REMOVE_OWNER` 카탈로그 미등재는 기존에 알려진 유예 갭(INFO) |
| rationale_continuity | MEDIUM | TOCTOU 방지 메커니즘이 확립된 "비관적 락" 패턴에서 벗어나며 spec Rationale 미기록(WARNING) + impl-prep 번들의 SoT 문서 누락(WARNING) |
| convention_compliance | LOW | `CANNOT_REMOVE_OWNER` 카탈로그 미등재(WARNING) + RBAC 표 GFM 렌더링 붕괴(WARNING) + 구분선 중복(INFO) |
| plan_coherence | NONE | 소스 트래커 항목과 정확히 대응, 인접 미해결 항목과 충돌 없음, 선행 PR 전부 `complete/` 확인 |
| naming_collision | NONE | 신규 식별자 없음, `CANNOT_REMOVE_OWNER` 는 기존 정의 재사용 확인 |

## 권장 조치사항
1. **BLOCK 사유 없음** — `member-owner-toctou` 구현 착수를 진행해도 무방하다.
2. 구현 PR 의 코드 주석/커밋 메시지에 `4-execution-engine.md` §8 선례와의 차이(같은-행 조건부 원자 연산 vs 타-행 집계 조건)를 명시해 다음 리뷰어의 오적용을 예방한다.
3. 후속(별도 planner 턴)으로 `spec/data-flow/12-workspace.md` 에 `removeMember` 의 4번째 TOCTOU 방지 메커니즘(조건부 DELETE + affected-count)을 각주로 명문화한다.
4. 후속 소규모 spec PR 로 `CANNOT_REMOVE_OWNER`·`OWNER_ROLE_PROTECTED`·`SOLE_OWNER_CANNOT_LEAVE` 를 `3-error-handling.md` §1.9 인접에 등재한다.
5. `spec/5-system/1-auth.md` §3.2 RBAC 표의 각주 삽입 위치를 옮기거나 구분자를 재삽입해 GFM 렌더링을 복구한다.
6. (낮은 우선순위) `3-error-handling.md` 296-298행 중복 구분선을 정리한다.
