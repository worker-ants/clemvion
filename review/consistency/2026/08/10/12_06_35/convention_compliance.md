# 정식 규약 준수 검토 — `spec/7-channel-web-chat/2-sdk.md`

검토 모드: spec draft (`--spec`)
대조 규약: `spec/conventions/**` (spec-impl-evidence.md · error-codes.md · i18n-userguide.md · swagger.md ·
frontend-layering.md · conversation-thread.md · interaction-type-registry.md · cross-node-warning-rules.md 등)

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 기록해 둘 만한 INFO 1건.

- **[INFO]** Rationale 절 번호가 `R2`부터 시작(`R1` 없음)
  - target 위치: `## Rationale` (L206) 첫 항목 `### R2. 스니펫 로더 + npm 둘 다`
  - 위반 규약: 없음 — CLAUDE.md/SKILL.md 가 요구하는 건 "Overview / 본문 / Rationale" 3섹션 구성뿐이고, Rationale 항목의
    연속 번호를 요구하는 정식 규약 문서는 없다.
  - 상세: 같은 영역의 형제 문서들도 전부 R1부터 시작하지 않는다 — `1-widget-app.md` 는 R4부터, `3-auth-session.md` 는
    R3부터 시작한다(반면 `0-architecture.md` 만 R1부터). 이는 `2-sdk.md` 만의 결함이 아니라 `7-channel-web-chat/` 전체에
    걸친 기존 관행(리비전 과정에서 항목이 옮겨지거나 병합되며 번호가 남은 것으로 추정)이라 이번 target 이 새로 만든
    편차가 아니다.
  - 제안: 규약 위반은 아니므로 수정 의무는 없음. 가독성만 고려한다면 "R1 은 본 문서에 없음(과거 항목이 다른 절로
    흡수/삭제됨)" 같은 1줄 각주를 다는 것도 선택지이나, 형제 문서들과의 일관성(전부 동일 패턴) 관점에서는 그대로 둬도
    무방.

## 점검 관점별 확인 내역 (위반 없음 확인)

1. **명명 규약**
   - Frontmatter `id: web-chat-sdk` — kebab-case, `spec-impl-evidence.md §2.1` 준수. basename(`2-sdk`)과는 다르지만
     동일 영역 형제 문서 전부(`web-chat-architecture`/`web-chat-widget-app`/`web-chat-auth-session`/
     `web-chat-admin-console`/`web-chat-security`)가 `web-chat-*` 접두를 동일하게 쓰는 **영역 전체의 의도된 패턴**이라
     `4-security.md` 자체에 그 근거 주석까지 있음. 문제 없음.
   - npm scope `@workflow/web-chat` — 리포 전역 monorepo 패키지 네이밍(`@workflow/sdk`·`@workflow/ai-end-reason`·
     `@workflow/node-summary`·`@workflow/graph-warning-rules`)과 일관. 전용 convention 문서는 없으나 기존 패턴과 정합.
   - `wc:*` postMessage type prefix, 전역 함수명 `ClemvionChat`, `ChatInstance` 메서드 목록(§5) — 이를 규율하는 별도
     conventions 문서는 리포에 없음(대상 밖). §1 스니펫 메서드 목록과 §5 `ChatInstance` 타입이 서로 일치함을 확인
     (`open`/`close`/`show`/`hide`/`sendMessage`/`updateProfile`/`on`/`off`/`shutdown`).

2. **출력 포맷 규약**
   - `wc:event` 페이로드 `{ name, data }`, `wc:resize` 페이로드 `{ width, height, state }` — 이 postMessage 프로토콜
     shape 를 규율하는 conventions 문서는 없음(대상 밖, `5-system` 영역 SoT 성격).
   - `conversationEnded.data.reason` 을 "열린 문자열(닫힌 enum 아님)"로 명시한 것은 `swagger.md §1-4`(닫힌 union vs
     열린 map 구분 원칙)의 취지와 상충하지 않음 — swagger.md 는 backend DTO 스키마 표현 규약이라 애초에 이 client
     event 필드에는 적용 대상이 아니고, 설령 유사 원칙을 유추 적용해도 "SSE terminal 이벤트명 + 위젯 로컬 종료 사유"
     처럼 실제로 열린 값 집합이라는 조건에 부합.
   - `error-codes.md` 는 `error.code` 필드(서버 응답 에러 코드)의 명명 규율이며 본 문서에는 그 필드가 등장하지 않아
     대상 밖.

