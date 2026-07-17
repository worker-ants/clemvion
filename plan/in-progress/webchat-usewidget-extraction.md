---
worktree: (unstarted)
started: 2026-07-18
owner: developer
---

# 웹채팅 위젯: `useWidget()` 세션 로직 `useEiaSession` 분리

**상태**: 미착수. 리팩토링 백로그. 기능 변경 없음.

이 항목은 `webchat-boot-single-flight.md`(곧 `complete/` 이동)의 산문 이월에서 분리했다 — 그쪽에
산문으로만 두면 plan 완료 이동 시 함께 묻힌다(형제 항목 `webchat-command-failure-is-not-termination.md`
와 같은 처분. `--impl-done` 23_58_23 maintainability WARNING 이 이 항목만 노출돼 있음을 지적).

## 배경

`codebase/channel-web-chat/src/widget/use-widget.ts` 의 `useWidget()` 훅이 계속 커진다 —
merge-base 877줄 → 이 PR 후 ~1070줄(세 라운드 fix 로 누적 증가). `useCallback` 26개·`useRef` 13개,
eslint 에 `max-lines`/`complexity` 가드 없음.

이 파일은 **거울상 결함이 반복된 자리**다 — boot/world/unmount staleness 축 관련으로 이 클래스에서
9번(23_58_23 기준) 서로 반대편 구멍을 냈다. 즉 규모 자체보다 **세션 라이프사이클 로직의 응집도 부족**이
반복 결함의 온상이라는 게 분리의 진짜 근거다(단순 줄 수가 아니라).

## 무엇을 분리하나

세션 확립·복원·staleness 판정 묶음을 `useEiaSession`(가칭) 커스텀 훅으로 추출:
- `worldGenRef`/`bootGenRef`/`unmountedRef` + predicate(`isStale`/`beginBootAttempt`/`cannotApplyConfig`/
  `isAttemptStale`/`sessionEstablished`)
- `establishConfig`/`applyConfig`/`start`/`seedWaitingFromStatus`/`sendCommand`/`teardownSession`
- `openStream`/`closeStream`/토큰 갱신 배선

`useWidget()` 은 reducer 배선 + host bridge + 프레젠테이션 상태만 남긴다.

## 선행 판단 (착수 전 확인)

- **축이 몇 개인가**: `webchat-boot-single-flight.md:129` 의 "가드가 하나로 정리된 지금이 적기" 전제는
  `bootGenRef` 신설로 되돌려졌다(축 2개). A-0 토큰 캡슐화를 채택하면 호출부가 보는 축은 다시 1개가 되나,
  현재는 `applyConfig`/`start` 가 `{world, boot}` 토큰을 직접 다룬다. 분리 시 이 토큰 타입을 훅 경계의
  공개 계약으로 삼을지 결정 필요.
- **JSDoc 인접성 취약성**(23_58_23 documentation): 이 파일에서 ref 선언 사이에 다른 선언이 끼면 JSDoc 이
  유실되는 버그가 2회 재발했다. 현재 방어가 "경고 주석"뿐이라, 분리하면서 `ts.getJSDocCommentsAndTags()`
  기반 lint/test 가드로 승격하는 것을 함께 검토.

## 체크리스트

- [ ] `useEiaSession` 훅 추출 (기능 무변경 — 순수 구조 이동)
- [ ] 기존 테스트 전원 통과 유지(현 391건) + 훅 단위 테스트 신설
- [ ] JSDoc 인접성 구조적 가드 검토(경고 주석 → lint/test)
- [ ] `/consistency-check --impl-done spec/7-channel-web-chat/` 통과
</content>
