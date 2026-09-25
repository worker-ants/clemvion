# 정식 규약 준수 검토 — `plan/in-progress/changelog-criteria.md`

## 검토 범위 메모

target 은 `spec/**` 를 건드리지 않는 plan draft다(`spec_impact: none`, B절 처방 표의 변경 대상은
`CHANGELOG.md` 와 `.claude/agents/documentation-reviewer.md` 뿐). `spec/conventions/**` 에 번들된
문서(audit-actions·cafe24/makeshop API catalog·error-codes·swagger·review-citations 등)는 대부분
API/도메인 명명·출력 포맷 규약으로, target 의 변경 표면(CHANGELOG 편집 기준)과 직접 겹치지 않는다.
그 결과 이 target 에 대해 발견 가능한 "정식 규약 위반" 표면은 좁고, 아래 발견사항은 대부분
**저장 위치·완결성** 관점의 경미한 지적이다.

## 발견사항

- **[WARNING] "정식 규약" 텍스트를 `spec/conventions/` 밖(=`CHANGELOG.md` 본문)에 신설하려는 처방**
  - target 위치: `## B. 처방` 표 1행 — `CHANGELOG.md` 상단에 "무엇이 항목을 만드는가" 기준 블록을 직접 적는다는 처방
  - 위반 규약: `CLAUDE.md` §정보 저장 위치(단일 진실 원칙) 표 — `정식 규약 | spec/conventions/<name>.md`
  - 상세: 이 plan 이 만들려는 것은 "낸다/안 낸다"를 가르는 **판정 기준(criteria)**으로, 성격상 `audit-actions.md`·`error-codes.md`·`review-citations.md` 같은 기존 정식 규약과 동종이다. 그런데 그 기준 본문을 `spec/conventions/<name>.md` 가 아니라 `CHANGELOG.md` 자체의 상단 산문으로 심는다. 기존 정식 규약들은 전부 `spec/conventions/` 아래 별도 파일로 관리되고, 소비처(코드 주석·SKILL.md·다른 spec)는 그 파일을 참조하는 패턴을 따른다(`review-citations.md` 가 `swagger.md §3` 을 참조하는 방식 등). 이 target 은 그 패턴을 뒤집어 "conventions 문서가 참조할 SoT" 를 codebase 루트 파일 안에 둔다.
  - 제안: (a) 기준 본문을 `spec/conventions/changelog-criteria.md` 로 신설하고 `CHANGELOG.md` 상단엔 짧은 pointer 만 남기거나, (b) `CHANGELOG.md` 자체를 SoT 로 유지하기로 의도한 것이라면 — 이는 "Keep a Changelog" 류 관행상 합리적일 수 있으므로 — 왜 `spec/conventions/` 가 아니라 `CHANGELOG.md` 를 택했는지 `## Rationale`(또는 plan 본문)에 한 줄이라도 남겨, CLAUDE.md 표와의 불일치가 의도임을 드러낸다.

- **[INFO] 신규 기준에 heading 명명 규칙이 빠져 있다**
  - target 위치: `## B. 처방` 표 1행(기준 블록 내용) — "낸다 셋 / 안 낸다 / 기준 이전 이력 불완전" 만 명시
  - 위반 규약: 직접 위반은 아님 — `## A. 전수 · A-1` 이 이미 확인한 heading 표기 관행(`## Unreleased — …`, 151/152, 접두 필수)과의 **완결성 갭**
  - 상세: A-1 에서 실측한 "1개(`## 부수 — …`)만 접두가 빠졌다" 는 발견은 사실상 **명명 규약 위반 사례**인데, B절 처방은 그 한 건을 개별 수정(`## Unreleased — (부수) …`)할 뿐, 새로 만드는 "정식 규약" 블록 안에 이 heading 표기 규칙 자체(`## Unreleased — <요약>` 형식, 접두 필수)를 성문화하지 않는다. 지금 처방대로면 "무엇이 항목인가" 는 규약이 되지만 "그 항목을 어떻게 표기하는가" 는 여전히 151/152 의 관행에만 의존한다.
  - 제안: 기준 블록에 heading 표기 형식 한 줄(`## Unreleased — <요약>`, 예외 없음)을 함께 명문화하면 이번에 발견한 유일한 명명 이탈 사례(A-1)까지 재발 방지 규칙으로 편입된다.

- **[INFO] `.claude/agents/**` 편집 권한이 `CLAUDE.md` 표에 명시돼 있지 않다**
  - target 위치: `## B. 처방` 표 4행 — `.claude/agents/documentation-reviewer.md` 수정 항목, "developer 가 `fix(harness)`로 고쳐 온 경로다(`#991`)" 근거
  - 위반 규약: 직접 위반 아님 — `CLAUDE.md` §Skill 체계의 harness 두 축 분리(코드/도구=`hooks/`·`tools/`·`tests/` → developer, 거버넌스 문서=`skills/**/SKILL.md`·`docs/**` → project-planner) 표가 `.claude/agents/**` 를 어느 쪽에도 명시적으로 나열하지 않음
  - 상세: `git log --oneline -- .claude/agents/documentation-reviewer.md` 로 확인한 결과 `#991`(`fix(harness): ...`)이 실제로 이 파일을 고친 커밋이며, target 의 선례 주장 자체는 사실이다. 다만 이 근거는 "관행상 developer 가 만져 왔다"는 실측이지, CLAUDE.md 표에서 직접 도출되는 결론은 아니다 — 표는 `.claude/agents/**` 를 언급하지 않는다.
  - 제안: target 의 잘못이라기보다 CLAUDE.md 표의 공백이다. project-planner 가 별도로 `.claude/agents/**` 를 developer 축(harness 실행물)에 명시적으로 추가하는 정정을 고려할 만하다.

## 준수 확인 (참고, 위반 아님)

- frontmatter 필수 3필드(`worktree`·`started`·`owner`) 모두 존재하고 `worktree: changelog-criteria` 는 실제 worktree 디렉토리명과 일치 ([`.claude/docs/plan-lifecycle.md §4`](../../../../.claude/docs/plan-lifecycle.md)).
- `spec_impact: none` 은 bare 리터럴로 Gate C 스키마(`문자열이면 none/없음/n/a/na` 어휘)를 정확히 따른다 — 실제 변경 범위(`CHANGELOG.md`, `.claude/agents/**`)가 `spec/` 밖이라는 사실과도 부합.
- 인용 형식(PR 번호·커밋 SHA·스크립트명)은 [`spec/conventions/review-citations.md §3`](../../../../spec/conventions/review-citations.md) 표에서 `plan/**` 문서가 명시적으로 적용 대상 제외("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다")이므로 bare 세션 인용 여부를 따질 필요가 없고, target 은 실제로 세션 경로 인용을 쓰지 않는다.

## 요약

target 은 `spec/conventions/**` 가 다루는 API·도메인 명명/출력 포맷 규약과 겹치는 변경 표면이 거의 없어(변경 대상이 `CHANGELOG.md`·리뷰어 프롬프트에 국한), 직접적인 CRITICAL 급 규약 위반은 발견되지 않았다. 다만 이 plan 자체가 "정식 규약"을 신설하는 작업이라는 점에서, 그 신설 위치(`spec/conventions/` 대신 `CHANGELOG.md`)가 CLAUDE.md 의 정보 저장 위치 원칙과 엇갈릴 수 있어 WARNING 으로 짚었고, 신설 기준의 완결성(heading 명명 규칙 누락)·harness 문서 권한 표의 공백은 INFO 로 남긴다. frontmatter·인용 형식 등 이미 존재하는 정식 규약과는 정확히 부합한다.

## 위험도

LOW
