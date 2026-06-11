---
worktree: code-node-isolated-vm
started: 2026-06-11
owner: resolution-applier
---
# Spec Update Draft — code-node isolated-vm SPEC-DRIFT

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 보다 더 정밀/완전함. 코드가 옳고 spec 표만 낡음.

## 원본 발견사항

### INFO#1
SUMMARY#INFO-1: `spec/4-nodes/5-data/2-code.md §5.3 공통 필드 표 output.error.code` 설명에
`CODE_MEMORY_LIMIT` 누락 — 코드는 옳고 spec 표만 낡음.

### INFO#2
SUMMARY#INFO-2: `queueMicrotask` 가 bootstrap 차단 목록에 포함되나 `spec/4-nodes/5-data/2-code.md §7.3 차단 API 표`에 미등재 — 구현이 spec 보다 더 정밀.

## 제안 변경

### §5.3 output.error.code 표 (INFO#1)

위치: `spec/4-nodes/5-data/2-code.md §5.3` — `output.error.code` 행 설명.

**Before:**
```
| `output.error.code` | ... | `CODE_TIMEOUT` · `CODE_EXECUTION_FAILED` 중 하나 |
```

**After:**
```
| `output.error.code` | ... | `CODE_TIMEOUT` · `CODE_EXECUTION_FAILED` · `CODE_MEMORY_LIMIT` 중 하나 |
```

설명란에 각 코드 의미 추가:
- `CODE_TIMEOUT` — 설정 타임아웃 초과
- `CODE_EXECUTION_FAILED` — 런타임 예외 (스택 트레이스 포함, 비프로덕션 한정)
- `CODE_MEMORY_LIMIT` — 128MB 메모리 한도 초과 (isolated-vm 전환으로 신규 추가)

### §7.3 차단 API 표 (INFO#2)

위치: `spec/4-nodes/5-data/2-code.md §7.3` — 차단 전역 목록 표.

**Before:** `queueMicrotask` 미등재.

**After:** `queueMicrotask` 행 추가:

| API | 분류 | 차단 사유 |
|-----|------|-----------|
| `queueMicrotask` | 비동기 스케줄링 | 마이크로태스크 큐 직접 접근으로 isolate 실행 흐름 조작 가능. bootstrap에서 `delete globalThis.queueMicrotask` 로 제거됨. |

## 관련 코드 증거

- `codebase/backend/src/nodes/data/code/code.handler.ts` L144: `'queueMicrotask'` 차단 목록에 명시적 포함
- `codebase/backend/src/nodes/core/error-codes.ts` L40: `CODE_MEMORY_LIMIT: 'CODE_MEMORY_LIMIT'` 정의
- `classifyError()` 함수: `EXECUTION_MEMORY_EXCEEDED` → `CODE_MEMORY_LIMIT` 정규화 경로
