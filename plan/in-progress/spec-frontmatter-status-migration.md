---
worktree: spec-frontmatter-status-migration-d97565
started: 2026-05-29
owner: project-planner
---

# Plan — spec frontmatter `status` 전반 마이그레이션 (spec-only → 실상태)

> spec-impl-evidence 규약(2026-05-23 도입)의 `status` 라이프사이클을 프로젝트 전반에
> 적용한다. 현재 대부분 spec 이 전환기 기본값 `spec-only` 로 남아 있다.

## 동기 / 배경

- 트리거: PR #355 변경 7 조사 (project-planner, 2026-05-29). 단일 spec(`4-execution-engine`)
  frontmatter 전이를 검토하다 **프로젝트 전반 현상**임을 확인.
- **TTL 가드는 spec 별 생성일이 아니라 규약 도입일(2026-05-23) + 90일 = `2026-08-21` 공통 deadline**
  (`codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts:19-22`).
  현재(5/29) 모든 `spec-only` 가 TTL 내라 빌드 통과 — 하지만 **8/21 이후 `spec-only`
  잔존 시 build fail**. 그 전에 실상태로 전이해야 한다.
- 현황 (2026-05-29, `spec/**.md` frontmatter status 보유 104개):
  - `spec-only` **96** · `implemented` 6 · `partial` 2

## 전이 규칙 (spec-impl-evidence §3 요약)

| 목표 status | 조건 | `code:` | `pending_plans:` |
| --- | --- | --- | --- |
| `implemented` | 약속 surface 전부 구현 | ≥1 glob 매치 의무 | 없음 |
| `partial` | 일부 구현 | ≥1 매치 의무 | **≥1 (in-progress 실존) 의무** |
| `backlog` | 장기 로드맵 — 구현 의도 미결정 (spec-impl-evidence §3) | 비어도 OK | — (`0-overview §6.3` 로드맵 매칭 **의무 — 가드**) |
| `archived` | 폐기 | — | — |

> 가드 4종: `spec-frontmatter` / `spec-code-paths` / `spec-status-lifecycle` / `spec-pending-plan-existence` (frontend vitest).

## 분류 방법론 (per-spec)

각 spec 에 대해:
1. 본문이 약속한 surface 식별 (UI / API / 동작).
2. `code:` glob 후보 도출 (구현 모듈/컴포넌트/마이그레이션 경로).
3. 갭 판정 — 전부 구현되면 `implemented`, 미구현 잔존 시 `partial` (+ owning plan 확인/신설) 또는 `backlog`.
4. `/spec-coverage` 산출물을 1차 입력으로 활용 가능 (NLP 휴리스틱 — 최종 판정은 수동).
5. spec 본문의 stale "예정/미구현" 문구도 함께 정정.

## 배치 (도메인별)

| 배치 | 영역 | spec-only 수 | 상태 |
| --- | --- | --- | --- |
| B0 | `5-system/4-execution-engine` (anchor) | 1 | ✅ 본 PR 에서 worked example 로 전이 (아래) |
| B1 | `5-system/` 나머지 | 12 | ⏳ |
| B2 | `4-nodes/` (logic·flow·ai·integration·data·presentation·trigger) | ~33 | ⏳ |
| B3 | `3-workflow-editor/` | 5 | ⏳ |
| B4 | `2-navigation/` | 14 | ⏳ |
| B5 | `conventions/` (cafe24-api-catalog 18 + 기타 13) | ~31 | ✅ (이 PR — 아래 §B5 결과) |
| B6 | `7-channel-web-chat/` (architecture·widget-app·sdk·auth-session·security) | 0 | N/A — 이미 전이됨. 5개 모두 `status: partial` + `pending_plans: [channel-web-chat-impl, channel-web-chat-followups]`. 양 plan 완료 시 `implemented` 전이 (가드 scope 내) |

> 각 배치는 별 PR 권장 (리뷰 단위 관리 + consistency-check 부담 분산). cafe24-api-catalog 는
> 외부 API 카탈로그(레퍼런스 성격)라 `implemented` 또는 `archived`/`backlog` 일괄 판정 가능성 높음 — 우선 검토.

## B0 — execution-engine anchor (본 PR 실행분)

