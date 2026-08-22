### 발견사항

- **[WARNING]** target 작업을 추적하는 plan 문서가 없다 — push gate 의 plan-연결 검증이 이 작업에 무력하다
  - target 위치: `codebase/backend/src/shared/utils/` (현재 diff 없음, `--impl-prep` 단계)
  - 관련 plan: `plan/in-progress/masked-marker-shared-package.md` §"후속 (이 PR 밖)" 마지막 항목(L192-199) — *"backend `deepRedactSecrets` 깊이 경계 테스트 — 프런트 `masked-markers.test.ts` 는 `nest(10)→true`/`nest(11)→false` 로 상한을 정확히 고정하는데, backend `sanitize-error-message.spec.ts` 는 `not.toThrow()` 만 본다"*
  - 상세: 현재 worktree `backend-redact-depth-boundary-af6b93` 는 이 정확한 미해결 follow-up 항목을 구현하려는 작업으로 보이는데(제목·타깃 디렉토리·현상이 정확히 일치), `plan/in-progress/**` 어디에도 `worktree: backend-redact-depth-boundary-af6b93` 로 연결된 plan 문서가 없다(전수 grep 0건). `.claude/docs/plan-lifecycle.md` §3 의 push-gate 연결 판정은 frontmatter `worktree:` 매칭으로만 작동하므로, 연결된 plan 이 없는 이 작업은 "ad-hoc/hotfix" 로 분류돼 **plan 갱신·이동 강제 가드가 발화하지 않는다.** 즉 구현이 끝나도 `masked-marker-shared-package.md` L192 체크박스가 자동으로 강제 갱신되지 않고, 이 저장소가 이미 겪은 "`review/**` 는 SoT 아님 → 미룬 항목이 조용히 유실" 패턴(예: `backend-lint-gate-broken-on-main.md`, `spec-sync-external-interaction-api-gaps.md` 사례)을 반복할 위험이 있다.
  - 제안: PR 내에서 `masked-marker-shared-package.md` L192 항목을 `[x]` 로 갱신하고 "완료 (날짜, `backend-redact-depth-boundary`)" 형태의 대체 근거를 남긴다 — 이 저장소가 이미 쓰고 있는 관용구(`backend-hygiene-followups` 사례 등)를 따르면 된다. plan 이동 자체는 불필요(그 plan 은 다른 worktree 소유이며 아직 다른 미해결 항목도 있을 수 있음, 실제로 존재하는지는 별도 확인 필요), 항목만 닫으면 된다.

- **[INFO]** 선행조건 두 가지는 실제로 이미 해소됨 — 착수 차단 요소 없음
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts`
  - 관련 plan: `plan/in-progress/masked-marker-shared-package.md`(패키지 추출), 그 안에서 닫힌 `mirror-guard-single-copy.md`(미러 가드 단일화)
  - 상세: 코드 확인 결과 `sanitize-error-message.ts` 는 이미 `@workflow/masked-markers`(`codebase/packages/masked-markers/src/index.ts`, `MAX_MASK_DEPTH = 10`)에서 상수를 import 하고 `MAX_REDACT_DEPTH` 로 재export 한다(`git log` 상 PR #1190/`3f8543eae`, #1191/`7b0e65aa8` 모두 이미 main 에 병합됨). frontend `masked-markers.test.ts` 는 `nest(10)→true`/`nest(11)→false` 로 상한을 정확히 고정 중이며, backend `sanitize-error-message.spec.ts:239-243` 는 여전히 `not.toThrow()` 만 본다 — plan 이 서술한 갭이 코드로 재확인됨. 이 작업을 막는 미해결 결정이나 미해소 선행 plan 은 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** target 스코프(`shared/utils/`) 안에 이미 확정된 별개의 depth-경계 비대칭이 있다 — 혼동 시 기존 결정 번복 위험
  - target 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:52-67` (`stripDeep` 의 `depth > maxDepth`)
  - 관련 plan: 없음(plan 항목이 아니라 이미 여러 리뷰 라운드 — `14_30_35`·`14_55_29` — 로 코드 JSDoc 에 정착된 결정)
  - 상세: `deepRedactSecrets`(`>=` 10, `sanitize-error-message.ts`)와 `stripExternalOnlyFields`(`>` 10)은 **같은 값을 공유하되 경계 연산자가 의도적으로 다르다** — 이미 실측·리뷰로 "안전 근거는 연산자 일치가 아니라 그 깊이에서 둘 중 하나가 서브트리를 collapse 한다는 성질" 로 확정됐다. 이번 target 작업이 요구하는 것은 `deepRedactSecrets` 단독의 경계 테스트(프런트 `nest(10)/nest(11)` 대칭)이지 `stripDeep` 과의 통일이 아니다. 스코프를 벗어나 두 경계 연산자를 맞추려 시도하면 이미 닫힌 결정(그리고 그 결정의 근거였던 WS `MAX_SANITIZE_DEPTH` 비통합 결정)을 근거 없이 번복하게 된다.
  - 제안: 구현 시 테스트 대상을 `deepRedactSecrets`(및 이를 위임하는 `redact-stored-error.ts`)로 명시적으로 좁히고, `strip-external-only-fields.ts`/`websocket.service.ts` 의 `>` 경계는 손대지 않는다.

- **[INFO]** `masked-marker-shared-package.md` 자체 체크리스트의 `/ai-review` 항목이 stale
  - target 위치: 무관(참고용)
  - 관련 plan: `plan/in-progress/masked-marker-shared-package.md` L137 `- [ ] /ai-review`
  - 상세: 이 plan 이 만든 PR #1190(`3f8543eae`)은 이미 main 에 병합됐다(CLAUDE.md 상 구현 완료 후 `/ai-review` 는 강제 의무). 체크박스가 `[ ]` 로 남아있는 것은 실제 미완료가 아니라 갱신 누락으로 보인다. 이번 target 작업의 착수를 막지는 않지만, 같은 plan 파일을 이번 PR 에서 편집할 예정이므로(위 WARNING 항목) 같이 정정하면 값싸다.
  - 제안: `masked-marker-shared-package.md` L192 편집과 같은 커밋에서 L137 도 `[x]` 로 정정(또는 별도 확인 후).

### 요약
target(`codebase/backend/src/shared/utils/`) 은 아직 diff 가 없는 `--impl-prep` 단계이며, 작업 성격(제목·디렉토리)이 `plan/in-progress/masked-marker-shared-package.md` 의 미해결 follow-up 항목("backend `deepRedactSecrets` 깊이 경계 테스트")과 정확히 일치한다. 그 항목이 전제하는 선행 작업(공유 패키지 추출 PR #1190, 미러 가드 단일화 PR #1191)은 코드·git log 로 모두 실제 완료가 확인됐고, 이 작업을 가로막는 미해결 결정 충돌은 없다. 다만 이 worktree 를 가리키는 plan 문서가 없어 push-gate 의 plan 연결 자동 강제가 무력하므로, 구현 완료 시 소스 plan 의 체크박스를 수동으로 닫아야 하는 절차적 리스크가 남는다. 또한 target 디렉토리 안에 이미 별개로 확정된 depth-경계 비대칭(`stripExternalOnlyFields` 의 `>` vs `deepRedactSecrets` 의 `>=`)이 있어, 구현 스코프를 명확히 `deepRedactSecrets` 로 좁혀야 기존 결정을 번복하지 않는다.

### 위험도
LOW
