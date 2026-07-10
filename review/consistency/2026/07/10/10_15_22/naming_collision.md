# 신규 식별자 충돌 검토

## 검증 방법 (실제 diff 확인)

프롬프트 파일에 첨부된 target 문서 페이로드는 `spec/5-system/` 전체(수천 줄)를 담고 있었으나,
호출자 지시에 따라 이를 신뢰하지 않고 아래로 **실제 diff 를 직접 재확인**했다:

```
git -C /Volumes/project/private/clemvion/.claude/worktrees/conversation-thread-secret-hardening-6477bb \
  diff origin/main...HEAD
```

결과: 이번 변경은 `spec/5-system/` 을 전혀 건드리지 않는다. 실제 diff 는 다음으로 구성된다.

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 `SECRET_LEAK_PATTERNS`
  배열(정규식 4개)에 **정규식 리터럴 2개**(bare JWT / URI-embedded userinfo)를 추가. 배열 자체,
  `redactSecrets`/`deepRedactSecrets`/`sanitizeLastErrorMessage`/`CREDENTIAL_KEY_PATTERN`/
  `MAX_REDACT_DEPTH` 등 모든 export 심볼은 기존 그대로 — **신규 export 식별자 없음**.
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 테스트 6건 추가. 새로
  선언되는 `const`(`jwt`, `out`)는 모두 `it()` 블록 로컬 스코프.
- `review/code/2026/07/10/10_05_20/*.md`, `review/code/2026/07/10/10_14_41/*.md` — `/ai-review`
  세션 산출물(`SUMMARY.md`/`RESOLUTION.md`/`security-reviewer.md`/`testing-reviewer.md`).

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 요구사항 ID 부여 없음 (spec 변경 자체가 없음).
2. **엔티티/타입명 충돌** — 신규 export 없음 (위 확인). `SECRET_LEAK_PATTERNS` 는 유일한 정의처이며
   (`git grep` 확인) `execution-engine/sanitize-error-message.ts`, `mcp-error-codes.ts`,
   `integration-oauth.service.ts`, `thread-renderer.ts`, cafe24/makeshop spec, 그리고
   `spec/5-system/11-mcp-client.md`·`spec/5-system/14-external-interaction-api.md`·
   `spec/2-navigation/4-integration.md` 모두 동일 SoT 를 포인터로 참조 — 경쟁 정의 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 신규 파일은 `review/code/2026/07/10/10_05_20/` 와
   `review/code/2026/07/10/10_14_41/` 두 타임스탬프 디렉터리. 기존
   `review/code/2026/07/10/{00_00_42, 00_52_26, 01_46_28, 02_09_15, 08_10_24, 08_13_00, 08_56_55,
   09_16_00, 09_17_14, 09_29_31}` 과 겹치지 않는 신규 타임스탬프이며, `<YYYY>/<MM>/<DD>/<hh_mm_ss>/`
   컨벤션(CLAUDE.md 코드 리뷰 산출물 규약)을 그대로 따른다. 충돌 없음.

## 부가 확인 — `EIA §R17` 참조 유효성

신규 코드 주석("2026-07-10 — ... EIA §R17 잔여 하드닝")이 가리키는 `spec/5-system/14-external-interaction-api.md`
의 `### R17.` 섹션(라인 1104)이 실제로 존재함을 확인했다 — 댕글링 참조 아님, 기존 acronym `EIA`(=
External Interaction API, `spec/5-system/14-external-interaction-api.md`)를 정확한 의미로 재사용한
것이며 새 의미를 덧씌우지 않는다.

## 부가 확인 (참고용, 이번 diff 범위 밖) — userinfo 마스킹 로직의 기능적 중복

`git grep`으로 URI userinfo 자격증명을 다루는 기존 구현이 이미 2곳 더 있음을 확인했다:
`codebase/backend/src/modules/mcp/mcp-error-codes.ts`(MCP 전용 패턴, PR #842 선행)와
`codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
(`sanitizeUrlCredentials`). 다만 이들은 **함수/변수명이 서로 다르고**(이름 충돌 없음), 이번 신규
정규식은 이름 없는 배열 원소(리터럴)로 추가되므로 "식별자 충돌" 관점에서는 문제가 없다. 이미
`review/code/2026/07/10/10_05_20/security-reviewer.md`·`testing-reviewer.md`가 이 기능적 중복/스코프를
검토·처분 완료한 상태(INFO, net-new 는 bare-JWT 한정임을 PR 본문에 명시)이므로 본 신규 식별자
충돌 리뷰에서 별도 등급 부여는 하지 않는다(참고 기록만).

## 발견사항

없음.

## 요약

호출 시 지시된 대로 프롬프트 페이로드가 아니라 `git diff origin/main...HEAD` 로 실제 변경분을
재확인한 결과, 이번 변경은 기존 `SECRET_LEAK_PATTERNS` 정규식 배열에 이름 없는 정규식 리터럴
2개를 추가하는 것이 전부이며 신규 export 식별자·엔티티·API endpoint·이벤트명·환경변수·config
key·spec 파일 경로 중 어느 것도 새로 생성하지 않는다. `review/code/2026/07/10/{10_05_20,10_14_41}/`
산출 파일 경로 역시 기존 타임스탬프 디렉터리와 겹치지 않으며 규약을 따른다. 코드 주석이 참조하는
`EIA §R17` 도 실재하는 기존 섹션이다. 신규 식별자 충돌 관점에서 위험 요소가 전혀 발견되지 않았다.

## 위험도

NONE
