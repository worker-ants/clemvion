# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 무관한 발견(push 게이트 미발동 조사)이 같은 브랜치/커밋 묶음에 신규 plan 티켓으로 포함됨
  - 위치: `plan/in-progress/harness-push-gate-did-not-fire.md` (신규 파일 전체)
  - 상세: 이 파일 자신의 Rationale 이 "발견 PR(§3 e2e)과 원인 계층이 완전히 다르다 … 섞으면 두 리뷰가 서로를 가린다(이 저장소의 PR 분리 원칙)" 라고 명시하면서도, 정작 그 문서 자체는 이번 e2e 작업과 같은 브랜치(`claude/node-cancel-e2e-98b61f`)의 diff 에 포함되어 커밋된다. 코드 변경은 없고 backlog 티켓 등록(plan 문서)뿐이라 실질 리스크는 낮지만, "별도 티켓" 임을 주장하는 문서가 물리적으로는 이번 PR 에 번들링된 점은 자기모순적으로 읽힐 수 있다.
  - 제안: 실질적 위험은 없으므로 그대로 두어도 무방하나, 후속 세션에서 이 티켓 자체의 실제 조사/수정 작업은 반드시 별도 worktree/브랜치에서 진행해 "PR 분리 원칙"을 실제로 지킬 것.

- **[INFO]** 3번째 테스트가 plan §3 의 acceptance criteria(다단계 cancel 전파)를 다소 벗어남 — 이미 자체 문서화·처분됨
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:307` (`it('취소된 실행은 재-stop 을 거부한다 (terminal 재진입 방지)', ...)`)
  - 상세: `review/code/2026/07/24/20_36_21/RESOLUTION.md` 의 "범위 메모 (I2)" 에서 이미 "plan §3 의 acceptance criteria 를 다소 벗어난다"고 스스로 인정하고, "같은 stop 계약의 인접 표면이라 함께 잠갔다"는 근거로 유지를 결정했다. 신규 스코프 발견이라기보다 이미 공개·처분된 항목이라 낮은 심각도로만 기록한다.
  - 제안: 조치 불요(이미 사용자/이전 리뷰 라운드에서 판정 완료). 향후 유사 인접-표면 테스트 추가 시 plan 본문에 명시적으로 scope 확장을 기록하는 관행을 유지할 것.

- **[INFO]** `review/code/2026/07/24/20_36_21/*` 이전 라운드 리뷰 산출물 전체(신규 파일 8개: RESOLUTION.md, SUMMARY.md, _retry_state.json, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md)가 이번 diff 에 통째로 포함됨
  - 위치: `review/code/2026/07/24/20_36_21/` 디렉토리 전체 (신규 파일)
  - 상세: 이 저장소는 `review/` 를 gitignore 하지 않고 리뷰 산출물을 커밋하는 것이 확립된 관행이다(메모리: "review/ 는 gitignored 아님"). 이전 라운드 리뷰 원본 + RESOLUTION.md 가 이번 커밋에 함께 들어가는 것은 "구현 완료 후 리뷰 → 해소 → 재리뷰" 워크플로의 정상적 부산물이며 스코프 일탈이 아니다. 오탐 방지 차원에서만 기록.
  - 제안: 조치 불요.

## 요약

핵심 변경(`node-cancellation-propagation.e2e-spec.ts` 신규 e2e 3건 + `node-cancellation-inflight-followups.md` 완료·이동 + `node-cancellation-infrastructure.md` 의 dangling 링크 3곳 보정 + `node-cancellation-residual-signal-propagation.md` 신규 추적 plan + `spec/conventions/node-cancellation.md` pending_plans/추적 포인터 갱신)는 모두 "§3 다단계 cancel 전파 e2e 작성"이라는 선언된 작업 목적과 그로부터 파생된 이전 리뷰 라운드(20_36_21)의 WARNING 해소(W1·W2·W3·W4·W5)로 직접 설명된다. 임포트 추가, 포맷팅, 불필요한 리팩토링, 관련 없는 파일 수정 등 전형적인 스코프 이탈 패턴은 발견되지 않았다. 유일하게 짚을 만한 점은 이번 작업 중 발견된 무관한 하네스 버그(push 게이트 미발동)를 별도 plan 티켓으로 같은 브랜치에 함께 커밋한 것인데, 코드 변경이 전혀 없고 문서 자체가 "별도 처리 대상"임을 명시하므로 실질 위험은 없다. 3번째 테스트(재-stop 거부)의 scope 확장 역시 이미 자체 문서에서 인지·처분되어 있다.

## 위험도

LOW
