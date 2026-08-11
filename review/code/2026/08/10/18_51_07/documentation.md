# Documentation Review — `18_51_07`

## 재판정 지시 결과 (핵심)

호출자가 지목한 4개 축(`seedWaitingFromStatus` JSDoc 전체 5개 불릿, `SeedOutcome`, `shouldAbortAfterSeed`,
`useTokenRefresh`) + `redactToken` JSDoc 을 코드 본문과 대조했다. `codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-token-refresh.ts`, `codebase/channel-web-chat/src/lib/eia-client.ts` 를
직접 열어 각 문서 문장과 실제 분기·반환값·호출부를 1:1 대조했다.

- **`seedWaitingFromStatus` JSDoc (§REST 오류 분기 5개 불릿 + `@returns`)**: 5개 불릿 전부 코드와 일치.
  `404→"ended"`(`use-widget.ts` 706-709행), `401→recoverFromExpiredToken`(716-717행) 안에서
  성공 시 `"continue"`(519행)·재차 401/410 시 `"ended"`(550-551행)·그 외 실패 시 `"refresh_deferred"`(541행),
  `getStatus` 자체의 그 외 오류는 여전히 `"continue"` soft-fail(719-723행). `@returns` 절도 `"ended"`/`"stale"`
  둘 다 건너뛰고 `"refresh_deferred"` 는 스트림만 건너뛴다는 구분을 정확히 서술 — 실제 두 호출부(825-852행,
  1188-1215행)의 `shouldAbortAfterSeed` → `deferredStreamRef` 배선과 일치.
- **`SeedOutcome`**: 4개 리터럴(`"ended"`/`"stale"`/`"continue"`/`"refresh_deferred"`) 각각의 JSDoc 설명이
  실제 반환 지점·용도와 부합.
- **`shouldAbortAfterSeed`**: `outcome !== "continue" && outcome !== "refresh_deferred"` 구현과
  "화이트리스트라 fail-closed" 서술이 일치. "뮤테이션 메모"(블랙리스트로 바꿔도 현재 union 에선 동치)도
  실제 union 이 4개 리터럴로 닫혀 있는 사실과 부합.
- **`useTokenRefresh`**: 헤더 docstring 의 "실패는 두 갈래"(401/410 즉시 중단 vs 그 외 지수 백오프 재예약),
  `@returns` 의 `scheduleRefresh`/`clearRefreshTimer` 역할 서술이 실제 구현(179-201행)·소비부
  (`use-widget.ts` 271-277, 308-351행의 `teardownSession` 이 `clearRefreshTimer` 호출)과 일치.
- **`redactToken`**: JSDoc 은 "쿼리의 `token=` 값만 지운다, 인접 파라미터는 보존" 이라고만 약속하고,
  실제 정규식 `/([?&]token=)[^&\s"']+/gi` 도 정확히 그 범위(선행 `?`/`&` + 리터럴 `token=`)만 치환한다.
  과장된 약속(예: 헤더·바디의 토큰까지 지운다는 식의 문구) 없음 — JSDoc이 규정한 범위 = 정규식이 실제로 하는 일.
  테스트(`eia-client.test.ts` 288-300행)도 이 범위와 정확히 일치.

**결론: 재판정 대상 5개 전부 코드와 일치. 낡은 곳 없음.**

## 새로 발견한 CRITICAL — 이번 diff가 build gate 를 깨뜨린다

