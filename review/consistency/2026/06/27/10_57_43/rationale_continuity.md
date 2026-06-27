# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 변경: `codebase/packages/web-chat-sdk/src/loader.ts` + `loader.spec.ts`

---

## 발견사항

- **[INFO]** `length > 32` 상한 제약 — 미문서화 암묵적 가정
  - target 위치: `codebase/packages/web-chat-sdk/src/loader.ts` replay 루프, `(raw as ArrayLike<unknown>).length > 32` 조건
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §R5` — 스텁이 `push(arguments)` 하므로 array-like 수용을 명시하지만, 인자 개수 상한(32)은 어디에도 언급 없음
  - 상세: R5는 replay 루프가 `Array.isArray` 대신 `length` 기반 가드를 써야 한다는 취지의 근거를 제공한다. 그러나 `length > 32` 절단 임계값은 spec 어디에도 근거가 없다. 실제 명령(`boot`/`open`/`close`/`updateProfile` 등)의 인자 수는 2–3개가 최대여서 현실적 영향은 없다. 다만 미문서화 가정이 코드에만 존재한다.
  - 제안: `loader.ts` JSDoc 또는 `2-sdk.md §R5`에 "재생 인자 개수 상한(32)은 악의적 oversized 호출 방어를 위한 defensive cap" 임을 한 줄 기재, 또는 named constant(`MAX_REPLAY_ARGS = 32`)로 의도를 코드에서 자명하게 한다.

---

## 요약

변경 사항은 `installGlobal` replay 루프의 `Array.isArray(call)` 가드를 제거하고 `length` 기반 가드 + `Array.from` 정규화로 교체한 버그 픽스다. `spec/7-channel-web-chat/2-sdk.md §R5`는 프로덕션 스텁이 `push(arguments)` 하므로 큐 항목이 진짜 Array가 아닌 array-like 객체임을 명시하고 있다 — 기존 `Array.isArray` 가드는 이 사실을 무시한 구현 버그였고, 이번 수정이 spec 과의 정합을 복원한다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 결정 번복, invariant 우회는 없다. 유일한 발견은 `length > 32` 절단 임계값이 어떤 Rationale에도 등장하지 않는 암묵적 방어 상수라는 점(INFO 수준)으로, Rationale 정합에 실질적 위험을 주지는 않는다.

---

## 위험도

NONE
