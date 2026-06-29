# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 4건(중복 통합 후 2건), INFO 5건. 모두 현재 디스크 파일과 draft 버전 간 stale 불일치 해소 방향이며, draft 자체가 옳은 상태.

> **main 검증 노트 (stale-read false positive)**: WARNING #1·#2 가 지목한 "현재 디스크 파일: strong 패턴으로 시작 / 표 — manual" 은 **origin/main(미머지) 버전**이며, 본 작업 커밋(029a9499c)에는 이미 올바른 내용(line 172 = 2신호 정의, line 189 = 가드 3건 행)이 반영돼 있다. checker 가 권고 #1 에서 "커밋 후 WARNING 1·2 자동 해소" 라고 명시 — 즉 두 WARNING 은 *내 수정이 옳음을 확인*하는 diff-vs-main 산물이지 실제 갭이 아니다. 별도 조치 불필요. (디스크 line 172 = "`findGuiFlowSections()` 의 두 신호 OR …" 확인 완료.)

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Convention-Compliance | Principle 7 GUI 흐름 절 판별 기준 서술이 SoT 와 불일치 (※ **stale-read — origin/main 기준. 본 커밋엔 이미 반영됨**) | `spec/conventions/i18n-userguide.md` line 172 | `user-guide-evidence.md §2` | (이미 적용됨) draft 버전(두 신호 OR + SoT 위임) |
| 2 | Cross-Spec / Convention-Compliance | 자동 가드 요약 표 Principle 7 행 build-time 가드 3건 누락 (※ **stale-read — 본 커밋엔 이미 반영됨**) | `spec/conventions/i18n-userguide.md` line 189 | `user-guide-evidence.md §2` | (이미 적용됨) GUI 흐름 절 3건 hard fail / 개념 절 manual |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 자동 가드 요약 표 Principle 1 행의 "P2-b" 주석이 행 레이블("1 (TSX 하드코딩)")과 불일치 — 번호 체계 변경 이력 흔적 (**본 변경과 무관·pre-existing**) | `i18n-userguide.md` 가드 요약 표 Principle 1 행 | 별도 PR 에서 "P2-b" → "P1-b" 또는 제거 |
| 2 | Cross-Spec | Principle 3-C `params` 노출 의무와 `cross-node-warning-rules.md` `GraphWarningRule` 타입 간 교차 참조 문구 없음 (**pre-existing**) | `i18n-userguide.md` Principle 3-C | `GraphWarningRule` 의 `params` 포함 여부 확인 후 참조 링크 추가 권장 |
| 3 | Convention-Compliance | frontmatter `code:` 에 Principle 7 가드 3건 미등재 (user-guide-evidence.md 에 이미 등재 — 중복 회피) | `i18n-userguide.md` frontmatter | 필수 아님. 주석 교차 참조 고려 |
| 4 | Naming-Collision | `Principle N` 번호가 `node-output.md` 와 `i18n-userguide.md` 간 독립 체계로 중복 — 이번 변경 이전부터 존재 | 두 파일 전반 | 현 상태 유지 가능 |
| 5 | Naming-Collision | `findGuiFlowSections()` 판별 정의 병렬 서술 — draft 는 SoT 위임 명시로 이중 SoT 방지 | `i18n-userguide.md` Principle 7 | 현재 구조 적절. 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(stale-read, 이미 반영) + INFO 2건(pre-existing) |
| Rationale-Continuity | NONE | 변경 2건 모두 user-guide-evidence.md R-4 및 §2 SoT 와 정합. 기각 대안 재도입 없음 |
| Convention-Compliance | LOW | WARNING 2건 — stale-read 동일 근원. frontmatter INFO 1건 |
| Plan-Coherence | NONE | 선행 plan 완료 확인. 미해결 결정 우회 없음 |
| Naming-Collision | NONE | 신규 식별자 도입 없음. Principle 번호 중복은 변경 이전부터 존재 |

## 권장 조치사항

1. **[WARNING — 이미 해소]** i18n-userguide.md line 172·189 는 본 커밋에 올바른 내용이 이미 반영됨 (stale-read 로 재플래그). 머지 시 origin/main 과 정합.
2. **[INFO, 별도 PR]** 자동 가드 요약 표 Principle 1 행의 "P2-b" 주석을 "P1-b" 로 정정/제거 — 본 변경과 무관한 pre-existing 흔적.
3. **[INFO, 선택]** `cross-node-warning-rules.md` `GraphWarningRule` 의 `params` 필드 확인 후 Principle 3-C 교차 참조 링크 추가 고려.
