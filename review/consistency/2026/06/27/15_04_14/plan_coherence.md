# Plan 정합성 검토 결과

검토 모드: --impl-done | 대상: spec/7-channel-web-chat/ | diff-base: origin/main

---

## 발견사항

### 발견사항 1

- **[WARNING]** 진행 중 작업에 대응하는 plan 파일 부재 — spec `pending_plans` 라이프사이클 미추적
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans`
  - 관련 plan: 부재. worktree `webchat-composer-loading`에 대응하는 `plan/in-progress/webchat-composer-loading.md` 없음
  - 상세: `1-widget-app.md`·`3-auth-session.md`·`0-architecture.md` 모두 `pending_plans`에 `webchat-eager-start.md`를 참조하고 있다. 이번 구현(`Composer loading prop + panel booting/streaming → loading 전달`)은 spec §2 "booting/streaming(AI 처리 중)에는 스피너 + `aria-busy=true` + `aria-label='AI 응답 중'"을 직접 구현한 별도 increment인데, 이를 추적하는 plan 파일이 존재하지 않는다. 작업 완료 후 spec `pending_plans` 목록에서 제거하거나 `status` 승격 근거가 될 plan이 없어 spec 라이프사이클 추적이 단절된다.
  - 제안: `plan/in-progress/webchat-composer-loading.md`를 생성하고, `spec/7-channel-web-chat/1-widget-app.md`의 `pending_plans`에 등록한다. 구현 완료 후 plan을 `plan/complete/`로 이동하고 spec `pending_plans`에서 제거하는 경로를 확보한다.

### 발견사항 2

- **[INFO]** `plan/in-progress/webchat-eager-start.md` plan complete 이동 미완료
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/webchat-eager-start.md` 마지막 체크박스 `[ ] plan complete 이동`
  - 상세: eager-start plan의 모든 실질 구현 단계(spec 갱신·consistency-check·코드·테스트·ai-review)는 완료됐고, 미완료 항목은 `plan complete 이동` 한 건뿐이다. 이번 diff는 eager-start 범위의 backlog 항목("composer allowlist 전환" 등)이 아닌 독립 spec 항목이므로 eager-start 완료 이동을 블록하지 않는다. 다만 spec `pending_plans`에서 eager-start를 제거하려면 plan 이동이 선행되어야 하고, 현재 그 step이 열려 있다.
  - 제안: eager-start plan의 `[ ] plan complete 이동`을 별도로 처리한다(비차단 cleanup). 이번 diff와 독립적으로 진행 가능.

---

## 요약

구현 diff(`composer.tsx` loading prop 추가, `panel.tsx`에서 `phase === "booting" || phase === "streaming"` 시 `loading` 전달)는 `spec/7-channel-web-chat/1-widget-app.md §2`가 이미 명시한 동작("booting/streaming(AI 처리 중)에는 스피너 + aria-busy=true + aria-label='AI 응답 중'로 '응답 중' 표시")을 직접 구현하고 있어, 미해결 결정 우회나 선행 plan 미해소 문제는 없다. 단, 해당 worktree(`webchat-composer-loading`)에 대응하는 `plan/in-progress/` 파일이 존재하지 않아 작업 완료 후 spec `pending_plans` 라이프사이클 추적이 단절된다. 이 점이 plan 정합성 관점의 유일한 실질 위험이다.

## 위험도

LOW
