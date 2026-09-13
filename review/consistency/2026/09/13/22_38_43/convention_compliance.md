# 정식 규약 준수 검토 — convention_compliance

## 범위·방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- prompt 번들의 `spec/conventions/error-codes.md`·`migrations.md`·`node-output.md`·`review-citations.md`·
  `secret-store.md`·`spec-impl-evidence.md`·`swagger.md`·`user-guide-evidence.md`·`<git diff … code_areas>`
  본문이 컨텍스트 예산 초과로 절단돼 있어, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를 절대경로로
  직접 열어 실측했다 (`error-codes.md`·`user-guide-evidence.md`·`review-citations.md` 전문 Read + 관련
  코드 `git diff`/`grep`).
- 실측: `spec/conventions/**` 델타 **0개 파일**(정상 — 이 브랜치는 그 영역을 편집하지 않는다).
  `codebase/**` 델타는 `git diff origin/main...HEAD -- codebase/ spec/` 기준 **4개 파일**:
  `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`,
  `content/docs/02-nodes/logic.mdx`/`logic.en.mdx`. 그 외 `CHANGELOG.md`·`PROJECT.md`·`plan/**`·`review/**` 갱신.
- 이 PR 은 이미 8라운드의 `/ai-review`+`--impl-done` 을 거쳤다(`plan/in-progress/error-code-emission-axis.md`
  §A~§L). 본 라운드(9)에서는 그 8라운드가 이미 다룬 지적을 재등재하지 않고, (a) 라운드 8 커밋
  (`061f5153f`)이 새로 만든 변경분과 (b) 이전 라운드들이 놓쳤을 수 있는 잔여만 신규로 판정한다.

## 발견사항

### [INFO] 코드 주석의 "라운드 9 정정" 표기가 실제 라운드 번호와 어긋난다

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:12`
  — `// > **라운드 7 의 그 교체가 두 가지를 한꺼번에 틀렸다 (라운드 9 정정).**`
- 위반 규약: 직접 위반은 아님 — `spec/conventions/review-citations.md` 는 `review/**` 세션 경로
  인용의 날짜·형식만 규정하고("bare `hh_mm_ss` 금지", §2) "라운드 N" 같은 plan 내부 카운터는
  규율 대상이 아니다. 다만 그 규약이 세운 원칙("인용은 스스로 해소돼야 한다", §1 Rationale)과
  같은 정신에 어긋난다.
- 상세: 이 문장이 서술하는 SoT 헤더 교체(라운드 7 의 1줄 치환을 되돌린 것)는 `plan/in-progress/error-code-emission-axis.md`
  자신이 `## L. 라운드 8` 절(라인 525·549)에서 "라운드 8" 로 명시하고 있고, 그 절은 실제로
  커밋 `061f5153f`("fix(guards): 라운드 8 …")에 대응한다. 반면 "라운드 9" 는 같은 plan 파일의
  체크리스트가 `- [ ] /ai-review + --impl-done — **라운드 9 대기**`(라인 651)로 아직 **완료되지 않은
  다음 라운드**(=본 검토)를 가리키는 값이다. 즉 코드 주석은 "아직 오지 않은 라운드에서 이미
  정정했다"고 적고 있어, 이 파일이 만들어내려던 "예고와 실제 상태가 어긋나면 다음 사람이
  헛수고한다"는 바로 그 결함 클래스(§L 이 CRITICAL 로 잡은 것과 같은 형태)를 한 칸 작게 재현한다.
  실질 영향은 작다 — 같은 문단이 `git show HEAD~2`·구체 리뷰 경로(`review/code/2026/09/13/22_06_10`,
  `review/consistency/2026/09/13/22_06_21`)를 정확히 병기하고 있어 독자가 실제 근거를 스스로
  재구성할 수 있다.
- 제안: "(라운드 9 정정)" → "(라운드 8 정정)" 한 단어 교체. 규약 갱신은 불필요 — plan 내부
  라운드 카운터는 `spec/conventions/**` 대상이 아니다.

## 준수 확인 (긍정 소견)

- **이전 라운드 WARNING 이 실제로 해소됨** — `review/consistency/2026/09/13/22_06_21` convention_compliance
  WARNING#4("SoT 인용이 `error-codes.md` 자기 선언 범위보다 넓다 — `(코드 명명·발행)`")는 라운드 8
  커밋에서 `(코드 명명·안정성·은퇴 이력)`으로 정정됐다. `error-codes.md` Overview 의 자기 선언
  ("명명·안정성 규율만 정의한다" · 유일 소유 ①명명 ②rename 안정성 ③예외 레지스트리, §5 은퇴 이력)과
  이제 정확히 대응한다 — 명명(§1)·안정성(§2)·은퇴 이력(§5) 세 축 모두 실제로 그 문서 안에 있다.
