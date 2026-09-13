# 정식 규약 준수 검토 — convention_compliance

## 범위·방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/**`, diff-base=`origin/main`.
- `spec/conventions/**` 자체 델타는 0개 파일 — 브랜치가 그 영역을 편집하지 않았다(정상, 이 사실만으로 CRITICAL 근거로 쓰지 않음).
- 구현 diff 는 워킹트리 절대경로에서 직접 실측: `git diff origin/main -- codebase/` → **4개 파일 / 842줄** (프롬프트가 예고한 수치와 일치, 전량 확인).
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx`
  - (+ `PROJECT.md`, `CHANGELOG.md` — 비-`codebase` 서술 정정)
- 대조한 정식 규약: `spec/conventions/error-codes.md`, `spec/conventions/user-guide-evidence.md`, `spec/conventions/review-citations.md` (전문 Read), 관련 SoT `spec/5-system/3-error-handling.md §1.4`.
- 프롬프트 번들의 `spec/conventions/error-codes.md`·`user-guide-evidence.md` 본문이 "컨텍스트 예산 초과로 생략됨"으로 잘려 있어, 두 문서 모두 절대경로로 직접 Read 해 우회했다 (이 결함 자체는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 별건으로 등재돼 있다 — 재등재하지 않음).

## 발견사항

### [WARNING] 카탈로그(SoT) 미배선 — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 여전히 `error-codes.md` 가 가리키는 카탈로그 SoT 에 없다

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 신규 `collectCatalogCodes()`/`GUIDE_NON_EMITTED_VOCABULARY` — 카탈로그를 "요구 조건"이 아니라 "탈출구"로 쓰는 설계 전체
- 위반 규약: `spec/conventions/error-codes.md` Overview — "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)"
- 상세: `error-codes.md` 는 프로젝트 전체 에러 식별자의 카탈로그 SoT 를 `3-error-handling.md §1`(특히 §1.4 "워크플로우 실행 에러" 표)로 지정한다. §1.4 표는 `EXECUTION_TIMEOUT`·`RECURSION_DEPTH_EXCEEDED`·`MAX_ITERATIONS_EXCEEDED`·`CYCLE_DETECTED` 등 "앵커 없는 맨 문자열"(엔진이 `throw new Error('X: …')` 로만 발행하고 구조화 `code` 필드가 없는 값)을 이미 정식 카탈로그 항목으로 인정한다. 이번 PR 이 실측으로 확인한 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`(`execution-engine.service.ts:7121·7125·7130`, `nodeExec.error = { message }` 만 기록·`code` 필드 없음)도 **구조가 완전히 동일**한데 §1.4 표에는 없다. 그 결과 이 PR 의 가드는 §1.4 를 "요구 조건"이 아니라 "탈출구"로만 쓸 수밖에 없었고, 스스로 "이 탈출구는 오늘 한 번도 발화하지 않는다"고 단언으로 고정했다 — 즉 카탈로그가 이 두 식별자에 대해서는 SoT 역할을 하지 못하는 상태가 남는다.
- 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 두 항목으로 정확히 등재돼 있다 — (a) "spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다"(`spec/3-workflow-editor/2-edge.md`·`0-canvas.md`·`spec/4-nodes/1-logic/{0-common,7-map,9-foreach}.md`·`spec/5-system/4-execution-engine.md`), (b) "`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종이 실제로는 메시지 접두다 — 카탈로그 표기를 정할 것". `spec/` 쓰기 권한은 `project-planner` 몫이므로 이 PR(developer)이 직접 고치지 않은 것은 CLAUDE.md 역할 경계상 옳다. **새 조치 불요** — planner 턴에서 두 항목을 함께 집행할 때 이 WARNING 은 자동 해소된다. (역참조까지 이미 plan 에 걸려 있어 `complete/` 봉인 시 유실 위험도 처리돼 있음.)

### [INFO] SoT 인용 문구가 `error-codes.md` 의 자기 선언 범위보다 넓다

