# 변경 범위(Scope) 리뷰

## 사전 재검증 — diff 오염 여부

지시대로 페이로드를 신뢰하지 않고 직접 재검증했다.

```
cd .claude/worktrees/webchat-boot-single-flight-8c92b4
git merge-base origin/main HEAD   → 14bc86a53fc95f73703ee2fe50968c4f0d73238d
git diff --stat 14bc86a53..HEAD
```

결과: **7 파일, +967/-41**, 페이로드에 실린 7파일(CHANGELOG.md · widget-state.test.ts · widget-state.ts ·
use-widget-eager-start.test.ts · use-widget.ts · plan/in-progress/webchat-boot-single-flight.md ·
spec/7-channel-web-chat/2-sdk.md)과 정확히 일치. `use-widget.ts` 전체 diff(260줄)를 별도로 추출해 페이로드 텍스트와
대조했고, 동일했다. **이번 세션은 오염 없음 — 지난 두 세션(`17_36_57`·`17_48_20`)이 지적한 2-dot 문제가 고정
merge-base 로 해소됐음을 확인.**

## 발견사항

- **[INFO]** A-6(리듀서 `RESTORED`/`BOOTED` `ended` 가드) — 계획 내 항목, 범위 이탈 아님
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` case `"RESTORED"`/`"BOOTED"`
  - 상세: plan 의 실행 계획에 `A-6. RESTORED/BOOTED 가드 확대 트리거 재점검`이 명시적 체크리스트 항목(`[x]`)으로
    존재하고, "이 이월은 어느 plan 에도 없어 유실 위험" 이라며 스스로 추적을 명문화했다. 트리거 조건("실패 사례
    확인 시")이 재현으로 충족돼 가드를 확대했고, 결론(채택/근거)을 plan 에 기록하라는 지시도 따랐다. 계획이
    예견한 조건부 작업의 정상 이행이지 "이 김에" 성 확장이 아니다.
  - 제안: 없음(범위 내).

- **[INFO]** `ERROR` 경로의 `teardownSession()` — 리뷰어 CRITICAL 대응, 근본 수정으로 범위 내
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `sendCommand` catch 블록의 비-410 분기
  - 상세: A-6 의 리듀서 가드는 디스패치(화면)만 막고 `getStatus`/SSE/토큰갱신 재개는 못 막는다는 CRITICAL 을
    리뷰어 2인이 독립적으로 냈고(C2, side_effect·security), 실측 재현(`getStatus 추가호출=1 | EventSource
    추가생성=1`)까지 뒤따랐다. CLAUDE.md 의 "구현 완료 후 review/fix 는 상시 승인된 강제 의무" 조항에 정확히
    해당하는 same-turn 필수 대응이며, 변경 범위도 `teardownSession()` 단일 호출 추가로 최소화돼 있다.
  - 제안: 없음(범위 내).

- **[WARNING]** 재전송 시 복원 스킵(flicker fix) — plan 실행 계획에 정식 항목으로 반영되지 않은 확장
  - 위치: `use-widget.ts` — `cannotApplyConfig`/`isAttemptStale`(checkpoint 1 을 boot 축 전용으로 재설계),
    `const saved = streamRef.current ? null : loadSession(cfg.triggerEndpointPath);`(현재 라인 896).
    `use-widget-eager-start.test.ts` — 신규 테스트 4건(flicker 정회귀 2건 + "6번째 거울상"(`startedRef`→`streamRef`
    오판정) 방어선 2건, 약 230줄)
  - 상세: plan 의 Overview·"실행 계획" 체크리스트는 A(§106 supersede)·B(동기 구간 불변식) **두 항목만** 명시한다.
    flicker fix 는 그 계획에 없던 세 번째 항목으로 — A/B/A-6/C1-C3 리뷰 대응이 모두 끝난 뒤 "사용자 결정"으로
    즉석 추가됐고, "진행 기록" 산문 섹션에만 사후 기술될 뿐 "실행 계획" 체크리스트에는 대응 항목(체크박스)이
    생기지 않았다(추적성 약화 — 사용자 메모리에 기록된 "plan 은 정식 phase 로 추적, prose 로 뭉개지 말 것" 원칙과
    같은 결의 문제). 더 무겁게 볼 지점은: 이 fix 자체가 자신의 회귀("`startedRef` 오판정 → streaming 인데 연결
    0개로 고착")를 다시 냈고 그 교정("6번째 거울상")까지 같은 PR 안에서 이뤄졌다는 것 — plan 문서가 스스로
    "'이 김에 구조를 고치는' 선택이 정확히 직전 회귀를 낳았다"며 PR #964 에서 A/B 를 이월시킨 바로 그 패턴과
    형태가 유사하다. 다만 완화 요인도 있다: (a) flicker fix 는 C1 의 supersede 설계(`isAttemptStale`)와 기술적으로
    깊이 얽혀 있어 checkpoint 1 재설계를 공유한다(분리 시 같은 추론을 다시 끌어와야 함), (b) spec §106 은 이미
    "동일 triggerEndpointPath 재부팅은 진행 중 execution 을 중복 시작하지 않는다"고 명시해 flicker fix 가 순수
    신규 스코프라기보다 §106 계약의 미완 이행에 더 가깝다, (c) 사용자가 직접 승인했고 양방향 mutation 테스트로
    고정됐다.
  - 제안: (요약 참조 — 별도 PR 분리에 대한 의견)

- **[INFO]** `applyConfig` world 축 회귀 테스트 — 기존 갭 마감, 테스트 전용이라 범위 내
  - 위치: `use-widget-eager-start.test.ts` "embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지
    않는다" 테스트
  - 상세: plan 의 A-5(mutation 검증)가 요구한 게이트를 이행하는 과정에서 "origin/main 코드에서도 이 가드를
    제거하면 44건 전부 통과"함을 A/B 로 확인했다 — 이 PR 이 만든 갭이 아니라 발견한 갭이다. 프로덕션 코드
    변경은 이미 A(`isAttemptStale`)가 도입한 것을 재사용할 뿐이고, 추가된 것은 테스트뿐이다. mutation-testing
    으로 우연히 발견한 기존 결함의 커버리지 보강은 표준적이고 저위험인 관행이다.
  - 제안: 없음(범위 내).

- **[WARNING]** `use-widget.ts:975` — `eslint-disable-next-line` 주석 소실 + trailing whitespace 잔존(부수 결함)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 마운트 `useEffect` cleanup, `unmountedRef.current
    = true;` 추가 직전 줄
  - 상세: 원본(`14bc86a53`)은 `worldGenRef.current++` 바로 위에 `// eslint-disable-next-line
    react-hooks/exhaustive-deps` 주석이 있었고, 그 위 8줄 JSDoc 이 "이 억제가 왜 정당한지"(ref 가 DOM 이 아니라
    세대 카운터라는 오탐 설명)를 서술한다. 이번 diff 가 그 주석 줄을 지우고 공백 6칸짜리 빈 줄로 바꾼 뒤
    `unmountedRef.current = true;` 를 끼워 넣었다. 실측 확인: `git diff --check 14bc86a53..HEAD` →
    `use-widget.ts:975: trailing whitespace`. `npx eslint src/widget/use-widget.ts` → 977번 줄에서
    `react-hooks/exhaustive-deps` 경고 1건 재노출(원래 억제되던 경고). CI(`pnpm --filter channel-web-chat lint` =
    순수 `eslint`, `--max-warnings` 미지정)는 경고를 무시해 빌드는 통과하지만(로컬 재현 exit 0), 바로 위 JSDoc
    문단이 가리키는 억제 주석 자체가 사라져 문서-코드 불일치 상태다. `unmountedRef.current = true` 자체는
    `beginBootAttempt` 관련 새 축 추가(정당한 변경)이지만, 그 편집이 인접한 무관 주석을 부주의하게 삭제한
    사례로 보인다 — "실질 변경에 포맷팅/주석 변경이 섞인" 전형적 패턴.
  - 제안: `worldGenRef.current++` 바로 위에 `// eslint-disable-next-line react-hooks/exhaustive-deps` 를
    복원하고 공백 전용 줄을 제거할 것. `unmountedRef.current = true`(단순 대입, 읽기 없음)는 같은 규칙을
    트리거하지 않으므로 억제 주석 위치는 그대로 두면 된다.

