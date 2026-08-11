# 요구사항(Requirement) Review — `10_58_43`

## 스코프 확정

이번 라운드의 실제 신규 delta 는 이전 리뷰(`review/code/2026/08/11/10_41_08`)가 낸 testing WARNING(W7:
`shouldAbortAfterSeed` 가 module-private 라 직접 테스트 불가) 을 반영한 커밋 `37b38cf31` 하나다.
`git show --stat 37b38cf31` 로 확인한 변경 파일은 4개뿐이다:

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `type SeedOutcome` / `function shouldAbortAfterSeed`
  앞에 `export` 추가, JSDoc 에 `@internal — unit-test seam only` 블록 추가, `sseErrorDetail` JSDoc 정리,
  `applyConfig` 내부 주석 라벨 정정("(실측)" → 근거 재서술), `seedWaitingFromStatus` `@returns` 에 CRITICAL
  근거 단일화 문장 추가.
- `codebase/channel-web-chat/src/widget/use-widget.test.ts` — `shouldAbortAfterSeed`/`SeedOutcome` import 추가,
  진리표 단언 2건(`ended`/`stale`/`continue`/`refresh_deferred` 4갈래 + fail-closed) + `sseErrorDetail` 의
  `readyState: undefined` 축 1건 = 신규 `it()` 3건.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 주석 2곳(존재 이유 설명 추가,
  `4-security §5` → `§1`(표 "에러 메시지 노출") 인용 정정).
- `plan/in-progress/webchat-auth-session-status-reconcile.md` — "(실측)" 라벨을 "(정적 추적 — 재현 시도는
  실패했고, 그건 부재의 증거가 아니다)" 로 정정.

diff 상 함수 본문(로직 바이트)은 `export` 키워드 추가를 제외하면 **한 글자도 바뀌지 않았다** — 순수
추가(테스트 seam 노출 + 신규 단언)와 주석/라벨 재서술뿐이다.

## 검증 (직접 실행)

- `npx vitest run` (channel-web-chat 전체): **23 files / 442 passed** — `RESOLUTION.md`(`10_41_08`)가 적은
  수치와 정확히 일치.
- `npx tsc --noEmit`: **0 errors**.
- `grep -rn "4-security §5" src`: **0건** — "저장소 잔존 0건" 주장 확인.
- `spec/7-channel-web-chat/4-security.md` §1 표에서 "에러 메시지 노출" 행(line 38) 확인 — 정정된 인용
  (`§1(표 "에러 메시지 노출")`)이 실제로 맞는 위치를 가리킴. §5 는 "프라이버시 / 데이터 처리"로 무관.

## 판정 (a) — `shouldAbortAfterSeed`·`SeedOutcome` 를 `export` 로 노출한 것

**문제 아님.** 근거:

1. **기존 컨벤션과 동형**: 같은 파일에 이미 `sseErrorDetail`, `safeApiBaseFromQuery`, 그리고 재수출된
   `refreshDelayMs`/`TOKEN_REFRESH_LEAD_MS`/`TOKEN_REFRESH_MIN_DELAY_MS` 가 정확히 같은
   `@internal — unit-test seam only` JSDoc 패턴으로 이미 `export` 돼 있다(`use-widget.ts:26, 175, 211`).
   신규 export 2개는 새 패턴을 만든 게 아니라 기존 패턴을 한 자리 더 적용한 것이다.
2. **소비 범위가 안 넓어짐**: `use-widget.ts` 는 발행되는 패키지의 public entry 가 아니라 이 SPA
   (`channel-web-chat`, Next.js CSR) 내부 모듈이다. `grep -rl "useWidget" src` 결과 이 훅을 프로덕션에서
   import 하는 곳은 `widget-app.tsx` 단 하나이며, `shouldAbortAfterSeed`/`SeedOutcome` 를 그쪽이나 다른
   프로덕션 파일이 import 하지 않는다(테스트 파일만 import). TS 모듈 레벨 `export` 는 번들 트리셰이킹이나
   실행 시 동작에 영향이 없다 — 함수는 이미 훅 본문에서 호출돼 번들 포함이 확정적이다(10_41_08 side_effect
   가 동일 논거로 검증).
3. **spec 이 이 표면을 규율하지 않음**: `spec/` 어디에도 이 훅의 내부 헬퍼 export 여부를 규정하는 계약이
   없다(`spec/conventions/` 에 "test seam export" 관련 규약 검색 결과 0건). §3.1-2/§R4/§3.1-3 은 *행위*
   (재로드 복원 시퀀스·REST 오류 분기·토큰 refresh)를 규정하지, 순수 판정 함수의 module-boundary 를
   규정하지 않는다 — 회색지대이므로 spec fidelity 관점에서도 INFO 이상이 아니다.

