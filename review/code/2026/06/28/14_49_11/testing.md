# Testing Review

## 발견사항

### [INFO] `safeApiBaseFromQuery` — `data:` 스킴 테스트 케이스 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` (safeApiBaseFromQuery describe 블록)
- 상세: 구현 JSDoc 주석에 `javascript:`/`data:`/상대경로를 거른다고 명시되어 있으나, 테스트에 `data:` 스킴(예: `data:text/html,<script>...`) 케이스가 없다. `data:` URL 은 `new URL()` 파싱이 성공하고 protocol이 `data:`로 반환되므로 http(s) 조건에서 누락되어 `undefined` 반환이 맞지만, 이를 검증하는 테스트 케이스가 없다. 보안 하드닝 코드에서 다뤄야 할 중요 스킴이다.
- 제안: `it("data: 스킴 → 무시(undefined)", ...)` 케이스 추가.

### [INFO] `safeApiBaseFromQuery` — 빈 문자열(`""`) 케이스 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts`
- 상세: 구현의 `if (!raw) return undefined` 조건은 `null` 외에 빈 문자열 `""` 도 falsy 처리하여 `undefined`를 반환한다. `q.get("apiBase")`가 `""` 를 반환하는 경우가 있을 수 있으며(파라미터는 있으나 값이 없는 경우), null 케이스와 동일하게 경고 없이 undefined가 반환되어야 한다. 현재 테스트에서 `""` 케이스를 명시적으로 확인하지 않는다.
- 제안: `it("빈 문자열 → undefined(경고 없음)", ...)` 케이스 추가 또는 null 테스트 케이스 이름에 `null/빈 문자열` 로 통합.

### [INFO] `javascript:` 케이스에서 경고 출력 여부 검증 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` 24-27행
- 상세: `javascript:` 스킴 케이스에서 `console.warn`을 spy 처리하지만 경고가 **호출되었는지** 단언하지 않는다(`null` 케이스와 대조적으로 null은 경고가 없음을 단언). 보안 관점에서 차단 시 경고가 반드시 발생해야 한다는 의도를 테스트가 검증하지 않아, 향후 구현이 경고를 제거해도 테스트가 통과된다.
- 제안: `javascript:` 케이스와 `상대경로(파싱 불가)` 케이스에 `expect(warn).toHaveBeenCalledWith(expect.stringContaining("[widget]"), expect.any(String))` 또는 `expect(warn).toHaveBeenCalledOnce()` 단언 추가.

### [INFO] `EmbedConfigDto` JSDoc 추가에 대한 별도 단위 테스트 없음 — 비차단
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
- 상세: 이번 변경은 기존 필드에 JSDoc 주석만 추가한 것이다. DTO 자체의 직렬화/역직렬화 테스트나 Swagger 스키마 반영 테스트는 이번 변경의 범위 밖이며, 기능 동작을 바꾸지 않으므로 별도 테스트 추가는 불필요하다. 기존 integration 테스트가 이 DTO를 커버하면 충분하다.
- 제안: 없음. 현 상태 적절.

### [INFO] 비-문서 변경 파일(plan, consistency review JSON/MD)에 대한 테스트 불필요
- 위치: `plan/in-progress/webchat-polish-batch.md`, `review/consistency/2026/06/28/14_36_34/` 하위 파일들
- 상세: 이들은 계획 추적 문서 및 리뷰 산출물로 코드가 아니므로 단위 테스트 대상이 아니다.
- 제안: 없음.

## 요약

이번 변경의 핵심 코드 변경은 `safeApiBaseFromQuery` 함수 도입이며, 5개 단위 테스트 케이스(https 허용, http 허용, javascript: 차단, 상대경로 차단, null 처리)가 추가되어 기본적인 커버리지는 갖추고 있다. null 케이스에서 경고 미발생 검증(`expect(warn).not.toHaveBeenCalled()`)을 명시한 것은 우수한 패턴이다. 다만 JSDoc에 언급된 `data:` 스킴 테스트 케이스가 없고, `javascript:`/상대경로 케이스에서 경고가 실제로 발생하는지 단언하지 않아 보안 의도의 완전한 검증이 이루어지지 않는다. 또한 빈 문자열 엣지 케이스도 미테스트 상태다. 이 세 항목은 모두 INFO 등급으로 차단 요인이 아니며, 기존 `widget-app.test.tsx`의 임베드 차단 테스트(85행)와 조합하면 실질적인 보안 경로 전체가 통합 수준에서 커버되고 있다.

## 위험도

LOW
