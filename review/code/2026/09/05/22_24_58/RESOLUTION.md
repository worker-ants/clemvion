# RESOLUTION — `review/code/2026/09/05/22_24_58`

전체 위험도 **MEDIUM** · Critical **0** · WARNING **4** · INFO **12**. **전건 조치 완료.**

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | `update()` 의 "생략 필드 `undefined` 덮어쓰기" 방지에 unit 회귀 없음 — e2e 단독 방어 | **unit 추가** |
| 2 | `findAll` 배열 매핑 경로의 secret strip 이 unit fixture 로 안 덮인다 (`findOneDetail` 만 보강됨) | **unit 추가** |
| 3 | `/** 트리거 응답 DTO */` 가 신설 클래스에 밀려 `TriggerDto` 가 무주석 — 이 세션 **4번째** 재발 | **재배치** |
| 4 | 스케줄 `trigger` 축소가 breaking change | **조치 완료로 간주** (3라운드 처분) |

### W1·W2 — 둘 다 "다른 코드 경로" 라서 필요했다

- **W1**: `{ name: undefined, isActive: false }` 를 넣고 `result.name` 이 원래 값으로
  남는지 단언한다. 이 값 모양이 핵심이다 — 실제 DTO 인스턴스가 `target: ES2023` 에서
  그렇게 생긴다(`useDefineForClassFields`).
- **W2**: 목록은 `findOneDetail` 과 **다른 코드 경로**(배열 `map`)다. fixture 에 비밀
  컬럼 2개와 조인 `workflow` 를 채우고, 스트립과 참조 좁힘을 함께 단언한다.

### W3 — 같은 실수를 네 번 했다

`triggers.service.ts` 상수 · `response-contract.ts` 함수 · 가드 스펙 `describe` 둘, 그리고
이번 `TriggerDto`. 전부 **기존 JSDoc 과 그 대상 사이에 새 선언을 끼워 넣은** 것이다.
편집 방식의 문제이지 개별 실수가 아니라서, 다음에 선언을 삽입할 때 **위에 붙은 주석이
누구 것인지 먼저 보는** 습관으로 옮긴다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 5 | deny-list 3벌 (fail-open) | **유예 → 이번 라운드에 4벌이 됐다.** JSDoc 에 "다음 축이 생기면 목록 대신 선언적 SoT" 를 적었다 (impl-done Critical 참조) |
| 8 | CHANGELOG 이중 빈 줄 | **정리** |
| 15 | 컨트롤러 spec 의 `update` 가 비밀 mock 을 두고도 반환값 미단언 — `create` 와 비대칭 | **대칭 복구** |
| 6·7·9·10·11·12·13·14·16 | 이미 등재 / 이월 / 확인 기록 | 조치 불요 |

INFO#11(`contractForDto` 반환값 변형 가능성)은 **하지 않는다** — `Object.freeze` 는 중첩
스키마까지 얼려야 실효가 있고, 현재 소비자는 전부 읽기 전용이다. 변형하는 소비자가 생기면
그때가 도입 시점이다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`22:39:05`) |
| unit | **PASS** (`22:40:05`) |
| build | **PASS** (`22:41:26`) |
| e2e | **PASS** — **296** 통과 (`22:44:01`) |

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다.