## 판정 (b) — `status: implemented` 는 여전히 참인가

**참, 그리고 이번 delta 로는 흔들릴 여지가 구조적으로 없다.** `spec/7-channel-web-chat/3-auth-session.md`
frontmatter 의 `code:` 목록(`session-store.ts`/`eia-client.ts`/`use-widget.ts`/`use-session-generations.ts`/
`use-token-refresh.ts`)이 이번 delta 가 건드린 파일과 겹치는 지점은 `use-widget.ts` 뿐이고, 거기서 바뀐 것은
`export` 키워드·JSDoc·주석 라벨뿐이다. `shouldAbortAfterSeed` 의 반환 로직(`outcome !== "continue" &&
outcome !== "refresh_deferred"`)은 바이트 단위로 그대로이고, 호출부 2곳(`start()`/`applyConfig`, 각각
`use-widget.ts:866, 1227`)도 변경이 없다. 즉 §3.1-2(REST 오류 분기)·§R4(401 낙관적 refresh)·§3.1-3 이
규정하는 *행위*는 이번 delta 이전과 이후가 논리적으로 동일한 함수이므로, 직전 라운드(`10_41_08`)가 spec
원문과 line-level 대조로 "세 요구사항 모두 빠짐없이 구현" 이라 내린 판정은 이번 delta 로 재검증할 필요
자체가 없다 — 재검증했다면 같은 결론이 나올 수밖에 없는 구조(순수 테스트 추가)다. 직접 돌린 vitest(442
passed)·tsc(0 errors) 도 이를 뒷받침한다.

## 발견사항

- **[INFO]** `SeedOutcome` 을 export 하면서 4번째 갈래(`"refresh_deferred"`)의 JSDoc 이 참조하는
  근거 앵커(`@returns`)와, `shouldAbortAfterSeed` JSDoc 의 "다섯 번째 갈래를 추가하려는 사람에게" 절이
  이제 타입 자체가 export 돼 다른 파일에서도 `import type { SeedOutcome }` 로 재사용될 수 있는 표면이
  됐다 — 현재는 테스트 파일만 소비하므로 문제는 아니지만, 향후 실제 프로덕션 재사용이 생기면 그 시점에
  "다섯 번째 갈래" 확장 규율(§꼬리 블록 중복 경고, `use-widget.ts:135-140`)이 그 소비처에도 적용되는지
  재확인이 필요하다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:84, 142` (export 선언부)
  - 상세: 현재는 회색지대(spec 침묵) — 조치 불요, 참고용 기록.
  - 제안: 조치 없음. 프로덕션 소비처가 생기는 시점에 재판정.

- **[INFO]** fail-closed 테스트(`shouldAbortAfterSeed("something_new" as SeedOutcome)`)는 타입 우회
  캐스팅을 쓴다 — 의도된 설계(JSDoc 이 명시)이고 TS 의 exhaustiveness 를 우회해야만 다섯 번째 갈래
  회귀를 잡을 수 있다는 사실 자체가 요점이므로 문제 아님.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts` — `describe("shouldAbortAfterSeed — 중단 판정 진리표"` 블록.
  - 상세/제안: 조치 불요.

CRITICAL·WARNING 없음.

## 요약

이번 라운드의 실질 delta(`37b38cf31`)는 `git show --stat` 로 확인한 대로 4개 파일에 한정되며, 로직 변경은
0바이트다 — `export` 키워드 2개 추가(기존 `sseErrorDetail`/`safeApiBaseFromQuery` 와 동일한
`@internal — unit-test seam only` 컨벤션 재적용), 신규 단위 테스트 3건(진리표 2건 + `readyState: undefined`
축 1건), 그리고 주석/인용 정정 2건(§5→§1 인용, "(실측)" 라벨 재서술)이다. (a) export 노출은 기존 컨벤션의
연장이고 프로덕션 소비 범위를 넓히지 않으며 spec 이 이 표면을 규율하지 않으므로 문제가 아니다. (b)
`status: implemented` 는 이번 delta 가 로직을 건드리지 않았으므로 직전 라운드(`10_41_08`)의 참 판정이
그대로 유지된다 — 재판정이 필요한 실질 변경 자체가 없었다. vitest 442 passed·tsc 0 errors 직접 재실행으로
확인했고, 두 라운드 연속이던 CRITICAL 0 은 이번에도 유지(신규 CRITICAL/WARNING 0)된다.

## 위험도

NONE

STATUS: DONE
