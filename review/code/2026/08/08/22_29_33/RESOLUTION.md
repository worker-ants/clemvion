# RESOLUTION — 22_29_33 (타겟 재리뷰: 개명 델타 5파일)

본 세션은 `20_53_48` 리뷰 **이후에** 발생한 코드 변경(`--impl-done` WARNING fix =
`resolveWorkspaceContext` → `resolveRequestWorkspaceContext` 개명 + docstring)만을
대상으로 한 타겟 재리뷰다. push 게이트가 "리뷰 이후 코드가 변경됨" 으로 차단해 정상
절차로 해소했다 (`BYPASS` 미사용).

**Critical 0 · WARNING 4 · INFO 13 · risk MEDIUM.** reviewer 14/14 전원 결과 확보.

## 조치 항목

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| W1 | ARCHITECTURE / SIDE_EFFECT | `handlerConsumesWorkspaceId` 가 Nest 비공개 `ROUTE_ARGS_METADATA` + 함수-identity 비교에 의존 → 가정이 깨지면 멤버십 검증이 **조용히 fail-open** | **후속 분리** | reviewer 5명이 각기 지적했으나 **전원이 "현재는 테스트로 방어됨, 즉시 조치 불요"** 로 판정. 처방(공식 `SetMetadata`+`Reflector` 확장점 전환 또는 부트타임 캐너리)은 **설계 변경**이라 P0 보안 fix 와 같은 PR 에서 하면 blast radius 가 커진다 |
| W2 | MAINTAINABILITY | `canActivate` 순환복잡도 ~10 | **무조치 종결** | reviewer 자신이 "급하지 않음" + **"클래스 docstring 이 명시한 '검증 순서를 한 곳에서 추적 가능해야 함' 설계 의도를 해치지 않도록 과도한 파편화 지양"** 을 함께 권고했다. 이 메서드는 인가 판정 순서가 곧 보안 계약이라 한 곳에서 읽히는 편이 낫다 |
| W3 | PERFORMANCE | reflection 결과가 전역 가드 핫패스에서 요청마다 재계산(메모이제이션 없음) | **후속 분리** | performance reviewer 위험도 **LOW**. 실측 없이 넣는 캐시는 그 자체가 새 표면(무효화 시점·WeakMap 키 수명)이라, 롤아웃 후 실측으로 상위 소비자에 나타날 때 착수하는 편이 맞다 |
| W4 | API_CONTRACT | 비-UUID `X-Workspace-Id` → `getMemberRole` 이 `QueryFailedError` → **500 INTERNAL_ERROR 로 마스킹**(클라이언트 입력 오류인데 서버 오류로 보임) | **후속 분리 (선재 확인)** | **이 diff 가 만든 결함이 아니다** — 개정 전 가드도 `@Roles()` 라우트에서 header-first 값을 그대로 `getMemberRole` 에 넘겼으므로 같은 500 이 났다. 이번 변경은 그 표면을 `@WorkspaceId()` 라우트로 **넓혔을 뿐**이다. 처방(UUID 형식 검증 → 400)은 `extractWorkspaceId`/`resolveRequestWorkspaceContext` 계약 변경이라 별 항목이 맞다 |

INFO 13건은 조치 대상 아님 — 2건(테스트 엣지케이스 `tokenWorkspaceId=undefined`·`normalizeWorkspaceHeader([])`)과 CHANGELOG 보강은 후속 plan 에 함께 등재했다.

> **왜 이번 라운드에서 코드를 더 건드리지 않았나.** 이 저장소는 "fix→리뷰 stale 루프" 를
> 7라운드까지 겪은 이력이 있고, 수렴 판정 기준을 **"발견 0" 이 아니라 "발견의 성격"**
> (동작 → 구조 → 문서)으로 정해 두었다. 이번 라운드 발견은 **diff 안의 correctness 결함 0**
> 이고 전부 구조 위험(W1)·복잡도(W2)·성능(W3)·선재 에러매핑(W4)이다. 코드를 더 고치면
> 리뷰가 다시 stale 해져 3라운드가 열리는데, 그 대가로 얻는 것이 P0 보안 fix 의 착지 지연이다.

## TEST 결과

- lint : **선재 결함으로 전체 게이트 유예** — `origin/main` backend eslint 79파일/224건 실패
  (별 PR [`backend-lint-gate-broken-on-main.md`](../../../../../plan/in-progress/backend-lint-gate-broken-on-main.md),
  사용자 결정). 이 라운드가 건드린 5파일은 `npx eslint` **exit 0**(개명으로 줄이 길어져
  prettier 재포맷 1건 동반, 재확인 exit 0).
- unit : **통과** — `common/{guards,decorators,utils}` 15 suites / 159 tests.
- build : **통과** — 직전 라운드 `nest build` 이후 변경이 순수 rename + 주석이라 타입 표면 무변경.
- e2e : **면제 (직전 라운드 산출물 유효)** — 이 라운드의 변경은 **심볼 개명 + docstring** 뿐으로
  런타임 동작이 동일하다. e2e 전량 통과 기록은 `20_53_48/RESOLUTION.md`
  (`_test_logs/e2e-20260808-215248.log`, backend 261 + playwright 51)이며, 그 이후 변경된
  5파일에 동작 변경이 없음을 유닛 159건으로 확인했다.

## 보류·후속 항목

전부 [`plan/in-progress/auth-guard-reflection-hardening.md`](../../../../../plan/in-progress/auth-guard-reflection-hardening.md)
로 분리 등재했다 — `review/**` 는 SoT 가 아니라 시점 기록이므로, 미룬 항목을 여기에만 두면
이 PR 이 머지되는 순간 사라진다.

- W1 reflection fail-open 경화 (공식 확장점 전환 또는 부트타임 캐너리)
- W3 reflection 메모이제이션 (롤아웃 후 실측 선행)
- W4 비-UUID 워크스페이스 헤더 → 400 조기 거부
- INFO 2·3 테스트 엣지케이스 2건, INFO 10 CHANGELOG 보강
