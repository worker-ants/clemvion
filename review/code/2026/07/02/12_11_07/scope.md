# 변경 범위(Scope) 리뷰

대상: `ai-turn-orchestrator.service.ts`, `execution-engine.service.spec.ts`, `execution-engine.service.ts`, `handler-output.adapter.ts`, `retry-turn.service.ts`, `utils/resume-state.schema.ts`(신규), `utils/resume-state.schema.spec.ts`(신규) — 커밋 `ab25beaf5`(RESUME-STATE 클러스터) + `62efb1bce`(ai-review W-1 drift 가드 strict 화 fix). 이번 페이로드에는 이전 리뷰 세션(`review/code/2026/07/02/11_59_12`)의 SUMMARY/RESOLUTION/각 reviewer 산출물(파일 8~17)도 컨텍스트로 포함돼 있으며, 이는 리뷰 대상 코드가 아니라 "직전 라운드에서 이미 검토·조치된 이력"이다.

## 사전 확인한 선언된 범위

`plan/in-progress/refactor/03-maintainability.md` M-7 항목(라인 221-229, 워킹트리에 uncommitted 갱신 존재)에 따르면:
- M-7 은 엔진 전반 inline 타입 단언(~124건/~15파일)을 SAFE-TORECORD / STORE-PRESERVE / LOAD-BEARING / RESUME-STATE 클러스터로 나눠 순차 진행 중.
- 첫 클러스터(PR #782, `27225ae39`)는 `to-record.ts` + `cachedMeta` 1건.
- **RESUME-STATE 클러스터**가 계획서에 명시된 "후속 클러스터" 항목(§7.4 zod schema 필요 분류) — 이번 diff 가 정확히 그 항목을 다룬다.
- plan 문서 자체도 이번 변경으로 갱신되어(`git status`상 `plan/in-progress/refactor/03-maintainability.md` uncommitted modified) "RESUME-STATE 클러스터 (본 PR)" 섹션이 실제 diff 범위(7파일, 6곳 단언 전환, 테스트, ai-review 세션 경로)를 정확히 서술 — 직전 리뷰 라운드(`11_59_12`)의 INFO #6("plan 서술이 실제 범위보다 좁음")과 scope.md 자체 INFO("plan 문서가 diff 에 포함 안 됨")가 지적한 갭을 이번 변경이 해소한다.

## 발견사항

- **[INFO]** `execution-engine.service.spec.ts` 의 drift-guard가 이전 라운드 대비 강화(`safeParse` → `.strict().safeParse`)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (두 사이트)
  - 상세: 커밋 `62efb1bce` 는 직전 ai-review(`11_59_12`)의 WARNING W-1(non-strict `safeParse` 는 unknown 키를 조용히 strip 해 검증이 항상-참)에 대한 fix다. 프로덕션 코드는 무변경, 테스트 전용 변경이며 RESOLUTION.md 에 근거가 명시돼 있다. review 프로세스가 요구한 정당한 후속 수정 — 범위 이탈 아님.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/refactor/03-maintainability.md` M-7 섹션 갱신(uncommitted)
  - 위치: `plan/in-progress/refactor/03-maintainability.md:221-229`
  - 상세: "첫 클러스터 (본 PR)" → "첫 클러스터 (PR #782, 머지)"로 라벨 정정 + "RESUME-STATE 클러스터 (본 PR)" 신규 단락 추가(대상 파일·전환 지점·테스트·ai-review 세션 경로·후속 클러스터 목록 최신화). 코드 변경이 아니라 plan 문서이지만, 직전 라운드 scope/requirement reviewer 가 공통으로 지적한 "plan 진행 서술 갱신 필요"에 대한 직접 응답이며, `.claude/docs/plan-lifecycle.md` 관례상 in-progress plan 은 실제 완료 클러스터를 반영해야 한다. 코드 diff 범위와 무관한 사이드 변경이 아니라, 같은 작업 단위(M-7 RESUME-STATE 클러스터)의 진행상태 동기화로 판단.
  - 제안: 조치 불필요 — 오히려 권장된 후속 조치가 이행된 것으로 긍정적.

- **[INFO]** `handler-output.adapter.ts` 인라인 가드 → `isRecord` 헬퍼 치환 (재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` `wrapBareAsNodeHandlerOutput`
  - 상세: 직전 라운드 scope.md 에서 이미 "새로 만든 헬퍼가 아니라 M-7 첫 클러스터(#782)에서 도입된 기존 `isRecord` 재사용이며 이번 클러스터 핵심 목표(명명 타입 전환)와 직결"로 판정됨. 이번 라운드 diff 에도 동일 변경이 유지되며 추가 변형 없음 — 재확인 결과 동일 결론.
  - 제안: 조치 불필요.

## 파일별 점검 결과

1. `ai-turn-orchestrator.service.ts` — `ResumeState` 타입 import 1개 + 기존 `as Record<string, unknown>` 단언 2곳을 `as ResumeState`/`as ResumeState | undefined` 로 교체. 로직·분기·주석 실질 변경 없음.
2. `execution-engine.service.spec.ts` — drift-guard assertion 추가(2곳) + `62efb1bce` 에서 `.strict()` 화. 새 import 는 신설 스키마 모듈에서만. 기존 테스트 구조 불변.
3. `execution-engine.service.ts` — `ResumeCheckpoint` 타입 import 1개 + 단언 1곳 교체. 그 외 변경 없음.
4. `handler-output.adapter.ts` — `isRecord` import 1개 + 가드 로직을 헬퍼 호출로 대체. behavior-preserving 명시, 신규 헬퍼 아님.
5. `retry-turn.service.ts` — `RetryState` 타입 import 1개 + 단언 2곳 교체. 로직 변경 없음.
6. `utils/resume-state.schema.ts` (신규) — `ResumeState`/`ResumeCheckpoint`/`RetryState` 3종 zod 스키마 + `CREDENTIAL_CONTEXT_FIELDS` 상수. 런타임 parse 미사용을 명시적으로 문서화(§7.5 graceful-reset semantics 보존) — 타입/테스트 SoT 목적에 국한, 기능 확장 아님.
7. `utils/resume-state.schema.spec.ts` (신규) — 신설 스키마의 unit 테스트. allow-list/라이프사이클 불변식만 검증.
8. `plan/in-progress/refactor/03-maintainability.md` (uncommitted) — M-7 진행 서술 갱신. 코드 범위 밖 문서지만 동일 작업 단위의 상태 동기화로 직전 리뷰 권고사항 반영.
9. `review/code/2026/07/02/11_59_12/*` (파일 8~17) — 이번 diff 대상이 아니라 이전 리뷰 라운드의 산출물(SUMMARY/RESOLUTION/각 reviewer 결과/state json). 신규 코드 변경으로 취급하지 않음.

## 요약

이번 diff 는 M-7 RESUME-STATE 클러스터의 프로덕션/테스트 코드 자체는 직전 ai-review 라운드(`11_59_12`)에서 이미 검토돼 Critical 0 · Warning 1(테스트 drift 가드 non-strict 문제)로 판정됐고, 그 Warning 은 커밋 `62efb1bce` 로 test-only fix 되어 해소됐다. 이번 페이로드에서 새로 나타난 실질 변경은 `plan/in-progress/refactor/03-maintainability.md` M-7 섹션 갱신뿐이며, 이는 직전 라운드 scope/requirement reviewer 가 공통으로 요청한 "plan 진행 서술을 실제 diff 범위에 맞춰 갱신"을 정확히 이행한 것이다 — 무관한 확장이 아니라 같은 작업 단위의 상태 동기화. 코드 쪽에서 의도 이상의 변경, 무관한 리팩토링, 기능 확장, 포맷팅/주석/임포트 잡음, 설정 변경 등 범위 이탈 신호는 발견되지 않았다.

## 위험도

NONE
