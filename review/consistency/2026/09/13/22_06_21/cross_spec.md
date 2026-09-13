# Cross-Spec 일관성 검토 — error-code-emission-axis (round 8)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md` 등 다수
파일과 실제 코드 diff 본문을 누락했다 (기지 결함 —
`plan/in-progress/spec-draft-nullable-notation-followups.md` "consistency `--spec` 기본
예산이 conventions 를 통째로 떨군다" 항목과 동형, round 1~7 에서 반복 재현). 프롬프트
지시대로 워킹트리를 **절대경로**로 직접 열어 우회했다:

- `git diff origin/main...HEAD --stat -- codebase/ spec/` — scope(`spec/conventions/`)
  델타는 **0 파일**(`spec_impact: none` 과 일치), 실제 codebase diff 는 4 파일:
  `logic.mdx` · `logic.en.mdx` · `guide-identifier-existence.test.ts` ·
  `guide-identifier-scan.ts`.
- `git log --oneline origin/main..HEAD` 로 round 7 검토(`21_41_25`) 이후 추가된 커밋을
  확인 — `53d29a6f4`(round 7 fix) 1건뿐이고 **HEAD 가 정확히 그 커밋**이다.
- `git diff eb53aba1c 53d29a6f4 -- codebase/ spec/` 로 round 7 검토 시점 이후의 실제 변경을
  특정 — `guide-identifier-scan.ts`(SoT 인용 정정 8줄) · `guide-identifier-existence.test.ts`
  (`resolveSourceLines` 유일성 대조군 3건 25줄) 뿐이며 `spec/**` · 유저 가이드 mdx 는
  **무변경**.
- 위 diff 가 인용한 실측(`execution-engine.service.ts:7121·7125·7130`·`:8017`)을 `Read` 로
  직접 대조, `spec/5-system/3-error-handling.md §1.4`·`spec/conventions/error-codes.md`·
  `spec/conventions/user-guide-evidence.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 6-spec-file 등재분(`spec_impact`)을 재확인.

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 "코드 아님"으로 정정됐는데 spec 6파일은 여전히 에러 코드로 서술 (known-open, round 7 대비 불변, 이 PR 비차단)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` /
  `logic.en.mdx:103` — *"실패 메시지 앞에 `CONTAINER_MISSING_EMIT` 또는
  `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야
  해요."* + `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 3항목
  (실측: `MAKESHOP_UNRESOLVED_PATH_PARAM` · `CONTAINER_MISSING_EMIT` ·
  `CONTAINER_MULTIPLE_EMIT`).
  실측 근거(직접 재확인): `execution-engine.service.ts:7121·7125·7130` 은 일반
  `throw new Error(...)` 로 이 토큰을 **메시지 접두**로만 쓰고, 같은 파일 `:8017` 의 노드
  실행 기록은 `nodeExec.error = { message }` 만 남겨 구조화된 `code` 필드가 아예 없다.
- **충돌 대상**(같은 두 토큰을 인라인 코드로 표기해 구조화 에러 코드처럼 서술하는 6개
  spec 파일):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"`CONTAINER_MISSING_EMIT`
    **에러로 실행 실패**."* (가장 강한 형태)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — 검증 결과 표에 코드로 등재
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 형제 `CONTAINER_INVALID_CHILD`·
    `CONTAINER_CYCLE` 도 동형
  - `spec/4-nodes/1-logic/0-common.md:83`
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — "코드" 열
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — "메시지 / 코드" 합성 열
  - (대조군: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 열 헤더 "메시지" + 발행 문자열
    전문을 실어 target 의 새 서술과 이미 정합 — 통일 시 이 패턴을 따르면 됨)
- **상세**: `spec/conventions/error-codes.md`·`spec/5-system/3-error-handling.md §1.4`
  어느 쪽에도 이 두 토큰이 정식 카탈로그 항목으로 등재돼 있지 않다. 이 PR 이
  `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 "구조화 코드가 아니다" 를 코드 레벨로 고정했는데,
  위 6개 spec 파일은 여전히 같은 두 토큰을 구조화 에러 식별자처럼 서술한다.
- **CRITICAL 이 아닌 이유**: 런타임 계약은 어느 서술이든 결국 `Error.message` 로만
  전파되므로 작동 불가를 유발하지 않는다. 순수 문서 층위 불일치이며, 이 6개 파일을 근거로
  향후 클라이언트 분기 코드를 작성하거나 §1.4 카탈로그에 그대로 추가하면 실측과 충돌하는
  방향의 위험이다.
- **round 8 변경분 확인**: round 7 검토(`21_41_25`) 이후 `spec/**` 도 두 mdx 도 건드리지
  않았음을 diff 로 재확인 — **이번 라운드가 만든 새 불일치가 아니다.**
- **제안 / 재등록 불요**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  planner 소유 항목(*"spec 6파일이 `CONTAINER_*` 를 «코드» 로 적는다"*, 미체크)이 6개
  파일을 정확히 열거하며 `spec_impact` 에도 6개 전부 등재돼 있음을 확인했다(`grep` 대조).
  처분 형태는 `3-loop.md §6` 패턴(열 헤더 "메시지" + 발행 문자열 전문 인용) 통일 권장.
  `spec/` 쓰기는 planner 권한이라 이 PR(`developer`)의 `spec_impact: none` 은 타당하다.

### [WARNING] `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용"과 "정상 앵커 없음"을 구분하지 않는다 (known-open, round 7 대비 불변, 이 PR 비차단)

- **target 위치**: `guide-identifier-scan.ts` 의 `collectQuotedLiterals` /
  `collectMessagePrefixes` / `isMessagePrefixOnly` / `collectCatalogCodes` — 카탈로그를
  "요구 조건이 아니라 탈출구" 로 쓰도록 §1.4 서술에 의존해 설계했다.
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 머리말(*"나머지 7종은 앵커 없는
  맨 문자열"*)과 표 — `RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/
  `CYCLE_DETECTED` 등 7종을 앵커 없이도 정식 카탈로그 항목으로 등재.
- **상세**: `MAX_ITERATIONS_EXCEEDED`(`loop-executor.ts` 의
  `throw new Error('MAX_ITERATIONS_EXCEEDED: …')`)와 `CONTAINER_MISSING_EMIT` 은 발행
  형태가 **구조적으로 동일**(둘 다 일반 `Error` 의 메시지 접두)한데 전자만 §1.4 카탈로그에
  있고 후자는 없다. §1.4 는 "앵커 없음" 과 "카탈로그 등재 여부" 만 구분할 뿐 "메시지 접두로만
  발행" 이라는 세 번째 축을 spec 본문에서 명시하지 않는다 — 이 PR 의 하네스가 실측으로 그
  구분을 임시 봉합한다.
- **제안 / 재등록 불요**: 위 항목과 **같은** planner 트래커 항목(*"§1.4 의 «앵커 없는 코드»
  7종이 실제로는 메시지 접두다 — 카탈로그 표기를 정할 것"*, 미체크)이 택일 (a)
  `CONTAINER_*` 를 §1.4 에 backfill, (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가를
  제시하며, `error-code-emission-axis` plan 과 **양방향 역참조**가 걸려 있음을 두 문서
  모두에서 확인했다(round 7 이 보강). 어느 쪽을 택하든 이 PR 의 `GUIDE_NON_EMITTED_VOCABULARY`
  등록 2건(`CONTAINER_*`)이 불필요해질 수 있음을 plan 이 조건부로 이미 적어 두었다.

### [정보 — 비이슈 확인] round 7→8 diff(`eb53aba1c`→`53d29a6f4`)는 cross-spec 결론에 영향 없음

round 7 이후 추가된 유일한 코드 변경은 (1) `resolveSourceLines` 유일성 가드의 분기 대조군
3건(테스트 전용, spec 인용 없음), (2) `guide-identifier-scan.ts` 헤더 SoT 인용을
`user-guide-evidence.md` 단독 → `error-codes.md`/`3-error-handling.md §1` + "가족 규약은
`user-guide-evidence.md` 이나 §2 표에 미등재" 로 정정한 것이다. 후자는 SoT 인용의 **정확성**
문제(착지 여부)로 `convention_compliance` 체커의 영역이며, 본 체커의 6개 관점(데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 중 어느 것과도 직접 충돌하지 않는다 —
새 데이터 모델·엔드포인트·상태 머신·권한 구조를 도입하지 않았고, 인용 대상 문서(`error-codes.md`
§1의 명명 규율, `3-error-handling.md §1.4` 의 카탈로그 서술)와 코드 주석 내용이 실측과
정합함을 직접 확인했다(위 §1.4 인용문 원문 대조 일치).

## 요약

이번 라운드(round 8)는 round 7 검토(`21_41_25`) 이후 추가된 유일한 커밋(`53d29a6f4`)이
프론트엔드 테스트 파일 내부의 유일성 가드 대조군 추가와 SoT 인용 문구 정정뿐이며 `spec/**`
도 유저 가이드 mdx 도 건드리지 않았음을 diff 로 확인했다 — **cross-spec 상태는 round 7
검토 시점과 완전히 불변**이다. 전체 브랜치 기준으로도 scope(`spec/conventions/`) 델타는
0 파일이고 `spec_impact: none` 과 일치하며, 실제 codebase 변경은 유저 가이드 문구 정정 2건
+ 그 가이드를 검증하는 프론트엔드 발행-축 테스트 하네스뿐이라 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임의 **정면 충돌(CRITICAL)은 없다**. 다만 이 PR 이
실측대로 정확히 고친 "`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 는 구조화 코드가
아니라 메시지 접두" 라는 사실이, 6개 spec 문서의 "…에러로 실행 실패/거부" 류 서술 및
`3-error-handling.md §1.4` 카탈로그의 "메시지 접두" 미구분과 계속 어긋난다 — 둘 다
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로
정확히 등재돼(`spec_impact` 6파일 전수 확인, 양방향 역참조 확인) 미체크 상태로 이월 중이며,
`spec/` 쓰기는 developer 권한 밖이므로 이 PR 의 `spec_impact: none` 스코프는 타당하다. 새
backlog 재등록은 불요하며, 이 PR 을 이유로 한 차단 사유도 없다.

## 위험도

LOW
