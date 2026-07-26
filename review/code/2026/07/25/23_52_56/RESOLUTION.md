# RESOLUTION — JSDoc 내부 불일치 2건

CRITICAL 0 / WARNING 2. 둘 다 **내 JSDoc 편집의 결함**이고 즉시 조치했다.

## 조치 항목

| # | 지적 | 조치 |
|---|---|---|
| W1 | 요약 문단에는 `Cafe24 / MakeShop` 을 추가했는데 바로 아래 **소비자 열거 리스트**에는 안 넣어, 같은 docblock 안에서 두 목록이 어긋났다(requirement·documentation 중복 지적) | 소비자 목록에 항목 추가. 단순 나열이 아니라 이 PR 계열이 실제로 배선한 내용(per-call controller cascade · `finally` 해제 · **취소를 `recordNetworkFailure` 에 넣지 않고 `upstream.aborted` 로 timeout 과 구분**)을 함께 적었다 — 그 구분이 이 계열에서 CRITICAL 이었던 부분이다 |
| W2 | 근거를 `1-data-model.md:230` 처럼 **원본 줄번호**로 인용했다. 저장소 전체에서 유일한 사례이고, 대상 문서가 편집되면 조용히 다른 곳을 가리키게 된다(자동 검증 없음) | 안정 식별자로 교체 — `` `Trigger.type` 표, spec/1-data-model.md ``. 파일 내 다른 인용(`CCH-AD-05`, `§2.1`)과 같은 방식 |

INFO1(spec §1/§6 stale)은 `spec/` 권한 밖이고 이미 위임 완료 — checker 도 "조치 불요" 로 확인.

## TEST 결과

JSDoc 주석만 변경(런타임 로직·타입 무변경).

- lint: `.claude/tools/run-test.sh lint` → **PASS**
- unit: `.claude/tools/run-test.sh unit` → **PASS** (14) / `npx jest src/nodes/core` → **163 passed**
- build: `.claude/tools/run-test.sh build` → **PASS**
- e2e: `.claude/tools/run-test.sh e2e` → **통과** (259 passed)

> 위 수치는 이번 WARNING 조치 **이전** 실행분이다. 조치가 주석 문구 변경뿐이라 재실행 없이
> lint 만 재수행한다(아래).

## 보류·후속 항목

- INFO4(`chat-channel 어댑터의 abortSignal 참조 0건` 을 지키는 정적 가드 부재) — 이번 스코프
  강제 아님. 향후 그 어댑터를 손댈 때 재검증.
