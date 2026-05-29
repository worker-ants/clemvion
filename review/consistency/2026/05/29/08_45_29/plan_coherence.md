# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-fix-isactive-drawer-toggle.md`
검토 시점: 2026-05-29
(원 sub-agent 가 worktree write 차단으로 inline 반환 → main 이 대리 기록)

## 발견사항

### [INFO] worktree slug `trigger-drawer-cleanup-f6a707` stale (PR #268 MERGED)
- frontmatter `worktree` 가 이미 머지된 slug. 실제 본 작업은 별도 worktree(`telegram-guide-realign-6ad222`)에서 진행 중이라 충돌 없음. 제안한 spec 변경(§2.3.1 + R-16)은 아직 main 미반영(정상 — 미착수였음).

### [INFO] §2.3.1 isActive 행 / R-16 미반영
- 현행 spec line 84 `edit (토글 버튼)`, Rationale R-15 까지만 존재. plan 미착수에 따른 정상 미반영. 착수 시 적용.

### [WARNING] `trigger-drawer-tests.md` isActive 케이스 후속 영향 누락
- isActive 행을 read-only 배지로 바꾸면 drawer 가 편집 토글을 노출하지 않음. `trigger-drawer-tests.md` 케이스 3/7 에 isActive edit 토글 assertion 이 있으면 재검토 필요. target plan `## 영향 범위` 에 테스트 plan 후속 언급 추가 권장.
- 단, drawer 는 이미 read-only 배지로 shipping 됨 — 즉 테스트도 이미 read-only 기준으로 작성됐을 가능성이 높음(구현↔테스트 동반). 실제 영향은 낮음.

### [INFO] 선행 plan auth-config-webhook-wiring(R-14) 이미 MERGED(PR #341)
- 선행 조건 충족, 경합 없음.

### [INFO] `triggers-auth-column.md` 등 동 파일 수정 plan 들은 stale(머지됨)
- worktree 충돌 후보 2건(`trigger-drawer-cleanup-f6a707`, `triggers-auth-column-a80393`) 모두 stale 판정 skip, active 충돌 0건.

## 위험도
LOW — 미해결 결정 우회·active plan 경합 없음. WARNING 1건(테스트 plan 후속 언급)은 보완 권장 수준.