- **[CRITICAL]** `plan/complete/webchat-reload-rest-error-branches.md` 가 `spec_impact` frontmatter 없이
  `plan/complete/` 에 신설돼 Gate C 빌드 가드를 실패시킨다.
  - 위치: `plan/complete/webchat-reload-rest-error-branches.md:1-5` (frontmatter 블록 — 이 파일은
    본 diff 가 신설한 파일이라 프롬프트에 diff 가 생략돼 있었으나, `git diff origin/main...HEAD --stat`
    으로 이 브랜치가 추가한 110줄짜리 신규 파일임을 확인했다.)
  - 상세: `.claude/docs/plan-lifecycle.md §5 (Gate C)` 는 "완료(`complete/` 이동) plan 은 frontmatter 에
    `spec_impact` 를 선언한다(spec path 목록 또는 `none`)" 를 의무로 못박고,
    `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 가 `started` 컷오프
    (`2026-06-04` 이후)를 기계적으로 강제한다. 이 파일의 frontmatter 는
    ```
    worktree: (unstarted)
    started: 2026-08-10
    owner: project-planner
    ```
    뿐이고 `spec_impact` 가 없다 — `started: 2026-08-10` 은 컷오프 이후라 grandfather 예외도
    적용받지 못한다. 실제로 `npx vitest run src/lib/docs/__tests__/spec-plan-completion.test.ts`
    를 돌려 확인했다:
    ```
    FAIL  ... > Gate C — plan-completion spec-consistency
      > plan/complete/webchat-reload-rest-error-branches.md > declares `spec_impact`
    AssertionError: ... expected false to be true
    Test Files  1 failed (1)
         Tests  1 failed | 813 passed (814)
    ```
    스위트 전체에서 유일한 실패이고, 실패 원인은 정확히 이 diff 가 신설한 파일이다. 이 plan 은
    같은 diff 안에서 `spec/7-channel-web-chat/3-auth-session.md` frontmatter 의 `code:` 목록을
    실제로 갱신했으므로(`use-token-refresh.ts` 추가 등) `spec_impact` 값 자체는 자명하다 —
    선언만 누락됐다.
  - 제안: 이 plan frontmatter 에 `spec_impact: [spec/7-channel-web-chat/3-auth-session.md]`
    (필요 시 `0-overview.md` 도 함께 건드렸으므로 그 경로도) 추가. 한 줄 추가로 해결되고,
    누락 시 이 브랜치의 build/CI 가 이 테스트에서 그대로 깨진다.

## 부가 관찰 (INFO, 조치 선택)

- **[INFO]** 같은 파일의 frontmatter `worktree: (unstarted)` 가 본문 첫 줄 "**상태**: **완료**"와
  어긋난다. `plan-lifecycle.md §4` 상 이 필드는 `plan/complete/**` 에는 강제되지 않아 가드는
  통과하지만, `started: 2026-08-10`(실제 작업일)과 `worktree: (unstarted)`(미착수 의미)가
  같은 프론트매터 안에서 모순돼 다음 독자가 헷갈릴 수 있다. 위치: 같은 파일 1-4행.
  제안: `worktree:` 를 실제 작업 브랜치/디렉터리명으로 갱신하거나, 관례상 완료 plan 에서는
  이 필드를 생략해도 무방하다면 그렇게 정리.
- **[INFO]** CHANGELOG 신규 항목(`CHANGELOG.md:166-174`, "웹채팅 위젯: 재로드 복원의 `404`·복구불가
  `401`/`410` REST 분기")은 spec 링크를 제목에 이미 인라인으로 넣어 뒀는데, 바로 아래·위 형제
  항목들(176-191행, 193-203행)은 본문 끝에 별도 `SoT:` 줄을 둔다. 강제 규약 문서는 없어 이대로도
  무방하지만, 스타일을 형제 항목과 맞추고 싶다면 끝에 `SoT: spec/7-channel-web-chat/3-auth-session.md
  §3.1-2·§R4.` 한 줄을 추가할 수 있다. 조치 불필요.

## 요약

호출자가 지목한 CRITICAL/WARNING 2건은 실제로 반영됐고, 재판정 범위(`seedWaitingFromStatus` 5개 불릿·
`SeedOutcome`·`shouldAbortAfterSeed`·`useTokenRefresh`·`redactToken`)를 코드와 전수 대조한 결과 낡은
서술은 없었다 — 이번 라운드의 "문서 정정" 작업 자체는 코드와 정합하다. 다만 그 정정 과정에서 새로
만든 `plan/complete/webchat-reload-rest-error-branches.md` 가 `spec_impact` frontmatter 를 선언하지
않아 Gate C 빌드 가드(`spec-plan-completion.test.ts`)를 실측으로 깨뜨리는 것을 발견했다 — 이 diff 가
push 되면 CI 가 그대로 실패한다. 한 줄 추가로 해결 가능한 성격이지만, 놓치면 확실히 차단되므로
CRITICAL 로 분류한다.

## 위험도

**HIGH** — CI 를 확실히 깨뜨리는 CRITICAL 1건(수정 비용은 낮음). 재판정 대상 문서 자체는 전부 정합이라
그 축만 보면 NONE 이지만, 새로 발견된 build-gate 실패가 전체 위험도를 끌어올린다.