- [x] 본문 stale 정정: `_multiTurnState` legacy fallback "제거 예정"(§1.x) → 이미 제거됨 / presentation status "`resumed` 통일 예정"(§1.x) → 이미 통일됨.
- [x] frontmatter: `status: partial` + `code: codebase/backend/src/modules/execution-engine/**` + `pending_plans: [plan/in-progress/execution-engine-residual-gaps.md]`.
- [x] 미구현 surface(G1 WS start gate / G2 errorPolicy continue / G3 seq TTL)는 `execution-engine-residual-gaps.md` 가 인수.

## B5 — conventions 결과 (이 PR, 2026-05-31)

29개 `spec/conventions/**` frontmatter 를 `spec-only` → 실상태로 전이.

**검증 (실측, 2026-05-31)**: 4 가드 vitest (`spec-{frontmatter,code-paths,status-lifecycle,pending-plan-existence}`). B5 가 건드린 29개 파일은 처음부터 전부 통과. 초기 실행 시 잔여 2 fail 은 **B5 무관·origin/main 기존 결함** — `spec/conventions/chat-channel-adapter.md`·`spec/5-system/15-chat-channel.md` 가 `status: partial` 인데 `pending_plans: []` (`git diff origin/main` 무차이로 확인). **사용자 결정에 따라 이 PR 에서 함께 해소** — 두 파일에 `pending_plans: [chat-channel-discord-gateway, chat-channel-slack-socket-mode, chat-channel-visual-ssr-png]` 추가. 최종 결과: **Tests 631 passed, 0 failed**. `/consistency-check --spec` 5-checker workflow 결과 **BLOCK: NO** (Critical 0; Warning 은 모두 본 plan 문서 stale 기재 — 같은 PR 에서 정정). 결과: `review/consistency/2026/05/31/17_12_00/SUMMARY.md`.

- **18 cafe24-api-catalog/<domain>.md → `implemented`**: code `codebase/backend/src/nodes/integration/cafe24/metadata/<domain>.ts` (도메인별 메타데이터 파일. `registry/` 하위가 아니라 `metadata/` 직속 — 인계 메모의 `registry/` 추정은 오류였음). 18 도메인 전부 `supported` row 보유 → 카탈로그가 약속한 surface(메타데이터) 구현 완료. `planned` row 는 카탈로그 내부 로드맵 표기라 frontmatter 와 별 도메인(`_overview.md §3`).
- **`cafe24-api-metadata` → implemented** (`metadata/**`).
- **`cafe24-restricted-scopes` → partial** (`metadata/restricted-approval.ts`, pending `cafe24-restricted-scopes-followups.md`).
- **`conversation-thread`·`data-hydration-surfaces`·`i18n-userguide`·`interaction-type-registry`·`migrations`·`secret-store`·`swagger`·`user-guide-evidence` → implemented**.
- **`node-output` → partial** (`nodes/core/node-handler.interface.ts` + `execution-engine/handler-output.adapter.ts`, pending `node-output-redesign/README.md`).
- 본문 stale 정정 1건: `user-guide-evidence.md §1.1` 컴포넌트 경로 `components/docs/impl-anchor.tsx` → `components/docs/mdx/impl-anchor.tsx`.
- 주의 (인계 메모 정정): 여러 spec 본문이 stale 경로를 갖고 있었으나 frontmatter `code:` 는 실경로로 검증해 채웠다 — migrations 는 `codebase/backend/migrations/`(src 아님), conversation-thread 는 `src/shared/conversation-thread/`, swagger 는 `src/common/swagger/`(+nest-cli plugin, backlog 아님). `_overview.md` 는 `_` basename 이라 가드 대상 외 — `spec-only` 유지(무변경).

> 잔여 배치: B1(`5-system` 10) · B2(`4-nodes` 35) · B3(`3-workflow-editor` 5) · B4(`2-navigation` 14). 8/21 deadline 전 완료 필요.

## 권고 후속 흐름

1. B0·B5 완료. 잔여: B1 → B2 → B3 → B4 순으로 배치 PR (B6 `7-channel-web-chat` 는 이미 partial 전이됨).
2. 각 배치는 project-planner 가 `/spec-coverage` 로 1차 분류 후 수동 확정 → frontmatter 적용 → `/consistency-check --spec`.
3. 8/21 deadline 전 완료. `backlog` 격하는 `0-overview §6.3` 로드맵 매칭이 실제 가능한 spec 에만 적용 (가드 (d) — 임의 보류 금지, spec-impl-evidence R-2·R-3). 그 외 미완 spec 은 `spec-only` 유지 또는 `partial`(+pending_plan).

