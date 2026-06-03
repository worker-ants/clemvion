---
id: spec-impl-evidence
status: implemented
code:
  - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts
  - codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts
---

# Convention: Spec-Impl Evidence (frontmatter)

> 관련 문서: [PROJECT.md §변경 유형 갱신 매핑](../../PROJECT.md#변경-유형--갱신-위치-매핑) · [user-guide-evidence](./user-guide-evidence.md) · [plan-lifecycle](../../.claude/docs/plan-lifecycle.md)
>
> SoT 역할: spec 문서가 약속한 surface 와 실제 구현 코드 사이의 정적 증거 (evidence) 를 frontmatter 로 명시·검증한다. 본 컨벤션은 텔레그램 chat-channel UI 영구 누락 사례와 같은 *spec 약속 vs 구현 부재* 갭을 build-time 가드로 차단하는 단일 진실 (single source of truth) 이다.

---

## Overview (제품 정의)

기존 harness 는 모두 **change-triggered**:
- `/consistency-check` — spec draft / impl-prep 시점만
- `/ai-review` — PR diff 안만
- `user-guide-sync-reviewer` — code → guide 단방향
- `nodes-coverage` / `hydration-coverage` 등 build-time 가드 — 등록부 enumeration 만

→ "spec 가 약속한 surface 가 *지금* 구현됐는가" 는 어떤 검사도 묻지 않음. 본 컨벤션은 spec 파일 frontmatter 에 `status` + `code:` + `pending_plans:` 를 의무화하고, 4개 build-time 가드로 정합성을 강제해 이 갭을 닫는다.

## 1. 적용 대상

다음 경로의 spec 파일에 frontmatter 의무 (대상 = inclusive list):

- `spec/2-navigation/**.md`
- `spec/3-workflow-editor/**.md`
- `spec/4-nodes/**.md`
- `spec/5-system/**.md`
- `spec/7-channel-web-chat/**.md`
- `spec/conventions/**.md`

**제외**:
- `spec/0-overview.md` (cross-cutting 진입 문서)
- `spec/1-data-model.md` · `spec/6-brand.md` (단순 overview 성격)
- `spec/_*.md` 및 `spec/<영역>/_*.md` (밑줄 prefix — leaf 가 아닌 layout/index 성격, 예: `_layout.md`, `_product-overview.md`, `_overview.md`)
- `spec/conventions/<name>-api-catalog/<resource>/**/*.md` (= 카탈로그 디렉토리 뒤에 경로 세그먼트가 **하나 이상** 있는 모든 `.md` — `<resource>/` 1단계든 그 아래 더 깊은 중첩이든 전부 제외) — API 레퍼런스 카탈로그의 **필드 단위 파일**. 생성기 산출물, frontmatter 가 `resource`/`entity`/`cafe24_docs`/`source` 인 lifecycle 비추적 레퍼런스다. 반면 카탈로그 최상위 `<name>-api-catalog/<resource>.md` 인덱스(세그먼트 0개)는 `id`/`status` 보유한 정식 spec 이므로 **검증 유지** (근거 §Rationale R-7).

## 2. Frontmatter 스키마

```yaml
---
id: chat-channel                          # kebab-case. 파일 basename 기반 권장
status: implemented                        # 5 값 중 하나
code:                                      # status 에 따라 검증 다름
  - codebase/backend/src/modules/chat-channel/**
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/app/(main)/triggers/page.tsx
pending_plans:                             # status: partial 일 때 의무
  - plan/in-progress/<name>.md
user_guide:                                # 선택. 가이드 페이지 cross-link
  - codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx
---
```

### 2.1 필드 정의

| 필드 | 타입 | 의무 | 의미 |
|---|---|---|---|
| `id` | string (kebab-case) | ✓ | spec 식별자. 파일 basename(확장자 제외) 기반 권장 |
| `status` | enum (5 값) | ✓ | §3 라이프사이클 참조 |
| `code` | string[] (glob 허용) | status 별 다름 — §3 | 본 spec 이 약속한 surface 의 구현 경로. 레포 루트 기준 상대경로 |
| `pending_plans` | string[] (path) | `status: partial` 시 ✓ | 미구현 surface 를 책임지는 plan 경로. `plan/in-progress/` 또는 `plan/complete/`(in-progress 경로를 complete 로 치환) 에 실존 의무 — §4 가드 참조 |
| `user_guide` | string[] (path) | 선택 | 본 spec 의 가이드 페이지 cross-link |

### 2.2 의미 도메인 구분 (혼동 방지)

- `code:` 키 — user-guide MDX frontmatter 의 동명 `code:` 와 의미는 같으나, 대상 문서가 `.md` (spec) vs `.mdx` (가이드) 로 구별됨. 두 가드(`spec-code-paths.test.ts` vs `registry.test.ts`)는 각각 자기 도메인만 검증.
- `status:` 키 — `spec/1-data-model.md` 의 엔티티 `status` 컬럼 (Integration / Execution 등) 과는 레이어가 다름. spec frontmatter 가드는 entity 컬럼을 건드리지 않음.
- `archived` (§3) — `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` (Cafe24 endpoint 폐기 상태) 와 의미 도메인이 다름. 본 컨벤션의 `archived` 는 spec 문서 자체의 폐기, cafe24 `deprecated` 는 외부 API endpoint 상태.

## 3. `status` 라이프사이클

| 값 | 의미 | `code:` 검증 | `pending_plans:` | TTL / 가드 |
|---|---|---|---|---|
| `backlog` | 장기 로드맵. 아직 구현 의도가 결정 안 됨 | 비어도 OK | 선택 | TTL 없음. `id:` 가 `spec/0-overview.md` 본문 텍스트에 등장 의무 (가드 — §6.3 로드맵 항목에 등재 권장) |
| `spec-only` | 작성됐고 구현 의도 결정됨 | 비어도 OK | 권장 | **TTL 90일** — 초과 시 build fail (PR 강제 또는 `backlog` 격하) |
| `partial` | 일부 구현됨 | ≥1 매치 의무 | **의무** | 모든 `pending_plans` 가 `complete/` 로 이동하면 `implemented` 로 승격 의무 (가드) |
| `implemented` | 모든 약속 구현 완료 | ≥1 매치 의무 | 없음 | — |
| `archived` | 폐기된 spec | 비어도 OK | 없음 | 본문 끝에 폐기 사유. 마지막 commit 후 90일 → 파일 삭제 권장 INFO |

### 3.1 전이 규칙

- `backlog` → `spec-only`: 구현 plan 작성 시점에 승격
- `spec-only` → `partial`: 최초 코드 머지 시점에 승격
- `partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)
- `*` → `archived`: spec 결정 폐기 시 즉시 (Rationale 본문에 사유 추가)

## 4. Build-time 가드 (5건, 모두 build 차단)

본 컨벤션의 정합성은 다음 5개 단위 테스트가 강제(빌드 실패 = 차단). 모두 `codebase/frontend/src/lib/docs/__tests__/` 또는 별도 frontend test 영역에 위치. (§4.0 의 인접 가드·Gate D 는 이 5건 카운트에 포함되지 않는다 — 별개 항목.)

| 가드 | 검증 |
|---|---|
| `spec-frontmatter.test.ts` | §1 대상 모든 spec 에 frontmatter 존재 + §2.1 의 의무 필드 (id/status) 유효 |
| `spec-code-paths.test.ts` | `status ∈ {partial, implemented}` 인 spec 의 `code:` 글로브가 ≥1 파일 매치 |
| `spec-status-lifecycle.test.ts` | (a) `spec-only` TTL 90일 초과 (b) `partial` 의 `pending_plans:` 미작성 (c) `partial` 의 `pending_plans` 모두 complete 인데 status 미승격 (d) `backlog` 의 `id:` 가 `0-overview.md` 본문 텍스트에 미등장 (overview 부재 시 warn-only) |
| `spec-pending-plan-existence.test.ts` | `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존 |
| `spec-plan-completion.test.ts` (**Gate C**) | `started ≥ 2026-06-04` 인 완료 plan 은 frontmatter `spec_impact` 선언 필수 (spec path 목록은 실존, 또는 `none`/`없음`). spec↔코드 정합 결정을 완료 시점에 강제. grandfather: cutoff 이전 시작 plan 면제 |

### 4.0 인접 지식저장소 가드 (위 5건과 별개, 별도 SoT)

본 frontmatter-evidence 가드(§4 의 5건) 외에, 지식저장소 무결성을 함께 지키는 **추가** 가드 — SoT 는 [`plan/in-progress/knowledge-base-quality-improvements.md`](../../plan/in-progress/knowledge-base-quality-improvements.md):

- `spec-link-integrity.test.ts` (build 차단) — spec 본문 in-repo 링크/heading 앵커 실존
- `spec-area-index.test.ts` (build 차단) — 영역 폴더 index 가 모든 sibling spec 링크
- `plan-frontmatter.test.ts` (build 차단) — top-level in-progress plan 의 worktree/started/owner ([plan-lifecycle §4](../../.claude/docs/plan-lifecycle.md))
- **Gate D** (**advisory — build 차단 아님**): `/spec-coverage --mode reverse` — spec 미참조 controller route·이벤트·env 탐지 (impl→spec 역커버리지). NLP 휴리스틱이라 보고형

### 4.1 가드와 다른 가드의 관계

- `registry.test.ts` (user-guide MDX 의 `spec:`/`code:` 경로 실존) 와 본 가드는 **대상 문서 종류** 로 분리 — 본 가드는 `spec/**.md` 만, `registry.test.ts` 는 `codebase/frontend/src/content/docs/**.mdx` 만.
- `nodes-coverage.test.ts` (backend 노드 → 가이드 본문 등장) 와는 **방향이 직교** — `nodes-coverage` 는 노드 enumeration → 가이드, 본 가드는 spec 약속 → 구현 코드.

## 5. 사용 예시

### 5.1 신규 spec 작성 시

```yaml
---
id: voice-trigger
status: spec-only
code: []
---
```

→ 90일 안에 구현 plan 작성 + `pending_plans:` 등록 의무. 그 사이 `code:` 가 비어 있어도 가드 통과.

### 5.2 부분 구현 머지 시

```yaml
---
id: chat-channel
status: partial
code:
  - codebase/backend/src/modules/chat-channel/**
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
pending_plans:
  - plan/in-progress/<name>.md
---
```

→ backend + 일부 frontend 구현 완료, visual SSR 후속 plan 남음. `pending_plans` 실존 + `code:` ≥1 매치 가드 통과.

### 5.3 완성 머지 시

```yaml
---
id: chat-channel
status: implemented
code:
  - codebase/backend/src/modules/chat-channel/**
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/app/(main)/triggers/page.tsx
user_guide:
  - codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx
---
```

→ 모든 약속 구현 완료. `pending_plans` 비움 (또는 제거). 모든 가드 통과.

## 6. Rollout 정책

본 컨벤션의 일괄 적용 절차:

1. §1 대상 spec 60여개 일괄 frontmatter 추가 (한 PR 안에)
2. 초기 `status` 분류:
   - 기존 머지된 PR 로 구현 완료된 spec → `implemented` + `code:` 채움
   - `spec/0-overview.md §6.3` 로드맵 매칭 → `backlog`
   - 부분 구현 + 후속 plan 존재 → `partial` + `pending_plans:` 채움
   - 그 외 → `spec-only`
3. 4개 가드 테스트 동반 작성
4. PROJECT.md §자동 가드 표에 4개 row 추가

## Rationale

### R-1. `code:` 글로브 허용 vs 명시 파일만

글로브 허용을 채택. 영역 단위 책임 (예: `codebase/backend/src/modules/chat-channel/**`) 을 자연스럽게 표현하고 마이그레이션 부담을 낮춤. **단점**: stale 글로브 (없어진 파일을 가리키는 glob 이 다른 파일에 매칭돼서 통과) 는 본 가드만으로 검출 불가. 이 약점은 `/spec-coverage` standing audit 가 보완 — NLP 휴리스틱으로 spec 본문이 약속한 UI/API surface 와 매칭되는 코드 부재를 감지.

### R-2. `spec-only` TTL 90일 + `backlog` enum

`spec-only` TTL 은 90일, `backlog` enum 신설로 이중 안전망:
- 30일 같은 짧은 TTL 은 backlog 항목까지 강제 분류해 false-pressure 유발
- 90일은 spec 작성 후 분기 1회 단위로 검토 — Phase 분리 결정 사이클과 정합
- backlog 는 `id:` 의 `0-overview.md` 본문 등장을 가드로 강제해 "임의 보류" 차단 (로드맵 §6.3 등재 권장 — 가드 매칭 세부는 R-3)

### R-3. `backlog` enum 신설 근거

`spec/0-overview.md §6.3 로드맵` 항목 (Marketplace, 고급 권한 모델 등) 은 *결정 후 spec 작성됐으나 구현 plan 은 분기/연 단위 후* 인 자연스러운 상태. `spec-only` (90일 카운터) 와 강제 분리해 카운터 압력에서 보호. **가드**: `backlog` 의 `id:` 가 `0-overview.md` 본문 텍스트에 `includes` 매칭 의무 (현 구현은 §6.3 절 한정이 아닌 문서 전체 텍스트 검사 — 로드맵 항목에 등재하는 것을 권장). 향후 §6.3 절 단위 검증으로 좁히려면 가드 갱신 필요.

### R-4. `archived` 명명 근거 (cafe24 deprecated 와의 구분)

`archived` 로 명명해 `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` (Cafe24 endpoint 폐기 상태) 와 의미 도메인을 명확히 분리:
- 본 컨벤션 `archived` = spec 문서 자체의 폐기
- cafe24 `deprecated` = 외부 API endpoint 의 폐기 (별 도메인)

### R-5. `status: partial` 의 `pending_plans:` 의무화 — plan 라이프사이클 역방향 강제

기존 plan-lifecycle 은 plan 이 spec 을 가리키는 단방향 (plan frontmatter `worktree`, plan 본문이 spec 참조). 본 컨벤션은 *역방향* — spec 이 자기를 책임지는 plan 을 가리킴 (`pending_plans:`).

근거: 텔레그램 chat-channel 케이스에서 spec 가 plan 을 가리키지 않아 "어떤 plan 도 책임지지 않는 빈 약속" 으로 영구 누락. 역방향 링크가 있었으면 plan 추적이 자연스럽게 발견했을 것. 가드 (`spec-pending-plan-existence.test.ts`) 가 spec → plan 링크 유효성 강제.

### R-6. `code:` 의미 도메인 (spec frontmatter vs user-guide MDX)

두 곳 모두 `code:` 키를 가짐. 의미는 비슷하나 검증 가드가 분리됨:
- user-guide MDX `code:` → `registry.test.ts` — 가이드가 *설명하는* 코드 (참조용)
- spec `.md` `code:` → `spec-code-paths.test.ts` — spec 이 *약속한* 구현 surface (책임용)

두 가드가 같은 키를 검증하지만 대상 문서 (`*.mdx` vs `*.md`) 가 다르고, 검증 강도도 다름 (user-guide 는 stale 허용, spec 은 `implemented/partial` 시 매치 의무). 통합 안 함 — 같은 이름이지만 다른 invariant.

### R-7. API 레퍼런스 카탈로그 필드 파일 제외 (`<name>-api-catalog/<resource>/**`)

`spec/conventions/cafe24-api-catalog/<resource>/<entity>.md` 같은 필드 단위 카탈로그는 외부 API 문서를 기계 추출한 **생성기 산출물**(`_overview.md` 의 `_generator.py`)로, frontmatter 가 `resource`/`entity`/`cafe24_docs`/`source` 다 — 제품 surface 의 구현 lifecycle (`backlog`→`implemented`) 을 추적하는 정식 spec 이 아니다. 따라서 `id`/`status` 를 부여하는 것은 (a) 의미상 부적절(추적할 구현 lifecycle 이 없음)하고 (b) 생성기가 매 재생성마다 수백 개 파일에 무의미한 메타를 찍어야 해 유지보수 부담이다.

반면 카탈로그 **최상위 `<resource>.md` 인덱스**(`application.md` 등 18개)는 해당 리소스군의 metadata 구현(`code:`)을 약속하는 정식 spec 이라 `id`+`status: implemented` 를 보유하고 검증을 유지한다. 그래서 제외는 카탈로그 디렉토리 *뒤에 path segment 가 하나 더 있는* 중첩 경로(`<name>-api-catalog/<resource>/…`)로 한정한다 — `_*.md`(밑줄 prefix, leaf 아님) 제외와는 다른 논리(생성물 vs layout/index)이므로 별 항으로 둔다. 가드 구현은 `spec-frontmatter-parse.ts` 의 `CATALOG_FIELD_FILE` 정규식이 §1 제외와 동기화한다.
