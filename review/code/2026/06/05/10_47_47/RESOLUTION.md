# RESOLUTION — 10_47_47

PR-A2a `_resumeCheckpoint` schemaVersion + 재구성 견고화 — ai-review WARNING 자동 후속 처리

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W#1 | 코드 (테스트) | 96444289 | `CheckpointSubject` 타입을 describe 내부에서 최상위 describe 스코프로 승격 — 재사용 가능 |
| W#2 | 코드 (테스트) | 96444289 | schemaVersion 미래 버전 통합 테스트: `try/finally` monkey-patch → `jest.spyOn().mockResolvedValue(undefined)` + `spy.mockRestore()` 교체 (후속 테스트 격리 보장) |
| W#3 | 코드 (문서) | 96444289 | `CHANGELOG.md` `## Unreleased` 에 `_resumeCheckpoint schemaVersion` 항목 추가 (CHANGELOG.md 존재 확인 후 반영) |

INFO 항목 추가 반영 (고가치, 같은 commit 96444289):

| INFO # | 조치 | 비고 |
|--------|------|------|
| #3 | 코드 | `expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled()` 추가 — spec §7.5 NodeExecution failed 마킹 검증 |
| #4 | 코드 | `expect(codes.length).toBeGreaterThan(0)` 사전 가드 추가 — false-pass 방지 |
| #10 | 코드 | `schemaVersion: 1` (현재 버전) 정상 통과 경계값 테스트 신규 추가 |
| #11 | 코드 | `buildResumeCheckpoint(null)` → `toBeUndefined()` 단언 추가 |
| #12 | 문서 | `plan/in-progress/exec-park-durable-resume.md` A2a 체크박스 `[x]` + 완료일 2026-06-05 기록 |

## TEST 결과

- lint  : 통과 (warnings 0 errors on changed files)
- unit  : 통과 (282 passed — execution-engine.service.spec.ts)
- build : 통과 (`npx nest build` 에러 없음)
- e2e   : 통과 (168/168, duration=68s, log=`_test_logs/e2e-20260605-105924.log`)

e2e 수행 근거: 변경 파일에 `.spec.ts`(TypeScript 코드) 포함 — PROJECT.md §e2e 면제 화이트리스트에 해당 없음. 실행 의무.

## 보류·후속 항목

- **INFO #1 (보안, 장기)**: `...resumeFields` spread — allow-list 전환(deny-list/strip 방식이 아닌 명시 필드 열거 또는 checkpoint 로드 시 스키마 검증). 단기 긴급도 낮음, 별도 PR 트래킹.
- **INFO #2 (보안, 장기)**: 에러 메시지에 `ckptVersion`/`CHECKPOINT_SCHEMA_VERSION` 값 포함 — 채널 어댑터 변환 보장 조건부 수용. 채널 어댑터가 `error.code === 'RESUME_INCOMPATIBLE_STATE'` 분기에서 원본 메시지를 사용자에게 노출하지 않는지 확인 후 수용.
- **side_effect reviewer 재실행 불요**: 다른 6 reviewer(LOW/0-critical)가 충분히 커버. SUMMARY 메모.
