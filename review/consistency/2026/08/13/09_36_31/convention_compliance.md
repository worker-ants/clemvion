# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`

## 발견사항

- **[CRITICAL] plan frontmatter 필수 필드(`started`/`owner`) 누락 — build gate 즉시 FAIL**
  - target 위치: 문서 최상단 frontmatter (`status`/`worktree`/`spec_impact` 3개 필드만 존재)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 (`plan-frontmatter.test.ts` 가드 표 — "top-level `plan/in-progress/*.md` 의 `worktree`(sentinel `(unstarted)` 허용)/`started`(ISO)/`owner` 필수"). 가드 규약 SoT 는 `.claude/docs/plan-lifecycle.md §4`("세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다").
  - 상세: target 은 `worktree`/`spec_impact` 는 채웠지만 `started`(ISO 날짜)와 `owner` 필드가 아예 없다. 이 저장소의 실제 build guard(`codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`)를 이 파일 하나에 대해 직접 실행해 실측했다:
    ```
    × `started` is an ISO date  — started=null
    × `owner` is set            — owner=undefined
    ```
    2개 테스트가 즉시 FAIL 한다. 같은 디렉터리의 자매 draft `plan/in-progress/spec-draft-eia-r8-alignment.md` 는 `title`/`worktree`/`started`/`owner`/`status`/`priority`/`spec_impact` 를 모두 채워 이 가드를 통과하는 정상 사례다 — target 만 스키마 축약판을 쓰고 있다.
  - 제안: frontmatter 에 `started: 2026-08-1x`(ISO, 실제 작성일)와 `owner: project-planner`(또는 실제 작성 주체)를 추가한다. 두 필드 모두 없으면 이 draft 는 `plan/in-progress/` top-level 가드 강제 대상에서 정상적으로 벗어나지 못하고 CI 를 깬다.

- **[WARNING] `worktree:` 값이 스키마와 다른 형태(경로 접두) — 소비 스크립트가 존재를 "MISSING" 으로 오판**
  - target 위치: frontmatter `worktree: .claude/worktrees/eia-r8-cache-scope-4ae434`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` 스키마 (`worktree: <task_name>-<slug>  # 이 plan 이 살아있는 worktree 디렉토리 이름` — **디렉터리 이름만**, `.claude/worktrees/` 접두 없음). 이 가드의 규약 SoT 는 `spec/conventions/spec-impl-evidence.md §4.2` 가 명시적으로 plan-lifecycle §4 로 위임한다.
  - 상세: 값에 `.claude/worktrees/` 접두가 이미 붙어 있다. `plan-frontmatter.test.ts` 자체는 비어있지 않고 placeholder 정규식에 안 걸리므로 통과하지만, 같은 필드를 소비하는 `.claude/tools/plan-stale-audit.sh` 는 `-d ".claude/worktrees/$wt_value"` 로 존재를 확인한다 — target 값을 그대로 넣으면 `.claude/worktrees/.claude/worktrees/eia-r8-cache-scope-4ae434` 를 찾게 돼 실제로 worktree 가 존재함에도 `MISSING` 으로 오판된다. 실제로 스크립트를 실행해 확인:
    ```
    plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md   (untracked)  0/3  MISSING  (no spec ref)
    ```
    (본 세션이 지금 바로 그 worktree 안에서 실행 중이므로 실제로는 존재한다.) 자매 draft `spec-draft-eia-r8-alignment.md` 는 `worktree: eia-spec-r8-alignment-fff754` 로 접두 없는 스키마를 정확히 따른다.
  - 제안: `worktree: eia-r8-cache-scope-4ae434` 로 접두를 제거한다.

