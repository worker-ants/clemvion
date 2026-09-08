# RESOLUTION — `review/code/2026/09/08/13_34_28` (`--route=all`)

**처리 방식**: main 직접 조치. Critical **0** · Warning **2** · INFO 11.
forced 7/7 확보(`--route=all` 이라 router skip, 14 reviewer 전원 실행).

**왜 2라운드인가**: 1라운드(`12_53_08`) fix 가 `codebase/**` 를 건드려 리뷰가 stale 이 됐다.
이 저장소가 기록해 둔 *"fix→리뷰 stale 루프"* 라, 남은 수정을 **모아서** 끝낸 뒤 전수 라운드를
한 번 돌렸다.

---

## WARNING (2/2 해소)

### W1. AST 워커 중복 — **다만 지적의 진단은 절반만 맞았다**

리뷰: *"신규 `enclosingMethodName` 과 형제 `enclosingName` 이 같은 책임을 각자 구현하고,
**이번에 고친 바로 그 결함 클래스가 형제에 그대로 남아 있다**"*.

**뒷부분은 사실이 아니다.** 형제 `enclosingName` 을 직접 읽어 확인했다:

| | 신규(고치기 전) | 형제 |
|---|---|---|
| 변수 선언을 만나면 | **즉시 반환** — 메서드보다 먼저 이긴다 | `fallback` 에 담아 두고 **계속 올라간다** |
| 결과 | `const saved = …` 가 `#saved` 로 잡힘 (버그) | 메서드가 있으면 항상 메서드 이름 |

즉 내 버그는 **순서**였고 형제는 처음부터 그 순서가 옳았다. 형제의 "초기자 종류를 안 본다" 는
성질은 **모듈 스코프 fallback** 에서만 발화하는데, 그 자리에서는 변수명이 최선의 라벨이라
결함이 아니다.

**맞는 것은 중복 쪽**이고, 이 저장소는 이미 `source-scan.ts` 로 스캔 로직을 승격하는 원칙을
세워 뒀다(그 파일 주석: *"walker 가 그렇게 사본 5개가 됐다"*). 그래서 **규칙을 바꾸지 않고**
형제의 알고리즘을 `enclosingScopeName` 으로 승격하고 한 갈래(초기자가 함수인 변수)만 더했다.
두 가드 모두 베이스라인 변화 **0** — 50 suites / 728 tests GREEN.

### W2. orphaned JSDoc — **고치다가 같은 것을 한 번 더 만들었다**

1라운드에서 `buildFiles` 캐싱 JSDoc 을 "vacuous 방지" JSDoc 과 그 `it(...)` **사이**에 끼워
넣어 설명이 대상에서 떨어졌다. 순서를 되돌렸다.

> **그리고 이 라운드의 W1 을 고치면서 `source-scan.ts` 에 똑같은 것을 만들었다** —
> 새 함수를 `stripComments` 의 docstring 과 그 함수 사이에 삽입했다. `stripComments` 뒤로
> 옮겼다. **한 세션에서 같은 형태 2회**다.

---

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1·2·3·8·9·10·11 | 전역 필터 / listMembers / 개명 / e2e / 의존성 / user-guide / scope | 확인만 (전부 긍정 판정) |
| **4** | fixture 가 `const saved = …` 회귀 형태를 재현하지 않는다 | **수정** ↓ |
| **5** | 리포지토리 수신자가 부분 문자열 매칭 | **수정** ↓ |
| 6 | `raceErrorSurfaces` 가 두 spec 에 중복 | **defer** ↓ |
| 7 | `findDevDepLeaks` 내부 재계산 1회 잔존 | **defer** — 가드 시그니처 변경이 필요하고 테스트 시간에만 영향 |

### INFO#4 — 프로덕션의 *우연한 모양*에 기대고 있었다

가드가 `const saved = await repo.save(t).catch(…)` 형태를 옳게 다루는지는 **`triggers.service.ts`
가 마침 그 형태라서** 실스캔으로만 간접 커버되고 있었다. 프로덕션이 모양을 바꾸면 안전망이
조용히 사라진다 — 게다가 그 형태가 바로 이 가드가 처음에 `#saved` 로 잘못 이름 붙인 회귀다.
fixture 에 `wrappedViaVariable` 음성 케이스를 넣어 직접 고정했다.

### INFO#5 — `save` 는 정확 비교, 수신자만 느슨했다

`receiver.getText(sf).includes(TRIGGER_REPOSITORY)` 는 `someTriggerRepositoryWrapper.save(…)`
까지 문다. 바로 아래에서 `save` 는 `isPropertyAccessNamed` 로 정확 비교하면서 수신자만 부분
문자열인 비대칭이었다. 같은 헬퍼로 좁혔다.

### INFO#6 — defer (fixture 중복)

`raceErrorSurfaces` 26줄이 cafe24·makeshop 두 spec 에 중복이다. **cafe24/makeshop 미러 중복은
이 저장소가 의도로 결정한 축**이지만, 리뷰 지적대로 이건 provider 무관한 Postgres 에러 모양이라
그 결정의 대상이 아니다. 다만 지금 추출하면 이 PR 이 파일을 하나 더 만들고, 두 spec 이 같은
fixture 를 공유하는 순간 한쪽 provider 의 에러 형태가 갈릴 때 되돌려야 한다. **세 번째 소비처가
생기면** 추출한다 — 그 트리거를 여기 남긴다.

---

## 이 라운드가 나 자신에게서 찾아낸 것 (리뷰 밖)

WARNING#1 을 따라 `auth-guard-reflection-hardening.md` 를 열었다가 **B-2 가 남의 계약을
깼다**는 것을 발견했다. 세 파일이 docstring 에 *"build tsc 가 `__test-utils__` 를 컴파일하므로
순수 함수만 둔다"* 를 적고 있었고, `source-scan.ts` 는 **이전 저자가 정확히 이 exclude 를
되돌린 이력**까지 적어 두었다 — *"제외를 넓히는 건 내 파일이 아니라 남의 계약을 바꾸는 일이다"*.

되돌리지 않고 문서를 고쳤다. 그 계약이 지키려던 위험(*dist 가 런타임에 jest 를 요구*)은
exclude 가 **제거**하고, 타입체크는 잃지 않는다 — ratchet 이 `tsconfig.json`(테스트 포함)을 쓰고
(`check-backend-typecheck-ratchet.py:57` 실측) B-1 이 그 ratchet 을 build 단계로 들여왔다.
세 docstring 을 취소선 + 정정으로 갈고, 그 plan 항목을 상호 참조와 함께 종결했다.

> **주석 안에 `**/__test-utils__/**` 를 그대로 썼다가 `*/` 가 블록 주석을 조기 종료시켰다** —
> 17 suite 가 `ReferenceError` 로 죽었고 prettier 가 깨진 코드를 재포맷해 잔해까지 남겼다.
> 글로브 문자열을 산문으로 바꿔 해소.

---

## 검증

| 단계 | 결과 |
|---|---|
| lint | (아래 표 참조) |
| unit | 〃 |
| build | 〃 |
| e2e | 〃 |

TEST WORKFLOW 재수행 결과는 커밋 본문에 싣는다 — 이 문서는 처분 기록이다.
