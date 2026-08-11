# Plan 정합성 검토 — `webchat-boot-apibase-scheme-validation.md` 라운드 2~5 회고 절 (델타 `9416da806`)

## 검토 범위

직전 라운드(consistency `16_21_15` plan_coherence INFO)가 지적한 "회고 절 부재"를 `9416da806`
(`fix(webchat): "정확히 2곳" 이 틀렸다 — 문자열을 셌지 뜻을 세지 않았다`)이 처분했다. 이번 라운드는
그 처분으로 추가된 `## 라운드 2~5 — 같은 실패가 다섯 번 났다` 절의 **사실 주장**을 실제 커밋과
대조했다.

## 검증 방법

1. `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 커밋 이력(`git log -- <file>`)과
   각 커밋(`3f1169ab5`·`d8abc7003`·`99d3e9000`·`4479e771b`·`df1375208`·`9416da806`)의 diff 를
   직접 열어, 회고 표의 각 행("복제된 사실"/"고친 곳"/"놓친 곳")을 diff 내용과 1:1 대조.
2. 표의 라운드 번호 ↔ 리뷰 산출물 디렉터리(`review/code/2026/08/11/<ts>`,
   `review/consistency/2026/08/11/<ts>`) 매핑을 `find`/`ls` 로 실측.
3. "6명이 같은 자리를 짚었다"(라운드 3 행) 주장을 `review/code/.../15_50_53/*.md` +
   `review/consistency/.../15_50_56/*.md` 에서 `R0` 문자열을 grep 해 소스별로 카운트.
4. "#384 유래" 주장을 `git log --follow -S"host 없이 직접 로드" -- codebase/channel-web-chat/src/widget/use-widget.ts`
   로 재실행 — 첫 등장·마지막 수정 커밋을 확인.
5. plan 의 "451 passed" 수치를 `pnpm test`(channel-web-chat) 로 직접 재실행해 재현.
6. `plan/in-progress/webchat-auth-session-status-reconcile.md` 를 전문 열람해, 이 plan 이
   가리키는 후속 항목(§`applyConfig` 조용한 early return)의 커밋 참조(`d8abc7003`)와 완료조건
   표 행이 여전히 유효한지 확인.

## 대조 결과

| 표 행 | 주장 | 실측 |
| --- | --- | --- |
| 라운드1 (`15_16_20`) | boot 검증 배선 — 헬퍼 단위 테스트만 고치고 호출부 놓침 | `d8abc7003` diff 로 확인: `mergeBootConfig` 단위 테스트만 있었고 `use-widget-eager-start.test.ts` 통합 회귀 2건이 이 커밋에서 신설됨. 일치 |
| 라운드2 (`15_32_44`) | "`applyConfig` 가 자기 자리에서 실패한다"(거짓) — spec §R0 는 고치고 `safeApiBase` JSDoc 은 안 고침 | `d8abc7003` 에서 spec §R0 만 정정, JSDoc(`use-widget.ts:191`)은 `3f1169ab5` 원문 그대로 남아 있었음(grep 확인). `99d3e9000` 이 JSDoc 도 정정. 일치 |
| 라운드3 (`15_50_53`) | `§R0`→`§R7` 재번호 — spec·plan 은 갱신, 같은 커밋(`99d3e9000`)이 새로 쓴 JSDoc 은 `§R0` 죽은 참조로 남음, 6명 수렴 | `99d3e9000` diff 로 재번호(spec `R0`→`R7`)와 JSDoc 신규 문구("spec §R0 에서...") 동시 확인. `4479e771b` 가 `§R7` 로 정정. 6명 = code(`scope`·`documentation`·`side_effect`) + consistency(`convention_compliance`·`naming_collision`·`rationale_continuity`) — grep 으로 6개 파일 전부 `R0` 언급 확인. 일치 |
| 라운드4 (`16_06_02`) | "쿼리 경로는 샘플 전용이 아니다" — spec §1 은 고치고 코드 주석 2곳은 안 고침 | `4479e771b` 가 `4-security.md §1` 상호배타 서술을 정정(cross_spec WARNING 처분), `df1375208` 가 `configFromQuery` JSDoc + 직접 로드 폴백 호출부 주석 2곳을 정정. 일치 |
| 라운드5 (`16_21_15`) | 위와 같음 — 코드 주석 2곳은 고쳤으나 테스트 주석 1곳(`use-widget.test.ts:15`) 놓침 | `df1375208` 가 "grep 으로 정확히 2곳" 이라 적었으나 `direct-load 외부 입력 방어`(다른 문구, 같은 주장)가 세 번째 복제본으로 남아 있었고 `9416da806` 이 정정. 일치 |
| "출처 #384" | `a652f8733`(#384)에서 문제 주석과 `resolveIframeTarget` 이 동시 탄생, 그 사이 무수정 | `git log --follow -S"host 없이 직접 로드"` 결과 커밋 2개(`a652f8733`, `df1375208`)뿐 — 탄생과 제거만 있고 중간 수정 없음. `a652f8733` 동일 커밋에 `resolveIframeTarget`(`web-chat-sdk/src/bridge.ts`) 포함 확인. 일치 |
| "451 passed" | 최종 테스트 통과 수 | `pnpm test`(channel-web-chat) 직접 재실행 → `Tests 451 passed (451)`. 일치 |
| `spec_impact` | `4-security.md` + `2-sdk.md` | frontmatter 확인, `2-sdk.md` 는 `4479e771b` 에서 추가(round3 scope·plan_coherence·requirement 3명 지적 처분). 일치 |
| 체크리스트 "단위 6건 + 호출부 통합 3건" | 회귀 테스트 수 | `4479e771b` 에서 "2건"→"3건" 정정, 현재 값과 실제 테스트 파일 구조 일치 |

`plan/in-progress/webchat-auth-session-status-reconcile.md` 의 후속 항목(§`applyConfig` 조용한
early return)은 이번 델타(`9416da806`)가 손대지 않았고, 그 항목이 참조하는 커밋 해시
`d8abc7003` 도 여전히 유효하다(재번호·재배치 대상이 아님). 상단 "완료 조건" 표에도 해당 행이
이미 존재하며 이번 델타로 인해 무효화되거나 새로 필요해진 후속 항목은 없다.

## 발견사항

없음. 회고 절의 6개 표 행 전부, "#384 유래" 주장, plan 수치(테스트 통과 수·`spec_impact`·
체크리스트)를 실제 커밋·리뷰 산출물·재실행 테스트와 대조했으나 사실 오류·미해결 결정 충돌·
선행 plan 미해소·후속 항목 누락을 찾지 못했다. 억지로 발견을 만들지 않는다.

## 요약

`9416da806` 이 추가한 라운드 2~5 회고 절은 각 행이 실제 커밋 diff·리뷰 산출물 디렉터리와
정확히 대응하며, `git log -S` 재실행으로 "#384 유래" 주장도 재확인된다. `pnpm test` 재실행으로
"451 passed" 수치도 실측 일치했다. `plan/in-progress/webchat-auth-session-status-reconcile.md`
의 관련 후속 항목·완료조건 표는 이번 델타로 영향받지 않았고 여전히 유효하다. 이 라운드는
plan 정합성 관점에서 처분할 항목이 없다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
