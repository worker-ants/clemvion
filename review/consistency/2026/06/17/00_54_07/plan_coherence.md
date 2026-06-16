## 발견사항

- **[INFO]** §1.1 메인 앱 sanitize 정책을 web-chat spec 영역에 포함
  - target 위치: `spec/7-channel-web-chat/4-security.md` §1.1 "마크다운/HTML sanitize 정책 매트릭스" 표의 "메인 앱 assistant 패널 메시지" 행
  - 관련 plan: 해당 정책을 §1.1에 메인 앱 렌더러(`frontend` 영역)까지 포함해야 한다는 결정을 내린 plan 항목이 없음
  - 상세: `spec/7-channel-web-chat/4-security.md`는 web-chat 영역 전담 spec인데, §1.1에 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx`(메인 앱 영역) 의 sanitize 정책을 병기함. 이는 "두 렌더러가 동일 위협에 보안 동등성을 보장한다"는 단면을 한 곳에서 검증하기 위한 cross-cutting 설명으로 해석될 수 있다. 특정 미결정 항목과 충돌하지는 않으나, 메인 앱의 `markdown-renderer.tsx` sanitize 정책이 변경될 경우 `7-channel-web-chat/4-security.md` 도 같이 갱신해야 하는 이중 SoT 구조가 된다. 현재 `spec/3-workflow-editor` 또는 `spec/2-navigation` 영역 spec에는 이 정책이 없어 여기가 유일한 문서화 위치이기도 하다.
  - 제안: 단기적으로는 현 위치 유지 허용(cross-cutting 동등성 표). 중기적으로 메인 앱 sanitize 정책을 메인 앱 영역(예: `spec/3-workflow-editor` 또는 `spec/2-navigation/9-user-profile.md` 등)에 SoT를 두고 본 §1.1에서 cross-reference 하는 형태로 정비하면 이중 갱신 문제를 제거할 수 있다. plan 갱신이 즉시 필요한 수준은 아님.

- **[INFO]** `(refactor 04 m-1)` 코드 리뷰 태그가 spec 본문에 인라인으로 포함됨
  - target 위치: `spec/7-channel-web-chat/4-security.md` §1 표 "입력 sanitize" 행 말미
  - 관련 plan: 없음(리뷰 태그 관리 규약과 관련)
  - 상세: spec 본문 안에 코드 리뷰 출처 태그 `(refactor 04 m-1)`가 남아 있다. spec 문서는 리뷰 ref가 아니라 결정된 사실의 SoT여야 하므로, 이 태그는 추적 목적이면 Rationale 절이나 주석으로 이동하거나 제거하는 것이 관례에 맞다.
  - 제안: spec 본문 정리 시 해당 태그를 제거하거나 Rationale 절에 "(코드 리뷰 refactor 04 m-1 에서 도출)" 형태로 이동.

## 요약

`spec/7-channel-web-chat/4-security.md`의 변경(§1 "입력 sanitize" 행 상세화 + §1.1 sanitize 매트릭스 신규 추가 + frontmatter `safe-html.ts` 등재)은 `channel-web-chat-followups.md §4`에서 완료 기록된 `lib/safe-html.ts`(marked + DOMPurify) 구현을 spec에 반영하는 것으로, 미결정 항목과 충돌하지 않는다. CRITICAL·WARNING 수준의 plan 정합성 위반 없음. 두 가지 INFO 사항(메인 앱 sanitize 정책 이중 SoT, 리뷰 태그 인라인 잔류)은 향후 정리 시 고려할 항목이다.

## 위험도

NONE
