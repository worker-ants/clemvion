# RESOLUTION — `11_02_16` (+ consistency `11_02_18`)

ai-review **CRITICAL 1 / WARNING 3** (forced 7명 전원). consistency **BLOCK: NO**.

## CRITICAL 1 — 리뷰어 넷의 결론이 갈렸다. 실행으로 갈랐다.

`testing` 은 depth=10 경계에서 누출을 재현했다 하고, `security`·`side_effect`·`requirement`
셋은 "값은 이미 `[REDACTED_DEPTH]` 라 필드명만 남는다" 며 반대 결론을 냈다. 요약도
*"코드만으로는 어느 쪽이 맞는지 확정할 수 없다"* 고 적었다.

**논증을 보태지 않고 실제 파이프라인으로 훑었다.** `emitExecutionEvent` 전 경로에 깊이별
마커를 심고 외부 fanout JSON 을 본다 (depth 0·5·8·9·10·11·12):

**7개 전부 통과 — 어느 깊이에서도 raw 내용은 나가지 않는다.**

`testing` 의 CRITICAL 은 파이프라인이 아니라 **두 함수 로직을 복제한 스크립트**의 산물이었다.
복제본은 원본과 갈라질 수 있다 — 이 저장소가 "정본 구현이 있으면 재현 말고 실행" 을 교훈으로
갖고 있는 이유다.

### 그리고 내 sweep 의 판별력도 실측했다

통과만으로는 부족하다. strip 을 no-op 으로 만든 뮤턴트로 어느 케이스가 실제로 지키는지 쟀다:

| depth | strip 없이도 통과? | 무엇이 막나 |
|---|---|---|
| 0 · 5 | **아니오 (RED)** | `stripDeep` 이 실제로 지운다 |
| 8 이상 | 예 | 마커가 상한 밖이라 `sanitizePayloadForWs` 가 먼저 치환 |

즉 **8 이상은 누출 테스트로서 판별력이 없다.** 그대로 두되 JSDoc 에 그 사실과 존재 이유를
적었다 — 깊은 곳은 strip 이 아니라 sanitize 의 상한이 막는다는 **구조 자체의 기록**이고,
그 상한이 사라지면 여기가 RED 를 낸다. 판별력 없는 케이스를 "통과했다" 로 세지 않는다.

### 경계 연산자는 통일했다

누출이 없다고 확인됐어도 `>=`(내 것) vs `>`(형제)의 어긋남은 남긴다. **리뷰어 넷이 갈린
자리가 바로 그 어긋남**이라, 무해하다면 형제와 다를 이유가 없다. `>` 로 맞췄다.

부수 효과: JSDoc 의 "형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다" 가 이제 **경계까지 참**이다
(종전엔 상수만 같고 경계가 달라, INFO 12 가 "완전한 동등성으로 오독된다" 고 지적한 상태였다).

## WARNING 2 (성능) — identity 캐시 부재

**유예.** 형제 `sanitizePayloadForWs` 는 `SANITIZE_CACHE`(WeakMap)로 ForEach 반복 emit 을
O(1) 로 줄이는데 `stripDeep` 엔 없다는 지적. 타당하다.

다만 캐시 키가 **입력 identity** 라, 같은 객체를 반복 emit 하는 시나리오에서만 이득이다.
지금 붙이면 두 캐시의 무효화 시점이 갈려 "sanitize 는 캐시 적중인데 strip 은 아닌" 조합이
생기고, 그 조합을 덮는 테스트가 없다. 성능 문제가 **관측되면** 붙이는 편이 낫다 —
현재 실측 비용은 +20.2 µs/emit 이다. plan §후속에 근거와 함께 등재했다.

## WARNING 3 (성능) — 벤치마크가 확장된 범위를 대표 못 한다

**타당하다.** A/B 를 AI 대화 payload 로만 쟀는데, 이 diff 는 `llmCalls` 를 가질 수 없는
**모든 node 이벤트**에도 `stripDeep` 을 건다(방어심층화). 대용량 non-AI `nodeOutput`
(HTTP 응답 JSON 등)이 worst case 인데 측정하지 않았다.

"실측했다" 는 말이 **측정한 범위 안에서만** 참이라는 점을 JSDoc 에 명시하고, 대용량
시나리오 추가 측정을 plan 에 등재했다.

## WARNING 4 (문서) — 성능 실측 체크박스

**이미 조치됨** — 커밋 `2ef826dc5`(consistency `11_02_18` W2 와 동일 항목).

## 검증

- 깊이 sweep 7건 통과 + 판별력 실측(뮤턴트에서 0·5 RED)
- 전체 백엔드 **422 suites / 8636 passed** · lint(`--max-warnings 0`) · ratchet 199/38

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| INFO 6 (`turnDebug` 이름 재사용) | 별도 planner 항목으로 추적 중. name-based strip 의 전제 재검증은 그 작업과 함께 |
| INFO 7 (`stripDeep`/`sanitizeInner` 스켈레톤 중복) | 의도적 defer. 한쪽 수정 시 짝점검 관례 유지 — 이번 라운드가 그 관례의 실례다(깊이 경계를 형제와 맞췄다) |
| INFO 8 (파일 비대화) | `EXTERNAL_STRIPPED_FIELDS` 확장 시 유틸 모듈 추출 고려 |
| INFO 9·10 (JSDoc 배열 분기 서술·스타일 불일치) | 문구를 배열/객체로 나눠 한정하는 편이 정확하나 동작 무관. 다음 실질 변경 시 |
| INFO 11 (배열 부분 clone-on-write 미검증) | 다원소 fixture 추가는 저비용이나 이번 라운드 범위 밖 — plan 등재 |
| INFO 12 (경계 연산자 문서 정밀도) | CRITICAL 1 조치로 자동 해소 |
