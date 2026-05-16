## 발견사항

- **[WARNING]** plan 체크리스트와 실제 코드 상태 불일치
  - target 위치: `Makefile` (e2e-up, e2e-test, e2e-test-full 타겟)
  - 관련 plan: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` §체크리스트 — `[x] 구현 (Makefile 수정)`, `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW`
  - 상세: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트 항목 "구현 (Makefile 수정)" 이 `[x]` 로 표기되어 있지만, worktree `bg-monitoring-e2e-fix-f789b9` 는 main 브랜치(`8fbad212`)와 동일한 커밋에 머물러 있고 Makefile 에 실제 변경이 없다. `git status` 는 plan 파일과 review 디렉토리만 untracked 로 보여준다. 즉 consistency-check `--impl-prep` 이 실행된 시점에 target 파일 diff 가 "(없음)" 인 상태가 맞지만, 동시에 plan 의 "구현 완료" 체크가 사실과 다르다.
  - 제안: plan 의 `[x] 구현 (Makefile 수정)` 과 `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW` 를 `[ ]` 로 되돌려 실제 구현 순서를 반영한다. consistency-check 완료 후 Makefile `--build` 플래그 추가 구현 → `make e2e-test` 통과 확인 → plan 체크박스 순서대로 갱신.

- **[INFO]** `brand-refresh-impl.md` 의 e2e fail #2 와 Makefile 수정의 간접 연관
  - target 위치: `Makefile` e2e-test / e2e-test-full 타겟
  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` §5 "fail #2 (password-reset — `/login` redirect timeout) — root cause 미확정, CI 검증 대기"
  - 상세: `brand-refresh-impl.md` 는 `make e2e-test-full` 에서 password-reset e2e 가 local Mac ARM Docker 에서 결정적으로 실패하고 있으며 CI 결과를 대기 중이다. 본 Makefile 수정 (`--build` 추가) 은 stale 이미지 문제를 해결하지만, brand-refresh worktree(`brand-refresh-7a3f12`) 는 별도 브랜치이므로 fix 가 merge 되기 전까지 그 worktree 에서 `make e2e-test` 실행 시 동일 stale 이미지 문제가 재현될 수 있다. 인과 관계는 없으나 brand-refresh 의 e2e 재검증 시 stale 이미지 여부도 같이 확인하면 좋다.
  - 제안: plan 갱신 불필요. brand-refresh e2e 재검증 시 `docker compose -f docker-compose.e2e.yml build` 수동 실행 여부를 확인하는 메모를 `brand-refresh-impl.md` §5 fail #2 항목 하단에 추가하면 추적에 도움이 됨 (선택 사항).

- **[INFO]** worktree 간 `Makefile` / `docker-compose.e2e.yml` 동시 수정 없음 — 충돌 없음
  - target 위치: `Makefile`, `docker-compose.e2e.yml`
  - 관련 plan: 전체 활성 worktree (`ai-agent-i18n-fix-b7d4e2`, `cafe24-fields-add-btn-d3f8a2`, `cafe24-node-i18n-fix-d8f3a1`, `cafe24-refresh-fix-a8c2f1`, `migrate-dup-guard-51c9fc`, `user-guide-sync-4af69c`)
  - 상세: 모든 활성 worktree 의 `docker-compose.e2e.yml` 이 main 과 동일하고, `Makefile` 도 마찬가지다. `self-hosting-deployment.md` 는 `docker-compose.production.yml` (신규 파일) 만 다루므로 경합 없음. worktree 충돌 없음.
  - 제안: 없음.

## 요약

target 파일(`Makefile`, `docker-compose.e2e.yml`) 에 대한 현재 diff 가 없는 상태(`(없음)`)로 consistency-check `--impl-prep` 이 수행된 것은 구현 착수 직전이라는 점에서 절차상 정상이다. 다른 진행 중 plan 과의 worktree 충돌, 미해결 결정 우회, 중복 작업은 발견되지 않았다. 단, `e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트가 구현·테스트·리뷰 항목까지 모두 `[x]` 로 선행 표기되어 있는 점은 plan 문서와 실제 git 상태 사이의 불일치를 초래한다. plan 체크박스를 실제 완료 시점에 맞게 갱신해 계획(plan)이 진실 소스로서의 역할을 유지하도록 교정이 필요하다.

## 위험도

LOW
