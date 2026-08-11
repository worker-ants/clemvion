# Code Review 통합 보고서 — typescript-toolchain-followups (최종 라운드)

- 대상: `claude/typescript-toolchain-followups` · diff-base `origin/main`
- forced 7명 **전원** 리포트 확보 (security · testing · scope · side_effect · maintainability ·
  requirement · documentation)
- 직전 라운드(`11_22_14`)의 WARNING 조치분(`76f9aa0f2`)까지 포함해 재검토한 라운드다.

## BLOCK: NO

**Critical 0 · WARNING 0.** 전체 위험도 **LOW**.

## Critical / 경고

없음.

## 참고 (INFO)

전 reviewer 합계 INFO 18건. 성격별로 묶으면 셋이고, 셋 다 조치하지 않는 근거가 있다.

| 묶음 | 내용 | 판단 |
|---|---|---|
| 설계상 경계 | blind YAML/셸 파서의 한계, 정규식 보간이 하드코딩 상수만 받음, `ROOT` 경로 조합에 외부 입력 없음 | **의도된 설계**다. blind 파서 경계는 `#970` 이 세운 "막는 쪽은 무지하게" 원칙 그대로 |
| 하위 호환 확인 | `_shared.ts` 의 신규 공개 심볼 3종, 선택적 DI 파라미터 2개, 모듈 최상위 `ROOT = repoRoot()` 트리거 지점 이동, `loadTypescriptFrom` 반환 타입 | 전부 **default 보존 / 타입 전용**임을 리뷰어들이 직접 확인했다. 런타임 동작 무변경 |
| 문서 스타일 | `loadTypescriptFrom` 의 타입 근거가 JSDoc 밖 `//` 주석, `__tests__/` 구조 개요 문서 부재, `_` 파일명 규칙 미문서화 | 첫째는 **의도** — 그 문단은 리팩터 이력이지 호출자 계약이 아니다(계약은 JSDoc 안). 둘째는 리뷰어 자신이 "필수 아님" 판정, **가드 3개 이상**이 트리거 |

requirement 가 지적한 plan 의 테스트 수 스냅샷 stale(282/5862 → 284/5920)은 **정정했다**.

## 라운드 추이 — 수렴 근거

이 저장소는 과거 fix→리뷰 stale 루프를 7라운드 돈 전례가 있어, 수렴을 "발견 0" 이 아니라
**발견의 성격**으로 판단한다.

| 라운드 | 세션 | reviewer | Critical | WARNING | 성격 |
|---|---|---|---|---|---|
| R1 | `10_54_59` | 8 (router 선별) | 0 | 3 | 구조·문서 혼재 |
| R2 | `11_08_01` | 4 | 0 | 3 | 구조 1 + 문서 2 |
| R3 | `11_15_05` | 3 | 0 | 1 | 순수 문서 |
| R4 | `11_22_14` | 7 (forced 전원) | 0 | 1 | 테스트 소유권 |
| **R5** | `11_44_32` | **7 (forced 전원)** | **0** | **0** | INFO 만 |

## 이 티켓이 반복해 드러낸 것 — 같은 결함 클래스 3회

세 WARNING 이 전부 **"내가 세운 방어를 자매에 안 미침"** 이었다.

1. **R1** — 파서를 `_shared` 로 옮기며 원래 **비공개**였던 `blockRange`/`findKeyLine` 까지
   재export 했다. 이관의 부산물로 없던 공개 표면이 두 모듈에 생겼다 — 이관이 API 를 넓히면
   그건 이관이 아니다.
2. **R2** — `discoverWorkspaceDirs` 에는 `readLines` 주입을 넣어 fail-closed 를 합성으로
   겨냥해 놓고 `repoRoot` 에는 안 넣었다. 그 함수의 throw 는 `__dirname` 하드코딩 탓에
   **테스트가 불가능**한 채였고, 이 모듈은 두 가드의 공용 기반이라 파급이 가장 크다.
3. **R4** — `shared.test.ts` 를 "소유 모듈이 자기 프리미티브를 직접 테스트한다" 는 근거로
   만들어 놓고 `repoRoot` 에만 적용했다. `listAtPath` 는 테스트가 소비자 파일에 남아,
   그 파일의 재export 를 정리하는 순간 커버리지가 함께 사라지는 구조였다.

셋 다 리뷰가 잡았고 전부 조치됐다. 기록해 두는 이유는 **다음 리팩터에서 같은 형태를 먼저
자문하기 위해서**다 — "이 방어를 형제에도 적용했는가".

## 검증

- `pnpm --filter frontend test` — **284 files / 5920 passed**, 1 skipped
- `pnpm --filter frontend exec vitest run src/lib/repo-guards/__tests__/` — 3 files / **82 passed**
- `pnpm --filter frontend exec tsc --noEmit` — 0 errors
- lint — 0 errors. 저장소 전체 warning 16건 중 **내 디렉터리는 1건(기존 `_drop`)**;
  13→16 증가분은 main 이 `#1123` 을 흡수하며 들어온 `plan-scan.test.ts` 쪽으로 실측 확인
- 뮤테이션 누적 **14종 전부 RED**

## 스코프 밖으로 남긴 것

§3(`catalog:` 마이그레이션) **미착수**. 세 판단 항목 중 둘을 실측으로 해소했고
(대상 = 9개 묶고 `@types/node` 제외 / lockstep 축은 무의미해지는 게 아니라 **가드가 깨진다** —
`parseMajor("catalog:")` → `null` → `unparsable` → 위반 판정), 남은 하나(dependabot 의 pnpm
catalog 지원)는 저장소 안에서 답할 수 없다. 확인 없이 옮기면 typescript 가 dependabot
시야에서 사라지고, 그건 `#1047` 을 만든 것과 같은 클래스의 사각지대다.