## 영향받지 않는 영역

- 코드 변경 없음 (frontmatter + spec 본문 문구 정정만). build-guard 는 frontend vitest.
- `implemented`(6)·`partial`(2) 기존 spec 은 대상 외.

## 다음 세션 인계 메모 (2026-05-31 조사 — 분류 미착수, 사실 확정만)

> 본 세션은 trigger-drawer 작업에 이어진 장기 세션 + 도구 I/O 글리치로, 사용자 결정에 따라
> **분류는 새 세션에서 재시작**한다. 아래는 다음 세션이 그대로 신뢰해도 되는 확정 사실이다.
> worktree: `spec-frontmatter-status-migration-d97565` (branch `claude/spec-frontmatter-status-migration-d97565`).

- **현 status 분포 실측 (5/31)**: `spec-only` 94 · `implemented` 9 · `partial` 12 (plan 작성 5/29 의 96/6/2 에서 변동 — 그동안 타 작업이 일부 전이). deadline 2026-08-21 불변.
- **배치별 spec-only 실측 (94)**: B1 `5-system` 10 · B2 `4-nodes` 35 · B3 `3-workflow-editor` 5 · B4 `2-navigation` 14 · B5 `conventions` 30 (cafe24-api-catalog 18 + cafe24-api-metadata + cafe24-restricted-scopes + 일반 conventions 10).
- **가드 적용 대상 scope 확정** (`spec-frontmatter-parse.ts isApplicable`): `spec/{2-navigation,3-workflow-editor,4-nodes,5-system,conventions}/**.md` 중 **basename `_*` 제외** + `{0-overview,1-data-model,6-brand}.md` 제외. → 위 94개는 전부 정당한 대상 (밑줄 basename 없음). `providers/telegram.md` 는 대상 포함.
- **cafe24-api-catalog 주의 (오판 함정)**: 카탈로그 파일은 본문 표의 row 별 `status`(`supported`/`planned`/`deprecated`)를 갖는데 이는 **frontmatter `status` 와 별 도메인** (`_overview.md §3` 명시). 가드는 frontmatter 만 본다. 18개 카탈로그는 외부 API enumeration 레퍼런스 — `code:` 후보는 `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` (catalog-sync.spec.ts 가 양방향 동기). `supported` row 가 1개라도 있으면 메타데이터 구현이 존재 → frontmatter `implemented` 후보. row 전부 `planned` 면 `backlog`/`spec-only` 후보. **일괄 아님 — 파일별 supported 유무 확인 필요.**
- **분류 절차 (배치당)**: `/spec-coverage` 1차(NLP) → 본문 surface 수동 확정 → frontmatter(`status`+`code:` glob, partial 시 `pending_plans:` 실존 plan) 적용 → `/consistency-check --spec` (BLOCK:YES 차단) → 4 가드 vitest (`codebase/frontend/src/lib/docs/__tests__/spec-{frontmatter,code-paths,status-lifecycle,pending-plan-existence}.test.ts`) → 배치별 PR (`docs(spec): ...`).
- **partial 의 pending_plans**: `plan/in-progress/` 실존 필수. 가드 (c) — pending_plans 가 전부 complete 면 implemented 로 승격 의무. 현 in-progress plan 목록은 세션 조사 시점 기준 29개 + `node-output-redesign/` 하위 다수.
- **B5 frontmatter 현황**: cafe24 카탈로그 18 + cafe24-api-metadata + cafe24-restricted-scopes + conventions 10(conversation-thread, data-hydration-surfaces, i18n-userguide, interaction-type-registry, migrations, node-output, secret-store, swagger, user-guide-evidence + ...) 모두 `status: spec-only, code: []`. `spec-impl-evidence.md` 만 이미 `implemented`.
- 권고 시작 배치: **B5 (cafe24 우선)**. plan 끝부분(L66~72)에 권고 후속 흐름 줄이 일부 중복돼 있으니 다음 세션에서 정리 가능.
