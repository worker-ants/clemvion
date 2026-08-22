# RESOLUTION — `22_19_56`

**Critical 0 · Warning 1 · SPEC-DRIFT 1 · INFO 8.**

## Warning #1 — plan 체크리스트 staleness (해소)

리뷰어 지적이 맞다. `rerun-input-resolution-extract.md` 의 6개 항목이 실제로는 끝났는데
`[ ]` 로 남아 있었다. 리뷰어가 제안한 그대로 **본 PR 마무리 커밋**에서 처리했다:

- 8개 항목 전부 `[x]` (TEST WORKFLOW · `/ai-review` 포함 — 이 리뷰가 그 마지막 항목이다)
- 뮤테이션 3종 결과표를 plan 본문에 기록
- `status: in-progress` → `complete`, 상대링크 재조정 후 `plan/complete/` 로 이동

> **이 staleness 는 구조적이다** — 체크리스트의 마지막 두 항목(테스트·리뷰)은 정의상 그
> 항목을 체크하는 커밋보다 **먼저** 끝난다. 그래서 리뷰는 항상 미체크 상태를 본다.
> 이번엔 그 마무리 커밋이 같은 PR 안에 있으므로 머지 시점의 상태는 정확하다.

## SPEC-DRIFT #1 — 조치하지 않는다 (권한 밖 · 선존)

`13-replay-rerun.md` §8.1·§8.2 의 401 코드가 `UNAUTHORIZED` (규약은 `AUTH_REQUIRED`).
consistency `21_53_41` W1 과 같은 건이고, 이미 실측했다 — `http-exception.filter.ts:145` 가
`AUTH_REQUIRED` 를 내므로 **런타임은 옳고 문서만 낡았다.**

`spec/` 편집은 developer 권한 밖이라 트래커에 planner 항목으로 등재해 뒀다. 리뷰어도
*"이미 정확히 등재되어 유실 없음"* 으로 확인했다.

## INFO — 조치하지 않는 것과 그 이유

| INFO | 처분 |
| --- | --- |
| #4 JSDoc 에 `@throws`/`@param`/`@returns` 태그 추가 | **안 한다.** 비차단이고, `codebase/**` 를 리뷰 뒤에 고치면 리뷰가 stale 이 돼 라운드가 하나 더 돈다. 얻는 것(태그 3줄)보다 비용이 크다 |
| #2 `workflows.controller.ts` 와의 catch 블록 중복 | **안 한다.** 선존이고 이 PR 범위 밖. 리뷰어 제안대로 *"다음에 그 블록을 손댈 때"* 공유 헬퍼 검토 |
| #3 `resolveManualOverrideInput` 리네이밍 | **안 한다.** 리뷰어 스스로 "우선순위 낮음". 이름이 봉투 조립까지 포함하는 이유는 JSDoc 에 적혀 있다 |
| #5 비-`TriggerParameterValidationException` rethrow 캐너리 | **안 한다.** 선존 갭이고 이 PR 이 만든 것이 아니다. 백로그 후보 |
| #1 · #6 · #7 · #8 | 확인성 기록, 조치 불요 |

## 리뷰어가 독립 확인해 준 것

- **순수 extract-method**: 에러 코드 · 응답 봉투 · 검증 순서 · 반환 shape 이 한 글자도
  안 바뀜. `useOriginal` 삼항의 지연 평가로 *"원본 재사용 시 스키마 로드 생략"* 도 보존
  (security · requirement · side_effect 세 리뷰어 공통).
- **가드 무영향**: `masked-reject-callers` 커버리지가 추출로 줄지 않음 — 제 M3 뮤테이션
  실측(가드도 RED)과 같은 결론에 독립적으로 도달했다.
- **plan 번들링 정당**: `plan-lifecycle.md §3` 근거로 의도적 번들링이라 scope 위반 아님.
