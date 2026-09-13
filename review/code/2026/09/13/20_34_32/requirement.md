# 요구사항(Requirement) 코드 리뷰 — round 4 (`review/code/2026/09/13/20_34_32`)

## 검토 범위 및 방법

`error-code-emission-axis` 배치의 실질 코드는 두 파일에 집중된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 + 공용 수집기 `collectMatches` + `isMessagePrefixOnly` + `GUIDE_NON_EMITTED_VOCABULARY`)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 축을 소비하는 단언·대조군 다수). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 이 구현을 서술하는 문서/프로세스 산출물이다.

프롬프트가 두 핵심 파일의 diff 를 예산으로 생략했기 때문에 `git diff origin/main...HEAD` 로 전체 diff 를 직접 받아 처음부터 끝까지 읽었다. 그 위에 아래를 **직접 실측**했다(추정 없음):

- `codebase/frontend` 에서 `npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` 직접 실행 → **71 passed (71)**.
- 소스 인용 줄 번호 전수 대조: `execution-engine.service.ts:7121,7125,7130`(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 메시지 접두), `:8016`(`nodeExec.error = { message }` — `code` 필드 없음), `makeshop.handler.ts:436`(`MAKESHOP_UNRESOLVED_PATH_PARAM` 접두) + `:360`(`err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'` fallback — `GUIDE_NON_EMITTED_VOCABULARY` 의 `why` 서술과 정확히 일치), `execution-failure-classifier.ts:76`(`MAX_ITERATIONS_EXCEEDED` 소비자 Set 리터럴 인용), `loop-executor.ts:64,85`(같은 토큰의 접두 발행). 전부 코드/JSDoc/CHANGELOG 인용과 **바이트 단위로 일치**.
- 독립 계측(테스트 파일을 scratch 로 백업 후 임시로 강제-fail 시켜 내부 값을 노출, 검증 뒤 `cp` 로 원복 — 아래 "뮤테이션/계측" 절 참조): 가이드에 실제로 인용된 고유 토큰 107개, 그중 "접두 전용 ∩ 카탈로그 미등재" 3개 = 등록된 3종과 정확히 일치(오프렌더 0). `catalogCodes.size = 144`, `quotedLiterals.size = 656`, `messagePrefixes.size = 24` — vacuity floor(50/200/3)를 실측이 뒷받침.
- `--strict` 로 두 파일을 격리 `tsc` 컴파일 → 에러 0 (이 파일들은 `tsconfig.json` 의 `src/**/__tests__/**` exclude 에 걸려 `next build`/일반 tsc ratchet 이 못 보는 영역이라 별도 확인함).
- 관련 spec 문서 식별: `spec/conventions/user-guide-evidence.md §2`(가드 카탈로그), `spec/5-system/3-error-handling.md §1.4`(에러 코드 카탈로그, `collectCatalogCodes` 가 읽는 SoT), `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md` + `spec/3-workflow-editor/{0-canvas,2-edge}.md` + `spec/5-system/4-execution-engine.md`(`CONTAINER_*` 서술 6~7곳) 를 `Read`/`Grep` 으로 직접 열어 대조.

## 발견사항

