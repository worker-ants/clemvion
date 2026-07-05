# 테스트(Testing) 리뷰 — invite-accept-confirm-ui (§1.5.3, 재검토)

전회(`review/code/2026/07/05/15_20_19/testing.md`) WARNING 3건(handleAccept 실패 미테스트·handleLogout 실패 미테스트·anonymous 방문자 미테스트) 중
RESOLUTION.md 가 "accept 실패·anonymous 방문자 테스트 2건 추가(8 passed)"로 조치를 주장한 부분을 실제 diff 로 검증한다.

## 발견사항

- **[INFO]** WARNING #1(handleAccept 실패 미테스트) — 조치 확인됨
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/__tests__/accept-invitation-content.test.tsx` 신규 `it("shows error when accept fails after clicking (ai-review testing)", ...)` (L170-185)
  - 상세: `mockAccept.mockRejectedValue(new AxiosError(...))` 로 버튼 클릭 후 `handleAccept` 의 catch 분기를 정확히 재현하고, `errorMessage`(`"accept boom"`)가 화면에 렌더되는지까지 `waitFor` 로 검증한다. 전회 WARNING 이 지적한 "getByToken 실패만 테스트되고 handleAccept 자체의 reject 는 미검증" 갭이 실질적으로 해소됐다.
  - 제안: 없음(조치 완료로 인정).

- **[INFO]** WARNING #3(익명/미로그인 방문자 mismatch 분기 미테스트) — 조치 확인됨
  - 위치: 신규 `it("treats a logged-out (anonymous) visitor as mismatch — no auto-accept", ...)` (L187-198)
  - 상세: `mockUser = null` 을 유지한 채(전회 지적대로, 기존 "mismatch" 테스트는 `other@example.com` 재로그인 케이스만 커버해 완전 비로그인 케이스와 달랐다) 렌더하여 `logoutAndSwitch` 안내가 뜨고 `accept` 버튼은 없으며 `mockAccept` 가 호출되지 않음을 검증한다. `userEmail && userEmail === m.email` 분기에서 `userEmail` 이 `undefined` 인 경로(완전 비로그인)가 이제 명시적으로 고정됐다.
  - 제안: 없음(조치 완료로 인정).

- **[WARNING]** WARNING #2(`handleLogout` 의 `authApi.logout()` 실패 시 catch-swallow 경로) — 미조치, RESOLUTION 기록과 실제 diff 불일치
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` `handleLogout` 내 `try { await authApi.logout(); } catch { /* 로그아웃 요청이 실패해도 클라이언트 세션은 정리하고 로그인으로 보낸다 */ }` (구현은 이번 diff 에서도 그대로 유지). 테스트 파일에는 여전히 `mockLogout.mockResolvedValue(undefined)` 성공 케이스(`"logout clears session and routes to /login"`) 하나만 존재하고, `mockRejectedValue` 를 사용하는 신규 테스트는 추가되지 않았다.
  - 상세: 이 항목은 RESOLUTION.md 의 "side_effect WARNING#2 (logout fallback)" 행("서버 logout 실패 삼킴 → 조치불요 — 의도된 fallback")과는 별개다. **원래 testing.md 의 WARNING 은 "동작 자체"가 아니라 "그 동작이 테스트로 고정되지 않았다"는 커버리지 지적**이었다 — side_effect 리뷰어가 동작 자체를 승인(조치불요)한 것과, testing 리뷰어가 그 동작에 대한 회귀 테스트가 없다고 지적한 것은 서로 다른 관점이며 하나가 다른 하나를 대체하지 않는다. RESOLUTION.md 는 "testing WARNING (branches) | handleAccept 실패·anonymous 방문자 미테스트 | ... 2건 추가"라고만 기록해, 3건 중 2건만 조치했음을 스스로 명시하고 있음에도 SUMMARY.md 표(#4, testing)는 "accept 실패·anonymous mismatch 테스트 추가"만 언급하고 logout-실패 케이스는 언급조차 없다 — 즉 이 갭이 "검토 후 기각"된 것이 아니라 그냥 누락된 것으로 보인다. 이 catch 블록은 실패해도 세션 정리(`setAccessToken(null)`→`setUser(null)`→`/login` 이동)가 그대로 진행되어야 한다는, 요구사항 텍스트(주석)로 명시된 핵심 동작이므로 회귀 시 조용히 깨질 수 있다(예: 향후 리팩터로 catch 안에서 return 을 추가하거나 순서를 바꾸면 unit 이 이를 잡지 못한다).
  - 제안: `mockLogout.mockRejectedValue(new Error("network"))` 케이스를 추가해 catch 이후에도 `setUserMock`/`mockPush` 호출이 그대로 일어나는지 확인하는 테스트 1건 보강 권장. 혹은 팀이 이 갭을 의도적으로 defer 하기로 했다면 RESOLUTION.md/SUMMARY.md 에 "조치불요" 사유를 명시해 문서와 실제 상태의 괴리를 없앨 것.

- **[INFO]** `translate` mock 의 파라미터 보간 우회(전회 INFO, `조치불요` 판단) — 이번 diff 에서도 동일하게 유지, 판단 재확인
  - 위치: `accept-invitation-content.test.tsx` L79-82 (`vi.mock("@/lib/i18n", () => ({ useT: () => (k) => k, translate: (_l, k) => k }))`)
  - 상세: RESOLUTION.md 가 "mock 한계, 실제 dict+translate 는 프로덕션 렌더/e2e 가 커버, mock 개선은 과설계"로 조치불요 처리한 판단은 합리적이다 — 신규 두 테스트도 이 mock 을 그대로 사용하지만 파라미터 보간을 검증하는 어서션은 아니므로 이 결정과 모순되지 않는다. 재확인 결과로만 기록, 추가 조치 불요.

- **[INFO]** 신규 테스트 2건의 격리·가독성은 양호
  - 위치: `accept-invitation-content.test.tsx` L170-198
  - 상세: 두 테스트 모두 `beforeEach` 의 `vi.clearAllMocks()`/`mockUser = null` 리셋에 의존하며 서로 상태를 공유하지 않는다. 테스트명(`"shows error when accept fails after clicking (ai-review testing)"`, `"treats a logged-out (anonymous) visitor as mismatch — no auto-accept"`)이 검증 대상과 의도(자동수락 안 함)를 명확히 표현해 가독성이 좋다. `"(ai-review testing)"` 라는 접미사가 리뷰 이력을 코드에 남기는 방식은 다소 이례적이나(보통은 커밋 메시지/PR 설명에 남김), 테스트 자체의 명확성을 해치지 않으므로 문제 삼지 않음.

- **[INFO]** 회귀 테스트 유효성 — 기존 6건 + 신규 2건 = 8건, 상태 전이 로직과 정합
  - 위치: `accept-invitation-content.test.tsx` 전체
  - 상세: 컴포넌트 소스 자체는 이번 재검토 라운드에서 (§1.5.3 로직 관련) 추가 변경이 없고 cleanup(`cancelled`) 가드만 추가됐다(RESOLUTION side_effect #1). 이 가드는 마운트 상태에서의 정상 흐름에는 영향이 없어 기존 6건 테스트가 여전히 유효하다. RESOLUTION 이 명시한 "unit: 통과(accept 8·register 10 passed)"과 실제 테스트 개수(8=6+2)가 일치해 카운트 상의 불일치는 없다.

## 요약

전회 testing WARNING 3건 중 2건(handleAccept 실패, anonymous 방문자 mismatch)은 이번 diff 로 정확히 조치되어 8개 테스트가 모두 의도한 분기를 검증한다. 다만 3번째 WARNING — `handleLogout` 의 `authApi.logout()` 실패(catch-swallow) 경로 미테스트 — 는 RESOLUTION.md/SUMMARY.md 어디에도 "조치" 또는 명시적 "조치불요" 로 언급되지 않은 채 그대로 남아 있다. side_effect 리뷰어가 그 **동작 자체**(실패해도 세션 정리)를 승인한 것과, testing 리뷰어가 그 동작에 대한 **회귀 테스트 부재**를 지적한 것은 별개 사안이므로, 전자의 조치불요 판단이 후자를 자동으로 해소하지 않는다. 사용자가 요청한 "prior round WARNING 전체 해소 여부 검증"에 대해서는 부분 해소(2/3)로 판정하며, 나머지 1건은 테스트 1건 추가 또는 명시적 defer 기록으로 마무리할 것을 권장한다.

## 위험도

LOW
