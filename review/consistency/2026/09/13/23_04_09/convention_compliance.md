# 정식 규약 준수 검토 — convention_compliance

## 범위·방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- prompt 번들의 `spec/conventions/error-codes.md`·`user-guide-evidence.md`·`review-citations.md`
  외 다수 파일과 `<git diff … code_areas>` 본문이 컨텍스트 예산 초과로 절단돼 있어(파일
  안내문 "본문 생략됨 — 컨텍스트 예산 초과" 및 "생략된 파일 272개" 목록으로 확인), 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
  절대경로로 직접 열어 실측했다 — `error-codes.md`·`user-guide-evidence.md`·`review-citations.md`
  전문 Read + `git diff origin/main...HEAD -- codebase/ spec/`/`git show d39d91a84` 로 실제
  diff 확보.
- 실측: `spec/conventions/**` 델타 **0개 파일**(정상 — 이 브랜치는 그 영역을 편집하지 않는다).
  `codebase/**`·`spec/**` 델타는 4개 파일 — `guide-identifier-scan.ts`,
  `guide-identifier-existence.test.ts`, `content/docs/02-nodes/logic.mdx`/`logic.en.mdx`.
  그 외 `CHANGELOG.md`·`PROJECT.md`·`plan/**`·`review/**` 갱신.
- 이 PR 은 이미 9라운드의 `/ai-review`+`--impl-done` 을 거쳤다(`plan/in-progress/error-code-emission-axis.md`
  §A~§M, HEAD = `d39d91a84` "라운드 9"). 본 검토(라운드 10)는 그 9라운드가 이미 다룬 지적을
  재등재하지 않고, 라운드 9 커밋이 만든 변경분과 잔여만 신규로 판정한다.

## 발견사항

신규 CRITICAL·WARNING 없음. 라운드 9 커밋(`d39d91a84`)의 `codebase/` 변경은 주석 2줄(라운드
번호 오기 정정 "(라운드 9 정정)"→"(라운드 8 정정)" + 인용을 줄 번호에서 앵커 문구로 교체)뿐이며,
둘 다 직전 라운드(`22_38_43` convention_compliance INFO)가 지적한 사항의 해소다. 재확인:

- `guide-identifier-scan.ts` 헤더가 이제 "(라운드 8 정정)" 으로 정확히 표기됨 (라인 11) — 이전
  라운드 INFO 해소 확인.
- 트래커 인용이 `spec-draft-nullable-notation-followups.md:3407` (편집 중인 파일의 줄 번호,
  같은 커밋의 다른 편집이 밀 수 있는 취약한 인용) 대신 앵커 문구
  (`"가이드 에러 코드 가드가 «존재» 만 보고 «방출» 을 안 본다"`)로 교체됨 — `review-citations.md`
  가 직접 규율하는 대상은 아니지만(§2는 `review/**` 세션 경로의 날짜 표기만 규정), 그 문서 §1
  Rationale 의 원칙("인용은 스스로 해소돼야 한다")과 같은 방향의 개선.

## 준수 확인 (긍정 소견 — 라운드 10 재검증)

- **`error-codes.md` 위반 없음** — 이 PR 은 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
  문자열 자체를 rename 하지 않고 유저 가이드 **서술**만 정정했다(§2 안정성 정책과 무관 —
  값 불변). `GUIDE_NON_EMITTED_VOCABULARY` 3항목(`MAKESHOP_UNRESOLVED_PATH_PARAM`·
  `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)은 전부 `UPPER_SNAKE_CASE`로 §1/
  `node-output.md §3.2` 표기 규약과 상충 없음.
- **`review-citations.md` §2/§3 준수** — 이번 diff 가 추가·유지하는 리뷰 인용 전부(`review/code/2026/09/13/*`,
  `review/consistency/2026/09/13/*`)가 전체 경로(연도/월/일/시각) + 지적 라벨 형태. 신규 diff
  라인에서 bare `hh_mm_ss` 0건(`grep -oE '[0-9]{2}_[0-9]{2}_[0-9]{2}'` 전수 대조 — 12종 전부
  `review/(code|consistency)/2026/09/13/` 전체 경로 뒤에 붙어 있음).
- **i18n 페어 갱신** — `logic.mdx`/`logic.en.mdx` 두 로케일이 동일 의미("전용 에러 코드는
  없으니 코드가 아니라 메시지를 봐야 해요" / "there is no dedicated error code, so read the
  message rather than the code")로 함께 정정됐고, 기존 MakeShop 선례(`integrations.mdx:306`,
  `integrations.en.mdx:295`)와 문형이 일치한다.
- **카탈로그(`3-error-handling.md §1`) 조회 결과와 가이드 정정 내용이 일치** —
  `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 그 카탈로그에 미등재이며, 가이드가
  새로 적은 "전용 에러 코드는 없다" 문장과 정합한다.
- **역할 경계 준수** — `spec/**` 은 이번 PR 에서 델타 0(developer 가 쓰기 권한 밖 spec 을
  건드리지 않음, CLAUDE.md 역할 경계). 구조적 갭(spec 6파일이 `CONTAINER_*` 를 "코드"로
  서술하는 drift, `3-error-handling.md §1.4` 카탈로그 표기 미정)은 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 대상 파일 전수·역참조와 함께 planner 담당으로
  정확히 위임돼 있다.

## 참고 — 이미 추적 중인 항목(신규 아님, 재확인만)

- **가드 가족 SoT 등재 지연**: `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`
  는 아직 `spec/conventions/user-guide-evidence.md` §2 표(build-time 가드 목록)에 등재돼 있지
  않다(`grep -c guide-identifier spec/conventions/user-guide-evidence.md` → 0, `spec/` 전체
  grep 으로도 이 두 파일을 참조하는 곳 0). 코드 자신이 이 사실을 숨기지 않고
  (`guide-identifier-scan.ts` 헤더 · `PROJECT.md:300` 부근) "가족 규약은 그 문서이지만 등재는
  planner 트래커 대기" 라고 명시하며, `spec/` 쓰기 권한이 없는 developer 가 직접 등재하지 않은
  것은 CLAUDE.md 역할 경계상 올바르다. `review/consistency/2026/09/13/21_41_25`·`22_06_21`·
  `22_38_43` 세 라운드가 이미 이 사실을 확인·인용했고 이번 라운드에도 유효하다. **문서 구조
  규약 관점의 WARNING 성격**(spec-impl-evidence 의 코드-등재 원칙)이지만 이미 트래커에
  올바르게 등재돼 있어 신규 발견으로 재기재하지 않는다.

## 요약

라운드 10 시점 `spec/conventions/**` 델타는 0이며(코드 전용 PR 이라 정상), 실제 구현 diff(4
파일 + 라운드 9 의 주석 2줄 정정)는 `error-codes.md`·`user-guide-evidence.md`·
`review-citations.md` 어느 것도 위반하지 않는다. 직전 라운드(`22_38_43`)가 지적한 유일한
INFO("라운드 9 정정" 표기 오기)는 같은 커밋(`d39d91a84`) 안에서 실제로 해소됐다. 남은 구조적
갭(가드 가족 미등재, spec 6파일 서술 drift)은 모두 developer 권한 밖으로 정확히 판별돼 planner
트래커에 위임돼 있고 반복 확인됐다. 신규 CRITICAL·WARNING 없음.

## 위험도

NONE
