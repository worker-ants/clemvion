# RESOLUTION — `18_14_50` (4라운드, 코드 동결 후 최종)

**CRITICAL 0 · WARNING 1** — 조치 완료.

## WARNING 1 (documentation) — 내가 센 수가 틀렸다

JSDoc 과 테스트 제목이 `stopInternal` 의 *"반환 지점이 **넷**"* 이라 주장했는데, 세어 보면
`return` 문은 **셋**이다(throw 3개는 별도). 그 수가 **단일 관문 설계의 근거**로 쓰이고 있어
틀리면 다음 사람이 잘못된 전제로 판단한다.

원인: `?? execution` 폴백을 별개 반환 지점으로 잘못 셌다. 정정 —
**`return` 문 셋, 각각 폴백이 있어 나갈 수 있는 객체는 여섯 가지.** 논지(네 번째가 추가될 때
호출부 마스킹이면 빠진다)는 그대로 성립한다. 틀렸던 사실도 JSDoc 에 남겼다.

## security INFO — 근거의 논리 결함, spec 정정

`triggerToken` 평문 보관 근거 (a) 를 *"요청마다 timing-safe 비교하므로 평문이 필요"* 로 썼는데
**성립하지 않는다** — 해시를 저장하고 해시끼리 `crypto.timingSafeEqual` 로 비교하면 동일한
성능·타이밍 안전성을 얻는다.

`secret-store.md` 를 정정했다: (a) 를 **"비용 근거이지 필요성 근거가 아니다"** 로 낮추고
**반례를 본문에 명시**, 이 예외를 실제로 지탱하는 근거가 (c)(서버 발급 랜덤 hex · 1회 노출 ·
영향 범위가 트리거 하나) 임을 못박고, "해시 저장 + timing-safe 비교" 전환을 유효한 후속으로
열어 뒀다.

> 이 세션에서 **근거를 실제보다 넓게 쓴 것이 네 번째**다(마스킹 범위 → 표면 전수 → 반환 지점
> 수 → 이 근거). 매번 다른 리뷰어가 잡았다.

## testing INFO — 자매 대칭 복원

`background-runs.service.spec.ts` 에 `error: null` 통과 케이스가 없어
`executions.service.spec.ts` 와 대칭이 깨져 있었다. 추가했다.

## impl-done(`18_20_34`) INFO 3건도 함께 반영

전부 spec-only 이고 비차단이지만 값싸다 — §5.3 레이어 구분 한 줄, 자기-인용을 원문에 맞게
정정, `secret-store.md §1` 링크에 `#1-uri-scheme` 앵커.

> **그 과정에서 내 실수를 하나 더 잡았다.** §5.3 을 이 문서 내부 앵커로 걸었는데 이 문서의
> §5.3 은 *"단발 상태 조회"* 이고, 체커가 말한 §5.3 은 **`2-api-convention.md`** 쪽
> (*"에러 응답"*)이었다. **앵커를 고치라는 지적에 답하면서 틀린 앵커를 새로 만들 뻔했다** —
> 실측 후 `./2-api-convention.md#53-에러-응답` 으로 정정했다.

## 검증

- 영향 스위트 **10 suites / 132 tests PASS** · 문서 가드 20파일 **2,956 tests PASS**
- TEST WORKFLOW 4스테이지 — lint / unit(**백엔드 427 suites · 8,776 passed**, 프런트 285 files) /
  build / **e2e 276 passed**