- **[SPEC-DRIFT] (WARNING, 연속 3라운드 확인 — 신규 아님, 재확인)** spec 6~7개 파일이 여전히 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "에러 코드"처럼 표에 올린다 — 이번에 정정된 가이드 문장과 어긋난다
  - 위치: `spec/5-system/4-execution-engine.md:332-333`("...에러로 실행 실패"), `spec/3-workflow-editor/0-canvas.md:636`, `spec/3-workflow-editor/2-edge.md:202`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` (전부 이 diff 밖의 기존 spec 파일 — 게이트 숫자 없음, 직접 `Grep` 으로 확인한 실제 소스 줄 번호)
  - 상세: 실측(`execution-engine.service.ts:7121,7125,7130`)으로 두 토큰은 `throw new Error()` 의 **메시지 접두**일 뿐이고 `:8016` 의 `nodeExec.error = { message }` 에는 `code` 필드가 없다. 이 배치가 `logic.mdx`/`logic.en.mdx` 에서 정확히 이 이유로 문장을 고쳤는데, 위 spec 파일들은 여전히 "코드"처럼 서술한다. 같은 저장소에 정답 선례(`spec/4-nodes/1-logic/3-loop.md:189-191`, "메시지" 열에 발행 문자열 전문 인용)가 이미 있다.
  - **불일치 방향**: 코드(엔진 동작 + 이번에 고친 가이드 문장)가 옳고 spec 6~7개 파일이 낡았다 — 순수 SPEC-DRIFT. 이 배치 자신이 이미 이 사실을 실측하고 근거·선례·처분 옵션(§1.4 backfill 택일 포함)을 `plan/in-progress/spec-draft-nullable-notation-followups.md:3404-3456`(§ *"spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다"*, 체크박스 `[ ]`, planner 몫)에 정확히 등재해 `project-planner` 로 넘겼다 — CLAUDE.md 의 "developer 는 spec 변경 필요 시 멈추고 planner 위임" 경계를 지켰고 `spec_impact: none`(frontmatter)도 이 diff 가 `spec/` 를 건드리지 않았다는 사실과 일치한다.
  - 제안: 이 diff 에 대한 조치 요구는 아님(코드/가이드 범위 안에서 완결). spec 반영은 `project-planner` 가 위 트래커 항목을 집행할 때 6~7개 위치를 `3-loop.md §6` 형식(발행 문자열 전문을 "메시지" 열에)으로 통일. `3-error-handling.md §1.4` 카탈로그 backfill 택일 항목(같은 트래커 파일 3440행 부근)과 연동해 함께 처분할 것 — 등재 항목 자체가 이미 그렇게 명시하고 있다.

- **[INFO] (기존 상태, 신규 아님)** `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표가 `guide-identifier-existence.test.ts` 를 여전히 안 싣는다 — `PROJECT.md:300` 의 이번 diff 는 그 §2 를 SoT 로 재인용한다
  - 위치: `spec/conventions/user-guide-evidence.md:68`(표 캡션 "3건"), 대조 `PROJECT.md:300`(이 diff, 수정된 줄 말미) "SoT: `spec/conventions/user-guide-evidence.md §2`"
  - 상세: 이 SoT 포인터 자체는 `#1330` 때부터 있던 기존 서술이고(diff 의 `-`/`+` 양쪽 줄 모두 동일 문구), 이번 배치는 그 줄 중간에 "발행 축(2026-09-13 추가)" 한 문단만 삽입했다 — 이 불일치를 새로 만들지 않았다. 다만 §2 표는 여전히 3건만 세고 있어 그 문서만 읽으면 이 가드(및 `guide-sanitized-message-parity.test.ts` 등)의 존재를 알 수 없다.
  - 제안: 이 diff 범위 밖. 다음에 이 가드 계열을 만지는 사람이 §2 표를 "3건뿐"으로 오인하지 않도록 참고 기록만 남긴다(이미 라운드 3 requirement.md 가 같은 항목을 등재했음).

- **[INFO] (기존 관행)** `where` 검증(`parseWhereRefs`)이 `codebase/backend/src` 하위만 탐색한다 — 향후 `packages/` 소스를 근거로 삼는 등록이 추가되면 그 항목만 "0건"으로 실패한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — `"where 의 파일:줄 이 실제로 그 토큰을 담는다"` 테스트, `walkTree(root, ["codebase/backend/src"], …)` 호출부
  - 상세: 오늘 등록된 3종은 전부 `codebase/backend/src` 안에 있어 문제가 없다(실측 확인). 다만 탐색 루트가 하드코딩돼 있어, 다음에 `packages/` 나 `codebase/frontend`(백엔드 아님) 소스를 근거로 하는 항목이 등록되면 이 테스트가 "0건"으로 **RED** 를 낸다 — 이는 fail-silent 가 아니라 fail-loud 라서 데이터 정합성 사고로 이어지진 않지만, 다음 등록자가 원인을 오인할 여지(마치 소스가 삭제된 것처럼 보임)가 있다.
  - 제안: 조치 불요(오늘 유효, 안전한 방향으로 실패). 넷째 등록 항목이 `backend/src` 밖을 가리키면 그때 탐색 루트를 배열로 확장.