- **[INFO]** CHANGELOG·spec `code:` 보강 — 정상 관례이나 CHANGELOG 가 flicker fix 를 누락
  - 위치: `CHANGELOG.md` "Unreleased — 웹채팅 위젯: 마지막 `wc:boot` 적용(§106) + 종료된 대화 부활 fix"
  - 상세: `spec/7-channel-web-chat/2-sdk.md` 의 `code:` 프런트매터 보강은 plan 체크리스트의 명시 항목이라
    범위 내. CHANGELOG 추가도 사용자 가시 fix 문서화라는 이 저장소의 표준 관행이라 범위 내다. 다만 커밋
    이력 확인 결과 CHANGELOG 항목은 `b1bef8633`(리뷰 CRITICAL 3건 반영) 커밋에서 작성됐고, 이후 flicker fix
    커밋(`8c79b68ea`)은 CHANGELOG 를 건드리지 않았다. 그 결과 현재 CHANGELOG 는 (1)종료된 대화 부활 fix,
    (2)§106 마지막 config 적용, (3)대체된 시도의 종료 확정 억제(C1) 세 가지만 언급하고, 사용자가 승인한 flicker
    fix(재전송 시 입력창이 사라졌다 돌아오는 문제 — 이것도 사용자 가시)는 언급이 없다. 이 저장소 스스로
    "사용자 가시 fix 의 CHANGELOG 누락은 반복 지적된 패턴"이라 진행 기록에 적어 놓았는데, 바로 이번에 새로
    추가된 사용자 가시 fix 하나가 같은 방식으로 또 누락됐다 — flicker fix 가 이 PR 의 문서화 사이클을 완전히
    통과하지 못했다는 방증이다.
  - 제안: 병합 전 CHANGELOG 에 flicker fix 항목 추가.

