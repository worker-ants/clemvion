# Plan 정합성 검토 — `spec/conventions/` (frontend-layering)

## 방법론 메모
전달된 prompt payload 의 "Target 문서" 섹션은 `spec/conventions/audit-actions.md`, `cafe24-api-catalog/**`
등 알파벳순 앞쪽 파일들로 채워져 있었고 실제 diff 대상인 `spec/conventions/frontend-layering.md` ·
`plan/in-progress/spec-draft-frontend-layering.md` 는 payload 에 누락돼 있었다(생성 단계의 스코프
직렬화 버그로 추정). 이 때문에 payload 대신 워킹트리에서 직접
`git diff 29aa918a653a0efb5f792dc7e105c0887f03ef25 HEAD -- spec/conventions/frontend-layering.md plan/in-progress/spec-draft-frontend-layering.md`
와 `plan/complete/spec-draft-frontend-layering.md`, `plan/in-progress/**` 전수 grep 으로 재확인해
분석했다.

## 검토 대상 변경 요약
- `plan/in-progress/spec-draft-frontend-layering.md` 삭제 → `plan/complete/spec-draft-frontend-layering.md` 로 이동, Phase 1/2/3 전부 `[x]` 완료 처리.
- `spec/conventions/frontend-layering.md` frontmatter `status: partial` → `implemented`, `pending_plans:` 제거.
- 본문 §4 "현재 CI 커버리지는 `src/lib/**` 뿐" 단서 블록 제거 (스코프가 `LOWER_LAYERS = ["src/lib/**", "src/types/**"]` 로 실제 확장됐으므로).
- 코드: `eslint.config.mjs`(`LOWER_LAYERS` 배열), `eslint-layering-guard.test.ts`(실제 ESLint API resolve 스위트 추가) — 모두 diff 의 `+` 라인으로 확인됨.

## 발견사항

없음. 아래 세 관점 모두 충돌·누락 없음을 확인했다.

1. **미해결 결정과의 충돌**: 없음. `plan/complete/spec-draft-frontend-layering.md` 의 D1~D4 결정(레이어 순서, `src/types/**` 스코프 포함, `app` 미가드, `partial→implemented` 승격 타이밍)이 spec 본문·frontmatter 와 1:1 로 반영돼 있다. 다른 `plan/in-progress/**` 23개 파일 전수 grep(`frontend-layering|LOWER_LAYERS|eslint-layering-guard|src/types/**`) 결과 이 작업을 "결정 필요"로 남겨둔 항목은 전무하다 — 즉 일방적으로 우회할 미해결 결정 자체가 없다.
2. **선행 plan 미해소**: 없음. 본 작업의 유일한 선행 조건은 자기 자신의 Phase 1(spec 신설)이었고 Phase 2·3 로 동일 plan 안에서 순차 완결됐다. `spec/conventions/spec-impl-evidence.md` §3 이 요구하는 `partial + pending_plans` → `implemented` 승격 규칙도 정확히 그 규칙대로 이행됐다(가드 구현 완료 확인 후 승격, `pending_plans` 제거).
3. **후속 항목 누락**: 없음. `plan/in-progress/` 23개 항목·`node-output-redesign/` 하위 문서 전수 확인 결과 `frontend-layering.md`/`LOWER_LAYERS`/`src/types` 를 참조하거나 그 완료를 전제로 하는 후속 작업은 없다. 병렬 세션 중복(branch `claude/zen-kapitsa-c5e1de` / worktree `nifty-greider-35167d`)에 대한 처분 기록은 plan 문서 안에 "Phase 2·3 수행 세션 처분 확정" 단락으로 이미 self-closed 돼 있다(단, 동시 작업 충돌 자체는 본 검토 범위 밖).

## 요약
`spec/conventions/frontend-layering.md` 신설·승격 작업은 그 자신의 plan(`plan/complete/spec-draft-frontend-layering.md`)이 규정한 Phase 1~3 을 빠짐없이 이행하고 정상적으로 `plan/complete/` 로 종결됐다. `pending_plans` 제거·`status: implemented` 승격이 `spec-impl-evidence.md` 규약과 일치하며, 다른 `plan/in-progress/**` 문서 중 이 변경과 충돌하거나 이 변경을 전제로 갱신이 필요한 항목은 발견되지 않았다. Plan 정합성 관점에서 위험 없음.

## 위험도
NONE
