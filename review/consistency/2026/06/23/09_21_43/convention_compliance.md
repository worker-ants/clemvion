# Convention Compliance Review

**검토 모드**: 구현 착수 전 (--impl-prep)
**대상**: `spec/7-channel-web-chat/` (신규 파일: `5-admin-console.md`)
**검토일**: 2026-06-23

---

## 발견사항

### WARNING — `_product-overview.md` 헤더 블록에서 `5-admin-console.md` 누락
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` lines 3–4, line 9
- **위반 규약**: CLAUDE.md §정보 저장 위치 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`; `spec/conventions/spec-impl-evidence.md §4.2 — spec-area-index.test.ts` (index docs link every sibling spec)
- **상세**: `_product-overview.md` 의 헤더 인트로 블록(line 3–4)과 `## 1.` 위 `**구성요소 spec**` 링크 목록(line 9)은 `0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md` 5개만 열거하고 신규 `5-admin-console.md` 가 빠져 있다. body 본문에서는 links가 있어 `spec-area-index.test.ts` 가드는 통과하지만, 헤더 내비게이션 블록이 영역의 공식 "구성요소 목차" 역할을 하므로 독자 입장에서 `5-admin-console.md` 가 존재하는지 파악이 어렵다. 다른 5개 파일은 header 라인에 명시됐으나 신규 파일만 누락.
- **제안**: `_product-overview.md` line 4 끝부분에 ` · \`5-admin-console.md\`(운영 콘솔)` 를 추가하고, line 9 의 `**구성요소 spec**` 링크 목록에 ` · [운영 콘솔](./5-admin-console.md)` 를 추가한다.

---

### INFO — `5-admin-console.md` 의 `id` 가 파일 basename 과 불일치
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `id: web-chat-admin-console`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장". 충돌 회피 예외는 "같은 basename 이 영역을 달리해 중복될 때"
- **상세**: 파일 basename 은 `5-admin-console` 이지만 `id: web-chat-admin-console` 로 area prefix 가 붙어 있다. `admin-console` basename 을 가진 다른 spec 파일은 현재 repo 에 존재하지 않으므로 충돌 회피 예외 사유가 없다. 단, 같은 영역의 다른 파일들(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`) 이 모두 동일한 `web-chat-*` prefix 패턴을 따르고 있어 영역 내 일관성은 있다.
- **제안**: 영역 내 패턴 일관성을 우선한다면 현 `web-chat-admin-console` 유지가 합리적이다. 규약 문서가 "권장(recommendation)" 으로 명시하고 있으므로 강제 변경보다는 `spec-impl-evidence.md §2.1` 에 "영역 전체가 `<area>-*` prefix 를 공유할 경우 일관성 우선" 예외 항목 추가를 검토할 수 있다.

---

### INFO — `5-admin-console.md` 의 `status: spec-only` 에 `pending_plans:` 선언
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` 에서 `pending_plans:` 는 "권장" (필수 아님)
- **상세**: `spec-only` 상태에서 `pending_plans: [plan/in-progress/web-chat-console.md]` 를 선언했다. 규약상 허용되는 패턴이며, 해당 plan 파일(`plan/in-progress/web-chat-console.md`)이 worktree 내 실존하므로 `spec-pending-plan-existence.test.ts` 가드도 통과한다. 위반이 아닌 권장 패턴 준수로 긍정적.
- **제안**: 변경 불필요.

---

## 요약

`spec/7-channel-web-chat/` 영역은 신규 `5-admin-console.md` 파일을 포함해 전반적으로 정식 규약을 준수한다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)·링크 무결성·`spec-area-index` 가드 모두 통과 수준이다. 핵심 지적사항은 하나로, `_product-overview.md` 헤더 내비게이션 블록이 영역 진입 문서의 "구성요소 목차" 역할을 하는데 신규 `5-admin-console.md` 를 열거하지 않아 독자 내비게이션이 불완전하다 (WARNING 1건). 나머지는 규약 기반의 minor 제안 수준(INFO 2건)이다.

## 위험도

LOW
