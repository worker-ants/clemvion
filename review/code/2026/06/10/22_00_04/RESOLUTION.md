# RESOLUTION — 22_00_04 (승인 묶음: dead code + M-5 deep freeze)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | (M-5 W-fix 커밋) | freeze 가 공유 참조에 적용됨/비용 집중 JSDoc 명시 + freezeSharedCacheValues JSDoc |
| W2 | 코드 | (동일) | FREEZE_BRANCH_CACHE allowlist(development\|test) + export, 테스트 전제 단언 |
| W3 | 코드 | (동일) | 테스트 try/catch → expect(mutator).toThrow(TypeError) |
| W4 | 문서 | (동일) | deepFreeze 비용 첫 branch 집중 JSDoc 명시 (production 무영향이라 코드 변경 불요) |
| SPEC-DRIFT 1 | spec | spec-update-deadcode-cleanup.md draft | system-status §3 상수명→getter (planner 트랙) |
| SPEC-DRIFT 2 | spec | (동일 draft, 선택) | engine §7.4 날짜 갱신 (선택) |
| SPEC-DRIFT 3·4 | 확인 | — | registerContinuationHandlers·toEiaEvent spec 잔재 grep **0건** → 갱신 불요 확인 |
| INFO 5·7·8·17·20 | 기존 코드 | — | 본 PR 무관(continuation-bus 기존 코드)·review/ 보존 정책 — 후속 |
| INFO 13·14·15 | 확인 | — | continuation 흐름 e2e 179 통과 커버 + 상수 잔여 import grep 0 확인 |

## TEST 결과

- lint  : 통과
- unit  : 통과
- build : 통과
- e2e   : 통과 (179/179)

## 보류·후속 항목

- SPEC-DRIFT 1·2: `plan/in-progress/spec-update-deadcode-cleanup.md` — project-planner `/consistency-check --spec` 후 반영.
- M-1·m-4 (원 승인 묶음 중 2건): impl-prep WARNING 으로 planner 선행 분리 — plan 에 ⏭️ 표기, 별도 트랙.
- INFO 기존-코드 항목(continuation-bus sanitizeForLog·nextSeq random·releaseLock): 본 PR 범위 밖, refactor 백로그 grooming.