- **[INFO] (기존 관행, 재확인)** `collectCatalogCodes` 의 spec 카탈로그 읽기(`spec/5-system/3-error-handling.md`)가 `readIfPresent` 가드 없이 하드 `fs.readFileSync` 다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:82-87` 부근(`catalogCodes` 선언)
  - 상세: 이미 라운드 1(maintainability INFO#1)·라운드 3(requirement INFO#2)가 "기존 관행 일치 — 조치 불요"로 처분한 사안이다. 같은 파일의 `envExampleTexts` 는 `readIfPresent` 를 쓰는데 이쪽만 다르지만, spec 카탈로그 SoT 파일 부재는 저장소 전체가 이미 깨진 상태를 뜻하므로 실용적으로 수용 가능하다.
  - 제안: 조치 불요.

## 기능 완전성 · 엣지 케이스 · 비즈니스 로직 판정

- `isMessagePrefixOnly(token, messagePrefixes, quotedLiterals) = messagePrefixes.has(token) && !quotedLiterals.has(token)` — JSDoc 의 4-칸 진리표와 정확히 일치하며 `describe("isMessagePrefixOnly — 진리표 대조군")` 가 4칸 전부를 합성 입력으로 고정한다(직접 실행 확인, 71/71 GREEN).
- `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 는 각각 역참조(여닫이 따옴표 일치) · `:`+공백 · 백틱-only 라는 서로 다른 경계 조건을 갖는데, 세 조건 모두 "두 판정이 갈리는 값"의 합성 fixture 로 개별 검증돼 있다(`describe("발행 축 수집기 — 경계 대조군")`) — 실제 프로덕션 코드(`makeshop.handler.ts:360`, `execution-failure-classifier.ts:76`)와 대조해도 판정이 정확했다.
- `GUIDE_NON_EMITTED_VOCABULARY` 는 4가지가 강제된다: 접두-전용 실측 유지("죽은 등록 방지") · 기준집합 소속(거울상 목록과 제약 반전) · `where`/`why` 비어있지 않음 · **`where` 의 모든 `파일:줄` 참조가 실제로 그 토큰을 담음**(다중 위치 파서까지 대조군 보유) · 상한 5 · 여전히 인용됨(죽은 항목 방지) · 목록 비어있지 않음(vacuity). 요구사항 대비 빠짐없다.
- TODO/FIXME/HACK/XXX: 두 핵심 파일 전수 grep 결과 **0건**.
- 반환값: 신규 export 함수(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/`isMessagePrefixOnly`/`collectMatches`) 모두 모든 경로에서 명시적 타입의 값을 반환한다(`Set<string>`/`boolean`) — 예외를 던지는 경로 없음, 암묵적 `undefined` 반환 없음.
- 카탈로그 탈출구(`collectCatalogCodes`)가 "오늘 한 번도 발화하지 않는다"는 자기-반증 서사가 회귀 라운드(1→2→3)를 거치며 정정됐고, 그 사실 자체가 `it("[한계] 카탈로그 탈출구는 오늘 한 번도 발화하지 않는다")` 단언으로 고정돼 있다 — 독립 실측(디버그 계측)으로 "접두 전용 ∩ 카탈로그" 교집합이 정말 공집합임을 재확인했다.

## 뮤테이션/계측 (검증용, 저장소 원복 완료)

리뷰 규약에 따라 저장소 밖 scratch(`/private/tmp/.../scratchpad/req-review/`)에 원본을 `cp` 로 백업한 뒤, `guide-identifier-existence.test.ts` 의 베이스라인 단언을 임시로 강제-실패시켜 내부 계산값(코퍼스 인용 수·오프렌더 목록)을 노출시키는 계측을 2회 수행했다(vitest 가 `console.log` 를 통과 테스트에서 출력하지 않아 강제-fail 로 값을 노출). 계측 직후 매번 `cp` 로 원복하고 `npx vitest run …` 재실행(71/71 GREEN)과 `git status --short`(리뷰 세션의 신규 `review/**` 산출물 외 diff 없음)로 원복을 확인했다 — **원복 완료, 잔여물 없음**.

## 요약

핵심 구현(발행 축 3종 수집기 + `isMessagePrefixOnly` 술어 + `GUIDE_NON_EMITTED_VOCABULARY` 등록 + 가이드 문장 정정)은 의도한 기능을 정확히 구현한다. 함수 시그니처·JSDoc·실제 동작이 일치하며, TODO/FIXME 없음, 반환값 누락 없음, 엣지 케이스(여닫이 따옴표 불일치·`:`/공백 유무·워드 경계·다중 `where` 위치·필터 방향)가 합성 대조군으로 촘촘히 고정돼 있다. 소스 인용 줄 번호·비즈니스 로직 서술(예: makeshop 의 `INTEGRATION_CALL_FAILED` fallback 경로)을 직접 코드까지 내려가 전수 재현했고 전부 정확했다. 독립 계측으로 "베이스라인 0" 판정의 실제 수치(인용 107·오프렌더 3=등록 수와 일치)도 재확인했다. 유일한 실질 발견사항은 spec fidelity 축의 SPEC-DRIFT(spec 6~7개 파일이 `CONTAINER_*` 를 "코드"로 서술)인데, 이는 3라운드 연속 확인된 **기존** 이슈이고 이 배치 스스로 실측·근거·선례를 갖춰 `project-planner` 몫으로 정확히 등재해 두었으므로 이 PR 에 대한 신규 조치 요구는 아니다. 나머지는 이미 여러 라운드에 걸쳐 처분된 저위험 INFO(spec §2 표 갱신 누락, 카탈로그 하드 리드, `where` 탐색 루트 범위)뿐이다.

## 위험도
LOW
