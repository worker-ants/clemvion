# 신규 식별자 충돌 검토 — naming_collision

## 대상
- Target: `spec/data-flow/` (impl-done, diff-base `origin/main`)
- 실제 코드 diff 는 2개 파일에 한정:
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- 번들에 포함된 `spec/data-flow/*.md` 전체(15-external-interaction.md, 0-overview.md, 1-audit.md, 3-execution.md, 11-workflow.md, 12-workspace.md, 2-auth.md, 4-file-storage.md 등)는 diff 대상이 아니라 **컨텍스트로 첨부된 unchanged 문서** — 이번 변경이 spec 파일 자체를 수정하지 않았다(요구사항 ID·엔티티·endpoint·이벤트명 신설 없음).

## 변경 내용 요약
`IdempotencyInterceptor` 캐시 히트 경로의 버그 픽스: 바깥 JSON(엔트리)뿐 아니라 안쪽 `responseJson`(payload)도 손상될 수 있다는 사실을 반영해, 두 손상 경로를 `discardCorruptEntry()` 로 통합하고 각각 warn 로그를 남기도록 확장. `bodyHash` 판정이 payload 파싱보다 먼저 오도록 순서를 고정.

## 신규 식별자 목록과 충돌 점검

1. **요구사항 ID** — 신규 ID 없음. 기존 `Spec EIA §R7`/`§R8`/`§R10`, `EIA-RL-02`, `EIA-AU-08/09` 등은 모두 기존 참조 재인용이며 diff 가 새 ID 를 부여하지 않는다.
2. **엔티티/타입명** — 신규 public 타입 없음. 신규 **private 메서드** `discardCorruptEntry<T>(what: '엔트리' | 'payload', err, processFresh)` 1건. `git grep -n "discardCorruptEntry"` 결과 정의 1곳(`idempotency.interceptor.ts:219`) + 동일 파일 내 호출 2곳(엔트리/payload) + JSDoc `{@link}` 1곳뿐 — 다른 모듈에 동명 식별자 없음. 충돌 없음.
3. **API endpoint** — 신규 endpoint 없음. 기존 `/api/external/executions/:id/*` REST 표면 불변.
4. **이벤트/메시지명** — 신규 warn 로그 메시지 2종: `IdempotencyInterceptor cache 엔트리 손상 — 무시하고 신규 처리: ...`, `IdempotencyInterceptor cache payload 손상 — 무시하고 신규 처리: ...`. `git grep -n "손상"` 로 codebase 전역을 확인한 결과 "손상" 이라는 한국어 단어 자체는 auth/execution-engine/knowledge-base/folders 등 여러 모듈에서 범용적으로 쓰이지만, `cache 엔트리 손상`/`cache payload 손상` 이라는 구체 로그 문자열 조합은 이 파일에만 존재 — 다른 의미로 이미 쓰이는 동일 문자열 없음. BullMQ 큐명·SSE/webhook 이벤트명(`execution.*`, `notification-webhook` 등)도 diff 에 신규 도입 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음 (`IEXT_REFRESH_WINDOW_SEC` 등 기존 키 불변, diff 에 등장하지 않음).
6. **파일 경로** — 신규 spec/코드 파일 없음. 기존 두 파일(`idempotency.interceptor.ts`/`.spec.ts`)의 내용만 수정.

## 발견사항
없음 — 이번 변경 범위(캐시 손상 처리 버그 픽스)는 spec 레벨 식별자를 새로 도입하지 않고, 코드 레벨에서 도입한 유일한 신규 이름(`discardCorruptEntry`, warn 로그 문자열 2종)도 codebase 전역에서 유일함을 확인했다.

## 요약
target 으로 지정된 `spec/data-flow/` 는 이번 diff 에서 실제로 변경되지 않았고(컨텍스트 번들만 첨부), 실질 변경은 `IdempotencyInterceptor` 내부의 캐시 손상 처리 로직 리팩터링 1건이다. 요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV/설정키·파일 경로 6개 관점 모두에서 새로 도입된 식별자가 없거나(대부분), 유일하게 신설된 private 메서드/로그 메시지가 codebase 전역에서 충돌 없이 유일함을 grep 으로 확인했다. 신규 식별자 충돌 관점에서 리스크는 없다.

## 위험도
NONE
