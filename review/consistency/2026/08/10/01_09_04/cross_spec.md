# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done, diff-base=origin/main)

## 진행 메모 (검토 방법)

`prompt_file` 의 bundle 은 컨텍스트 예산 초과로 diff 섹션(`## 구현 변경 사항`)이
프롬프트에 실리지 않았고(헤딩 0건·변경 파일명 0건 — 세션에 이미 `BYPASS.md` 로 기록된
동일 결함), `spec-impl-evidence.md` 본문 자체도 bundle 컨텍스트(3428줄)에 포함되지 않은
채(§conventions 리스트가 `chat-channel-adapter.md` 에서 끊기고 곧장 `0-overview.md` 로
점프) `spec-impl-evidence.md` 를 "생략된 파일 111개" 목록에도 올리지 않았다. 즉 이 target
문서는 프롬프트 안 어디에도 텍스트로 존재하지 않는다.

지시대로 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서
`git diff origin/main...HEAD`, 실제 파일 `Read`, `pnpm vitest run`(171/171 PASS 확인)으로
직접 근거를 확보해 검토했다.

## 발견사항

- **[WARNING] `PROJECT.md` §자동 가드 표의 `plan-frontmatter.test.ts` 서술이 실제 가드 범위보다 좁다**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 표 (`plan-frontmatter.test.ts` 행) — 이번 커밋(`9e880e908`+`f4a1723be`)이 "**(1)** worktree/started/owner, **(2)** `plan/complete/**` 의 `status` 종료값, **(3)** top-level 살아있는 plan 상대링크 무결성" 셋으로 정정
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates/PROJECT.md:277` — `` - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — top-level `plan/in-progress/*.md` 의 `worktree`(sentinel `(unstarted)` 허용)/`started`/`owner` frontmatter 강제. SoT: `.claude/docs/plan-lifecycle.md §4` ``
  - 상세: `spec-impl-evidence.md` §6 Rollout 정책 step 4 는 "PROJECT.md §자동 가드 표에 해당 row 추가"를 명시적 절차로 규정하는데, 이번 PR 은 target(spec-impl-evidence.md)과 `.claude/docs/plan-lifecycle.md` §4/§5 는 갱신했지만 PROJECT.md 277행은 여전히 원래(3-필드만 강제)로 남아 있다. `.claude/tests/test_doc_sync_matrix.py` 는 PROJECT.md 가 참조하는 `*.test.ts` 파일의 **존재**만 검증하고 서술 **정확성**은 보지 않으므로, 이 drift 는 CI 로 잡히지 않는다. 결과적으로 PROJECT.md 를 읽는 개발자는 "plan 이동 시 `status`/상대링크가 깨져도 이 가드는 안 본다"고 오판할 수 있다(실제로는 build 를 막는다).
  - 제안: PROJECT.md:277 을 `spec-impl-evidence.md §4.2` 행 서술과 동기화(3검사·스코프·SoT 위임 문구 반영). 원문 편집 권한은 developer 범위이므로 이 정정은 함께 반영 가능.

- **[WARNING] `spec-links.ts` 의 `findBrokenPlanLinks` 코멘트 실측 주장이 같은 PR 의 두 번째 커밋으로 이미 반증됐다**
  - target 위치: `spec/conventions/spec-impl-evidence.md:131` — "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관"이라고 명시해 이 파일을 판정 로직의 SoT 로 위임
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:274-275` — `` Measured 2026-08-09: 8 broken links in the live plans, every one a plan that had moved to `complete/`. `` (docstring, `findBrokenPlanLinks` 위)
  - 상세: 커밋 `9e880e908`(1차)은 앵커를 무시하는 손-정규식으로 "8건, 전부 이동된 plan" 을 발견·수정했다. 커밋 `f4a1723be`(2차, 같은 PR)는 이 손-정규식을 `spec-links.ts` 공유 스캐너(앵커까지 검증)로 교체했고, 그 커밋 메시지 자체가 "**교체하자마자 9번째 위반이 나왔다** — `cafe24-backlog-residual.md` 의 `#92-주요-api` 앵커가 stale" 이라고 적는다. 실제로 `plan/in-progress/cafe24-backlog-residual.md` 는 이 PR 안에서 `spec/2-navigation/4-integration.md` 앵커를 `#92-주요-api` → `#91-목록crud` 로 고쳤다(이동된 plan 링크가 아니라 **spec 앵커 rename**). 즉 최종 코드의 "8건 / 전부 이동-plan 링크" 주장은 개수·범주 둘 다 현재 동작과 어긋난다(실제 9건, 그중 최소 1~2건은 다른 실패 클래스 — `spec-fix-swagger-forbidden-response.md` 의 `../5-system/1-auth.md`→`../../spec/5-system/1-auth.md` 수정도 "이동된 plan" 이 아니라 상대경로 깊이 오류다).
  - 제안: 코멘트를 "9 broken links... 8 were plans that had moved to `complete/`; 1 was a stale spec-section anchor" 식으로 갱신하거나, 카테고리 주장을 빼고 개수만 남긴다. `spec-impl-evidence.md` 가 이 파일을 "판정 로직" 권위로 명시 위임하는 만큼, 여기 남은 부정확한 "every one" 주장은 향후 이 가드를 확장/자동수정하려는 사람이 잘못된 불변식(모든 위반이 경로-치환으로 고쳐진다)을 전제하게 만들 수 있다.

- **[INFO] plan frontmatter `status:` 값 도메인이 spec frontmatter `status:` 값 도메인과 어휘를 공유한다 (`implemented`)**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.2 "의미 도메인 구분 (혼동 방지)" — `code:`/`status:`(엔티티 컬럼)/`archived` 세 키의 동명이의를 명시적으로 분리해 둔 절
  - 충돌 대상: 같은 문서 §4.2 표(`plan-frontmatter.test.ts` 행) + `.claude/docs/plan-lifecycle.md` §4 + `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `TERMINAL_STATUSES = {complete, implemented, applied, superseded}`
  - 상세: 이번 PR 로 `plan/*.md` frontmatter 의 `status:` 값(`complete`/`implemented`/`applied`/`superseded`)이 처음으로 build guard 대상이 되면서, 같은 문서 §3 이 정의하는 spec frontmatter `status:` enum(`backlog`/`spec-only`/`partial`/`implemented`/`archived`)과 `implemented` 값을 공유하게 됐다. spec 쪽 `implemented` 는 "그 spec 이 약속한 모든 surface 가 구현 완료"를 뜻하고, plan 쪽 `implemented` 는 "이 완료-plan 의 종료 상태"를 뜻해 의미가 다르다. 이 문서(§2.2)는 정확히 이런 동명이의 케이스마다 disambiguation 문장을 추가해 온 전례가 있는데(`code:`, `status:`(entity 컬럼), `archived`), 이번에 새로 생긴 plan `status:` 도메인만 그 절에 반영되지 않았다.
  - 제안: §2.2 에 "plan frontmatter `status:`(§4.2, `plan-scan.ts` `TERMINAL_STATUSES`) 는 spec frontmatter `status:`(§3) 와 별 도메인 — 같은 `implemented` 값도 대상 문서 타입(spec vs plan)에 따라 의미가 다르다" 한 줄을 추가하는 정도로 충분. 기능적 충돌은 아니며(가드 로직이 문서 타입으로 이미 완전히 분리돼 있어 오동작 가능성 없음), 향후 새 spec/plan 을 쓰는 사람이 문서만 보고 헷갈리지 않도록 하는 예방적 sync.

## 조사했으나 문제 없음으로 확인한 항목

- `plan-frontmatter.test.ts`/`plan-scan.ts`/`spec-links.ts` 3파일 vitest 실행 — 171/171 PASS. target 이 서술하는 "3검사·스코프·면제" 는 실제 구현과 정확히 일치.
- `plan/complete/**` 전체 top-level `status:` 값 재스캔 — `in-progress` 잔존 0건(claim한 15건 일괄 정정 확인). 본문에 임베드된 예시 YAML 스니펫(`status: planned`/`status: spec-only`)은 frontmatter 밖이라 가드가 안 보는 게 맞고 실제로 오탐 없음.
- §4.2 "build 차단 4건 + advisory 1건" 총계·`code:` 파일 목록 갱신(`plan-scan.ts` 추가) — 정확.
- `spec/conventions/frontend-layering.md` 계층 규약과 `plan-scan.ts` 위치(`src/lib/docs/__tests__/`) — import 방향 위반 없음, 기존 `spec-links.ts`/`spec-frontmatter-parse.ts` 와 동일 패턴이라 계층 책임 충돌 아님.
- 요구사항 ID·API 계약·RBAC·엔티티 상태 머신 — 이번 변경은 문서/플랜 라이프사이클 가드 범위라 해당 축에 표면이 없음(§1-데이터모델·§5-system 등과 무관).

## 요약

target(`spec/conventions/spec-impl-evidence.md`)의 이번 정정 — `plan-scan.ts` 를 `code:` 에 등재하고 `plan-frontmatter.test.ts` 행을 "3검사"로 갱신한 것 — 은 실제 워킹트리 코드(171/171 PASS)와 정확히 일치하며 `.claude/docs/plan-lifecycle.md` §4/§5 와도 스코프·SoT 위임이 일관된다. 다만 이 변경의 파급이 미친 두 인접 문서에 drift 가 남았다: PROJECT.md §자동 가드 표의 해당 행이 옛 3-필드 서술 그대로라 target 의 Rollout §6 절차(가드 변경 시 PROJECT.md 동반 갱신)를 완결하지 못했고, target 이 "판정 로직 SoT" 로 위임한 `spec-links.ts` 자신의 코드 코멘트는 같은 PR 의 후속 커밋이 이미 반증한 "8건/전부 이동-링크" 주장을 그대로 갖고 있다. 둘 다 build 를 막지 않고 기능 회귀도 없지만, 문서를 읽고 향후 이 가드를 다루거나 신뢰할 사람에게 실제 동작보다 좁거나 틀린 그림을 준다. `status:` 키의 spec/plan 도메인 공유는 기능 충돌 없는 명명 관찰 수준의 INFO.

## 위험도

LOW
STATUS=success