- **`PROJECT.md` SoT 표기도 함께 정정됨** — `PROJECT.md:300` 이 이제
  `SoT: spec/conventions/error-codes.md + spec/5-system/3-error-handling.md §1 — user-guide-evidence.md §2 표에는
  아직 없다`로 정확히 착지한다(`grep -c guide-identifier spec/conventions/user-guide-evidence.md` → 0 재확인,
  이 부재를 숨기지 않고 명시). `review/consistency/.../21_41_25`·`22_06_21` 두 라운드가 반복 지적한
  "인용이 착지하지 않는다" 결함 클래스가 이번 라운드엔 재발하지 않는다.
- **명명 규약(`UPPER_SNAKE_CASE`) 준수** — `GUIDE_NON_EMITTED_VOCABULARY` 3개 항목
  (`MAKESHOP_UNRESOLVED_PATH_PARAM`·`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)이 전부
  `error-codes.md §1`/`node-output.md §3.2` 표기 규약과 상충 없이 `UPPER_SNAKE_CASE`.
- **에러 코드 rename 정책(`error-codes.md §2`) 위반 없음** — 이 PR 은 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 문자열 자체를 바꾸지 않고 유저 가이드 **서술**만 정정했다
  (`execution-engine.service.ts:7121·7125·7130` 실측 — 여전히 같은 문자열이 메시지 접두로 발행됨).
- **카탈로그(`3-error-handling.md §1`) 조회 결과와 가이드 정정 내용이 일치** — `grep -n "CONTAINER_MISSING_EMIT\|CONTAINER_MULTIPLE_EMIT" spec/5-system/3-error-handling.md` 는 0건이며, 이는
  가이드가 새로 적은 "전용 에러 코드는 없으니 메시지를 보라"는 문장과 정합한다.
- **i18n 페어 갱신** — `logic.mdx`/`logic.en.mdx` 두 로케일이 동일 의미로 함께 정정됐다
  (`i18n-userguide.md` 의 로케일 쌍 관례 준수).
- **`review-citations.md` §2/§3 준수** — 이번 diff 가 추가한 리뷰 인용 전부(`review/code/2026/09/13/22_06_10 architecture WARNING#1` 등)가 전체 경로(연도/월/일/시각) + 지적 라벨 형태를 쓴다. bare `hh_mm_ss` 0건. 표기된 "WARNING#N" 라벨은 각 세션 `SUMMARY.md` 의 통합 경고 표 번호와 실제로 일치함을 대조 확인(`21_41_25`→#3, `22_06_21`→#4).
- **`spec_impact` 형식(Gate C)** — `plan/in-progress/error-code-emission-axis.md` frontmatter
  `spec_impact: none` — bare `none`, 리스트 오형·`- none` 오형 아님.
- **남은 구조적 갭은 이미 올바르게 planner 트래커로 위임됨** — `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 를 "코드"로 서술하는 spec 6개 파일(`5-system/4-execution-engine.md §3.0` 외)과
  `3-error-handling.md §1.4` 의 앵커-없는-코드 축 미구분은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 대상 파일 전수·역참조와 함께 이미 등재돼 있다(`review/consistency/.../21_41_25`·`22_06_21` 확인 완료).
  `spec/` 쓰기 권한은 project-planner 소유이므로 이 developer PR 이 직접 고치지 않은 것은 CLAUDE.md
  역할 경계상 옳다 — 새 CRITICAL/WARNING 근거로 재등재하지 않는다.

## 요약

`spec/conventions/**` 자체는 이번 PR 에서 변경되지 않았고(델타 0, 코드 전용 PR 이라 정상), 실제
구현 diff(4파일)는 `error-codes.md`·`user-guide-evidence.md`·`review-citations.md` 를 위반하지 않는다.
직전 두 라운드(`21_41_25`, `22_06_21`)가 지적한 SoT 인용 착지 실패는 라운드 8 커밋에서 실제로
정정되어 이번 라운드엔 재발하지 않았고, 남은 카탈로그-미배선 구조적 갭은 developer 권한 밖이라
planner 트래커에 정확히 위임돼 있다. 신규로 발견한 것은 방금 그 정정 문장 자신이 자기 라운드
번호를 하나 틀리게 적은("라운드 9" → 실제는 "라운드 8") 사소한 자기서술 오차뿐이며, 이는
`spec/conventions/**` 의 어떤 명시 조항도 직접 위반하지 않는 INFO 수준이다. CRITICAL·WARNING 없음.

## 위험도

NONE
