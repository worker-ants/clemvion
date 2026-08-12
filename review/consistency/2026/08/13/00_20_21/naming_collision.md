# 신규 식별자 충돌 검토 — naming_collision

## 대상
- Target: `spec/data-flow/` (impl-done, diff-base `origin/main`, 워킹트리 `.claude/worktrees/eia-r8-cache-scope-4ae434`)
- `git diff origin/main...HEAD --stat` 실측: 실질 코드 변경은 2개 파일에 한정.
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
  - (그 외 `CHANGELOG.md` 및 `review/**` 산출물 — 식별자 신설과 무관)
- 번들에 첨부된 `spec/data-flow/*.md` 전체(15-external-interaction.md 포함 15개 문서)는 이번 diff 에서 **수정되지 않은 컨텍스트**다. `git diff --stat` 에 `spec/` 경로가 전혀 나타나지 않음 — 요구사항 ID·엔티티·endpoint·이벤트명·ENV·파일 경로를 spec 레벨에서 신설한 바 없다.

## 변경 내용 요약
`IdempotencyInterceptor` 캐시 히트 경로 버그 픽스: 바깥 JSON(엔트리)뿐 아니라 안쪽 `responseJson`(payload)도 손상될 수 있다는 사실을 반영. 두 손상 경로를 `discardCorruptEntry()` 로 통합해 각각 warn 로그를 남기도록 확장하고, 엔트리 형태 검증(`isIdempotencyEntry`)·손상 로그용 형태 기술(`describeShape`)을 새로 추가. `bodyHash` 판정이 payload 파싱보다 먼저 오도록 순서를 고정.

## 신규 식별자 목록과 충돌 점검

1. **요구사항 ID** — 신규 ID 없음. 코드·주석에 등장하는 `Spec EIA §R7`/`§R8`/`§R10`, `EIA-RL-02` 는 모두 기존 참조 재인용이며, diff 는 spec 문서를 건드리지 않아 새 ID 를 부여하지 않는다.
2. **엔티티/타입명 / 함수명** — 신규 public 타입 없음. 신규 식별자 3건, 전부 이 파일 내부 전용:
   - private 메서드 `discardCorruptEntry<T>(what: '엔트리' | 'payload', detail, processFresh)` — 정의 1곳(`idempotency.interceptor.ts:234`), 호출 3곳(엔트리 파싱 실패/형태 불일치/payload 파싱 실패), JSDoc `{@link}` 1곳.
   - 타입가드 함수 `isIdempotencyEntry(value): value is IdempotencyEntry` — 정의 1곳(`:370` 부근), 호출 1곳.
   - 헬퍼 함수 `describeShape(value): string` — 정의 1곳(`:381` 부근), 호출 1곳.
   `git grep -n "discardCorruptEntry|isIdempotencyEntry|describeShape"` 로 `codebase/` `spec/` 전역을 확인한 결과 위 파일 밖에 동명 식별자 없음. 충돌 없음.
3. **API endpoint** — 신규 endpoint 없음. 기존 `/api/external/executions/:id/*` REST 표면 불변, 컨트롤러/라우트 파일은 diff 대상이 아니다.
4. **이벤트/메시지명** — 신규 warn 로그 메시지 2종 확인: `` `IdempotencyInterceptor cache 엔트리 손상 — 무시하고 신규 처리: ...` ``, `` `IdempotencyInterceptor cache payload 손상 — 무시하고 신규 처리: ...` ``. `git grep -n "엔트리 손상|payload 손상"` 로 codebase 전역 검색 결과 이 두 로그 문자열 조합과 그 assert(`idempotency.interceptor.spec.ts`)만 존재 — 다른 모듈이 같은 문자열을 다른 의미로 쓰는 사례 없음. BullMQ 큐명·SSE/webhook 이벤트명(`execution.*`, `notification-webhook` 등)도 diff 에 신규 도입 없음.
5. **환경변수·설정키** — 신규 ENV/config key 없음. `IDEMPOTENCY_HEADER`/`REDIS_KEY_PREFIX`/`TTL_SEC`/`IEXT_REFRESH_WINDOW_SEC` 등은 모두 diff 밖(기존 상수, 값 변경 없음).
6. **파일 경로** — 신규 spec/코드 파일 없음. 기존 두 파일(`idempotency.interceptor.ts`/`.spec.ts`) 내용만 수정.

## 발견사항
없음 — 이번 변경 범위(캐시 손상 처리 완성: payload 손상 방어 추가 + 형태 검증 + 판정 순서 고정)는 spec 레벨 식별자를 새로 도입하지 않는다. 코드 레벨에서 새로 도입한 이름 3건(`discardCorruptEntry`, `isIdempotencyEntry`, `describeShape`)과 로그 메시지 2종 모두 `codebase/`·`spec/` 전역에서 유일함을 `git grep` 으로 확인했다.

## 요약
target 으로 지정된 `spec/data-flow/` 는 이번 diff 에서 실제로 수정되지 않았고(컨텍스트 번들만 첨부), 실질 변경은 `IdempotencyInterceptor` 내부의 캐시 손상 처리 로직 완성 1건(직전 라운드 대비 `isIdempotencyEntry`·`describeShape` 두 헬퍼가 추가됨)이다. 요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV/설정키·파일 경로 6개 관점 모두에서 새로 도입된 식별자가 없거나(대부분), 유일하게 신설된 private 메서드/함수 3건·로그 메시지 2종이 codebase 전역에서 충돌 없이 유일함을 실측했다. 신규 식별자 충돌 관점에서 리스크는 없다.

## 위험도
NONE
