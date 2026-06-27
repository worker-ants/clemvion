# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [INFO] `localStorage` → `sessionStorage` 전환은 spec §R6 과의 정합 회복 (위반 아님)

- **target 위치**: `codebase/channel-web-chat/src/lib/session-store.ts` `getStorage()` 함수
- **과거 결정 출처**: `spec/7-channel-web-chat/3-auth-session.md` `## Rationale §R6` ("토큰 저장 — sessionStorage (vs localStorage)")
- **상세**: `spec/3-auth-session §R6` 은 재로드 복원 저장소로 `sessionStorage` 를 명시적으로 채택하고 `localStorage` 를 **기각**된 대안으로 기록한다 (`"localStorage 는 탭·브라우저 종료 후에도 남아 XSS 등으로 탈취될 잔존 노출 면이 더 길다"`). 이번 PR diff 는 코드가 사전에 `localStorage` 를 사용하고 있던 것을 `sessionStorage` 로 교체해 **spec 과의 drift 를 해소**한다. 즉 기각된 대안을 재도입하는 것이 아니라 기각된 구현을 제거하고 spec 채택 결정을 따르는 정합 회복이다.
- **제안**: 현재 상태로 문제 없음. 다만 이 drift 가 어느 시점에 발생했는지(초기 구현이 spec 확정 전에 작성됐을 가능성)에 대한 메모를 plan 에 남겨두면 향후 유사 drift 재발 방지에 도움이 된다.

---

### [INFO] 운영 콘솔 외형 초안 캐시는 `localStorage` 유지 — 의도된 역할 분리

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §4`, `§R3`
- **과거 결정 출처**: `spec/7-channel-web-chat/5-admin-console.md` `## Rationale §R3` ("localStorage = 미저장 편집 캐시 (서버가 SoT)")
- **상세**: 콘솔 외형 폼의 미저장 편집 캐시는 `localStorage` 를 유지한다. `§R3` 이 "`sessionStorage`(탭 닫으면 소실)보다 localStorage 가 적합"이라고 명시적으로 결정했으므로, 이번 PR 이 세션 토큰은 `sessionStorage` 로 전환하면서 외형 캐시는 `localStorage` 를 그대로 두는 것은 두 Rationale 의 역할 분리를 올바르게 반영한다. 혼동 우려가 있으나 spec 이 이미 구분을 명문화했고 코드도 이를 따른다.
- **제안**: 이슈 없음. 현재 두 저장소 분리 정책은 spec 과 일치한다.

---

## 요약

이번 PR 의 핵심 변경(세션 토큰 저장소 `localStorage` → `sessionStorage`)은 `3-auth-session §R6` 이 이미 채택·문서화한 결정을 코드가 뒤늦게 따른 것이다. spec Rationale 에서 기각된 대안(`localStorage`)이 코드에 잔존하던 drift 를 제거하는 방향이라 Rationale 연속성 관점의 위반은 없다. 합의된 원칙(per_execution 단일 토큰, sessionStorage defense-in-depth, 운영 콘솔 외형 캐시 localStorage 분리)이 모두 유지된다. 기각된 대안의 재도입, 무근거 번복, 합의 invariant 우회에 해당하는 사항은 발견되지 않았다.

## 위험도

NONE
