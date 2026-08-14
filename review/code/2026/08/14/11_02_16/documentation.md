# 문서화(Documentation) 리뷰

이번 라운드(`11_02_16`)는 직전 라운드(`10_32_27`)에서 나온 documentation WARNING 들(CHANGELOG 누락 · plan 체크리스트 미동기화 · `stripDeep` 깊이 가드 비대칭 서술)에 대한 조치 커밋(`a9574f823`, `5df89cda6`)이 반영된 상태를 다시 검토한 것이다.

## 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 의 "성능 실측" 체크리스트 항목이 실제로 이미 완료된 작업을 미체크(`[ ]`)로 남겨 두고 있다
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:150` (`- [ ] 성능 실측 — 재귀 순회 비용을 옛 shallow 와 A/B. 리뷰 종료 후 수행`)
  - 상세: 이 항목은 "리뷰 종료 후 수행" 이라 적혀 있어 커밋 `a9574f823` 시점엔 미착수가 맞았다. 그런데 바로 다음 커밋 `5df89cda6` 에서 정확히 이 A/B 벤치마크(옛 depth-1 strip 0.0112 ms/emit vs 현행 재귀 strip 0.0314 ms/emit, N=3000, 8턴 `turnDebugHistory`)가 수행되어 `codebase/backend/src/modules/websocket/websocket.service.ts:370-379`(`stripDeep` JSDoc `## 비용 (실측)` 절)에 결과가 그대로 기록됐고, `review/code/2026/08/14/10_32_27/RESOLUTION.md` W2 에도 같은 수치가 있다. 즉 벤치마크는 이미 수행·문서화됐는데 이 plan 체크박스만 갱신되지 않았다. 같은 파일의 바로 위 항목("처방")은 이미 (a)→실제 채택 사실과 함께 정정된 서술로 갱신됐는데(`:134-139`), 이 항목만 뒤처졌다. 이 저장소는 "plan 체크박스 = 실제 상태" 규약을 반복적으로 강조해 온 곳이라(다른 세션이 벤치마크를 아직 안 됐다고 오판해 재측정을 시도하거나, 반대로 이 문서만 보고 "성능이 검증 안 된 채 배포됐다"고 오판할 수 있음), 이 항목도 실제 상태로 동기화할 필요가 있다.
  - 제안: 체크박스를 `[x]` 로 바꾸고 "옛 depth-1 0.0112ms vs 현행 재귀 0.0314ms(2.80배), 근거는 `stripDeep` JSDoc `## 비용 (실측)` 및 `RESOLUTION.md` W2 — 두 pass 를 합치지 않기로 결정" 한 줄을 덧붙인다.

