# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (`--impl-done`, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`)

## 검토 대상

**Target 문서**: `spec/7-channel-web-chat/` (전체 6개 파일)

**구현 변경**: `codebase/packages/web-chat-sdk/src/loader.ts` + `loader.spec.ts`
- `installGlobal` 큐 replay 루프에서 `Array.isArray()` 가드를 `length`-기반 가드 + `Array.from()` 정규화로 교체
- 스니펫 스텁이 `push(arguments)` 를 사용하므로 큐 항목이 진짜 Array 가 아닌 array-like(`arguments` 객체)이며, 기존 `Array.isArray` 필터가 이를 통째로 버려 `boot` 호출이 누락되던 버그 수정
- `GlobalCall` 타입 export 추가 + 회귀 테스트 케이스 신설

**관련 in-progress plan**: `plan/in-progress/channel-web-chat-impl.md`, `plan/in-progress/channel-web-chat-followups.md`, `plan/in-progress/webchat-eager-start.md`

---

## 발견사항

발견된 CRITICAL / WARNING 항목 없음.

---

## 요약

이번 변경은 `codebase/packages/web-chat-sdk/src/loader.ts` 의 `installGlobal` 큐 replay 로직 버그 수정이다. 스니펫 스텁이 `push(arguments)` 를 사용하므로 큐 항목이 진짜 Array 가 아닌 array-like 객체인데, 기존 `Array.isArray()` 가드가 이를 걸러내 `boot` 호출이 누락되는 회귀(#709 테스트 갭)를 수정한다. 이 동작은 `spec/7-channel-web-chat/2-sdk.md §R5`("스텁은 `push(arguments)` 하므로 queue 항목은 array-like — replay 루프에서 `Array.isArray` 가 아닌 `length` 기반 수용 후 `Array.from` 정규화해야 한다"는 구현 주석과 정합)에 이미 문서화된 요구사항을 구현이 충족하도록 교정한 것이다. 미해결 결정 우회 없음, 선행 plan 미해소 없음, 후속 항목 누락 없음 — plan 정합성 관점 전면 이상 없음.

---

## 위험도

NONE
