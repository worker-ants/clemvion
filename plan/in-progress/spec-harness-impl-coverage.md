---
worktree: harness-spec-impl-coverage-befc2f
started: 2026-05-23
owner: planner
---

> **Consistency-check 결과 (2026-05-23 17:01)**: 1차에서 plan frontmatter 스키마 위반 1건 (BLOCK) → 본 frontmatter 정정 + WARNING/INFO 모두 본문 반영. 2차에서 Plan Coherence CRITICAL 4건 (메타 파일 동시 수정 worktree 충돌) 검출됐으나, 지목된 4개 worktree 모두 이미 머지 완료 (PR #209/#286/#211 MERGED + 1건 본 PR 자기 자신) — stale worktree false-positive. 본 worktree 가 c619c62b (PR #283 머지 직후) 기반이라 실제 main 충돌 0. 따라서 BLOCK 실효 해소.

# Harness 갭 보강 — spec-impl coverage standing audit

## 배경

2026-05-23 텔레그램 통합 검토에서 다음 갭이 드러남:
- spec `spec/5-system/15-chat-channel.md` 가 chat channel UI 약속
- backend Phase 1·2 구현 완료 (`codebase/backend/src/modules/chat-channel/**`)
- user-guide `06-integrations-and-config/telegram.mdx` 가 GUI 흐름 약속
- **frontend trigger UI 0% — `config.chatChannel` 입력 경로 부재 (영구 누락)**

사용자가 수동 검증으로 발견. 머지된 ~5개월간 어떤 검사도 차단 안 함.

### 구조적 원인

기존 harness 는 모두 **change-triggered** (PR diff / draft / 신규 코드 변경 기반). "spec 약속 vs 구현 부재" 같은 *정적 갭* 을 잡는 standing audit 부재.

| 메커니즘 | 트리거 | 텔레그램 갭 미검출 이유 |
|---|---|---|
| `/consistency-check` 5 checker | spec draft / impl-prep | draft 없으면 작동 안 함 |
| `/ai-review` 14 reviewer (`requirement-reviewer` 포함) | PR diff | diff 밖 spec 약속은 검사 안 함 |
| `user-guide-sync-reviewer` | code → guide 단방향 | 역방향 미커버 |
| `plan-coherence-checker` | draft vs in-progress plan | "spec §X 책임 plan 존재" 미검사 |
| build-time 가드 (`nodes-coverage`, `hydration-coverage` 등) | 등록부 enumeration | 자유 형식 spec 약속 비대상 |

## 목표

spec 영역 약속과 구현 사이의 정적 갭을 검출하는 5개 메커니즘을 통합 컨벤션으로 정식화. 본 PR 은 *spec 정의* 만, 구현은 후속 plan 5건으로 분리.

## 변경안 (spec/conventions, PROJECT.md, CLAUDE.md, .claude/docs, SKILL.md 갱신)

### 결정 A — spec 파일 frontmatter (`code:` / `status:` / `pending_plans:`)

신규 `spec/conventions/spec-impl-evidence.md`:

- 대상 spec 파일: `spec/{2-navigation,3-canvas,4-nodes,5-system}/**.md`, `spec/conventions/**.md` (단순 overview `spec/0-overview.md`·`spec/6-brand.md`·`spec/_*` 제외)
- frontmatter 스키마 (YAML, user-guide mdx 와 동일 패턴):
  ```yaml
  ---
  id: chat-channel                          # kebab-case, 파일 basename 기반
  status: implemented                        # backlog | spec-only | partial | implemented | archived
  code:                                      # 글로브 패턴 허용. status 별 검증 다름
    - codebase/backend/src/modules/chat-channel/**
    - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
    - codebase/frontend/src/app/(main)/triggers/page.tsx
  pending_plans:                             # status: partial 일 때 의무. plan/in-progress/ 에 실존
    - plan/in-progress/chat-channel-visual-ssr-png.md
  user_guide:                                # 선택. 가이드 페이지 cross-link
    - codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx
  ---
  ```
- `status` enum **5 값** (수정안 — `backlog` 추가, `deprecated` → `archived` 개명):
  - **`backlog`**: 장기 로드맵 항목. `code:` 비어도 OK. TTL 없음. `spec/0-overview.md §6.3 로드맵` 항목 매칭 의무 (가드)
  - **`spec-only`**: 작성됐고 구현 의도가 결정됨. `pending_plans:` 권장. TTL **90일** 이상 지속 시 build fail (PR 강제 또는 `backlog` 로 격하)
  - **`partial`**: 일부 구현됨. `pending_plans:` **의무**. 모든 `pending_plans` 가 `complete/` 로 이동하면 `implemented` 로 승격해야 함 (가드)
  - **`implemented`**: 모든 약속 구현 완료. `code:` 글로브 ≥1 매치 의무
  - **`archived`**: 폐기된 spec. 본문 끝에 폐기 사유 + 마지막 commit 후 90일 지나면 파일 삭제 권장 INFO. **명명 근거**: `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` (Cafe24 endpoint 제거 상태) 와 의미 도메인이 달라 혼동 방지 (naming_collision W-6 반영)

- build-time 가드 신설 (구현은 후속 plan 2):
  - `spec-frontmatter.test.ts` — 모든 대상 spec 에 frontmatter 존재 + 스키마 (id/status/code) 유효
  - `spec-code-paths.test.ts` — `code:` 글로브가 ≥1 파일 매치 (`implemented`/`partial` 한정. `backlog`/`spec-only` 면제)
  - `spec-status-lifecycle.test.ts` — `spec-only` 90일 / `partial` 의 pending_plans 실존 / pending_plans 모두 complete 인데 status 미승격 / `backlog` 의 로드맵 매칭 검출
  - `spec-pending-plan-existence.test.ts` — `pending_plans:` 의 모든 path 가 `plan/in-progress/` 에 실존

### 결정 B — user-guide reverse-evidence (`<ImplAnchor>` + 카테고리별 coverage)

신규 `spec/conventions/user-guide-evidence.md` **+ 강제력 확보를 위한 부수 갱신**:

- MDX 공용 컴포넌트 `<ImplAnchor>` 신설 (위치: `codebase/frontend/src/components/docs/impl-anchor.tsx`):
  ```mdx
  <ImplAnchor
    kind="ui-entry"
    file="codebase/frontend/src/app/(main)/triggers/page.tsx"
    symbol="chatChannelCheckbox"  // grep 대상. JSX prop, 변수명, 또는 data-testid
    describes="트리거 생성 dialog 의 Chat Channel 체크박스"
  />
  ```
- `kind` enum: `ui-entry` (라우트/페이지 진입점) · `component` (재사용 컴포넌트) · `api-endpoint` (controller route) · `e2e-scenario` (e2e spec)
- 렌더 시점: 일반 사용자 view 에서 hidden (`display: none`). build-time 가드만 사용. (옵션: dev mode `?dev=1` 노출은 후속 enhancement)
- 가드 신설 (`registry.test.ts` 와의 역할 분리 — `registry` 는 frontmatter `spec:`/`code:` 경로 실존 검증, 본 가드는 본문 안 `<ImplAnchor>` symbol grep 검증):
  - `impl-anchor-existence.test.ts` — 모든 `<ImplAnchor>` 의 `file` 실존 + `symbol` 이 file 안 grep ≥1 매치
  - `integrations-coverage.test.ts` — `06-integrations-and-config/<provider>.mdx` 의 "GUI flow" 절 (h2/h3 "GUI" 키워드 포함) 안에 `<ImplAnchor kind="ui-entry">` ≥1 의무
  - `triggers-coverage.test.ts` — `02-nodes/triggers.mdx` 의 provider 별 절도 동일

- **강제력 확보 (cross_spec W-2 반영)**:
  1. `spec/2-navigation/13-user-guide.md §공용 MDX 컴포넌트` 카탈로그에 `<ImplAnchor>` 항목 추가 (본 PR 안에)
  2. `PROJECT.md §유저 가이드 파일 컨벤션 > SoT 문서 인덱스` 5문서 목록에 `spec/conventions/user-guide-evidence.md` 추가 (결정 E 범위)
  3. `user-guide-writer` sub-agent 자가 검증 체크리스트에 "GUI 흐름 절에 `<ImplAnchor>` 동반" 항목 추가 (본 PR 안에 — `.claude/agents/user-guide-writer.md` 갱신)
  4. `spec/conventions/i18n-userguide.md §Principle 7` 의 "자동 결정 검출 불가" 주석을 본 가드 도입 반영해 갱신 (후속 plan 3 범위 — 본 PR 의 변경안에 명시만)

### 결정 C — plan stale audit + `/spec-coverage` standing audit

`.claude/docs/plan-lifecycle.md` 에 §audit 절 추가 (본 PR 의 변경 범위 — convention_compliance I-8 반영: 본 PR 안에서 사용자 승인된 변경으로 수행):

- 신규 도구 `.claude/tools/plan-stale-audit.sh` — bash 한 줄 호출 (구현은 후속 plan 4):
  - 30일 이상 갱신 없는 `plan/in-progress/*.md` 목록
  - 각 plan 의 checkbox 진행률 (예: `7/12 done`) + 마지막 commit 일자
  - 어느 spec 의 `pending_plans:` 에 등록됐는지 cross-link
  - **fail 안 함** — 정보 출력만. 사용자가 수동 grooming
- 신규 slash command `/spec-coverage` (구현은 후속 plan 5):
  - `.claude/skills/spec-coverage/SKILL.md` + `.claude/agents/spec-impl-coverage-auditor.md`
  - sub-agent 가 `spec/**` walk:
    1. spec 본문 UI 키워드 (page, dialog, card, button, drawer, modal) 등장 + frontmatter `code:` 에 frontend 경로 매칭 없음 → 후보
    2. spec API endpoint 명세 (`POST /api/...`) + backend controller route 매칭 없음 → 후보
    3. spec e2e 약속 시나리오 + e2e spec 파일 매칭 없음 → 후보
  - confidence (high/medium/low) 분류한 SUMMARY.md 산출
  - **산출 위치**: `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` (cross_spec W-1 반영 — 기존 `review/consistency/` 하위로 통합. 신규 최상위 경로 신설 회피. CLAUDE.md §정보 저장 위치 표 갱신은 결정 E 범위)
  - **CI 차단 아님** — NLP 휴리스틱 기반 false-positive 부담 > 검출 가치. 보고만 산출, 사용자가 picking (Rationale 는 신설 SKILL.md 의 §Rationale 절에 명시 — rationale_continuity I-3 반영)

### 결정 D — `developer/SKILL.md §4` + `PROJECT.md` 양쪽 partial-implementation discipline

**명확화 (cross_spec I-1 반영)**: 현재 사전 체크리스트는 `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 에 위치. `developer/SKILL.md §4` 본문에는 PROJECT.md 매트릭스 참조 한 줄만 있음. 따라서 본 결정은 **양쪽 모두 갱신**:

1. `.claude/skills/developer/SKILL.md §4` 본문에 한 줄 추가:
   > **partial-implementation 분리**: spec 의 일부만 구현하고 나머지 surface 가 남아있는 경우, 본 PR 머지 전 `plan/in-progress/<spec-name>-followup-<surface>.md` 신설 + 해당 spec frontmatter `status: partial` + `pending_plans:` 등록 의무. 자가 체크리스트는 `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 마지막 항목.

2. `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 에 신규 체크박스 한 줄:
   > [ ] 본 PR 이 구현하는 spec 섹션의 *나머지 surface* 가 있다면 (Phase 분리, 후속 UI, 미구현 enum 값) `plan/in-progress/<spec-name>-followup-<surface>.md` 가 신설/갱신됐는가? 본 spec 의 frontmatter `pending_plans:` 가 해당 plan 을 가리키는가? spec `status:` 가 `partial` 로 정확히 설정됐는가?

### 결정 E — PROJECT.md + CLAUDE.md 매트릭스·인덱스 갱신 (범위 확장)

cross_spec W-1·W-4 + 본 plan 권장 #3 반영:

**E-1. PROJECT.md §변경 유형 → 갱신 위치 매핑 표** 신규 row 2개:

| 변경 유형 | 필수 갱신 위치 | 검증 명령 |
|---|---|---|
| **spec 신규/대규모 변경** (`spec/{2,3,4,5}-**.md`, `spec/conventions/**.md`) | (a) frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신<br>(b) `status: partial` 이면 `pending_plans:` 의 plan 신설<br>(c) `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장 | `cd codebase/frontend && npm test -- spec-frontmatter spec-code-paths spec-pending-plan-existence` |
| **user-guide GUI 흐름 절 신규/변경** (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 의 GUI 안내 절) | `<ImplAnchor kind="ui-entry">` 동반 작성 — file/symbol 실존 의무 | `cd codebase/frontend && npm test -- impl-anchor-existence integrations-coverage triggers-coverage` |

**E-2. PROJECT.md §자주 누락되는 항목** 절에 신규 항목 2개 (사후 보정 패턴 차단):
- **spec frontmatter `code:` 글로브 stale** — backend 경로만 명시하고 frontend 경로 누락 (텔레그램 케이스 재현 차단)
- **`status: partial` 의 `pending_plans:` 미작성** — 미구현 surface 가 plan 추적에서 단절

**E-3. PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트** 신규 항목 (결정 D 와 짝):
- 위 결정 D-2 의 체크박스

**E-4. PROJECT.md §자동 가드 (build-time 차단) 표** 신규 row 7개:
- `spec-frontmatter.test.ts`
- `spec-code-paths.test.ts`
- `spec-status-lifecycle.test.ts`
- `spec-pending-plan-existence.test.ts`
- `impl-anchor-existence.test.ts`
- `integrations-coverage.test.ts`
- `triggers-coverage.test.ts`

**E-5. PROJECT.md §유저 가이드 파일 컨벤션 SoT 문서 인덱스** 갱신:
- 신규 row 2개: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/user-guide-evidence.md`

**E-6. CLAUDE.md §정보 저장 위치 표** 신규 row 1개:
| 저장할 내용 | 위치 |
| --- | --- |
| Spec-impl coverage standing audit 산출물 | `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (결정 C-2) |

권한: project-planner 가 `/spec-coverage` 호출 시 sub-agent 가 write. Skill 체계 표에 별 row 추가 없음 (consistency 와 동일 권한 도메인).

## 후속 구현 plan (별 PR 5건)

본 spec PR 머지 후 enumerate. 각 plan 은 별 worktree·별 PR. plan/in-progress/0-unimplemented-overview.md 인덱스에도 등록 (plan_coherence I-9 반영).

| 순서 | plan | 결정 | 의존 | 예상 규모 |
|---|---|---|---|---|
| 1 | `developer-partial-impl-discipline.md` | D | 없음 | XS (SKILL.md + PROJECT.md 사전 체크리스트) |
| 2 | `spec-frontmatter-rollout.md` | A | E 머지 후 (PROJECT.md 매트릭스 의존) | M (spec 파일 60여개 frontmatter 일괄 + 4 가드 테스트). 착수 전 `ai-presentation-tools.md` 의 conversation-thread.md 관련 항목 완료 확인 (plan_coherence I-11) |
| 3 | `user-guide-reverse-coverage.md` | B | 없음 | M (`<ImplAnchor>` 컴포넌트 + 3 가드 테스트 + 가이드 페이지 anchor 일괄 추가 + `i18n-userguide.md §Principle 7` 갱신) |
| 4 | `plan-stale-audit.md` | C-1 | 없음 | XS (bash 스크립트) |
| 5 | `spec-coverage-slash-command.md` | C-2 | A 머지 후 (frontmatter 의존) | L (skill + agent + slash command + `## Rationale` 절) |

병렬 가능: 1, 3, 4. 2, 5 는 E·A 의존.

## 검증 단계

1. **본 plan draft 작성 후** `/consistency-check --spec plan/in-progress/spec-harness-impl-coverage.md` 호출 (5 checker 검토)
2. **BLOCK: NO** 확인 후 spec/conventions/**.md + PROJECT.md + CLAUDE.md + `.claude/skills/developer/SKILL.md` + `.claude/docs/plan-lifecycle.md` + `.claude/agents/user-guide-writer.md` + `spec/2-navigation/13-user-guide.md` 본문 반영
3. **side-effect 점검** — 기존 컨벤션 (`i18n-userguide.md`, `interaction-type-registry.md`, `data-hydration-surfaces.md`) 과 충돌 없는지 cross-check. 완료된 `harness-i18n-userguide-gap.md` 가 SKILL.md/PROJECT.md 갱신 이력이 있어 (plan_coherence I-10) 중복·충돌 확인
4. commit: `docs(spec): harness — spec-impl coverage standing audit (A-E 5 결정)`

## 의식적 결정 포인트 (신설 spec 의 `## Rationale` 로 이전 — rationale_continuity I-3/I-4/I-5/I-6 반영)

각 항목은 **신설 spec 의 `## Rationale` 절에 본문으로 이전**, 본 plan 에는 참조만 유지:

- **(1)** spec frontmatter 의 `code:` 글로브 허용 vs 명시 파일만 → 글로브 허용. stale 글로브 약점은 결정 C 의 `/spec-coverage` 가 보완 (`spec-impl-evidence.md §Rationale`)
- **(2)** `spec-only` TTL 30→90일 완화 + `backlog` 신설 — 장기 로드맵 spec 의 즉시 fail 회피 (cross_spec W-3 + naming_collision W-1 종합 반영) (`spec-impl-evidence.md §Rationale`)
- **(3)** `<ImplAnchor>` hidden 렌더 — 가이드 본문 가독성 보호 (`user-guide-evidence.md §Rationale`)
- **(4)** `/spec-coverage` 가 CI 차단 아닌 보고형 — NLP 휴리스틱 false-positive 부담 > 검출 가치. i18n-userguide ratchet 패턴 선례 (`spec-coverage` SKILL.md `§Rationale`, 후속 plan 5 범위)
- **(5)** `registry.test.ts` (경로 실존) vs `impl-anchor-existence.test.ts` (symbol grep) 의 역할 분리 — 두 가드는 보완 관계 (`user-guide-evidence.md §Rationale`)
- **(6)** `status: partial` 의 `pending_plans:` 의무화는 plan-lifecycle 기존 흐름에 역방향 강제 추가 — spec → plan 단방향 추적이 실패한 텔레그램 케이스 (spec 가 plan 을 가리키지 않아 영구 누락) 차단 목적 (`spec-impl-evidence.md §Rationale`)
- **(7)** 통합 vs 분리 — 5개 결정이 서로 보완적 (A frontmatter, B reverse, C·D audit, E PROJECT.md). 단일 spec PR 안에서 일관된 invariant 로 묶어야 부분 도입의 갭 발생 안 함. 사용자 결정 확인됨 (옵션 4 채택)

## 산출물 위치

- 본 plan: `plan/in-progress/spec-harness-impl-coverage.md` (본 파일)
- consistency-check 결과: `review/consistency/2026/05/23/16_48_26/` (작성 완료)
- spec 신설: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/user-guide-evidence.md`
- spec 갱신: `spec/2-navigation/13-user-guide.md` (§공용 MDX 컴포넌트에 `<ImplAnchor>` 추가)
- 메타 갱신: `PROJECT.md` (매트릭스·자동 가드·SoT 인덱스·자주 누락·사전 체크리스트), `CLAUDE.md` (정보 저장 위치 표), `.claude/skills/developer/SKILL.md` (§4 한 줄), `.claude/docs/plan-lifecycle.md` (§audit 추가), `.claude/agents/user-guide-writer.md` (자가 검증 체크리스트)
- 후속 plan: `plan/in-progress/{developer-partial-impl-discipline, spec-frontmatter-rollout, user-guide-reverse-coverage, plan-stale-audit, spec-coverage-slash-command}.md` stub
- 인덱스 갱신: `plan/in-progress/0-unimplemented-overview.md` (본 plan + 후속 5건 등록)
