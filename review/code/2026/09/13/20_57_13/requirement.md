# 요구사항(Requirement) 코드 리뷰 — error-code-emission-axis (라운드 5)

## 검토 방법

`plan/in-progress/error-code-emission-axis.md` 는 이 배치가 라운드 5(`/ai-review` 4회 반복,
매 라운드 Critical 0 · WARNING 이 7→4→2→1 로 수렴)임을 명시한다. 실질 코드 변경은
`git diff afaef5bef HEAD`(base commit `afaef5bef` = `65256a109`~`57288e47f` 5개 커밋) 기준
`guide-identifier-scan.ts`(+200)·`guide-identifier-existence.test.ts`(+367) 두 파일에 집중되고,
문서(`logic{,.en}.mdx` 각 1문장, `CHANGELOG.md`, `PROJECT.md`)·plan 두 건이 나머지다. 프롬프트가
생략한 파일은 `git diff`/`Read` 로 직접 열어 전문을 확인했고, 핵심 "where" 인용(소스 파일:줄)은
전부 실제 소스를 열어 grep 으로 대조했으며, `codebase/frontend` 에서 `vitest run
guide-identifier-existence.test.ts` 를 직접 실행해 71/71 GREEN 을 확인했다(저장소 변경 없음,
읽기 전용 실행).

## 발견사항

