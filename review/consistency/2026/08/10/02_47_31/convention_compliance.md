# 정식 규약 준수 검토 — convention_compliance (6차)

## 검토 범위·방법

- prompt_file 은 `spec/conventions/` 번들(다수 파일, `spec-impl-evidence.md`·`audit-actions.md`·`cafe24-api-catalog/_overview.md` 등)을 target 으로 지정하나, diff 섹션이 비어 있어 위 "알려진 프롬프트 결함" 안내에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)를 절대경로로 직접 확인했다.
- 6차 지시에 따라 아래 두 항목에 집중했다:
  1. 세 미러(`PROJECT.md:277` / `spec/conventions/spec-impl-evidence.md §4.2` / `.claude/docs/plan-lifecycle.md §4·§5`)가 `plan-frontmatter.test.ts` 헤더 주석 축약(38→22줄)·`describe` 이름 일반화 이후에도 정합한지.
  2. 신규 `plan/in-progress/docs-guard-legacy-fixture-coverage.md` 가 plan 문서 규약(frontmatter 스키마, Overview/본문/Rationale 류 구성)을 지키는지.
- `git log`/`git diff origin/main` 으로 실제 변경분을 실측했고 (`f5f454844`, `6101a04b2`, `f09b21893`, `dd7da2d1b` 등), 코드(`plan-scan.ts`/`spec-links.ts`) 구현과 문서 서술을 대조했다.

## 발견사항

새 CRITICAL/WARNING 없음. 아래 1건만 INFO 로 기록(이번 라운드 delta 는 아니고 5차 이전부터 존재하던 상태이나, 재확인 과정에서 눈에 띄어 남긴다).

- **[INFO]** `spec-impl-evidence.md` frontmatter `code:` 에 `plan-scan.test.ts`/`spec-links.test.ts` 미등재
  - target 위치: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 목록 (파일 상단 12줄)
  - 위반 규약: 자기 자신 — 같은 문서 §4.2 도입부 "4개 build 가드 구현 파일은 본 문서 frontmatter `code:` 에 등재"
  - 상세: `code:` 에는 `plan-frontmatter.test.ts`(가드 본체) + `plan-scan.ts`/`spec-links.ts`(판정 로직 모듈)까지는 등재돼 있으나, 그 판정 로직의 non-vacuity 를 합성 fixture 로 증명하는 `plan-scan.test.ts`(신규, 135행)와 `spec-links.test.ts`(확장, +99행)는 없다. §4.2 표·R-9 Rationale 이 이 두 단위 테스트를 "판정 로직이 실제로 위반을 잡는다는 증거"로 여러 번 인용하는데(§4.2 표 note, 신규 plan 본문의 "왜 그 PR 에서 안 했나" 절도 동일 논리 인용), 정작 evidence 목록에는 없다. 문언상 요구("4개 build 가드 파일")는 충족하므로 위반은 아니고, 실제로 다른 3개 build 가드(`spec-link-integrity`/`spec-area-index`/`spec-plan-completion`)도 자신의 헬퍼 테스트를 개별 등재하지 않는 것과 같은 패턴이라 일관성 결여도 아니다.
  - 제안: 조치 불요. 다만 이 문서가 스스로 "spec 약속 vs 구현 증거"를 다루는 컨벤션이니, 다음에 `code:` 를 손댈 일이 생기면 두 테스트 파일도 함께 등재하는 편이 §4.2 의 자기서술과 더 정합하다.

### 항목 1 — 세 미러 정합성 (헤더 주석 축약 이후)

정합함. 축소된 코드 주석(22줄)·`PROJECT.md:277` 행·`spec-impl-evidence.md §4.2` 표 행 셋 모두 다음을 동일하게 서술한다:

- 3개 불변식 (1) top-level `in-progress` frontmatter 필수 (2) `complete/**` `status` 종료값(선택 필드, 값은 `complete`/`implemented`/`applied`/`superseded`) (3) top-level 살아있는 plan 상대링크 무결성.
- 판정 로직 소재: `plan-scan.ts`(수집·status), `spec-links.ts`(링크). 규약 SoT: `.claude/docs/plan-lifecycle.md §4`.
- 예외: subfolder 클러스터·`0-`/`_` index 면제, 링크 검사는 `plan/complete/**` 제외(시점 기록 문서는 옛 경로 유지가 정상).

