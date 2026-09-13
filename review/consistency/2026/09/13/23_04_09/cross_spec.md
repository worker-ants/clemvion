# Cross-Spec 일관성 검토 — `error-code-emission-axis` (impl-done, scope=`spec/conventions/`)

`spec/conventions/` 자체의 델타는 0(코드 전용 PR)이라 검토 대상은 diff 4파일(989줄):
`codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx` ·
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-{existence.test,scan}.ts`.
이 변경이 `spec/**` 다른 영역과 새로 어긋나거나 기존 어긋남을 방치하는지를 본다.

## 발견사항

- **[WARNING]** `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 유저 가이드는 "전용 코드 없음"으로 정정했는데 spec 6파일은 여전히 정식 코드처럼 서술한다
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (diff) — "여러 개 또는 0개를 연결하면 실행이 실패하고, **실패 메시지 앞에** `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 붙어요 — **전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요**"로 수정
  - 충돌 대상:
    - `spec/5-system/4-execution-engine.md:332-333` — "`CONTAINER_MISSING_EMIT` **에러로** 실행 실패" (가장 강한 서술)
    - `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`(형제 `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE`도 동형)
    - `spec/4-nodes/1-logic/0-common.md:83`, `7-map.md:179-180`(§6 "코드" 열), `9-foreach.md:209-210`(§6 "코드" 열)
    - (대조: `spec/4-nodes/1-logic/3-loop.md:189-191`은 이미 발행 문자열 전문을 인용해 코드로 단정하지 않는 올바른 선례)
  - 상세: 실측(`execution-engine.service.ts:8017`, `nodeExec.error = { message }`)상 `code` 필드가 없어 메시지 접두일 뿐이다. 이번 diff가 사용자 대면 가이드 2곳(KO/EN)을 그 실측에 맞게 고쳤지만, 같은 사실을 서술하는 spec 6개 파일은 여전히 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 다른 정식 코드와 동일한 표기·열(`코드` 컬럼)로 적어 두어 spec 내부적으로 서로 모순인 상태가 지속된다. 데이터 계약(무엇이 "코드"인지) 정의가 영역마다 다른 전형적 Cross-Spec 충돌이다.
  - 이미 추적됨: 동일 항목이 직전 라운드(`review/consistency/2026/09/13/19_23_31` cross_spec WARNING#1)에서 이미 지적됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3474-3493`에 planner 소유 미해결 항목(`- [ ]`)으로 6개 파일 표까지 등재돼 있다. 이번 diff 자체가 신규로 만든 충돌이 아니라 **기존 충돌 중 "가이드" 쪽만 먼저 정정하고 spec 쪽 6파일 정정은 아직 남긴** 상태 — 등재는 정확하고 중복 등재 불필요.
  - 제안: planner 턴에서 택일 집행 — (a) `spec/5-system/3-error-handling.md §1.4`에 `CONTAINER_*` 를 backfill해 형제 코드와 나란히 두거나, (b) 위 6파일의 표기를 `3-loop.md` 선례(발행 문자열 인용)로 통일. 아래 두 번째 항목과 **한 턴에 묶어 처리**할 것(트래커가 이미 그렇게 요구).

- **[WARNING]** `3-error-handling.md §1.4` 카탈로그의 "앵커 없는 맨 문자열" 7종과 `CONTAINER_*`가 발행 구조상 동형인데 카탈로그 포함 여부만 다르다
  - target 위치: `guide-identifier-scan.ts`(diff)의 `collectCatalogCodes` JSDoc — "카탈로그 등재 0종…그래도 남기는 이유는 트래커 항목이 이것을 발화시킨다"
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.4` 카탈로그 표(`MAX_ITERATIONS_EXCEEDED`·`RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등 "앵커 없음"이지만 정식 카탈로그 등재) vs `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`(같은 발행 형태 `throw new Error(...: ...)`이지만 미등재)
  - 상세: §1.4는 스스로 "앵커 없는 맨 문자열"이라 인정하면서도 그 7종을 정식 카탈로그 항목으로 취급한다. 왜 `CONTAINER_*` 두 개만 그 카탈로그 밖에 있는지 §1.4 어디에도 근거가 없다 — 카탈로그 "포함/제외" 기준 자체가 미정의라는 점에서 이는 §1.4 문서 **내부** 일관성 문제이면서 위 항목의 해소 방식을 좌우하는 선결 조건이다.
  - 이미 추적됨: `plan/in-progress/spec-draft-nullable-notation-followups.md:3495-3529`에 planner 소유 항목으로 등재(원 출처 `review/consistency/2026/09/13/19_23_31` rationale_continuity WARNING#2). 같은 문서에 "§1 하위구조를 겨냥하는 plan이 이미 셋 있고 한 턴에 묶으라는 합의"가 명시돼 있어 이 항목이 넷째로 합류해야 함도 이미 기록됨.
  - 제안: 위 항목과 동일한 planner 턴에서 §1.4 표기 정책(코드/메시지-접두 구분)까지 함께 결정. 이 결정에 따라 이번 diff가 추가한 `GUIDE_NON_EMITTED_VOCABULARY` 2건 등록도 재검토 대상이 된다는 점을 diff 자신의 forward-note가 이미 언급하고 있음(정확).

- **[INFO]** `guide-identifier-existence.test.ts` 가드 패밀리가 `user-guide-evidence.md §2` 등록표에 없다
  - target 위치: `guide-identifier-scan.ts`(diff) 헤더 주석 — "이 가드는 아직 그 문서 §2 표에 없다(실측: `grep -c guide-identifier` → 0)"
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 — `impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`triggers-coverage.test.ts` 3건만 등재, `guide-identifier-existence.test.ts` 미포함(실측 확인됨: 해당 표에 `guide-identifier` 문자열 0건)
  - 상세: 가드 패밀리 규약 문서(§2)가 실제 존재하는 가드 4번째 구성원을 등록하지 않은 registry drift. diff 자체가 self-report한 정확한 관찰이며 새 결함은 아니다.
  - 이미 추적됨: `review/consistency/2026/09/13/21_41_25` convention_compliance WARNING#3에서 이미 지적된 사안(diff 주석이 직접 인용). Cross-Spec 관점에서는 심각도가 낮고(등록 누락일 뿐 모순은 아님) convention_compliance 축의 소관이 더 크므로 여기서는 참고용 INFO로만 기록.
  - 제안: planner가 §2 표에 4번째 행 추가(별건, 급하지 않음).

## 요약

이번 diff(logic 가이드 2곳 정정 + `guide-identifier-*` 발행 축 테스트 추가)는 `spec/conventions/`를 직접 건드리지 않았고, 새로 만든 Cross-Spec 충돌도 없다. 다만 diff가 정정한 유저 가이드 문구("CONTAINER_* 는 전용 코드가 아니라 메시지 접두")는 `spec/5-system/4-execution-engine.md`·`spec/3-workflow-editor/{0-canvas,2-edge}.md`·`spec/4-nodes/1-logic/{0-common,7-map,9-foreach}.md` 6개 spec 파일이 여전히 같은 대상을 정식 코드처럼 서술하는 것과 정면으로 어긋나는 상태를 그대로 남겨 두었다. 이 불일치는 이번 라운드가 처음 발견한 것이 아니라 직전 cross_spec 라운드(19_23_31)가 이미 WARNING으로 등재했고, `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 소유 미해결 항목(§1.4 카탈로그 정책 항목과 함께 "한 턴에 묶어 처리" 합의 포함)으로 정확히 캡처돼 있다. 즉 이번 PR은 spec 델타가 0인 코드/문서 전용 변경으로서 자신의 책임 범위(developer 권한) 안에서 할 수 있는 절반(가이드 문구 정정 + 가드 등록)만 마치고, 나머지 절반(spec 6파일 정정 및 §1.4 카탈로그 정책 결정)을 planner 턴으로 명시적으로 넘긴 상태 — 이는 은폐가 아니라 정확한 인계다. Cross-Spec 관점에서 이 PR을 BLOCK할 이유는 없으나, 후속 planner 턴이 위 두 WARNING을 한 번에 정리하지 않으면 동일 지적이 계속 재등장할 것이다.

## 위험도

LOW
