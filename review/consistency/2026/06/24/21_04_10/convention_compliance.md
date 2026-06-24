# Convention Compliance Review

Target: `spec/7-channel-web-chat/5-admin-console.md`
Mode: 구현 완료 후 검토 (--impl-done, diff-base=origin/main)

---

## 발견사항

- **[INFO]** `spec` frontmatter `id` 값이 basename 과 불일치
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter line 2 (`id: web-chat-admin-console`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
  - 상세: `id: web-chat-admin-console` 는 basename `5-admin-console` 과 다르다. 그러나 같은 영역(`spec/7-channel-web-chat/`)의 모든 sibling spec 이 동일하게 `web-chat-<suffix>` prefix 패턴을 쓰고 있고(`web-chat-architecture`, `web-chat-sdk` 등), 이는 다른 영역과의 basename 충돌 회피를 위한 **의도된 영역 전체 일관 패턴**이다. 규약에서 "의도된 패턴"으로 명시적 허용됨 — 위반이 아니다.
  - 제안: 현 상태 유지(정상). 메모만.

- **[INFO]** `spec` frontmatter `user_guide:` 필드 미선언
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter (1~8행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `user_guide:` 는 "선택(optional)"
  - 상세: 해당 spec 에 대응하는 유저 가이드 파일(`codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`)이 존재하고 그 파일의 `spec:` 필드가 이 spec 을 역방향으로 참조한다. `user_guide:` 는 선택 필드이므로 build 가드를 통과하나, 양방향 cross-link 명시를 위해 추가를 고려할 수 있다.
  - 제안: `user_guide:` 선택 필드이므로 현 상태 위반 아님. 편의상 추가 가능: `user_guide:\n  - codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`

- **[INFO]** `spec` frontmatter `code:` glob 이 `codebase/frontend/src/lib/types/trigger.ts` 를 미커버
  - target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `code:` (lines 4~7)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1 / §3` — `status: implemented` 인 spec 의 `code:` 는 ≥1 매치 의무(가드 통과). 단 특정 파일 미포함이 fail 기준은 아님.
  - 상세: 이번 diff 에서 `codebase/frontend/src/lib/types/trigger.ts` 에 `lastTriggeredAt?: string` 필드가 추가됐다. 이 변경은 `spec/2-navigation/2-trigger-list.md` 의 `code:` (`codebase/frontend/src/app/(main)/triggers/page.tsx` 등)와도 교차 적용되며, `5-admin-console.md` 의 기존 세 글로브(`app/(main)/web-chat/**`, `components/web-chat/**`, `lib/web-chat/**`)에는 `lib/types/trigger.ts` 가 포함되지 않는다. 현재 가드(`spec-code-paths.test.ts`)는 ≥1 매치만 검증하므로 통과하지만, `lib/types/` 변경이 이 spec 에서 기술되는 기능(목록 행 메타 `lastTriggeredAt`)을 구현하는 파일임에도 glob 미포함이다.
  - 제안: `code:` 에 `codebase/frontend/src/lib/types/trigger.ts` 를 추가하거나, 이미 `spec/2-navigation/2-trigger-list.md` 가 `codebase/frontend/src/components/triggers/*.tsx` 로 trigger 관련 shared 파일을 커버하므로 현 상태 유지도 수용 가능. build 가드는 통과함.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 는 정식 규약(`spec/conventions/`)을 전반적으로 준수한다. frontmatter 의 `id`/`status`/`code:` 필드는 `spec-impl-evidence.md` 스키마를 만족하고(`implemented` + ≥1 glob 매치), ko/en 사전 parity 는 `i18n-userguide.md` Principle 2 를 따라 양쪽 동시 갱신됐다. 유저 가이드 섹션 6 에 추가된 `<ImplAnchor>` 세 건의 `file`/`symbol` 이 실제 `page.tsx` 에 존재하고, 내부 SoT(`spec/`, `plan/`) 노출 금지(Principle 6-B) 위반 없다. 발견된 세 항목은 모두 INFO 등급으로, 규약 직접 위반에 해당하지 않는다.

## 위험도

NONE
