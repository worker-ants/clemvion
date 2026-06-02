---
worktree: web-chat-presentation-rich-ea5a59
started: 2026-06-02
owner: resolution-applier
---
# Spec Fix Draft — template HTML sanitize caveat (DOMPurify)

## 원본 발견사항
SUMMARY#I15: `spec/4-nodes/6-presentation/5-template.md` 의 "HTML sanitize caveat" 가 클라이언트 측 DOMPurify 추가를 반영하지 않아 spec-impl 불일치.

## 제안 변경
`spec/4-nodes/6-presentation/5-template.md` L35 근처 "HTML sanitize caveat" 섹션에 다음 내용 추가:
- channel-web-chat 위젯(임베드 SPA)은 클라이언트 측에서 **DOMPurify + marked** 로 추가 sanitize 를 수행한다.
- `src/lib/safe-html.ts` → `renderTemplateHtml()` 이 DOMPurify(Apache-2.0 선택) 로 XSS(script·이벤트 핸들러·javascript: href 등)를 제거한다.
- SSR/build prerender 단계에서는 window 미가용으로 null 반환 → plain text 폴백.
- marked-before-DOMPurify 순서는 정상(DOMPurify 가 최종 방어선) — defense-in-depth 패턴.

해당 파일: `spec/4-nodes/6-presentation/5-template.md`