- **[INFO]** `seedWaitingFromStatus` 함수 시그니처의 무의미한 개행 — 무해한 포맷팅 노이즈
  - 위치: `use-widget.ts`, `seedWaitingFromStatus` 선언부(`async (client: EiaClient, session: SessionRef):
    Promise<SeedOutcome> => {`)
  - 상세: 내용 변경 없는 한 줄(77자, 표준 80/100자 제한 이내로 측정 확인)이 3줄로 개행됐다. 순수 재포맷이
    실질 변경(다른 hunk)과 같은 파일 diff 에 섞여 있으나, 기능·가독성에 영향 없고 범위 왜곡 우려도 없는
    수준이라 중요도는 낮다.
  - 제안: 불필요하나 굳이 되돌릴 필요는 없음. 참고용으로만 기록.

## 요약

이번 세션은 지시대로 고정 merge-base(`14bc86a53`) 기준 7파일 diff 를 직접 재검증했고 오염은 없었다. 범위
판단은 항목별로 갈린다: **A-6**·**ERROR teardownSession**·**world 축 회귀 테스트**·**CHANGELOG/spec code: 보강**
넷은 모두 plan 의 명시 항목이거나 plan 이 요구한 검증 게이트(A-5 mutation)의 정상 산출물이거나 리뷰어 CRITICAL
에 대한 same-turn 강제 대응이라 범위 이탈이 아니다. 문제는 **flicker fix(3번)** 다 — plan 의 "실행 계획"
체크리스트에는 끝내 항목으로 오르지 못한 채(오직 사후 "진행 기록" 산문에만 존재) A/B/A-6/C1-C3 가 모두 끝난
뒤 사용자 승인으로 편입됐고, 그 자체가 새 회귀("6번째 거울상")를 내 자기 교정까지 이번 PR 에 포함시켰다 —
이는 이 plan 문서가 스스로 "이 김에 구조를 고치면 직전 회귀를 낳는다"며 PR #964 에서 A/B 를 이월시킨 바로
그 위험 패턴과 형태가 같다. **내 의견**: 완전히 분리해야 할 만큼 나쁘지는 않다고 본다 — checkpoint 1 을 boot
축 전용으로 재편하는 작업이 C1 의 supersede 설계와 기술적으로 얽혀 있어 사후 분리 시 같은 추론을 다시
끌어와야 하고, spec §106 이 이미 "진행 중 execution 재시작 금지"를 명문화해 flicker fix 가 신규 스코프라기보다
§106 계약의 완성에 더 가까우며, 양방향 mutation 테스트로 고정돼 실측 품질도 확보돼 있다. 다만 **최소 조건으로
두 가지를 병합 전에 권고**한다: (1) plan "실행 계획" 체크리스트에 flicker fix 와 그 자기 교정을 정식 항목으로
소급 반영해 향후 감사자가 prose 를 다 읽지 않아도 PR 의 실제 blast radius 를 알 수 있게 할 것, (2) CHANGELOG
에 flicker fix 항목을 추가할 것(사용자 가시 fix 누락은 이 저장소가 스스로 반복 지적한 패턴). 팀이 PR 당
관심사 최소화를 더 우선한다면, flicker fix delta(체크포인트 재설계 + 2테스트)만 별도 plan/PR 로 떼어내는
것도 기술적으로는 가능하나 필수는 아니라고 판단한다. 별개로, `use-widget.ts:975` 의 `eslint-disable-next-line`
주석 소실은 flicker fix 리팩터링 과정에서 생긴 작지만 실재하는 부수 결함으로, 병합 전 한 줄 복원이 필요하다.

## 위험도

MEDIUM
