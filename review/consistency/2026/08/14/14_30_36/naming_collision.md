# 신규 식별자 충돌 검토

## 검토 범위 및 방법

`_prompts/naming_collision.md` 는 target spec 영역(`spec/5-system/`) 자체의 diff 를 담고 있지 않았다 (`spec/5-system/` 는 `origin/main...HEAD` 대비 무변경 — `git diff origin/main...HEAD --stat -- spec/` 결과 없음). 프롬프트 내 `<git diff origin/main...HEAD -- code_areas>` 섹션도 컨텍스트 예산 초과로 절단돼 있었으므로, 실제 신규 식별자는 워크트리에서 직접 `git diff origin/main...HEAD -- codebase/` 로 재확인했다 (절대경로 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 이 세션의 CWD와 동일).

이번 변경(`34e32e62f` "fanout 만 막았다 — REST 스냅샷으로 같은 프롬프트가 나가고 있었다")이 도입하는 신규 식별자:

- 신규 파일 `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- export `stripExternalOnlyFields<T>(value: T, maxDepth: number): T` (기존 `websocket.service.ts` 내부의 module-private 동명 함수를 대체·이전하며 `maxDepth` 매개변수 추가로 시그니처 확장)
- export `EXTERNAL_STRIPPED_FIELDS`(`= ['llmCalls'] as const`, 기존 `websocket.service.ts` 의 module-private 상수를 이전·export)
- module-private 함수 `stripDeep`(새 파일 내부, 재귀 strip 구현)
- 기존 상수 재사용: `MAX_REDACT_DEPTH`(`sanitize-error-message.ts`, origin/main 기 존재) / `MAX_SANITIZE_DEPTH`(`websocket.service.ts`, origin/main 기 존재) — 이번 diff 가 새로 만든 이름이 아니라 새 호출부가 기존 상수를 import 해 재사용하는 것.

각 관점별로 전수 grep 을 돌렸다.

## 발견사항

### INFO — 이전(moved) 식별자에 대한 stale 위치 참조 (충돌 아님, 위치 혼선 소지)

- target 신규 식별자: `stripDeep` (신규 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:45`)
- 기존 사용처: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:616` 의 JSDoc 주석 — `` `stripDeep`(`websocket.service.ts`)은 SSE·webhook·chat-channel fanout 에서 `` 라고 적혀 있다.
- 상세: 이번 diff 로 `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`/(신규) `stripDeep` 로직 전체가 `websocket.service.ts` 에서 `shared/utils/strip-external-only-fields.ts` 로 이동했다 (`git grep -n "function stripDeep"` 확인 결과 `websocket.service.ts` 에는 더 이상 `stripDeep` 라는 이름의 함수가 없다 — 남은 것은 별개 이름의 `sanitizePayloadForWs`/`sanitizeInner`뿐). 그런데 같은 diff 로 새로 추가된 `interaction.service.spec.ts:616` 테스트 주석은 여전히 `stripDeep` 의 소재를 `websocket.service.ts` 라고 가리킨다. 이름 자체가 다른 대상과 충돌하는 것은 아니다(현재 코드베이스에 `stripDeep` 라는 이름의 함수는 신규 파일 하나뿐, module-private) — 다만 "같은 이름이 어느 파일 소속인가"에 대한 문서 포인터가 이번 커밋에서 스스로 어긋났다.
- 제안: 해당 JSDoc 주석의 파일 포인터를 `` `stripDeep`(`shared/utils/strip-external-only-fields.ts`) `` 로 정정. (naming collision 자체는 아니라서 차단 사유는 아니며, 문서 정확성 차원의 사소한 후속 정리로 권장.)

## 관점별 결과 요약 (충돌 없음 확인)

1. **요구사항 ID 충돌** — 이번 diff 는 새 요구사항 ID(`WH-*`/`R*`/`F-*` 류)를 부여하지 않는다. 해당 없음.
2. **엔티티/타입명 충돌** — `stripExternalOnlyFields` / `EXTERNAL_STRIPPED_FIELDS` / `stripDeep` 세 식별자를 `codebase/` 전역(`frontend`/`channel-web-chat`/`packages` 포함)에서 grep 했으나 이 신규 파일 외 정의·사용처 없음. `shared/utils/` 안의 다른 `export function strip*` (`agent-memory-injection.ts`, `channel-web-chat/lib/api-base.ts` 등)은 이름이 다르고 무관. 충돌 없음.
3. **API endpoint 충돌** — 이번 diff 는 신규 endpoint 를 도입하지 않는다 (기존 `GET /api/external/executions/:id` 핸들러 내부 로직 변경뿐). 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 WS/SSE/webhook 이벤트명 없음(기존 `execution.waiting_for_input`/`AI_MESSAGE` fanout 경로의 내부 strip 로직만 변경). 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var/config key 없음. `MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH` 는 TS 상수(런타임 env 아님)이며 둘 다 origin/main 에 이미 존재하던 것을 새 호출부가 재사용. 충돌 없음.
6. **파일 경로 충돌** — `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 는 같은 디렉터리의 기존 파일들(`bcrypt-format.ts`, `retry-after.ts`, `sanitize-error-message.ts`)과 동일한 kebab-case 단일-책임 명명 컨벤션을 따르며, 기존 파일과 경로가 겹치지 않는다. 충돌 없음.

## 요약

target 변경(`strip-external-only-fields.ts` 신설 + `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 이전·export 확장)이 도입하는 식별자는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 6개 관점 전수에서 기존 사용처와 실질 충돌을 일으키지 않았다. 유일한 발견은 CRITICAL/WARNING 급 충돌이 아니라, 같은 커밋 안에서 함수가 이동했는데 새로 추가된 테스트 JSDoc 하나가 옛 파일 위치를 계속 가리키는 stale 포인터(INFO)뿐이다.

## 위험도

LOW