3. **문서 구조 규약**
   - `## Overview` → `## 1~5` 본문 → `## Rationale` 3섹션 구성 준수. `_product-overview.md`/`0-` prefix 규칙은 진입
     문서에만 적용되는데 본 문서는 번호 있는 본문 spec(`2-sdk.md`)이라 해당 없음(정상).
   - `_product-overview.md` 가 `2-sdk.md` 를 구성요소 목록에 링크하고 있어 `spec-area-index.test.ts`(§4.2) 의 "영역
     index 가 모든 sibling 을 링크" 요건도 충족.

4. **API 문서 규약 (swagger 등)**
   - 대상 문서는 backend REST 컨트롤러/DTO 가 아니라 client SDK/postMessage 프로토콜 정의라 `swagger.md`(OpenAPI
     데코레이터·DTO 명명)의 적용 범위 밖. 위반 여지 없음.

5. **금지 항목**
   - `spec-impl-evidence.md §1` 의무 대상(`spec/7-channel-web-chat/**.md`)에 해당하며 frontmatter `id`/`status`/`code`
     모두 존재. `status: implemented` 이므로 `code:` ≥1 매치 의무 — 세 위젯 파일(`host-bridge.ts`/
     `use-session-generations.ts`/`use-widget.ts`) 존재 확인, 그리고 frontmatter 주석이 명시한 정본 심볼
     (`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`/`applyConfig`)이 실제로 `use-session-generations.ts`·
     `use-widget.ts` 에 여전히 존재함을 grep 으로 확인 — 2026-07-25 재발 우려(주석에 명시)가 현재는 재발하지 않은 상태.
   - frontmatter `code:` 블록 내부의 긴 인라인 YAML 주석은 이 리포지토리에서 여러 spec 문서(`2-navigation/*.md` 등)가
     이미 쓰는 확립된 관행이라 위반이 아님.
   - `i18n-userguide.md` 의 위젯 chrome i18n 예외 조항(§적용 범위 "부분 제외 — `channel-web-chat/**`")이 정확히
     본 문서 §4/R6 의 `locale` 활성화 서술과 상호 참조돼 있고 내용도 서로 모순 없이 정합(위젯 로컬 catalog + ko/en
     parity, 운영자 콘텐츠/AI 본문은 비대상).
   - link 무결성: 문서 내 상대링크(`0-architecture.md`/`1-widget-app.md`/`3-auth-session.md`/`5-admin-console.md`/
     `_product-overview.md`/`../../plan/complete/eia-sdk-publish.md`/`../../plan/complete/webchat-i18n-scope.md`/
     `../5-system/15-chat-channel.md`) 전부 실존 확인. `#anchor` 형태 링크는 `_product-overview.md#2-목표--비목표`
     1건뿐이며 대상 heading(`## 2. 목표 / 비목표`) 존재 확인.

## 요약

`spec/7-channel-web-chat/2-sdk.md` 는 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반이 없다.
Frontmatter(`id`/`status`/`code`)는 `spec-impl-evidence.md` 의 스키마·라이프사이클·evidence 요건을 정확히 따르고,
근거로 든 코드 심볼도 현재 코드베이스에 실재해 stale 하지 않다. 문서 구조(Overview/본문/Rationale)·명명(영역 접두
`web-chat-*`, 모노레포 패키지 스코프 `@workflow/*`)·i18n 관련 서술은 각각 대응하는 정식 규약(`i18n-userguide.md` 등)과
상호 참조가 정확히 맞물려 있다. `swagger.md`/`error-codes.md`/`frontend-layering.md` 등 backend·frontend-app 대상
규약은 본 문서(client SDK/postMessage 프로토콜 spec)의 적용 범위 밖이라 관련 위반이 성립하지 않는다. 유일한 관찰
사항은 Rationale 번호가 `R2`부터 시작한다는 점이나, 이는 규약 위반이 아니고 같은 영역 형제 문서 전반에 걸친 기존
패턴이라 target 고유의 결함으로 볼 수 없다.

## 위험도

NONE
