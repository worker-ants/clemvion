# Convention Compliance Review — spec-draft-web-chat-console.md

**검토 대상**: `plan/in-progress/spec-draft-web-chat-console.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-23

---

## 발견사항

### 1. **[CRITICAL]** `spec/7-channel-web-chat/5-admin-console.md` frontmatter — `status` 값 위반
- **target 위치**: draft §2.1 `frontmatter:` 블록 — `status: planned`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — status enum 은 `backlog` / `spec-only` / `partial` / `implemented` / `archived` 5가지만 허용. `planned` 는 정의되지 않은 값이다.
- **상세**: 신규 spec 파일(`5-admin-console.md`)의 frontmatter 에 `status: planned` 를 제안하고 있으나, spec-impl-evidence 컨벤션의 5개 enum 에 `planned` 는 존재하지 않는다. build guard `spec-frontmatter.test.ts` 가 이 값으로는 즉시 실패(`fail`)한다.
- **제안**: 구현 plan 이 `plan/in-progress/web-chat-console.md` 에 분리됐고 코드가 아직 없는 상태이므로, 올바른 값은 `spec-only` (구현 의도 결정됨, 코드 없음)다. `pending_plans:` 에 `plan/in-progress/web-chat-console.md` 를 추가하는 것도 권장한다 (§3 `spec-only` → 구현 plan 작성 시점에 `partial` 로 승격 전까지).

---

### 2. **[CRITICAL]** `spec/7-channel-web-chat/5-admin-console.md` frontmatter — `code:` 경로와 status 불일치
- **target 위치**: draft §2.1 `frontmatter:` 블록 — `code:` 에 `codebase/frontend/src/app/(main)/web-chat/**` 등 2개 경로 기재
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` / `implemented` 일 때는 `code:` ≥1 실제 파일 매치 의무. `status: spec-only` / `backlog` 는 `code: []` 허용.
- **상세**: `status: planned` (비존재 enum)에 구체 경로를 선언하고 있어 두 가지 문제가 동시에 발생한다. 1번 이슈 대로 `status: spec-only` 로 정정하더라도, 해당 코드 경로가 실제 파일시스템에 존재하지 않으면 `spec-code-paths.test.ts` 가 `status: partial`/`implemented` 시 fail 을 유발한다. `spec-only` 로 정정하면 `code: []` 를 기재해도 가드를 통과하므로, 코드 작성 전까지는 비워두어야 한다.
- **제안**: 1번 이슈 수정과 함께 frontmatter 를 아래와 같이 정리한다.
  ```yaml
  id: web-chat-admin-console
  status: spec-only
  code: []
  pending_plans:
    - plan/in-progress/web-chat-console.md
  ```

---

### 3. **[WARNING]** plan 문서 frontmatter — `started` / `owner` 필드 부재
- **target 위치**: `plan/in-progress/spec-draft-web-chat-console.md` frontmatter 전체
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` / `spec/conventions/spec-impl-evidence.md §4.2` — top-level `plan/in-progress/*.md` 는 `worktree`·`started`·`owner` 3개 필드 필수. build guard `plan-frontmatter.test.ts` 가 강제.
- **상세**: 현재 frontmatter 에 `worktree: .claude/worktrees/webchat-console-95fe1e` 는 있으나 `started`(ISO 날짜)와 `owner` 가 없다. 두 필드 누락 시 `plan-frontmatter.test.ts` build guard 가 실패한다. 또한 `worktree` 값은 full path 가 아니라 **디렉토리 이름만**(`webchat-console-95fe1e`) 기재하는 것이 plan-lifecycle §4 관례이다.
- **제안**: frontmatter 에 다음 두 필드를 추가한다.
  ```yaml
  started: 2026-06-23
  owner: planner
  ```
  `worktree` 값을 `.claude/worktrees/webchat-console-95fe1e` → `webchat-console-95fe1e` 로 단축하는 것도 권장한다(강제 아님 — 값 형식 guard 가 full path 를 거부하지는 않으나 관례 일탈).

---

### 4. **[WARNING]** 신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE` — fallback 정책 미명세
- **target 위치**: draft §1.3, §2.1 §5 설명
- **위반 규약**: 명시적 env 명명 규약은 없으나, spec 문서가 신규 env 를 도입할 때 미설정 동작을 명세하는 것이 spec 완결성 기준.
- **상세**: `NEXT_PUBLIC_WIDGET_CDN_BASE` 는 프론트엔드 노출용 신규 env 로, 스니펫 빌더의 `src` URL 과 라이브 미리보기 임베드 URL 을 결정하는 핵심 값이다. draft 는 "신규 필요" 만 선언하고, 미설정 시 fallback 전략(에러 표시 / `window.location.origin` 폴백 / disabled UI 등)이 명세되지 않았다. `NEXT_PUBLIC_API_URL` 이나 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 같은 기존 env 는 모두 fallback 정책이 spec 에 명시되어 있다.
- **제안**: `5-admin-console.md §5 설치 스니펫` 에서 `NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 시 동작을 명시한다(예: "미설정 시 스니펫 빌더 disabled + 경고 표시").

---

### 5. **[WARNING]** `spec/2-navigation/_layout.md` 변경 — 사이드바 메뉴 i18n 키 추가 미언급
- **target 위치**: draft §2.3 — 사이드바 "웹채팅" 신규 메뉴 항목 추가
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1·2 — UI 가시 문자열은 dict 키 경유 의무. ko/en leaf key parity 필수.
- **상세**: `_layout.md §2.2` 에 신규 메뉴 항목 "웹채팅"(또는 "Web Chat")이 추가되면, 해당 레이블이 `dict/ko` 와 `dict/en` 에 동시에 추가돼야 한다. draft §3 Phase 3 에 "i18n(ko/en sidebar + web-chat dict)" 가 언급되어 있어 인식은 있으나, spec 본문(`5-admin-console.md` 또는 `_layout.md` 개정안)에 명시적으로 i18n 규약 준수가 요구사항으로 기재되지 않았다.
- **제안**: `5-admin-console.md` 의 §3 또는 §7(권한) 절에 또는 별도 구현 노트로 "모든 UI 문자열은 `i18n-userguide.md` Principle 1 준수, ko/en dict 쌍 추가 의무"를 명시한다.

---

### 6. **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` 파일명 — 기존 번호 시퀀스 일치 확인
- **target 위치**: draft §2.1 scope 항목
- **위반 규약**: 없음 (정보 제공).
- **상세**: 현재 `spec/7-channel-web-chat/` 에 `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` 가 존재하며, `5-admin-console.md` 는 다음 순번으로 정확히 연속적이다. 명명 규약상 이상 없음.

---

### 7. **[INFO]** `spec/7-channel-web-chat/_product-overview.md` — 밑줄 prefix 면제 확인
- **target 위치**: draft §2.2
- **위반 규약**: 없음 (정보 제공).
- **상세**: `_product-overview.md` 는 `spec-frontmatter.test.ts` 에서 밑줄 prefix(`_*.md`) 면제 대상이므로 `id`/`status` frontmatter 없이도 가드 통과다. 현재 해당 파일에 frontmatter 가 없으며 이는 올바른 상태다. draft 의 수정 계획(§4 구성요소 표 추가 + §2 비목표 명확화 + Rationale 추가)은 구조 규약과 충돌 없음.

---

## 요약

정식 규약 준수 관점에서 가장 심각한 문제는 신규 spec 파일 `5-admin-console.md` 의 frontmatter 에 존재하지 않는 `status: planned` 값을 사용하는 점이다(CRITICAL). 이는 `spec-frontmatter.test.ts` build guard 를 즉시 실패시켜 CI 를 차단한다. 올바른 값은 `spec-only` 이며 `code: []` 로 비워두어야 한다. plan 문서 자체에도 `started` / `owner` 필드가 누락돼 `plan-frontmatter.test.ts` 가 실패하는 WARNING 이 동반된다. 이 두 가지를 수정하면 build-time 가드 충돌은 해소된다. 나머지 발견사항(env fallback 정책 명세 부재, i18n 규약 참조 명시 부재)은 spec 내용 완성도와 구현 시 규약 준수를 위한 권고 수준이다. 전체적으로 문서 구조(Overview/본문/Rationale 3섹션), 파일 번호 순서, `_product-overview.md` 처리 방식은 정식 규약을 잘 따르고 있다.

## 위험도

HIGH — CRITICAL 2건(`status: planned` 비존재 enum, `code:` 경로와 status 불일치)이 build guard 즉시 실패를 유발하며, plan frontmatter 누락 WARNING 이 동반된다. spec 을 그대로 `spec/7-channel-web-chat/5-admin-console.md` 에 반영하면 CI 가 차단된다.
