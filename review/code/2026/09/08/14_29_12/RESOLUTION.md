# RESOLUTION — `review/code/2026/09/08/14_29_12` (`--route=all`, 4라운드)

Critical **0** · Warning **3** · INFO 12. forced 7/7. 셋 다 반영했다.
**세 지적이 전부 같은 클래스다** — *"문서·근거 서술이 실측과 어긋난다"*.

---

## W1 (requirement) — 같은 클래스의 **세 번째** 인스턴스

`workspace-rbac.e2e-spec.ts` 의 JSDoc 이 여전히 *"`WorkspacesService.listMembers` 가
`relations: ['user']` 로 `User` 를 전부 싣고 JS 매핑만으로 걸러낸다"* 라고 적고 있었다.
B-4 가 그것을 DB 레벨 투영으로 바꿨고, **자매 두 파일**(`workspaces.service.spec.ts`·
`user-entity-exposure.spec.ts`)의 같은 서술은 고쳤으면서 **이 파일만 빠뜨렸다.**

취소선 + 정정으로 갈고, **이 e2e 의 역할이 없어지지 않고 2차 방어선으로 바뀐다**는 것을
함께 적었다 — 투영이 넓어지거나 JS 매핑이 필드를 늘리는 것은 여전히 여기서 잡는다.

> **이 세션에서 같은 형태를 세 번 만들었다**: `__test-utils__` docstring 3개(2라운드) →
> ratchet 스크립트 2개(3라운드) → 이것(4라운드). 매번 *"바꾼 사실을 자기 서술이 못 따라간다"*
> 이고, 매번 **자매 파일 중 일부만** 고쳤다.

## W2 (testing) — 요약이 오기 전에 이미 고쳤다

`enclosingScopeName` 의 fallback 두 갈래(변수명 · `'<module>'`)가 소비 가드를 통한 간접
실행만 되고 **결과를 단언받지 않는다**는 지적. 리뷰어 개별 리포트를 먼저 읽고
`source-scan.spec.ts` 에 `describe('enclosingScopeName')` 를 추가했다 — 같은 파일의 다른 모든
export 가 자기 `describe` 를 갖는데 이것만 없었다.

**뮤테이션으로 비-vacuous 확인**: `return fallback ?? '<module>'` → `return '<module>'` 로
바꾸면 **정확히 변수-fallback 테스트 1건만** RED(265 중 1). 원복 후 265/265.

> **3라운드의 자매 갈래(`isFn`)는 지웠는데 이 둘은 테스트를 붙였다.** 기준은 *"그 갈래가
> 답해야 할 코드 형태가 저장소에 있는가"* 다 — `isFn` 은 대응 형태가 없었고(그래서 죽은
> 코드), 이 둘은 모듈 스코프 로드라는 실재 형태를 다룬다.

## W3 (dependency) — **내 주석의 전제를 내 다음 커밋이 반증했다**

`tsconfig.build.json` 의 세 번째 exclude 주석이 사유를 *"devDependency 를 끌어오지 않아
누출 축에는 안 잡히는, 죽은 코드가 번들에 실릴 뿐인 형태"* 로 적었다. 그런데 **같은 배치의
뒷 커밋**이 `source-scan.ts` 에 AST 워커를 승격하며 `import * as ts from 'typescript'` 를
넣었다 — `typescript` 는 devDependency 다(`package.json:129`, `devDependencies` 블록 내부,
실측 확인).

즉 이 축은 이제 **첫 번째 자리(`repo-guards/**`)와 같은 등급**의 devDependency 격리를 겸한다.

**빌드 안전성이 깨진 구간은 없다** — `production-build-devdep-guard.ts` 가 tsconfig 해석
기반 **디렉터리 단위**로 막고, exclude 가 import 보다 **먼저** 들어갔다. 깨진 것은 사유
문장뿐이라 그것을 갈았다.

---

## INFO 처분

12건 전부 확인 또는 이미 처분된 항목의 재확인이다.

| # | 항목 | 처분 |
|---|---|---|
| 1·2·3·4·5·6·7·10 | listMembers 투영 / pg-error SoT / 필터 확장 / 헬퍼 승격 / 신규 가드 / e2e / exclude / 개명 | 확인만 (전부 긍정) |
| 8 | `raceErrorSurfaces` 중복 | **defer 유지** — 3라운드에서 트리거(셋째 소비처)와 함께 확정 |
| 9 | `CREATOR_PROJECTION` 값 일치 | **defer 유지** — 3라운드에서 전수 실측 근거와 재개 조건 등재 |
| 11 | 4라운드 fix→review 루프, 이번 실질 diff 81줄 | 스코프 발산 없음 확인 |
| 12 | ratchet 순차 실행 | **won't-do 유지** — 1라운드에서 사유 기록 |

---

## 수렴 판단 — 여기서 멈춘다

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| 1 `12_53_08` | 0 | 1 | 문서 |
| 2 `13_34_28` | 0 | 2 | 구조 + 문서 |
| 3 `14_01_56` | 0 | 4 | 죽은 코드 1 + 문서 3 |
| 4 `14_29_12` | 0 | 3 | **전부 문서·근거 서술** |

**동작 결함은 네 라운드 내내 0건**이고, 2~4라운드가 문 것은 **전부 그 라운드의 fix 자신**이다.
4라운드 Warning 셋은 코드가 아니라 **주석·JSDoc·테스트 커버리지**이고, 그 fix 역시
주석 2건 + 테스트 1건이다 — 프로덕션 코드 **0줄**.

`--impl-done` 축은 4라운드(`14_29_13`)에서 **위험도 NONE · Warning 0** 으로 이미 완전히
수렴했다. 마지막 게이트 라운드는 push 게이트의 freshness 요건을 채우기 위한 것이다.

---

## 검증 (fix 후)

| 단계 | 결과 |
|---|---|
| lint | PASS (51s) |
| unit | PASS — backend **453 suites / 9,509** (`enclosingScopeName` 4건 추가로 9,505 → 9,509) |
| build | PASS (156s) — ratchet 둘 다 OK |
| e2e | PASS (189s) — backend **300**, playwright **51** |
