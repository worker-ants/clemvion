# 정식 규약 준수 검토 결과

검토 모드: `--impl-done` (scope=`spec/5-system/6-websocket-protocol.md`, diff-base=`origin/main`)
검토 대상: diff 내 신규/변경 구현 파일 — `codebase/backend/src/modules/websocket/`, `codebase/backend/src/modules/executions/`, `codebase/backend/src/modules/knowledge-base/`, `codebase/backend/src/modules/workflows/`, `codebase/backend/src/common/utils/uuid.ts`

---

## 발견사항

### 1. **[INFO]** `spec/5-system/6-websocket-protocol.md` §3.2 채널 패턴 표에 `background:run:{id}` 누락

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §3.2 채널 패턴 표 (line 118–123)
- **위반 규약**: CLAUDE.md "정보 저장 위치" — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"; `spec/conventions/spec-impl-evidence.md` §2 frontmatter `code:` 경로 정합 원칙
- **상세**: §3.2 채널 패턴 표에는 `execution:`, `workflow:`, `kb:`, `notifications:` 4개만 있다. 그러나 §3.3 권한 검증 표에는 `background:run:{id}` 가 5번째로 등장하며, diff 에서 `BackgroundRunChannelAuthorizer` 가 신설(또는 이전)됐고 `VALID_CHANNEL_PREFIXES` 에도 `background:run:` 이 포함돼 있다. §3.2 는 실제 지원 채널 목록의 SoT 이므로 표에서 `background:run:` 이 빠진 것은 spec 내 불일치이나, 이는 **기존 spec drift** (refactor M-7 이전부터 동일) 로 본 diff 에서 신규로 도입된 문제가 아니다. 단, 구현이 이 채널을 권장하고 있으므로 INFO 수준으로 기록.
- **제안**: spec §3.2 표에 `백그라운드 실행 | \`background:run:{id}\` | 백그라운드 실행 모니터링` 행 추가. (spec 쓰기 권한은 `project-planner` — 별도 위임 필요.)

---

### 2. **[INFO]** `channel-authorizer.ts` — 공개 인터페이스/토큰 파일에 JSDoc 없음 (swagger.md §1 간접 적용 범위 아님이나 spec-evidence frontmatter `code:` 경로 미등록)

- **target 위치**: `codebase/backend/src/modules/websocket/channel-authorizer.ts` (신규 파일)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2 `code:` 필드 — spec 이 약속한 surface 의 구현 경로를 frontmatter 에 등록
- **상세**: `spec/5-system/6-websocket-protocol.md` frontmatter 의 `code:` 목록(line 6–13)에는 `websocket.gateway.ts`, `websocket.service.ts` 등이 있으나, 신규로 도입된 `channel-authorizer.ts`, `notifications-channel-authorizer.ts` 는 등록되지 않았다. 개별 authorizer 파일들(도메인 모듈 소속)까지 모두 열거할 필요는 없지만, WS 모듈의 핵심 공개 계약 파일인 `channel-authorizer.ts` 는 spec-impl 연결의 단일 진실 경로로서 등록이 권장된다.
- **제안**: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 에 아래 두 줄 추가 검토:
  ```
  - codebase/backend/src/modules/websocket/channel-authorizer.ts
  - codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts
  ```
  (spec 쓰기 권한은 `project-planner` — 별도 위임 필요.)

---

### 3. **[INFO]** `KbChannelAuthorizer` — UUID 선차단 정책 추가 시 spec §3.3 `kb:` 행에 명시 부재

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §3.3 권한 검증 표 `kb:{documentId}` 행 (line 149)
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 기술 명세: `spec/<영역>/*.md` 본문"
- **상세**: 구현(`kb-channel-authorizer.ts`)은 `isValidUuid` 선차단을 W-6 정책으로 일관 적용했다. 그러나 spec §3.3 표의 `kb:` 행에는 "workspace 문서 소유 검증" 만 있고 "비-UUID 선차단" 명시가 없다. `execution:`, `workflow:`, `background:run:` 행에는 모두 "(비-UUID 선차단)" 이 적혀 있어 형식 불일치이다. 동작은 정확하고 보안이 강화됐으므로 CRITICAL/WARNING 이 아니나, spec 기술 명세와 구현이 달라 미래 리더가 혼동할 수 있다.
- **제안**: spec §3.3 `kb:` 행을 "workspace 문서 소유 검증 (비-UUID 선차단)" 으로 갱신. (spec 쓰기는 `project-planner` 위임.)

---

## 요약

정식 규약(`spec/conventions/**`) 기준으로 본 diff(M-7 channel authorizer inversion)는 전반적으로 규약을 준수하고 있다. 명명 규약(kebab-case 파일명, `ChannelAuthorizer`/`CHANNEL_AUTHORIZER` 식별자), 출력 포맷 규약(인가 실패 시 `{ error: string }` / 통과 시 `null` — spec §3.3 평문 error 문자열 계약과 일치), 에러 코드 규약(신규 에러 문자열 리터럴은 평문이며 `error-codes.md` §1 의 `UPPER_SNAKE_CASE` 공식 코드와 충돌 없음), swagger 규약(WS 파일은 REST DTO/컨트롤러가 아니므로 비적용) 모두 위반이 없다. 발견된 3건은 모두 INFO 수준으로, 기존 spec drift(§3.2 `background:run:` 누락) 또는 frontmatter `code:` 경로 미등록, spec 표 행의 부분 불일치이며 신규 코드가 규약을 어긴 사례는 없다.

## 위험도

NONE
