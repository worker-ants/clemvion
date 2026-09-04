# RESOLUTION — 3R (`12_17_50`)

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W1 (requirement) | "경로 정규화 8곳 전부 통일" 이 거짓 — 미정규화 자리가 남아 있다 | **4곳** 정규화 (리뷰어가 지목한 2곳 + 내가 재측정으로 찾은 2곳). 재측정 결과 **0건** |
| W2 (scope) | 무관한 plan 편집(`execution-engine-residual-gaps.md`)이 3라운드 연속 지적에도 미분리 | 이 브랜치에서 **되돌렸다**. 내용은 별 브랜치로 옮겨 따로 올린다 |
| W3 (testing) | `temp-fixture.spec.ts` 의 "async 콜백이 실패해도" 테스트가 **한 번도 reject 하지 않는다** — resolve 경로를 이름만 바꿔 재검사 | 실제로 throw 하는 async 콜백으로 교체 + **unhandled rejection 누출 단언** 추가. 구현에도 `result.then(undefined, () => {})` 부착 |

## W1 — 검증 패턴이 결함을 원리적으로 못 찾았다

내가 "8곳 전부" 라고 센 패턴은 `split(path.sep).join('/')` 였다. **그 패턴은 이미 정규화된
자리만 매칭한다** — 결함은 그 문자열의 *부재*이므로 원리적으로 찾을 수 없다. **고친 것을
찾고 결함은 안 찾은 것이다.**

올바른 패턴(`path.relative(` 중 정규화 없는 것)으로 재측정하니 **4곳**이었다. 리뷰어가 지목한
것은 그중 2곳(`engine-error-code-anchor-guard.ts:170,196`)이고, 나머지 둘
(`audit-action-binding.spec.ts:62`·`websocket-events.types.spec.ts:311`)은 재측정으로 나왔다 —
**리뷰어의 목록도 좁았다.**

2R 이 `engine-error-code-anchor-guard.ts` 를 "이미 정규화된 형제" 로 인용했고 내가 그것을
실측 없이 받아들인 것이 직접 원인이다.

수정 후 재측정: **0건.**

## W3 — 뮤테이션 검증 (예측 / 실측)

| | 예측 | 실측 |
|---|---|---|
| `result.then(undefined, () => {})` 제거 | RED | **RED — 1건 실패** |
| 원복 | GREEN | **GREEN — 6건** |

종전 테스트는 콜백이 `return 1` 이라 **resolve** 했다. async 함수는 성공 반환도 Promise 로
감싸므로, 이름만 "실패해도" 일 뿐 바로 위 테스트와 같은 경로를 다시 봤다. 정작 위험한
경로 — reject 가 미구독으로 남아 **무관한 다음 테스트로 전이되는 것** — 은 무방비였다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest **9,314건**
- build: **PASS**
- e2e: **PASS** — 292건

## 보류·후속 항목

- **G2 재실측 기록**은 이 브랜치에서 되돌렸고 별 브랜치로 올린다 (W2). 내용 자체는 유효하다.
- 3R INFO 18건은 전부 비차단. 반복 등장하는 둘(`ParenthesizedTypeNode` 언랩,
  `readBooleanOption` non-literal)은 **저장소 실사례 0건**으로 재확인됐다.
