# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 이 PR 이 완료한 항목이 자매 plan 의 체크리스트에는 미해소로 남아 stale
  - 위치: `plan/in-progress/spec-draft-auth-invariants-sync.md:385-390` (이 diff 밖의 파일 — grep/Read 로 직접 확인한 실제 소스 줄 번호)
  - 상세: 해당 plan(`worktree: pnpm-migration-followups-7fc7c2`, `owner: planner`)의 "후속 (이 PR 밖) → developer 범위" 항목이 정확히 이번 커밋이 수행한 작업을 미해결로 등재하고 있다 — `"[ ] common/utils/uuid.ts docstring 의 캐너리 지목 정정 — ... 같은 파일의 단위 테스트(uuid.spec.ts 경계 테스트 · workspace-context.util.spec.ts)를 지목하도록 고칠 것."` 이번 커밋이 `uuid.ts`·`uuid.spec.ts`·신설 `workspace-id-fixtures.ts` 세 곳을 정확히 그 방향으로 고쳤음에도, 그 사실이 저 체크리스트에 반영되지 않았다. 해당 항목 자체가 "spec 쪽은 이미 정정돼 있어 잘못된 근거가 퍼지지는 않는다"고 스스로 리스크를 낮춰 적어 두었기 때문에 확산 위험은 낮지만, 이 저장소가 이미 반복 학습한 실패 클래스다(같은 문서 안에서도 두 곳에 있던 정정이 한 곳만 반영돼 이번 커밋이 재정정한 사례가 이 diff 자체에 들어 있다 — `plan/in-progress/auth-guard-reflection-hardening.md`). 체크박스가 실제 상태와 어긋난 채로 남으면 `pnpm-migration-followups-7fc7c2` worktree 가 이미 끝난 작업을 다시 시도하거나, 최소한 상태 파악에 혼선을 줄 수 있다.
  - 제안: 이번 PR 범위 밖(다른 worktree 소유)이라 직접 체크할 권한이 애매하다면, 최소한 커밋 메시지나 이 plan 의 "후속" 섹션에 "`spec-draft-auth-invariants-sync.md:385` 의 동일 항목을 함께 해소함 — 다음 planner 턴에서 체크 표시할 것" 같은 포인터를 남겨 두는 것을 권장한다. 그래야 다음에 그 plan 을 여는 사람이 별도로 grep 하지 않고도 이미 끝난 작업임을 알 수 있다.

- **[INFO]** `uuid.ts`/`uuid.spec.ts`/`workspace-id-fixtures.ts` 세 곳에 "앵커 정정" 각주가 영구히 프로덕션 코드 주석/테스트 주석으로 쌓이는 구조
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (`isUuidShaped` JSDoc, `> **앵커 정정 (2026-08-09, #1112 실측).**` 블록) · `codebase/backend/src/common/utils/uuid.spec.ts` (`accepts UUID-shaped values...` 테스트 바로 위 블록 주석) · `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` (`NIL_WS` 위 docstring)
  - 상세: 세 곳 모두 사실관계는 정확히 검증됨(`system-status.controller.ts` 에 `@Roles()`/`@WorkspaceId()` 부재, `RolesGuard` 단축 순서, `isUuidShaped` 프로덕션 호출부가 `workspace-context.util.ts:74` 한 곳뿐이라는 주장 모두 grep 으로 재확인해 정확했음). 다만 correction 이력을 지우지 않고 원문 인용 + 정정 각주 형태로 영구 보존하는 패턴이라, 향후 같은 종류의 재정정이 또 생기면 docstring 이 계속 길어질 수 있다. 지금은 문제 없으나, 장기적으로 "정정의 정정"이 누적되면 정본이 무엇인지 다시 흐려질 수 있다.
  - 제안: 지금 당장 조치는 불필요. 다만 spec 쪽(`spec/data-flow/12-workspace.md`)처럼 코드 docstring 도 "이 앵커가 최종본"이라는 표식을 유지하려면, 추후 동일 문단이 세 번째로 바뀔 때는 각주를 새로 쌓기보다 이전 각주를 접어(consolidate) 정리하는 편이 낫다.

## 요약
이 변경은 순수하게 문서(코드 docstring·테스트 주석·plan 서술)만 건드리는 정정 커밋이며, 정정된 사실관계(`system-status.controller.ts` 에 `@Roles()`/`@WorkspaceId()` 가 없어 `RolesGuard` 가 술어 호출 전에 통과시킨다는 것, `isUuidShaped` 의 유일한 프로덕션 호출부가 `workspace-context.util.ts:74` 라는 것)를 직접 grep/코드로 재검증한 결과 모두 정확했다. 4개 파일(신설 픽스처 모듈 · `uuid.spec.ts` · `uuid.ts` · plan) 간 정정 내용도 서로 모순 없이 일관되며, 취소선 + 정정 각주로 이전 서술을 지우지 않고 남기는 방식은 이 저장소의 기존 관례(`spec/data-flow/12-workspace.md`)와 일치한다. 유일한 실질적 아쉬움은 diff 밖의 자매 plan(`spec-draft-auth-invariants-sync.md`)에 있는 동일 항목의 체크박스가 이번 정정으로 인해 사실상 완료됐음에도 미반영 상태로 남아 있다는 점이며, 자체적으로 위험을 낮춰 적어 둔 항목이라 확산 리스크는 낮다. README/CHANGELOG/API 문서/설정 문서는 이번 변경 범위에 해당 사항이 없다(행동 변화 없음, "결정·근거는 영향 없고 앵커만 바뀐다"고 커밋 스스로 명시).

## 위험도
LOW
