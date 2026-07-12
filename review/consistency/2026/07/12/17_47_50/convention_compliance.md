# 정식 규약 준수 검토 — spec/7-channel-web-chat/

## 방법 노트
prompt payload 의 "정식 규약 모음" 절에는 `spec/conventions/audit-actions.md`·`cafe24-api-catalog/**` 만 포함돼
있었는데, 이는 target(`spec/7-channel-web-chat/**`)이 실제로 참조·의존하는 규약(`swagger.md`·`i18n-userguide.md`·
`conversation-thread.md`·`interaction-type-registry.md`·`spec-impl-evidence.md`)과 무관하다. payload 번들링
누락으로 보고, 리포지토리 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-doc-alignment-01d7a4`)의
`spec/conventions/**` 원본을 직접 읽어 대조했다. diff-base 는 `origin/main`이며 실제 신규 diff(`git diff origin/main..HEAD`)는
`spec/7-channel-web-chat/2-sdk.md`(주석 1줄)·`spec/7-channel-web-chat/_product-overview.md`(단락 재배치)·
`spec/conventions/i18n-userguide.md`(dev-only 시뮬레이터 P6 carve-out 1줄) 로 매우 작다 — 본문 대부분은 이미
`origin/main`에 머지돼 여러 차례 규약 정합 리뷰를 거친 상태다.

## 검증 절차
- `spec-frontmatter.test.ts`/`spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts`/
  `spec-area-index.test.ts` (frontmatter-evidence family) — 969 tests 전부 pass.
- `spec-link-integrity.test.ts` (in-repo 링크·anchor 무결성) — 13 tests 전부 pass.
- `codebase/channel-web-chat/src/lib/i18n/**` 위젯 로컬 catalog parity·freeze 테스트 — 14 tests 전부 pass.
- frontmatter `id`/`code:` 6개 파일 수동 대조(`spec-impl-evidence.md §2`), Swagger DTO 명명(`swagger.md §5-1`), 응답
  wrapping 서술(`swagger.md §2-5`, `api-convention §5.1/§5.2`), conversation-thread §9 웹챗 carve-out 정합,
  interaction-type-registry §1.2 4→3 매핑 정합을 본문 대조로 확인.

## 발견사항
없음 — target 문서 전체 및 diff 범위 모두에서 CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다.

### 확인한 주요 정합 포인트 (참고, 위반 아님)
- **frontmatter**: 6개 spec 파일(`0-architecture`~`5-admin-console`) 모두 `id`(kebab-case)/`status: implemented`/`code:`
  필드를 갖추고, `code:` glob 이 실제 코드 경로와 일치(자동 가드 pass). `4-security.md` 의 `id: web-chat-security`
  (basename `4-security` 와 불일치)는 `spec-impl-evidence.md §2.1` 이 명시한 "basename 충돌 시 영역 prefix 로 회피"
  패턴을 그대로 따르며, 그 사유를 인라인 YAML 주석으로 문서화해 두었다 — 정당한 예외. `_product-overview.md` 는
  `spec/<영역>/_*.md` 면제 규칙(§1)에 해당해 frontmatter 부재가 정상.
- **문서 구조**: 6개 spec 파일 모두 `## Overview` → 본문(`## 1.`…) → `## Rationale` 3섹션 구조를 유지.
- **API 문서 규약**: `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts`
  (`EmbedConfigDto { allowlist, enforce }`) 는 `swagger.md §5-1` 의 `dto/responses/*-response.dto.ts` 위치 규약과
  일치(과거 PR #926 로 이미 정렬). spec 본문의 `{ data: { allowlist, enforce } }` wire 서술도 `swagger.md §2-5`/
  `api-convention §5.1`(단일 리소스 `{ data: <Dto> }`)과 정합.
  `4-security.md §2.1` 의 CORS·`3-auth-session.md §3` 의 `{ data }` 언랩 서술도 전역 `TransformInterceptor` 규약과 일치.
- **i18n 규약**: `spec/conventions/i18n-userguide.md` 의 신규 dev-only 시뮬레이터(`codebase/channel-web-chat/src/app/demo/**`)
  P6 carve-out 추가는 실제 코드 경로가 존재하고, 기존 "위젯 chrome ko/en parity 대상, 메인 앱 dict 기구는 스코프 밖"
  구조와 정합하며 리스트 들여쓰기도 유효한 markdown. `_product-overview.md` 의 chrome i18n 목표 재배치(비목표→목표)
  도 동일 커밋(#929)의 실제 구현 상태와 일치.
- **conversation-thread 정합**: `1-widget-app.md §2` 의 2-way 말풍선 축약(`presentation_user`/`ai_user`→user,
  `ai_assistant`/`ai_tool`/`system`→assistant)·`[user-input]…[/user-input]` strip 서술은
  `conversation-thread.md §9` 의 웹챗 carve-out(§9.3/§9.4/§9.5 는 강제, §9.1/§9.2 는 면제)과 정확히 일치.
- **interaction-type-registry 정합**: `1-widget-app.md §2` 의 `WaitingInteractionType=ai_form_render` 매핑 서술은
  `interaction-type-registry.md §1.2`(내부 4값 ↔ EIA 외부 3값 통합)와 어긋남 없음.
- **코드 측 renaming**(`Locale`/`TranslationKey` → `WidgetLocale`/`WidgetTranslationKey`, diff 내 8커밋 정리분)은
  명명 충돌 회피 목적의 식별자 개명으로, 대응하는 정식 규약 위반은 없음(spec 본문에 영향 없는 내부 타입명).

## 요약
target(`spec/7-channel-web-chat/**`) 은 정식 규약(`spec/conventions/**`) 관점에서 명명·출력 포맷·문서 구조·API 문서
규약을 모두 준수하고 있으며, 이번 diff-base(`origin/main`) 대비 신규 변경분(2-sdk.md 주석 1줄·_product-overview.md
단락 재배치·i18n-userguide.md carve-out 1줄) 도 기존 규약 구조를 그대로 계승해 위반을 만들지 않는다. 이 영역은
과거 다수 PR(#901/#904/#916~#929 등)을 거치며 이미 규약 정합 이슈를 반복 정리해 온 상태라 잔여 위반이 거의
소진돼 있다. 다만 본 리뷰의 입력 payload 가 무관한 conventions(audit-actions/cafe24 catalog)만 번들링해 왔던 점은
checker 파이프라인 측(orchestrator convention 번들러) 개선 여지로 별도 보고할 만하다 — target 문서 자체의 결함은
아니다.

## 위험도
NONE
