# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 변경 set 요약

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재해 검토. 변경 파일은 `git diff --name-only 71ce6c12b HEAD` (=`git merge-base HEAD origin/main` 결과와 동일) 로 23개 확인 — orchestrator 가 전달한 목록과 일치:

- `codebase/backend/src/modules/workflows/workflows.controller.ts` (swagger description 갱신)
- `codebase/backend/src/modules/workflows/workflows.service.ts` (`duplicate()` 재구현)
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`, `codebase/backend/test/workflow-crud.e2e-spec.ts` (테스트)
- `plan/in-progress/workflow-duplicate-nodes-edges.md` (신규 plan)
- `review/consistency/2026/07/30/{16_45_59,17_03_26}/**` (본 작업의 consistency-check 산출물 14개 — 매트릭스 target 아님, 검토 대상 아님)
- `spec/2-navigation/1-workflow-list.md`, `spec/data-flow/11-workflow.md` (내부 spec)

frontend(`codebase/frontend/**`) 파일은 **하나도 포함되지 않음** — TSX/dict/docs MDX/locale.ts 전부 무변경.

## 매트릭스 매칭

| trigger 행 | 매칭 근거 | 판정 |
|---|---|---|
| `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) | 무매칭 — 변경 파일은 `src/modules/workflows/**`, `src/nodes/**` 아님 | 해당 없음 |
| `new-ui-string` (`*.tsx`) | 무매칭 — TSX 변경 없음 | 해당 없음 |
| `new-userguide-section-dir` (`content/docs/*/`) | 무매칭 — docs 디렉토리 변경 없음 | 해당 없음 |
| `integration-provider-change` | 무매칭 — provider 관련 변경 없음 | 해당 없음 |
| **`backend-api-change`** (`src/**/*.controller.ts`, semantic) | **매칭** — `workflows.controller.ts` 의 `POST :id/duplicate` `@ApiOperation.description` 변경 | 부분 충족 — 아래 발견사항 참조 |
| `auth-session-flow-change` (`src/modules/auth/**`) | 무매칭 | 해당 없음 |
| `expression-language-change` (`packages/expression-engine/**`) | 무매칭 | 해당 없음 |
| `run-debug-flow-change` (semantic) | 무매칭 — CRUD 복제이지 실행/디버깅 흐름 아님 | 해당 없음 |
| `new-warning-code` / `new-error-code` | 무매칭 — 신규 코드 없음 | 해당 없음 |
| **`spec-major-change`** (`spec/2-*/**` 등) | **매칭** — `spec/2-navigation/1-workflow-list.md` | 충족 (아래 근거) |
| `userguide-gui-flow-section` (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) | 무매칭 | 해당 없음 |

`spec/data-flow/11-workflow.md` 는 `spec-major-change` 의 glob(`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) 어디에도 속하지 않는다 — data-flow 문서는 frontmatter-evidence 컨벤션의 명시적 제외 대상(동일 판단이 이 changeset 의 `convention_compliance.md` 산출물에도 기록돼 있음)이라 정상.

### `spec-major-change` 충족 확인

`spec/2-navigation/1-workflow-list.md` frontmatter: `status: partial` + `pending_plans:` 에 `plan/in-progress/workflow-duplicate-nodes-edges.md` 가 이미 등재돼 있고(동일 changeset diff), `code:` 글로브에 `codebase/backend/src/modules/workflows/workflows.service.ts` 가 이미 포함(변경 불요). §2.6 더보기 메뉴 표 + §3 API 표 duplicate 행 본문도 새 동작(캔버스 전체 복제 · 버전 이력/트리거/데이터셋 비승계)을 정확히 반영하도록 갱신됨 — 갭 없음.

### `backend-api-change` target (a) 충족, (b) 갭

- target (a) "controller·DTO 의 swagger jsdoc" — 충족. `workflows.controller.ts` 의 `@ApiOperation.description` 이 "노드·엣지를 포함한 캔버스 전체를 한 트랜잭션으로 함께 복사" 로 갱신됨 (같은 changeset).
- target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — **미충족**. 아래 발견사항 참조.

## 발견사항

