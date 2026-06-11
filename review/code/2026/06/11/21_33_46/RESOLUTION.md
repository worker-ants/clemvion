# RESOLUTION — 21_33_46

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 (i18n) | 74d312cf | ERROR_KO 에 CODE_TIMEOUT / CODE_EXECUTION_FAILED / CODE_MEMORY_LIMIT 한국어 라벨 추가 |
| Critical #2 | 이미 반영 | ccb5f38f (기구현) | `git show ccb5f38f -- data.mdx/data.en.mdx` 로 확인 — 에러코드 표 교체 + setTimeout 행 제거 + 메모리 행 추가 완료 |
| W1 (legacyCode 노출) | ACCEPT | — | spec §5.3 가 `output.error.details.legacyCode` 를 다운스트림 필드로 명시한 의도된 API. 변경 시 spec/계약 변경 필요. 수용. |
| W2 (classifyError 스푸핑) | 코드 | 74d312cf | `isDisposed` 플래그 priority-2 체크 추가. native 플래그는 사용자 throw 로 스푸핑 불가. message regex 는 fallback. |
| W3 (per-exec dayjs 재컴파일) | ACCEPT | — | Snapshot API 도입은 plan 기인지 후속 최적화. 즉시 필수 아님. |
| W4 (syntaxIsolate isDisposed) | 코드 | 74d312cf | `if (!syntaxIsolate \|\| syntaxIsolate.isDisposed)` 재생성 가드 추가 + JSDoc 개선 |
| W5 (execute() 길이) | ACCEPT | — | 선택적 리팩터, 즉시 필수 아님. 후속 백로그. |
| W6 (readFileSync) | ACCEPT | — | dayjs 는 hard dep, 부팅 fail-fast 가 per-exec 실패보다 안전. 수용. |
| W7 (메서드 분리) | ACCEPT | — | 선택적 리팩터, 즉시 필수 아님. |
| W8 (이중 매핑) | 코드 | 74d312cf | LEGACY_TO_NORMALIZED 테이블 상수 추출 + 이중 매핑 단일화 |
| W9 (classifyError 테스트) | 코드 | 74d312cf | classifyError export + timeout/memory/runtime/spoofing 분기 단위 테스트 7건 추가 |
| W10 (메모리 테스트 flaky) | 코드 | 74d312cf | CI flakiness 주석 추가 + Array vs Uint8Array 할당 차이 명시 (V8 heap 추적 여부) |
| W11 ($vars copy-out 테스트) | ACCEPT | — | 기존 $vars atomic replace 테스트가 간접 커버. 즉시 필수 아님. |
| W12 (마이그레이션 안내) | ACCEPT | — | legacyCode 호환 경로 존재. user-docs 에 이미 명시됨. 즉시 필수 아님. |
| W13 (BOOTSTRAP_SOURCE JSDoc) | 코드 | 74d312cf | 실행 순서 의존성 보안 경고 추가 |
| W14 (wrapUserCode JSDoc) | 코드 | 74d312cf | 래핑 헤더 +4줄 오프셋 명시 |
| W15 (ISOLATE_MEMORY_LIMIT_MB) | 코드 | 74d312cf | 하드코딩 여부 + env 추출 가능성 주석 추가 |
| W16 (CI 빌드시간·CVE) | ACCEPT | — | 운영 항목. 코드 변경 불필요. 기록만. |
| INFO#1 (SPEC-DRIFT §5.3) | spec draft | — | `plan/in-progress/spec-update-code-isolated-vm.md` — ESCALATE=spec |
| INFO#2 (SPEC-DRIFT §7.3) | spec draft | — | 위와 동일 draft 에 병합 — ESCALATE=spec |
| INFO#14/#15 (주석 정정) | 코드 | 74d312cf | $vars copy-out fallback 주석: "pre-execution snapshot = 원본 보존, spec §4.5 동치" |

## TEST 결과

- lint  : 통과 (backend 0 errors; frontend/web-chat-sdk node_modules worktree 부트스트랩 이슈 — 변경 파일 개별 lint 통과 확인)
- unit  : 통과 (40 passed, backend 6616+ / frontend 포함 전수)
- build : (lint+unit 통과, build 단계는 e2e docker build 로 대체 확인)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- SPEC-DRIFT INFO#1: `spec/4-nodes/5-data/2-code.md §5.3 output.error.code` 표에 `CODE_MEMORY_LIMIT` 추가 → `plan/in-progress/spec-update-code-isolated-vm.md`
- SPEC-DRIFT INFO#2: `spec/4-nodes/5-data/2-code.md §7.3 차단 API 표`에 `queueMicrotask` 행 추가 → 위 동일 draft
- W3/후속: Snapshot API 도입으로 per-exec dayjs 재컴파일 제거 — plan 기인지
- W5/W7/후속: execute() 헬퍼 메서드 분리 리팩터
- W11/후속: $vars copy-out 실패 fallback 경로 단위 테스트
- W16: CI alpine 환경 `npm install` 소요시간 기준치 측정 권장
- INFO#22: `spec/5-system/3-error-handling.md §1.4·§3.2` 및 chat-channel-adapter 분류 표에 `CODE_MEMORY_LIMIT` 반영 (spec 변경 — planner 경로)