축약 과정에서 빠진 서술(과거 `#1108`/`#1117` 재발 이력, 뮤테이션 검증 결과, 135건 broken-link 실측치 등 회고 서사)은 삭제된 게 아니라 **`plan-lifecycle.md §4` 의 콜아웃 박스(`> 2026-08-09 신설 …`)로 그대로 남아 있다** — 코드 주석만 "현재 규칙"으로 좁혔고 규약 SoT 문서 쪽은 이력을 보존한다. 커밋 메시지(`f09b21893`)의 의도("회고 서사를 커밋 메시지·plan 산출물로 넘겼다")와 실제 diff 가 일치하며, `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}`(`plan-scan.ts`)·`findBrokenPlanLinks`→`collectLivePlanMarkdown`(top-level in-progress 만)도 세 미러의 서술과 코드가 일치함을 실측 확인했다.

`describe` 이름 일반화("plan-frontmatter guard" → "plan lifecycle guards (frontmatter + live-plan links)")는 실제로 그 블록이 담는 두 검사(frontmatter 3필드, 링크)만 정확히 반영한다. `status` 종료값 검사는 별도 top-level `describe("completed plans declare a terminal status", …)` 로 애초에 분리돼 있어 이름이 그 검사를 안 담아도 오도가 아니다.

### 항목 2 — 신규 plan `docs-guard-legacy-fixture-coverage.md`

conventions 위반 없음.

- **frontmatter**: `worktree: (unstarted)`(명시 sentinel, placeholder 아님) / `started: 2026-08-10`(ISO, `plan-lifecycle.md §4` 스키마 규칙 준수) / `owner: developer`(허용 역할) 3필수 필드 모두 존재. `status`/`priority`/`spec_impact` 는 "추가 필드는 허용" 범주. `spec_impact: none` 은 Gate C sentinel 값과 동일 표기(완료 시점 의무이나 선제 선언은 무해).
- **구성**: `## Overview` → 본문(`왜 그 PR 에서 안 했나` / `할 일`(`- [ ]` 체크박스) / `함께 볼 것`) → `## Rationale` 순. CLAUDE.md 의 "Overview/본문/Rationale" 3섹션은 spec 문서 대상 규칙이라 plan 에는 formal 강제가 없으나, 같은 디렉터리의 이웃 plan(`docs-guard-walker-dedup.md`: Overview→대상→착수 전 필수→함께 볼 것→Rationale)과 동일한 관행을 그대로 따른다 — 저장소 관행과 정합.
- **분류**: 미체크 체크박스가 있어 `plan/in-progress/` 배치가 §2 분류 기준과 일치(리서치 산출물 아님).
- **인용**: `[docs-guard-walker-dedup.md](docs-guard-walker-dedup.md)` 상대링크는 같은 폴더(`plan/in-progress/`) 파일을 가리키며 실존 확인.

## 요약

이번 6차 라운드에서 지시된 두 초점 — plan-frontmatter 가드 서술의 세 미러(PROJECT.md/spec-impl-evidence.md/plan-lifecycle.md) 정합성, 그리고 신규 plan `docs-guard-legacy-fixture-coverage.md` 의 정식 규약 준수 — 모두 위반 없이 정합함을 실측으로 확인했다. 헤더 주석 축약(38→22줄)은 규약이 요구하는 서술(3개 불변식·판정 로직 소재·SoT·예외 조건)을 하나도 빠뜨리지 않았고, 삭제된 회고 서사는 규약 SoT 문서(`plan-lifecycle.md §4`)에 보존돼 있어 정보 손실이 아니라 책임 소재 재배치다. `describe` 이름 일반화도 실제 블록 스코프와 일치한다. 신규 plan 문서는 frontmatter 스키마·저장소의 plan 구성 관행을 그대로 따른다. 유일하게 남긴 것은 `spec-impl-evidence.md` 의 `code:` 목록에 신규 단위 테스트 2건(`plan-scan.test.ts`/`spec-links.test.ts`)이 명시 등재되지 않은 INFO 성 관찰인데, 문언상 요구도 저장소 관행도 위반하지 않아 조치 불요로 판단한다.

## 위험도

NONE

STATUS=success