- **[INFO]** 핵심 사실 주장(가이드 정정의 근거) 전수를 실측 대조 — 전부 정확
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:314-330`(`GUIDE_NON_EMITTED_VOCABULARY` 3개 항목의 `where`)
  - 상세: (1) `execution-engine.service.ts:7121,7125,7130` 에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 정확히 그 줄에서 `throw new Error(\`…\`)` 템플릿 리터럴 접두로 등장함을 grep 으로 확인. (2) 같은 서비스의 노드 실행 실패 기록(`nodeExec.error = { message }`, plan §D-2 가 인용한 `execution-engine.service.ts:8016` 부근)과 `codebase/backend/src/nodes/core/error-codes.ts` 전수에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 없음을 확인 — "전용 에러 코드는 없다" 는 가이드 정정 문장이 실측과 일치한다. (3) `makeshop.handler.ts:436` 에 `MAKESHOP_UNRESOLVED_PATH_PARAM` 이 정확히 그 줄에 있음을 확인. (4) `execution-failure-classifier.ts:76` 이 `'MAX_ITERATIONS_EXCEEDED'` 를 정확 리터럴(따옴표가 토큰만 감쌈)로 인용함을 확인 — `collectQuotedLiterals`/`isMessagePrefixOnly` 가 이 토큰을 "접두 전용 아님"으로 판정하는 근거와 일치. (5) `spec/5-system/3-error-handling.md` §1.4 카탈로그 표에 `MAX_ITERATIONS_EXCEEDED` 는 있고 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 없음을 확인 — "카탈로그 탈출구가 오늘 한 번도 발화하지 않는다"는 주석·테스트의 주장과 일치. 다섯 갈래 모두 코드·주석·테스트가 서로 및 실제 소스와 line-level 로 들어맞는다.
  - 제안: 조치 불필요 — 검증 완료 기록.

- **[INFO]** `execution-engine.service.spec.ts:13198,13328` 가 두 토큰을 이미 `toMatch(/…/)` (메시지 매칭)로만 검증하고 있어, 이 배치의 "메시지 접두일 뿐"이라는 주장과 기존 백엔드 테스트의 검증 방식이 서로를 보강한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:13198,13328`
  - 상세: 만약 두 토큰이 실제로는 구조화된 `.code` 필드로 발행됐다면 이 기존 테스트가 `.code` 대신 메시지 정규식 매칭을 쓸 이유가 약해진다 — 기존 테스트 형태 자체가 "접두일 뿐" 이라는 이번 가이드 정정의 방증이다.
  - 제안: 조치 불필요 — 참고 기록.

- **[SPEC-DRIFT]** 이번에 정정된 가이드 서술(`logic.mdx`/`logic.en.mdx`)이 이제 `spec/5-system/4-execution-engine.md §3.0` 등 6개 spec 파일의 서술과 어긋나는데, **이 배치는 spec 을 건드리지 않았다**(developer 는 `spec/` write 권한 없음 — 정상 경계 준수)
  - 위치: `spec/5-system/4-execution-engine.md:331-332`(§3.0 — `` `CONTAINER_MISSING_EMIT` 에러로 실행 실패``), 그 외 `spec/3-workflow-editor/2-edge.md:202`·`spec/3-workflow-editor/0-canvas.md:636`·`spec/4-nodes/1-logic/0-common.md:83`·`spec/4-nodes/1-logic/7-map.md:179-180`·`spec/4-nodes/1-logic/9-foreach.md:209-210` (전부 `plan/in-progress/spec-draft-nullable-notation-followups.md:3427-3446` 이 열거)
  - 상세: `4-execution-engine.md §3.0` 을 직접 열어 "emit 포트에 연결된 body 노드가 0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**" 문구를 확인했다 — 코드가 `.code` 필드 없이 메시지 접두만 낸다는 실측(위 항목)과 다르게 여전히 "에러"(코드에 준하는 존재)처럼 서술한다. 반면 `spec/4-nodes/1-logic/3-loop.md:189-191` 은 이미 발행 문자열 전문을 인용하는 정확한 선례 형태를 갖고 있다(plan 이 이를 "통일할 선례"로 지목). 이 불일치는 **이번 코드/가이드 변경이 만든 것이 아니라 이번 변경이 가이드 쪽만 실측에 맞게 고치면서 이미 존재하던 spec-코드 간극을 spec-가이드 간극으로 이동시킨 것**이다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목(`:3427`, `:3448`)이 미체크(`- [ ]`) 상태로 이미 이 6파일 + `3-error-handling.md §1.4` "앵커 없는 코드 7종" 처분을 planner 턴으로 명시적으로 넘겨 두었다 — CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙을 정확히 따른 것으로 판단된다.
  - 제안: 코드/가이드 유지 — 정정 방향은 옳다(실측이 뒷받침). spec 반영은 `project-planner` 가 `plan/in-progress/spec-draft-nullable-notation-followups.md:3427-3468` 의 두 미체크 항목을 통해 `spec/5-system/4-execution-engine.md §3.0` 외 5개 spec 파일에서 "CONTAINER_* 는 메시지 접두이며 구조화 코드 아님"으로 정정하거나(§1.4 backfill 대안 포함), 처분을 확정해야 한다. 이 리뷰는 spec 을 직접 수정하지 않는다.

- **[INFO]** `spec/conventions/user-guide-evidence.md §2` (Build-time 가드 3건 표)에 `guide-identifier-existence.test.ts` 가 등재돼 있지 않다 — 다만 이 PR 이 만든 간극이 아니라 선재 상태
  - 위치: `spec/conventions/user-guide-evidence.md:68-76`(§2 표에 `impl-anchor-existence`·`integrations-coverage`·`triggers-coverage` 3건만 등재) vs `PROJECT.md:300`("SoT: `spec/conventions/user-guide-evidence.md §2`")
  - 상세: `git show afaef5bef:PROJECT.md` 로 대조한 결과 이 SoT 포인터 문구는 이번 diff 이전부터 있었다(이번 diff 는 같은 불릿에 "발행 축(2026-09-13 추가)" 한 단락만 보탰을 뿐 SoT 참조는 바꾸지 않았다) — 이번 배치가 새로 만든 spec fidelity 문제가 아니다.
  - 제안: 이번 PR 범위 밖. 별도 트래커 항목으로 등재할 가치는 있으나(§2 표에 4번째 가드 추가 또는 SoT 문구 수정), 이 배치의 fix 대상은 아니다.

- **[INFO]** 엣지 케이스 확인 — `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 모두 토큰 중복 등록을 막는 명시적 유일성 검사가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:112`(`allowed`), `:120-121`(`registeredNonEmitted`) — 둘 다 `new Set(list.map(e => e.token))` 로만 변환, 원본 배열 길이 대비 중복 여부는 미검사
  - 상세: 두 목록 모두 현재 3~이하 항목이라 실질 위험은 낮고, 이 갭은 이번 배치가 새로 만든 것이 아니라 기존 `GUIDE_EXTERNAL_VOCABULARY` 패턴을 그대로 답습한 것이다(대칭성 유지 자체는 합리적 선택). 상한 검사(`toBeLessThanOrEqual(5)`)가 배열 `.length` 를 세므로, 중복 토큰이 들어가면 "실질 유니크 항목 수"보다 상한 도달이 빨라지는 안전한 방향의 부작용만 있다.
  - 제안: 조치 불필요 — 참고용. 목록이 커지면 `new Set(...).size === list.length` 형태의 유일성 단언을 형제 목록과 함께 추가하는 것을 고려.

- **[INFO]** `where` 필드의 파일 위치 검증(`parseWhereRefs` + `walkTree`)이 `codebase/backend/src` 로 스코프가 고정돼 있다 — 기준집합은 backend ∪ packages 인데 후자는 검증 대상에서 빠져 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:203`(`walkTree(root, ["codebase/backend/src"], …)`)
  - 상세: 현재 등록된 3개 항목(`makeshop.handler.ts`·`execution-engine.service.ts` 2회)이 전부 `codebase/backend/src` 안에 있어 오늘은 문제가 없다. 다만 향후 `codebase/packages/**` 안의 발행 지점을 등록하면 이 검증은 `hits.length !== 1` 로 **"0건"** 을 내며 `broken` 에 걸린다 — 이것은 **fail-safe**(조용히 통과하는 게 아니라 명시적으로 RED) 방향이라 데이터 유효성 결함은 아니고, 다음 등록자가 스코프를 넓혀야 함을 즉시 알게 되는 설계다.
  - 제안: 조치 불필요(현재 fail-safe). 문서화(JSDoc 한 줄)로 "backend/src 한정, packages 항목 등록 시 walkTree 대상 확장 필요"를 남기면 다음 등록자의 디버깅 시간을 줄일 수 있다.

- **[INFO]** TODO/FIXME/HACK/XXX 부재 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 전체
  - 상세: grep 결과 0건. 대신 "잔여 한계"·"한 번도 발화하지 않는다" 등 명시적 산문으로 미완결 지점을 정직하게 기재하고 있고, 각각 별도 테스트(예: "[한계] 카탈로그 탈출구는 오늘 한 번도 발화하지 않는다")로 고정돼 있어 TODO 대신 실행 가능한 단언으로 대체된 형태다.
  - 제안: 조치 불필요.

## 기능 완전성 · 반환값 · 데이터 유효성 (별도 결함 없음)

- `collectMatches`/`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/`isMessagePrefixOnly`/`parseWhereRefs`/`staleGuideEntries` 모든 함수가 모든 입력 경로(빈 배열·빈 문자열·매치 없음)에서 `Set`/`boolean`/배열을 빠짐없이 반환한다 — 코드 경로에 값 미반환 분기 없음.
- plan 의 뮤테이션 로그(§체크리스트 "뮤테이션 4건 전부 RED", §E "뮤턴트 6건 전부 RED")가 청구하는 것과 실제 코드의 방어 지점(역참조·`:`·따옴표 유형·vacuity 하한)이 diff 상에서 서로 대응됨을 직접 diff 로 확인했다 — 청구와 구현의 괴리 없음.
- `plan/in-progress/error-code-emission-axis.md` 의 체크리스트는 마지막 한 항목(`/ai-review` + `--impl-done` 라운드 5)만 미체크 상태이고, 그 항목이 정확히 지금 이 리뷰 실행에 대응한다 — plan 서술과 실제 저장소 상태(git log 상 라운드 1~4 커밋 4개 확인)가 일치한다.

## 요약

핵심 코드 변경(발행 축 수집기 3종 + 판정 함수 + 신규 예외 목록 + 대응 테스트 다수)은 4라운드에 걸친 자체 리뷰로 이미 Critical 0·WARNING 을 7건에서 1건까지 수렴시킨 상태였고, 이번 라운드에서 독립적으로 모든 "where" 실측 주장(소스 파일:줄 5갈래)을 직접 grep 으로 재확인한 결과 전부 정확했다. 새로 발견한 유일한 구조적 사안은 spec fidelity 관점의 SPEC-DRIFT — 이번에 정정된 가이드 문장이 이제 `spec/5-system/4-execution-engine.md §3.0` 등 6개 spec 파일의 "CONTAINER_* 에러로 실행 실패" 서술과 어긋나는데, 이는 이번 배치가 만든 결함이 아니라 가이드만 실측에 맞춰 먼저 고치면서 이미 있던 spec-코드 간극이 spec-가이드 간극으로 드러난 것이고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 처분 미정 상태(planner 몫)로 이미 명시적으로 등재돼 있어 developer/planner 경계를 올바르게 지켰다. 그 외에는 목록 유일성 미검사·`where` 검증 스코프가 `backend/src` 한정인 점 등 낮은 우선순위의 INFO 뿐이며, 전부 fail-safe 하거나 형제 코드의 기존 관례를 답습한 형태라 이번 배치가 새로 도입한 리스크가 아니다. TODO/FIXME 류 미완성 표식은 없고, 71/71 테스트 GREEN 을 직접 실행해 확인했다.

## 위험도

LOW
