# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 컨텍스트 — 이 리뷰는 2차(fix 후) 라운드

`.claude/config/doc-sync-matrix.json`(21행, `rows[]`)+ `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을
적재해 검토. `git diff --name-only origin/main...HEAD` 로 39개 변경 파일을 확인 — prompt 번들(파일 1~39,
일부 diff 생략)과 일치.

본 changeset 은 1차 `/ai-review`(`review/code/2026/07/30/17_54_27/`)에서 이미 이 reviewer(`user_guide_sync`)가
WARNING 1건 — `backend-api-change` target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
미충족(`ui-tour.mdx`/`.en.mdx` 미갱신) — 을 낸 뒤, 같은 브랜치의 `RESOLUTION.md`(WARNING #7)가 그 WARNING 을
조치한 결과물까지 포함해 재검토하는 2차 라운드다. 즉 이번 라운드의 핵심 질문은 "1차 WARNING 이 실제로
닫혔는가 + 그 조치 자체나 다른 변경이 새로운 doc-sync 갭을 만들지 않았는가" 다.

## 매트릭스 매칭 (21행 전수)

| trigger 행 | 매칭 근거 | 판정 |
|---|---|---|
| `new-node`/`node-schema-change` (`src/nodes/**`) | 무매칭 | 해당 없음 |
| `new-ui-string` (`*.tsx`, semantic) | 무매칭 — changeset 에 TSX 파일 0개 | 해당 없음 |
| `new-widget-chrome-string` (`channel-web-chat/**/*.tsx`) | 무매칭 | 해당 없음 |
| `integration-provider-change` | 무매칭 | 해당 없음 |
| `new-userguide-section-dir` (`content/docs/*/`) | 무매칭 — 기존 `01-getting-started/` 안 파일 수정일 뿐, 신규 섹션 디렉토리 아님 | 해당 없음 |
| **`backend-api-change`** (`*.controller.ts`/`dto/**`, semantic) | **매칭** — `workflows.controller.ts` 의 `POST :id/duplicate` `@ApiOperation.description` 변경 | **충족 (아래 근거)** |
| `new-bullmq-queue` | 무매칭 | 해당 없음 |
| `new-warning-code`/`new-error-code` | 무매칭 — `error-codes.ts` 변경 없음, 신규 warningRule 없음 | 해당 없음 |
| `new-cross-cutting-enum`/`new-backend-ui-zod-value`/`new-handler-output-field` | 무매칭 | 해당 없음 |
| `auth-session-flow-change` (`src/modules/auth/**`) | 무매칭 | 해당 없음 |
| `auth-config-type-enum-change` | 무매칭 | 해당 없음 |
| `expression-language-change` (`packages/expression-engine/**`) | 무매칭 | 해당 없음 |
| `run-debug-flow-change` (semantic) | 무매칭 — CRUD 복제이지 실행/디버깅 흐름 아님 | 해당 없음 |
| `env-runtime-change` | 무매칭 | 해당 없음 |
| **`spec-major-change`** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) | **매칭** — `spec/2-navigation/1-workflow-list.md` | **충족** |
| `userguide-gui-flow-section` (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) | 무매칭 — `ui-tour.mdx` 는 `01-getting-started/`, 두 glob 어디에도 속하지 않음 | 해당 없음 |
| `spec-defect-found` | 해당 없음(spec 결함 미발견) | 해당 없음 |

`spec/data-flow/11-workflow.md` 는 `spec-major-change` glob(`spec/{2,3,4,5}-*/**`) 밖(data-flow 는
frontmatter-evidence 컨벤션의 명시적 제외 대상) — 갱신 의무 없음, 정상.

## `backend-api-change` 충족 확인 (1차 WARNING 해소 검증)

- **target (a) "controller·DTO 의 swagger jsdoc"**: 충족. `workflows.controller.ts:214-215` 의
  `@ApiOperation.description` 이 "노드·엣지를 포함한 캔버스 전체를 한 트랜잭션으로 함께 복사합니다"
  로 갱신됨(1차 커밋 `13b818ec5`부터 유지).
- **target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"**: **1차 라운드에서는
  미충족(WARNING) → 본 changeset 안에서 충족으로 전환됨.** 근거:
  - `git log --oneline -5`: `e66bbb9c1 docs(frontend): SUMMARY#7 ui-tour 가이드에 복제 범위 한 줄 보강 (KO/EN)`
    커밋이 이 브랜치(같은 PR)에 실존.
  - `codebase/frontend/src/content/docs/01-getting-started/ui-tour.mdx:97` — "더보기(⋮)" 항목에
    "복제는 노드·연결선을 포함한 캔버스 전체를 복사하지만, 버전 기록과 트리거(웹훅/스케줄) 설정은
    새로 시작해요" 추가 확인(diff 직접 대조).
  - `codebase/frontend/src/content/docs/01-getting-started/ui-tour.en.mdx:86` — 동일 의미의 영문
    "Duplicating copies the whole canvas, including nodes and connections, but version history and
    trigger (webhook/schedule) settings start fresh." 가 **같은 커밋**에 함께 추가됨 — ko/en parity 유지.
  - `RESOLUTION.md` (SUMMARY #7 항목) · `_resolution_log.md`(`note=ko_en_ui_tour_both_updated`) ·
    `_resolution_state.json`(`commits_made[6].scope="frontend/content/docs"`) 3곳 모두 일관되게 이
    조치를 기록 — 산출물 간 불일치 없음.
  - PROJECT.md §사후 보정 PR 패턴 금지 관점: 이 조치는 **별도 PR/turn 이 아니라 같은 브랜치·같은 diff**
    안에서 이뤄져 "같은 PR·같은 turn" 원칙에 부합한다(원 코드 커밋 `13b818ec5` → fix 커밋 `e66bbb9c1`
    모두 이 changeset 안).
  - 문구 정확도: 실제 새 동작(`duplicate()` 재구현 — 노드·엣지 UUID 재매핑 복사, `workflow_version`/
    `trigger`/`workflow_test_dataset` 비승계)과 추가된 안내 문구("캔버스 전체 복사" + "버전 기록과
    트리거 설정은 새로 시작")가 의미상 정확히 일치. 과장·누락 없음.

**결론**: target (a)(b) 모두 충족 — 1차 WARNING 은 해소됐다.

## `spec-major-change` 재확인

`spec/2-navigation/1-workflow-list.md` frontmatter(`status: partial`, `pending_plans:` 에
`plan/in-progress/workflow-duplicate-nodes-edges.md` 등재, `code:` 글로브에 `workflows.service.ts` 이미
포함) + 본문 §2.6/§3 표 갱신 — 1차 라운드(`review/consistency/2026/07/30/{16_45_59,17_03_26}`, 양쪽
BLOCK:NO)에서 이미 검증됐고 이번 diff 에서 추가로 되돌리거나 어긋난 부분 없음.

## 조치 자체(WARNING #1~#6, INFO #4/#5/#7)의 doc-sync 영향 재확인

`workflows.service.ts`(REPEATABLE READ 격리·cross-ref 주석), `workflows.service.spec.ts`/
`workflow-crud.e2e-spec.ts`(테스트 오염 수정·mutation fixture·e2e 헬퍼 추출)의 실제 diff 를 직접
대조한 결과, Node/Edge 필드 추가·라벨 변경·신규 error/warning 코드·신규 UI 문자열·신규 섹션 디렉토리
중 어느 것도 발생하지 않았다 — 기존 필드 재사용 + 주석/테스트 보강뿐이므로 이 조치들 자체가 새로운
matrix trigger 를 만들지 않는다. `CHANGELOG.md` 갱신(WARNING #6)은 matrix target 은 아니나(사용자 가이드
MDX 가 아님) 별도 "documentation" 리뷰어 관점의 요구사항이었고 정상 반영됨.

## 발견사항

- **[INFO]** (참고, 조치 불요) `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx`
  (+`.en.mdx`) — export/import 의 "실행 이력·버전 기록 미포함" 은 이미 설명하지만 workflow **duplicate**
  범위는 언급하지 않음. 1차 리뷰가 이미 이 페이지를 "필요하면 후보" 수준의 선택적 보강 지점으로만
  언급했고 SUMMARY 의 확정 WARNING 대상은 아니었다 — 실제로 이번 fix 도 이 페이지는 손대지 않았지만
  이는 애초에 필수 target 이 아니었으므로 새로운 누락이 아니다. 필수 target(`ui-tour.mdx`/`.en.mdx`)은
  이미 충족됨.

CRITICAL/WARNING 없음.

## 요약

매트릭스 21개 trigger 행 중 이번 전체 changeset(39개 파일)은 `backend-api-change`(semantic,
`*.controller.ts`)와 `spec-major-change`(glob, `spec/2-*/**`) 2개에 매칭됐다. 1차 `/ai-review` 라운드가
`backend-api-change` target (b)(공개 user-guide MDX 미갱신)를 WARNING 으로 지적했고, 같은 브랜치의
후속 커밋(`e66bbb9c1`, RESOLUTION SUMMARY #7)이 `ui-tour.mdx`+`.en.mdx` 양쪽에 실제 새 동작(캔버스 전체
복사, 버전/트리거 비승계)을 정확한 문구로 동시 반영해 갭을 닫았음을 diff·commit log·3개 resolution
산출물(RESOLUTION.md/_resolution_log.md/_resolution_state.json) 교차로 확인했다. `spec-major-change` 는
1·2차 consistency-check(BLOCK:NO)에서 이미 충족 확인됐고 이번 diff 로 되돌아간 부분 없음. WARNING #1~#6
fix 자체(트랜잭션 isolation·테스트 오염·mutation fixture·e2e 헬퍼)는 스키마/라벨/에러코드/UI 문자열
변경을 수반하지 않아 새 trigger 를 만들지 않는다. 새 노드·TSX 문자열·신규 섹션·통합·인증·표현식·
warning/error 코드 관련 trigger 는 전부 무매칭(frontend 코드 변경이 이 changeset 에 전혀 없고, mdx 는
docs-target 갱신으로만 등장). CRITICAL 없음, 잔존 WARNING 없음 — 1차에서 유일하게 열려 있던 gap 이
같은 PR 안에서 해소됐다.

## 위험도

NONE