- **[WARNING]** `POST /workflows/:id/duplicate` 의 동작 변경(빈 워크플로우 생성 버그 → 캔버스 전체 복제 + 버전 이력/트리거/테스트 데이터셋 비승계)이 공개 user-guide MDX 에 반영되지 않음
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`@ApiOperation.description` 갱신, line 214-215 신규), `codebase/backend/src/modules/workflows/workflows.service.ts` (`duplicate()` 재구현)
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (PROJECT.md 표 130행 원문)
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/01-getting-started/ui-tour.mdx` + `.en.mdx` (line 97/86 "더보기(⋮): 편집, 복제, 내보내기(JSON), 삭제 등을 선택해요." — 복제가 정확히 무엇을 복사하는지 언급 없음). 필요하면 `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx`(+`.en.mdx`) 의 내보내기/버전 절 인근도 후보.
  - 상세: 내부 spec(`spec/2-navigation/1-workflow-list.md` §2.6, `spec/data-flow/11-workflow.md` §1.5)은 이번 changeset 안에서 정확하고 상세하게 갱신됐다 — "노드·엣지 포함 캔버스 전체 복사, 버전 이력·트리거(webhook/schedule)·테스트 데이터셋은 승계하지 않는다" 까지 명문화. 그러나 이 내용은 `spec/` 내부 문서이며 최종 사용자가 열람하는 문서가 아니다(CLAUDE.md/PROJECT.md 상 `spec/` 경로는 사용자 가이드 본문에 노출 금지 대상). 실제 사용자가 읽는 `codebase/frontend/src/content/docs/01-getting-started/ui-tour.mdx` 는 여전히 "복제"를 나열형 액션으로만 언급하고 범위를 설명하지 않는다. 이 changeset 이 고치는 버그가 이전에는 "복제 = 완전히 빈 워크플로우"였던 만큼 사용자가 체감하는 변화가 크고, 특히 **webhook/schedule 트리거와 버전 이력이 복제되지 않는다**는 점은 "캔버스는 전부 복사되는데 왜 트리거는 안 남지?" 라는 혼란을 낳을 수 있는 비대칭 동작이다. `plan/in-progress/workflow-duplicate-nodes-edges.md` 의 구현 체크리스트에도 사용자 가이드 MDX 갱신 항목이 없다(`spec_impact:` 도 `spec/` 2건만 선언, docs MDX 없음).
  - 제안: `ui-tour.mdx`/`.en.mdx` 의 더보기 메뉴 설명에 "복제는 노드·연결선을 포함한 캔버스 전체를 복사하지만, 버전 기록과 트리거(웹훅/스케줄) 설정은 새로 시작해요" 수준의 한 줄을 추가. CRITICAL 이 아닌 이유: 이 target 행은 자동 가드(`verify: null`, `guard_tests: []`)가 없는 수동 검토 항목이라 빌드를 깨지 않고, 기존 문구가 새 동작과 명시적으로 모순되지도 않는다(범위를 아예 언급하지 않았을 뿐).

- **[INFO]** `spec/data-flow/11-workflow.md` Rationale 신설분(§"duplicate 는 캔버스 전체를 복제한다" 등)이 매트릭스 어떤 행에도 직접 걸리지 않음 — data-flow 문서는 `spec-major-change` glob 밖(frontmatter-evidence 명시적 제외 대상)이라 정상이며, 별도 조치 불요. 참고용으로만 기록.

## 요약

매트릭스 20개 trigger 행 중 이번 changeset 은 `backend-api-change`(semantic, `*.controller.ts`)와 `spec-major-change`(glob, `spec/2-*/**`) 2개에 매칭됐다. `spec-major-change` 는 frontmatter(`pending_plans:`/`code:`)·본문 표 갱신 모두 같은 changeset 안에서 충족돼 갭 없음. `backend-api-change` 는 target (a) swagger jsdoc 은 충족했으나 target (b) 공개 user-guide MDX(`ui-tour.mdx`)가 새로 정의된 복제 범위(캔버스 전체 복사 vs 버전/트리거/데이터셋 비승계)를 반영하지 않아 WARNING 1건. 새 노드·UI 문자열·신규 섹션·통합·인증·표현식·warning/error 코드 관련 trigger 는 전부 무매칭(frontend 파일이 changeset 에 전혀 없음) — CRITICAL 은 없음.

## 위험도

LOW
