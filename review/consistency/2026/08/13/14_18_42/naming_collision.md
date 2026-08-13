# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 사전 확인: 실제 diff 범위

`git diff origin/main...HEAD -- codebase/ spec/` 를 워크트리 절대경로에서 직접 재현했다.
결과: **`spec/5-system/` 산하 어떤 파일도 이번 diff 에 포함되지 않았다.** 실제 변경분은 전부
`codebase/backend/src/modules/{execution-engine,executions,chat-channel}/` 아래의 코드/테스트이며,
요약하면:

1. `codebase/backend/src/modules/executions/executions.service.ts` — 기존 module-private 상수
   `SNAPSHOT_CACHE_MAX_ENTRIES = 256` 를 `export const` 로 가시성만 확장 (값 불변).
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — admission 자리
   (`rows.length === 1`) 앞에 `if (!Array.isArray(rows)) throw new Error('admission: UPDATE ...
   RETURNING 이 배열이 아님 …')` 방어 가드 추가. 일반 `Error`(비-typed, 비-`ExecutionError`)이며
   에러코드 레지스트리([conventions/error-codes.md](../../../../spec/conventions/error-codes.md))에
   등록되는 명명된 코드가 아니다.
3. `chat-channel.dispatcher.spec.ts` / `execution-engine.service.spec.ts` /
   `executions.service.spec.ts` — 신규 테스트 케이스 및 테스트 전용 헬퍼
   (`makeDispatcherHarness`, `buildDispatcherForNull`) 추가.
4. `plan/in-progress/backend-lint-gate-broken-on-main.md` — 체크리스트 완료 마킹(신규 식별자 없음).

즉 이번 변경은 **요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트/메시지명·ENV
var·spec 파일 경로 중 어느 층에서도 새 식별자를 spec 표면에 도입하지 않는다.** 유일한 "새로
노출된 이름"은 이미 존재하던 module-private 상수의 `export` 전환뿐이다.

## 점검 결과

### 1. 요구사항 ID 충돌
해당 없음 — 이번 diff 는 신규 요구사항 ID를 부여하지 않는다 (`EIA-*`/`WH-*`/`NAV-*` 등 어떤
접두 계열도 새로 생성되지 않았다).

### 2. 엔티티/타입명 충돌
`SNAPSHOT_CACHE_MAX_ENTRIES` export 전환을 신규 식별자에 준해 충돌 검사했다.

```
grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/ spec/
```

결과: `executions.service.ts`(정의+사용) · `executions.service.spec.ts`(신규 테스트, import) 두
파일에서만 등장 — 동일 이름의 다른 의미 사용처 없음. 충돌 없음.

테스트 전용 헬퍼 `makeDispatcherHarness` / `buildDispatcherForNull` 도 `chat-channel.dispatcher.spec.ts`
파일 스코프 내부에서만 정의·사용되며 export 되지 않는다 — 모듈 경계를 넘는 이름 충돌 가능성 없음.

### 3. API endpoint 충돌
해당 없음 — 신규 endpoint 없음.

### 4. 이벤트/메시지명 충돌
해당 없음 — 신규 webhook/queue/SSE 이벤트명 없음. 주석에 언급된 `isSubFilterNull` 은
`chat-channel.dispatcher.ts:192` 에 **이미 존재하던** 로컬 변수(이번 diff 로 신설되지 않음,
diff stat 에 `chat-channel.dispatcher.ts` 자체는 없고 `.spec.ts` 만 변경) — 신규 식별자 아님.

### 5. 환경변수·설정키 충돌
해당 없음 — 신규 ENV var/config key 없음. `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 등 admission 관련
기존 키는 변경되지 않았다.

### 6. 파일 경로 충돌
해당 없음 — `spec/5-system/` 에 신규 파일이 추가되지 않았다. `plan/in-progress/backend-lint-gate-broken-on-main.md`
는 기존 파일의 체크리스트 갱신이다.

## 요약

이번 검토 대상 diff(`origin/main...HEAD`, `codebase/` + `spec/`)는 `spec/5-system/` 문서 자체를
전혀 변경하지 않는다 — 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV var·spec 파일
경로 중 어느 것도 새로 도입되지 않았다. 유일하게 가시성이 바뀐 식별자(`SNAPSHOT_CACHE_MAX_ENTRIES`
의 `export` 전환)를 전수 grep 했으나 다른 의미의 기존 사용처와 충돌하지 않는다. 새로 추가된
테스트 헬퍼(`makeDispatcherHarness`, `buildDispatcherForNull`)와 방어 가드의 `Error` 메시지는
모듈-로컬/비-등록 성격이라 spec 레벨 식별자 충돌 표면 밖이다.

## 위험도

NONE