- **[INFO] NF-OB-07 표 신규 행이 기존 라벨 표기 관례(닫힌 enum 인라인)에서 벗어남**
  - target 위치: "## 무엇을 쓸 것인가 §1" 제안 표 행 — `| clemvion.redis.fail_open | Counter | component, reason | ... |`
  - 위반 규약: 명시적 `spec/conventions/**` 항목은 아니고, `spec/5-system/_product-overview.md` §NF-OB-07 표 자체가 보여주는 기존 관례. 같은 표의 `status` (`completed/failed/cancelled`), `state` (`waiting/active/delayed/failed`) 행은 닫힌 소수 enum 값을 라벨 컬럼에 괄호로 인라인한다. 반면 카디널리티가 큰 `error_code`/`model`/`node_type` 은 인라인하지 않는다.
  - 상세: 제안된 `component`(1값)·`reason`(5값)은 `status`/`state` 와 카디널리티가 같은 급인데, draft 는 표 셀에는 라벨명만 적고 닫힌 집합 값은 표 아래 별도 산문(불릿)으로 뺐다. 표만 보는 독자는 `status`/`state` 행과 달리 `component`/`reason`의 실제 값 범위를 표에서 바로 확인할 수 없어 문서 내부 일관성이 약간 흐트러진다.
  - 제안: `component`(`idempotency`), `reason`(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`) 형태로 표 셀에 직접 인라인하거나, 표 아래 산문 설명을 유지하려면 §NF-OB-07 서두 "모든 라벨은 bounded cardinality" 문구 옆에 "표에 인라인 또는 산문으로 병기" 라고 명문화해 규약화하는 것도 방법이다(둘 중 하나로 통일 권장 — 현재는 문서 내에 두 표기 방식이 혼재).

- **[INFO] draft 본문이 `project-planner/SKILL.md` 의 "본문 끝에 `## Rationale`" 문구를 문자 그대로 따르지 않음**
  - target 위치: 문서 전체 섹션 구성 (`## 왜` → `## 무엇을 쓸 것인가` → `## 판단이 필요한 지점` → `## 비목표` → `## 체크리스트`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번 — "`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. 본문 끝에 `## Rationale` 로 결정 근거 명시." (엄밀히는 `spec/conventions/**` 가 아니라 SKILL.md 라 본 리뷰의 1차 스코프 밖에 가깝지만, 검토 관점 3 "CLAUDE.md 의 명명 컨벤션 준수" 와 인접해 참고로 남긴다.)
  - 상세: target 은 문자 그대로의 `## Rationale` 헤더 없이 결정 근거를 최상단 `## 왜` 절에 배치한다. 다만 같은 디렉터리의 최근 자매 draft(`spec-draft-eia-r8-alignment.md`)도 동일하게 `## Overview`/`## 왜 지금 하나`/`## 변경 N` 구성이고 문자 그대로의 최상위 `## Rationale` 헤더가 없다 — 즉 이 저장소의 최근 실제 관행 2/2 가 SKILL.md 문구와 이미 다르다. 이는 target 만의 결함이라기보다 **SKILL.md 문구가 실제 관행보다 뒤처졌을 가능성**이 크다.
  - 제안: target 을 굳이 고치기보다, `project-planner/SKILL.md` §3 을 "결정 근거는 `## 왜` 절(또는 `## Rationale`)로 명시" 정도로 갱신해 실관행과 맞추는 편이 더 적절해 보인다.

## 요약

target 은 순수 문서(spec draft) 변경이라 API 응답 포맷·에러 코드·Swagger 데코레이터·audit action 명명 등 다른 정식 규약 영역과는 접점이 없고, 제안된 메트릭 이름(`clemvion.redis.fail_open`)·라벨(`component`/`reason`)은 `spec/5-system/_product-overview.md` §NF-OB-07 의 기존 `clemvion.*` dot 표기·bounded cardinality 원칙과 정확히 일치한다. 다만 target 자신의 **plan frontmatter** 가 이 저장소의 `spec/conventions/spec-impl-evidence.md §4.2`(SoT: `plan-lifecycle.md §4`)가 규정한 필수 스키마를 어긴다 — `started`/`owner` 누락은 build guard 를 즉시 실패시키는 것으로 실측 확인했고(CRITICAL), `worktree` 값의 경로 접두는 `plan-stale-audit.sh` 를 실제로 오작동시키는 것도 실측 확인했다(WARNING). 두 건 모두 target 이 `spec/` 에 반영되기 전, plan 문서 자체를 push 하는 시점에 정정이 필요하다. 나머지 두 건(INFO)은 표기 일관성 수준의 참고 사항이다.

## 위험도

HIGH