- **[INFO]** `stripDeep` 의 깊이 상한 비교 연산자가 형제 함수 `sanitizeInner`/`sanitizePayloadForWs` 와 1레벨 어긋나는데, JSDoc 은 "형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다"고만 서술해 완전한 동작 동등성으로 읽힐 수 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:360-361`(JSDoc: "깊이 상한은 형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다"), `:387`(`if (depth >= MAX_SANITIZE_DEPTH) return value;`) — 대조: `:251`(`sanitizePayloadForWs` 의 `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`)
  - 상세: `sanitizePayloadForWs` 는 `depth > MAX_SANITIZE_DEPTH`(즉 depth 11부터 마스킹, depth 0~10 은 정상 처리)인 반면, `stripDeep` 은 `depth >= MAX_SANITIZE_DEPTH`(depth 10부터 이미 순회 중단)라 실제로는 한 레벨 더 일찍 멈춘다. 상수(`MAX_SANITIZE_DEPTH`)는 같지만 경계 조건(`>` vs `>=`)이 달라 "형제와 같다"는 서술이 값 재사용까지만 정확하고 경계 동작까지는 정확하지 않다. 실무 영향은 낮다 — JSDoc 이 이미 명시하듯 `stripDeep` 은 항상 `sanitizePayloadForWs` 가 depth ≤ 10 로 이미 정규화한 결과에만 호출되므로 이 경계가 실제로 관측되는 경로는 없다.
  - 제안: 필수 아님. 여지가 있다면 "형제와 같은 상수를 쓰되 경계 조건은 `>=`(한 단계 더 보수적)"처럼 한 구절만 보태면 다음에 두 함수를 나란히 읽는 사람의 혼선을 줄인다.

## 확인했으나 문제 없음 (이전 라운드 WARNING 조치 확인)

- **CHANGELOG.md** — 최상단에 `## Unreleased — (보안) 외부 fanout 의 llmCalls strip 이 depth-1 이라 raw 프롬프트가 새고 있었다` 항목이 추가됐다. 두 유출 경로·수신자·"WS §4.4 선언이 참이 아니었다"는 사실·"이미 전송된 데이터"라는 운영 영향까지 명시해 저장소의 기존 CHANGELOG 관행(보안/정보노출 등급은 항목화)과 일치한다. `5df89cda6`(`__proto__` 오염 하드닝)은 같은 미배포 브랜치 내에서 도입·수정이 함께 랜딩된 내부 수정이라 최종 상태 서술(CHANGELOG 항목)이 이미 정확하며, 별도 항목이 없어도 사용자 관점에서 누락된 정보는 없다.
- **`plan/in-progress/spec-draft-eia-62-waiting-payload.md` "처방" 항목**(`:130-146`) — 직전 라운드 requirement/scope WARNING("plan 이 '(b) 가 유력'이라 적어 놓고 실제론 (a)가 구현됨")이 `a9574f823` 로 조치됐다. "착수 전엔 (a) 는 비용이 크니 (b) 가 유력이라 적었는데 선택이 뒤집혔다"는 반전 사유와 근거(clone-on-write 로 비용 상쇄, 테스트로 단언)까지 명시적으로 기록됐다.
- **`websocket.service.ts` `stripDeep` JSDoc**(`:342-384`) — 직전 라운드 security W1(`__proto__` 오염)·W3("할당 없음" 주장이 구현보다 넓음)·W4(깊이 상한 없음)가 모두 조치됐고, JSDoc 이 "무엇이 실제 방어인지"(스프레드 vs `Object.defineProperty`)를 실측 근거와 함께 정확히 귀속시킨다. `Object.defineProperty` 를 방어라고 잘못 적었던 서술도 "중복 방어"로 정정됐다.
- **`websocket.service.spec.ts` 신규 테스트**(`:635-747`) — 직전 라운드 requirement W1("고치기 전 동작을 현재형으로 서술")이 조치됐다(`:639` "했었다" 과거형). testing W5(`fanout.payload === wire` 최상위 identity 미검증)·W6(nested strip 테스트에 wire 대조군 없음)도 각각 `:744`·`:709-713` 에서 해소됐다. `:702` 에서 지적됐던 `wire` 변수명 재사용 혼선도 `wireJson`(`:709`)으로 분리돼 해소됨.
- **`plan/in-progress/eia-terminal-payload.md`**(신규) — 인접 plan 3건·`retry-turn-terminal-guard.md` 와의 교차 참조가 실제로 존재하는 파일을 정확히 가리킨다(직접 열어 확인). "동일 코드 블록을 겨냥하는 다른 plan"·"동반 필수 정리 대상" 등 향후 작업자가 참고할 문맥이 구체적 파일:라인과 함께 기록돼 있어 인수인계 문서로서 품질이 좋다.

## 요약

이번 라운드는 신규 코드 결함보다 "직전 라운드 지적이 실제로 반영됐는가"를 확인하는 성격이 강했고, CHANGELOG 추가·plan (a)/(b) 반전 기록·`stripDeep` JSDoc 의 근거·귀속 정정·테스트 시제/대조군 보강 등 지적된 항목이 대부분 정확하게 조치됐다. 다만 이 조치 작업 도중 새로 수행된 성능 A/B 벤치마크가 원래 그 항목을 열어 둔 plan 문서(`spec-draft-eia-62-waiting-payload.md`)의 체크박스에는 반영되지 않아 "실제로는 끝났는데 문서는 미착수로 보이는" 전형적인 stale-checklist 가 하나 남아 있다(WARNING). `stripDeep` 의 깊이 상한 경계 조건이 형제 함수와 정확히 동일하지 않다는 점은 실무 영향이 없는 서술 정밀도 문제(INFO)다. 코드 자체의 JSDoc·인라인 주석·SoT 링크는 이 저장소의 무거운 주석 관례에 부합하는 높은 품질을 유지하고 있다.

## 위험도

LOW
