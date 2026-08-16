# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-ws-types-canonical-location.md`

## 발견사항

- **[CRITICAL] `plan/in-progress/*.md` 필수 frontmatter (`started`/`owner`) 누락 — build 가드 실측 FAIL**
  - target 위치: frontmatter 블록 (라인 1~13). `worktree:` (라인 4) 만 있고 `started:`/`owner:` 키 자체가 없음.
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다." SoT 참조는 `spec/conventions/spec-impl-evidence.md §4.2` (지식저장소·plan 무결성 가드 family, `plan-frontmatter.test.ts` = build 차단).
  - 상세: 실제로 `pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` 를 로컬에서 돌려 확인했다 — 이 파일 하나 때문에 2개 테스트가 실패한다.
    ```
    FAIL plan/in-progress/spec-draft-ws-types-canonical-location.md > `started` is an ISO date
      AssertionError: expected [ 'started=null' ] to deeply equal []
    FAIL plan/in-progress/spec-draft-ws-types-canonical-location.md > `owner` is set
      AssertionError: expected [ 'owner=undefined' ] to deeply equal []
    ```
    같은 worktree 안의 자매 spec-draft 문서(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-r8-alignment.md`)는 전부 `worktree`/`started`/`owner` 3필드를 갖추고 있다 — 이 target 만 두 필드가 비어 있다. 이 상태로 `plan/` 이 diff 에 포함된 채 push 하면 build 가드가 그대로 fail 한다 (다른 시스템의 invariant 파손 = CRITICAL 등급 정의에 정확히 해당).
  - 제안: frontmatter 에 `started: 2026-08-15`(또는 실제 착수일), `owner: project-planner` 추가.

- **[WARNING] `worktree:` 값이 "디렉토리 이름"이 아니라 전체 경로 — 스키마 예시와 불일치 + `plan-stale-audit.sh` 오탐 유발**
  - target 위치: frontmatter 라인 4 — `worktree: .claude/worktrees/eia-r8-cache-scope-4ae434`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` 스키마 — `` worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름 ``. 즉 bare 디렉토리 이름이지 `.claude/worktrees/` 접두 경로가 아니다. 같은 worktree 의 자매 문서들은 모두 `worktree: eia-r8-cache-scope-4ae434` (bare name) 을 쓴다.
  - 상세: `plan_guard.py`(push 게이트)는 `_normalize_worktree_value()` 가 leading path 를 벗겨내 `eia-r8-cache-scope-4ae434` 로 정규화하므로 push 게이트 자체는 우연히 통과한다. 그러나 `.claude/tools/plan-stale-audit.sh` (§6.1, 운영 보조 도구) 는 정규화 없이 `sed` 로 원문을 그대로 뽑아 `[[ -d ".claude/worktrees/$wt_value" ]]` 로 존재를 검사한다 (라인 133-140) — `$wt_value` 가 이미 `.claude/worktrees/...` 를 포함하므로 실제로는 `.claude/worktrees/.claude/worktrees/eia-r8-cache-scope-4ae434` 를 찾게 되어 **항상 MISSING** 으로 오판된다. 해당 스크립트는 fail 하지 않는 정보성 도구이지만("본 도구는 정보 출력만"), 살아있는 작업을 "worktree 소실"로 잘못 보고해 grooming 판단을 오도할 수 있다.
  - 제안: `worktree: eia-r8-cache-scope-4ae434` (bare directory 이름) 로 정정.

- **[INFO] 첫 섹션 헤딩이 `## 왜` — 동일 파일군(`spec-draft-*.md`) 의 확립된 `## Overview` 패턴과 다름**
  - target 위치: 라인 17 `## 왜`
  - 위반 규약: 직접적인 강제 규약은 없음(`project-planner` SKILL.md §Spec 문서 구조 3섹션 권장 표는 문언상 `spec/<영역>/*.md` 최종 산출물에 대한 것이고, draft 자체 요구사항은 "본문 끝에 `## Rationale`" 뿐 — 이건 target 이 충족). 다만 같은 worktree 의 두 자매 `spec-draft-*.md` (`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-r8-alignment.md`) 는 둘 다 첫 섹션을 `## Overview` 로 시작하는 일관된 로컬 관행이 있다.
  - 상세: 사소한 형식 일관성 차이. 강제 가드나 명시 규약 위반은 아니다.
  - 제안: 원하면 `## 왜` → `## Overview` 로 통일하거나(자매 문서와 스캔 패턴 일치), 의도적 차별화라면 무시 가능.

## 요약

target 은 spec 본문 변경안 자체(7곳 정본 위치 서술 정정 + Rationale 보완)는 `project-planner` SKILL.md 의 draft 요구(`## Rationale` 포함), 파일명 패턴(`spec-draft-<name>.md`), `spec_impact` 리스트 형식(Gate C 스키마)을 모두 준수하고, 인용한 7개 spec 경로도 전부 실존 파일이다. 그러나 target 문서 자신의 frontmatter 가 `.claude/docs/plan-lifecycle.md §4`(= `spec/conventions/spec-impl-evidence.md §4.2` 가 인용하는 SoT)의 필수 3필드 스키마를 어긴다 — `started`/`owner` 가 아예 없고, 이는 실측(`vitest run plan-frontmatter.test.ts`)으로 확인된 **현재 진행 중인 build 실패**다. `worktree:` 도 bare-name 스키마 대신 전체 경로를 써서 push 게이트는 정규화로 우연히 통과하지만 `plan-stale-audit.sh` 를 오작동시킨다. 두 항목 모두 frontmatter 세 줄만 고치면 해소되는 국소적 결함이라, spec 변경안 자체의 판단력과는 분리해서 봐야 한다.

## 위험도
CRITICAL
