# Consistency Check 통합 보고서 (impl-done, 6차)

- 대상: `spec/conventions/` 번들 · diff-base `origin/main`
- checker 5종 전원 실행·전문 확보. 누락 없음.

## BLOCK: NO

Critical 0건. WARNING 1건은 규칙 문언과의 충돌 지적으로, 아래 §조치에 따라 **등재가 아니라
실제 fix 로** 해소했다.

## 전체 위험도

**LOW** — cross_spec / naming_collision / convention_compliance / plan_coherence 4종 NONE,
rationale_continuity 만 MEDIUM.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | checker | 발견사항 | 위치 | 조치 |
|---|---------|----------|------|------|
| 1 | rationale_continuity | 신규 plan `docs-guard-legacy-fixture-coverage.md` 의 "선재 코드라 PR 밖" 유예 근거가 `developer/SKILL.md §ISSUE FIX 정책` 문언과 충돌 — "TEST·REVIEW WORKFLOW 에서 발견된 사항은 **기존부터 있던 것이라도 조치**" 이므로 backlog 등재는 조치가 아니다. 동일 패턴이 이 PR 에서 3회 반복됐는데 규칙은 개정되지 않았다 | `plan/in-progress/docs-guard-legacy-fixture-coverage.md`, `review/code/2026/08/10/02_33_44/RESOLUTION.md §W1` | **fix 채택.** 판정 로직을 `plan-scan.ts` 로 추출하고 fixture 로 negative-path 를 증명. plan 파일은 항목이 전부 해소돼 삭제 |

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale_continuity | 헤더 주석 축약(38→22줄)은 **근거 소실이 아님** — 걷어낸 서사가 `plan-lifecycle.md §4`·커밋 메시지·`plan/complete/` 산출물 3곳에 보존됨을 실측 확인. CLAUDE.md "근거는 `## Rationale` 로" 원칙에 오히려 부합 | 조치 불요 |
| 2 | convention_compliance | `spec-impl-evidence.md` frontmatter `code:` 에 `plan-scan.test.ts`/`spec-links.test.ts` 미등재. 다만 문언 요구("4개 build 가드 구현 파일")는 충족하고 다른 3개 가드도 헬퍼 테스트를 개별 등재하지 않아 관행과 일치 | 조치 불요 |
| 3 | plan_coherence | 삭제된 plan 본문의 "그 파일이 이미 세 관심사를 안고 있다는 지적" 에 출처 인용이 없었음 | plan 삭제로 소멸 |
| 4 | rationale_continuity | `spec-impl-evidence.md` 자기 정정 커밋(`dd7da2d1b`)의 역할 경계 우회 — 자기인지·BYPASS 근거가 기록돼 있음 | 조치 불요 |

## checker 별 위험도 요약

| checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | NONE | 세 미러(PROJECT.md·spec-impl-evidence.md·plan-lifecycle.md) 서술이 코드와 일치. 삭제된 서사의 보존처를 `git log --oneline --all` 로 실증 |
| naming_collision | NONE | 신규 export 6종·plan 파일명 충돌 없음. `describe` 개명이 CI 의 `-t`/`--grep` 필터를 깨지 않음을 전역 검색으로 확인(해당 패턴 자체가 0건) |
| convention_compliance | NONE | 3개 불변식·판정 로직 소재·SoT·예외 조건 서술 누락 없음. 신규 plan frontmatter 스키마 준수 |
| plan_coherence | NONE | 미해결 결정 우회·선행 plan 미해소·후속 누락 없음 |
| rationale_continuity | MEDIUM | WARNING #1 (위 표) |
