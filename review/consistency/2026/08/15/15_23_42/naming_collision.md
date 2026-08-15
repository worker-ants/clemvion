# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 조사 방법

`--impl-done` 모드이므로 `origin/main` 대비 실제 diff(코드+spec)를 1차 근거로 삼았다
(워킹트리 절대경로: `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`).
번들 파일에는 `spec/5-system/14-external-interaction-api.md` 전문이 포함돼 있으나, 실제
diff 는 매우 좁다:

```
spec/5-system/14-external-interaction-api.md              | 16 +-
spec/conventions/node-cancellation.md                     | 20 +-
codebase/backend/.../execution-engine.service.ts          | 79 ++
codebase/backend/.../retry-turn.service.ts                | 27 ++
codebase/backend/.../execution-status-response.dto.ts      | 16 ++
codebase/backend/.../interaction.service.ts                |  6 +
codebase/backend/.../shared/utils/terminal-duration.ts     | 18 ++
```

이번 PR 은 신규 채널·엔드포인트·이벤트를 도입하지 않고, 기존 EIA-IN-04 요구사항이 이미
약속했던 `durationMs` 필드를 `GET /api/external/executions/:executionId` 응답에 실제로
채우는 작업(+ `finalizeCancelledExecution`/retry-turn 종결 emit 버그 수정)이다. 따라서
신규 식별자 표면 자체가 작다.

## 발견사항

### 신규 식별자 목록과 충돌 여부

| 신규 식별자 | 종류 | 충돌 여부 |
|---|---|---|
| `durationMs` (REST `GET /api/external/executions/:id` 응답 필드, `ExecutionStatusDto.durationMs`) | DTO 필드 | 없음 — §6 종결 이벤트(webhook/SSE/WS) 의 **동일 이름·동일 의미·동일 값**(`영속 컬럼을 그대로 싣는다`)으로 spec 본문이 명시. 새 의미의 재사용이 아니라 표면 간 필드명 일치(의도된 설계) |
| `toPersistedDate` (`codebase/backend/src/shared/utils/terminal-duration.ts` 신규 export 함수) | 함수명 | 없음 — `git grep` 결과 정의 1곳 + 호출 1곳(`retry-turn.service.ts`)뿐. 자매 함수 `toFiniteNumber` 와 명명 패턴 일치, 기존 동명 식별자 없음 |
| `.returning(['duration_ms', 'finished_at'])` (retry-turn.service.ts 신규 RETURNING 절) | DB 컬럼명 재사용 | 없음 — `execution-engine.service.ts` 의 기존 5개 `.returning(['id', 'duration_ms'])` 호출부와 동일 컬럼명 표기 컨벤션을 그대로 따름 |
| `finalizeCancelledExecution` 의 재조회 분기(신규 로직) | 함수 내부 로직 | 새 식별자 도입 아님 — 기존 함수명 유지, 내부 분기만 추가 |

### ID·엔드포인트·이벤트·ENV·파일경로

- **요구사항 ID**: 신규 ID 부여 없음. `EIA-IN-04` 는 기존 ID 그대로, 설명 문구만 `durationMs` 추가 반영(값 서술 변경, ID 재사용 아님).
- **엔티티/DTO/타입명**: 신규 타입·인터페이스 없음. `ExecutionStatusDto` 에 필드 1개 추가.
- **API endpoint**: 신규 endpoint 없음. 기존 `GET /api/external/executions/:executionId` 응답 스키마에 필드만 additive.
- **이벤트/메시지명**: 신규 이벤트 없음.
- **환경변수·설정키**: 신규 ENV/설정키 없음 (diff 내 `process.env.*` 신규 참조 0건).
- **파일 경로**: 신규 spec 파일 없음(기존 `14-external-interaction-api.md`, `conventions/node-cancellation.md` 편집만). 신규 소스 파일 없음(기존 `terminal-duration.ts` 에 함수 추가).

검토한 관점 6가지 전부에서 CRITICAL/WARNING 급 충돌을 발견하지 못했다.

## 요약

이번 target 변경은 새 채널·엔드포인트·이벤트·엔티티·ENV·spec 파일을 전혀 도입하지 않는
좁은 범위의 버그 수정 + 필드 additive PR이다. 유일한 신규 식별자인 DTO 필드
`durationMs` 는 §6 종결 이벤트 필드와 이름·의미·값이 완전히 동일하도록 spec 이 명시적으로
설계했고(다른 의미의 우발적 재사용이 아님), 유일한 신규 함수 `toPersistedDate` 는
`git grep` 상 다른 사용처와 충돌 없이 자매 함수 `toFiniteNumber` 명명 패턴을 그대로 따른다.
DB `RETURNING` 컬럼명(`duration_ms`/`finished_at`) 표기도 같은 파일군의 기존 관행과
일치한다. 신규 식별자 충돌 관점에서 이 PR 은 안전하다.

## 위험도

NONE
