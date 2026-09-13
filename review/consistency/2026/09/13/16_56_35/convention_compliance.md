# 정식 규약 준수 검토 — convention_compliance

## 전제 (실측)

- 이번 PR 의 `spec/conventions/**` 델타는 **0개 파일** — 이 브랜치는 그 영역을 고치지 않는다.
- 실제 구현 diff(5개 파일 / 1112줄)는 전부 `codebase/frontend/src/lib/docs/__tests__/` 안의
  가이드 식별자 실재성 가드 리네임·확장이다(`guide-error-code-*` → `guide-identifier-*`).
  절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)에서
  `git diff origin/main...HEAD` 로 직접 확인했다(1112줄 정확히 일치).
- 따라서 본 검토는 "이 코드 변경이 `spec/conventions/**` 가 이미 선언한 규약(명명·인용·frontmatter
  스키마)을 지키는가" 를 판정한다.

## 발견사항

- **[WARNING]** `user-guide-evidence.md §2` 에 신규 가드가 여전히 미등재
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` /
    `guide-identifier-scan.ts` (신규), 그리고 이를 "SoT" 로 인용하는 두 파일의 최상단 주석
  - 위반 규약: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 +
    `spec/conventions/spec-impl-evidence.md §2.1` (`code:` = "본 spec 이 약속한 surface 의 구현
    경로")
  - 상세: 새 스캐너 파일 상단 주석이 `SoT: spec/conventions/user-guide-evidence.md (가드
    가족)` 이라 명시하고 `CHANGELOG.md` 도 "`spec/conventions/user-guide-evidence.md` 의 가드
    가족" 이라 부르는데, 정작 `user-guide-evidence.md` 의 frontmatter `code:` 목록과 §2 표
    어디에도 `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` (구
    `guide-error-code-*`) 가 등재돼 있지 않다. `spec-code-paths.test.ts` 는 glob 이 ≥1 매치만
    요구하므로 build 는 통과하지만, 문서가 자칭하는 "가드 가족" 목록과 실제 구현 목록이
    어긋난 상태다.
  - **단, 이것은 이번 PR 이 새로 만든 결함이 아니다** — 선행 판(`guide-error-code-existence.test.ts`
    / `guide-error-code-scan.ts`)도 `origin/main` 시점에 동일하게 미등재였다(확인:
    `git show origin/main:spec/conventions/user-guide-evidence.md` 에 두 파일 부재). 이번 PR 은
    그 기존 갭을 넓혔을 뿐이다. 그리고 `plan/in-progress/guide-identifier-existence.md` 자신이
    이 사실을 정확히 인지하고 있다 — frontmatter 바로 아래에 "`user-guide-evidence.md §2` 등재는
    필요하고 **developer 권한 밖**이라 planner 항목으로 등재돼 있다" 고 명시했고, §D(라운드
    4)·§F(라운드 6) 기록에 따르면 이 항목은 `--impl-prep`/`--impl-done` 6라운드 연속 유일한
    WARNING 으로 잡혔고 매번 "developer 쪽 조치는 완료, planner 몫" 으로 BLOCK:NO 처리됐다.
    `spec/` 쓰기는 `project-planner` 소관이라는 CLAUDE.md 역할 경계상 developer 가 지금 이
    PR 안에서 직접 고칠 수 없는 항목이다.
  - 제안: 이 finding 은 새로 생성할 블로킹 사유가 아니라 **이미 등재된 planner 백로그
    항목을 재확인**하는 차원으로 다뤄야 한다. planner 턴에서 `user-guide-evidence.md §2` 표 +
    frontmatter `code:` 에 두 파일을 함께 추가하고, "허용목록 없음" 원칙을 번복한 근거
    (`GUIDE_EXTERNAL_VOCABULARY` 도입 이유)도 같은 턴에 spec Rationale 로 승격할 것 (plan §D
    item #1·#2 가 이미 이렇게 처분을 지정해 두었다).

- **[WARNING]** `cafe24-api-metadata.md §4` 의 Principle 오인용 (이번 PR 과 무관한 선재 결함, 참고용)
  - target 위치: `spec/conventions/cafe24-api-metadata.md` 4절 말미, `> **용어 주의**` 박스
    ("CONVENTIONS Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한
    별개 개념이다.")
  - 위반 규약: `spec/conventions/node-output.md` 자체의 Principle 번호 체계
  - 상세: `{config, output, meta, port, status}` 5필드 불변 envelope 을 정의하는 것은
    `node-output.md` **Principle 0**("`NodeHandlerOutput`의 5필드는 불변")이다. **Principle 7**
    은 별개 규칙("`config` echo 원칙")이다 — 직접 `node-output.md` 를 읽어 확인했다. 게다가
    인용된 필드 목록 `{config, output, meta, port}` 도 실제 5필드(`config, output, meta, port,
    status`) 중 `status` 를 빠뜨렸다.
  - 이 결함은 **이번 PR 의 diff 범위 밖**이다 — `spec/conventions/**` 델타 0 이므로 이번
    브랜치가 만든 것이 아니고, `plan/in-progress/guide-identifier-existence.md §D` 항목 4 가
    이미 같은 결함을 적시하며 "이번 plan 과 무관한 선재 결함… `git log -S` 로 확인" 이라고
    기록해 두었다(2026-05-16 작성 시점부터의 오인용이라 재넘버링 탓도 아님).
  - 제안: 별도 planner 항목으로 처리(이미 그렇게 트래킹돼 있음). 이번 PR 의 SUMMARY 가 이
    항목을 이번 diff 의 CRITICAL/WARNING 으로 새로 등재하지 않도록 — 스코프 밖 선재 결함이다.

## 양호 항목 (참고)

- **리뷰 인용 형식** — `spec/conventions/review-citations.md §2` 는 bare `hh_mm_ss` 를 금지하고
  전체 경로(`review/code/YYYY/MM/DD/hh_mm_ss`) 형태를 권장한다. 신규 두 파일(`guide-identifier-
  scan.ts`, `guide-identifier-existence.test.ts`)의 모든 리뷰 인용을 확인한 결과 예외 없이
  전체 경로 형태(예: `review/code/2026/09/13/16_28_47` requirement INFO#1)를 쓰고 있어 규약을
  준수한다. `codebase/**` 코드 주석이 규약 적용 대상(§3)이라는 점과도 일치한다.
- **외부 어휘 허용목록 설계** — 신규 `GUIDE_EXTERNAL_VOCABULARY`(token/system/why 필드 + 상한 +
  "여전히 인용되는지"·"기준집합에 없는지" 이중 강제)는 `spec/conventions/error-codes.md §3`
  "Historical-artifact 예외 레지스트리"(코드/이유/진실/근거 컬럼 구조)와 같은 설계 어휘를
  쓰고 있어, 이 저장소가 이미 확립한 "예외는 명시 레지스트리 + 근거"패턴과 정합한다. 명명
  규약 위반이 아니다.
- **파일 명명** — `guide-identifier-scan.ts` / `guide-identifier-existence.test.ts` 는 선행
  `impl-anchor-parse.ts` / `impl-anchor-existence.test.ts`, 구 `guide-error-code-scan.ts` /
  `guide-error-code-existence.test.ts` 와 동일한 `<domain>-scan.ts` + `<domain>-existence.test.ts`
  네이밍 패턴을 유지한다. 삭제된 구 파일에 대한 잔존 import 참조도 없음을 grep 으로 확인
  (`guide-error-code-scan|guide-error-code-existence` 는 이력 주석 2곳에만 남고 실제 import 는
  0건).

## 요약

이번 diff 는 `spec/conventions/**` 를 전혀 건드리지 않는 codebase-only 변경이라 정식 규약을
"위반" 할 표면 자체가 좁다. 코드가 스스로 인용하는 규약(리뷰-인용 형식, 예외 레지스트리 설계
패턴, 가드 파일 명명)은 모두 기존 conventions 문서와 정합하며 새 위반은 없다. 유일하게 남는
것은 `user-guide-evidence.md §2` 가드 목록에 신규(및 그 전신) 파일이 계속 미등재라는 점인데,
이는 developer 권한(=`spec/` 은 read-only) 밖이라 이 PR 이 스스로 해소할 수 없고, 실제로
`plan/in-progress/guide-identifier-existence.md` 가 6라운드 연속 이 사실을 인지·기록하며
planner 백로그로 정확히 위임해 두었다 — 즉 절차상 올바르게 처리된 기존 갭이다.
`cafe24-api-metadata.md §4` 의 Principle 오인용은 실재하는 결함이지만 이번 PR 의 diff 범위
밖의 선재 결함으로, 마찬가지로 이미 planner 항목으로 식별돼 있다. 두 항목 모두 이 라운드의
새로운 블로킹 사유로 취급하지 않는 것이 맞다.

## 위험도
LOW