- target 위치: `guide-identifier-scan.ts` 파일 헤더 주석 — `// SoT: spec/conventions/error-codes.md (코드 명명·발행) · spec/5-system/3-error-handling.md §1 (카탈로그)`
- 위반 규약: `spec/conventions/error-codes.md` Overview — "본 문서가 **유일하게 소유**하는 것: ① 의미 기반 명명 원칙, ② rename 안정성 정책, ③ historical-artifact 예외 레지스트리." (카탈로그·분류·트리거는 명시적으로 다른 문서에 위임)
- 상세: 새 주석은 `error-codes.md` 를 "(코드 명명·**발행**)"의 SoT로 표기한다. `error-codes.md` 본문은 "발행"을 §4(정규화 후 발행 파이프라인, Code 노드·트리거 파라미터 한정)에서만 다루고 스스로 "명명·안정성 규율만 정의한다"고 선을 긋는다. 이번 발행-축 가드가 다루는 "메시지 접두로만 발행되는가"라는 일반 질문은 §4 파이프라인과 다른 사안이라, "발행"이라는 단어가 인용의 정확한 착지점을 흐릴 수 있다. 위반이라기보다 표현의 느슨함.
- 제안: `(코드 명명)` 으로 좁히거나, `error-codes.md §4` 를 함께 병기해 "발행"이 §4 파이프라인을 가리키는 것인지 신규 축 전체를 가리키는 것인지 명확히 한다. 시급성 없음.

## 준수 확인 (긍정 소견)

- **`review-citations.md` §2/§3 준수**: diff 842줄 전체를 스캔했을 때 bare `hh_mm_ss` 인용이 0건이었다. 모든 리뷰 인용이 `review/{code,consistency}/YYYY/MM/DD/hh_mm_ss` 전체 경로 형태를 쓴다 (예: `review/code/2026/09/13/19_23_22 maintainability WARNING#7`) — §2 표의 "권장" 형태를 정확히 따른다.
- **명명 규약 / 충돌 회피**: 신규 식별자 10종(`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·`isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`·`collectMatches`·`resolveSourceLines`·`parseWhereRefs`·`staleGuideEntries`)를 `codebase/**` 전수 grep 했을 때 대상 두 파일 밖 사용 0건 — 충돌 없음. `staleEntries`→`staleGuideEntries` 리네임은 실제로 grep 으로 기존 동명 export(`internal-package-registration-guard.ts`)를 찾아낸 뒤 수행됐다 — "새 식별자는 후보 토큰이 grep 0건임을 먼저 보여라" 관례를 준수.
- **`GUIDE_NON_EMITTED_VOCABULARY` 3개 항목**(`MAKESHOP_UNRESOLVED_PATH_PARAM`·`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)은 `UPPER_SNAKE_CASE` — `error-codes.md §1` 표기 규약과 상충 없음.
- **에러 코드 rename 없음**: `error-codes.md §2` 는 "이름 정확성 향상만을 위한 rename 은 하지 않는다"고 금지한다. 이 PR 은 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 문자열 자체를 바꾸지 않았고 가이드 **서술**만 정정했다 — §2 위반 없음.
- **`spec_impact` 형식**: `plan/in-progress/error-code-emission-axis.md` frontmatter `spec_impact: none` — bare `none` 형태로 정확 (리스트 오형·`- none` 오형 아님).
- **거짓 SoT 자기 정정**: 종전 주석이 `user-guide-evidence.md` 를 이 가드의 SoT 로 표기했으나 그 문서 §2 표에는 이 가드가 등재돼 있지 않음을 실측(`grep -c guide-identifier` → 0)하고, `PROJECT.md:300`·스캐너 헤더·테스트 JSDoc 세 곳 모두 "가족 규약은 그 문서이지만 등재는 planner 대기"로 정정했다. `spec/` 쓰기 권한이 없는 developer 가 사실과 다른 SoT 주장을 유지하지 않고 정확하게 좁혀 적은 것은 CLAUDE.md 역할 경계·정식 규약 인용 정확성 관점에서 바람직한 처리다.

## 요약

`spec/conventions/**` 자체는 이번 PR 에서 변경되지 않았고, 실제 구현 diff(4파일/842줄) 는 기존 `error-codes.md`·`user-guide-evidence.md`·`review-citations.md` 규약을 위반하지 않는다. 유일하게 남는 아쉬움은 `error-codes.md` 가 카탈로그 SoT 로 지정한 `3-error-handling.md §1.4` 가 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 아직 등재하지 않아 이 PR 의 신규 가드가 카탈로그를 "탈출구"로만 쓸 수밖에 없다는 구조적 갭인데, 이는 developer 권한 밖(`spec/` 쓰기는 planner 몫)이라 새 조치를 요구하지 않으며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 대상 파일 전수와 함께 정확히 등재·역참조돼 있다. SoT 인용 부정확성은 이 PR 이 스스로 발견해 정정했고, 신규 식별자 명명·리뷰 인용 형식은 모두 규약을 준수한다. CRITICAL 은 없다.

## 위험도

LOW
