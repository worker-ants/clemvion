# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 가드 신설 3파일(약 360줄)이 "9지점 리다이렉트"라는 최소 요청보다 넓은 산출물
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`, `engine-error-code-anchor-fixture.ts`, `engine-error-code-anchor.spec.ts` (전부 신규 파일)
  - 상세: 원 요청은 맨 문자열 에러 코드를 상수 참조로 리다이렉트하는 것인데, 재발 방지용 AST 기반 회귀 가드(파서 로직 + 픽스처 + spec)가 추가로 신설됐다. 다만 (1) `CHANGELOG.md`(파일 1, `재발 방지는 repo-guards/__tests__/engine-error-code-anchor-guard.ts(AST)`)와 `plan/complete/exec-intake-followups.md`(파일 9)가 이 산출물을 명시적으로 계획·서술하고 있고, (2) 저장소에 이미 존재하는 형제 패턴(`redis-fail-open-catalog-guard.ts` + spec, 파일 7 헤더 주석에서 직접 언급)을 그대로 따르고 있어 임의의 기능 확장이 아니라 이 저장소의 확립된 컨벤션이다. 직전 리뷰 라운드(`review/code/2026/08/31/20_27_29/scope.md` 계열, 이번 diff 파일 18)에서도 동일 항목을 INFO 로 지적하고 "스코프 이탈로 보기 어려움"으로 조치 불요 처리한 이력이 있으며, 이번 라운드에서도 그 판단에 동의한다.
  - 제안: 조치 불요. 향후 유사 가드가 더 늘어나면 별도 plan 항목으로 분리하는 것을 고려.

- **[INFO]** `ai-turn-orchestrator.service.ts` 의 `LLM_*` 4지점은 애초에 값이 `ErrorCode` enum 에 이미 있었고 상수만 거치지 않던 경우 — "엔진 레이어가 반만 상수" 라는 원 문제와는 결이 다른 사이트가 같은 편집에 번들됐다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (게이트 1298, 1301, 1304, 1311 — `ErrorCode.LLM_RATE_LIMIT` / `ErrorCode.LLM_CALL_FAILED` ×3)
  - 상세: `EngineErrorCode` 신설의 핵심 동기는 "상수도 타입도 없는 맨 문자열"(넷) 이었는데, `LLM_*` 4지점은 이미 `ErrorCode` enum 에 값이 존재했고 단지 참조 방식(리터럴 vs 상수)만 문제였다. `CHANGELOG.md`(파일 1)가 "여기에 값은 이미 enum 에 있으면서 상수를 안 거치던 … LLM_* 4지점을 더해 9지점을 상수 참조로 바꿨다"고 명시적으로 밝히고 있고, 이 파일은 신설 가드가 스캔하는 `ENGINE_DIR`(`codebase/backend/src/modules/execution-engine`) 안에 있어 가드 관점에서도 동일 스코프다. 근거가 문서화돼 있고 가드 스코프와 일치하므로 은닉된 확장은 아니다.
  - 제안: 조치 불요. 향후 유사 번들링 시에도 이번처럼 CHANGELOG/plan 에 사유를 명시하는 관례를 유지할 것.

- **[INFO]** 이전 리뷰 라운드(`20_27_29`)의 산출물 전체(RESOLUTION.md, SUMMARY.md, 개별 reviewer md, meta.json, `_retry_state.json` 등 11파일)가 이번 diff 에 포함됨
  - 위치: `review/code/2026/08/31/20_27_29/*` (파일 11~21)
  - 상세: `review/code/**` 는 이 저장소의 정식 산출물 저장 위치이며, fix→재검증 루프에서 이전 라운드 리포트와 RESOLUTION 을 함께 커밋하는 것은 이 프로젝트의 확립된 관례다(직전 라운드 자체가 이번 세션의 입력이자 그 대상 파일들도 diff 로 함께 잡힌 것으로 보인다). 코드/설정 변경이 아니고 임의 확장도 아니므로 스코프 이슈로 보지 않는다.
  - 제안: 조치 불요.

검증용 뮤테이션은 수행하지 않았다(해당 리뷰 관점상 코드 동작 재현이 필요 없었음). 저장소 파일은 건드리지 않았다 — `git status --short` 확인 불필요.

## 요약

이번 diff 는 원 티켓("엔진 에러 코드 레이어 분리")의 처방을 재검토해 "파일 분리 대신 같은 파일 안에 `EngineErrorCode` const 신설 + 9지점 리다이렉트"로 좁혔고, 그 판단 근거·옮기지 않은 항목의 사유·재발 방지 가드까지 `CHANGELOG.md` 와 `plan/complete/exec-intake-followups.md` 에 상세히 기록했다. 신설된 AST 가드 3파일은 최소 요청보다 넓어 보이지만 기존 형제 패턴을 따른 확립된 컨벤션이고 plan/CHANGELOG 에 명시적으로 계획된 산출물이라 스코프 이탈로 보기 어렵다. `ai-turn-orchestrator.service.ts` 의 `LLM_*` 4지점 번들링도 가드 스캔 범위(`ENGINE_DIR`) 안이고 문서화된 근거가 있다. 무관한 파일 수정·불필요한 포맷팅/주석/임포트 변경·설정 파일 변경은 발견되지 않았고, 이전 리뷰 라운드 산출물 커밋도 이 저장소의 정상 워크플로다. 전반적으로 변경 범위는 잘 통제되어 있다.

## 위험도

NONE
