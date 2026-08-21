STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger 행)을 SoT 로 Read 했다. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문은 이번 라운드에서도 동일 행 집합(`test_doc_sync_matrix.py` 가 1:1 로 묶어둠)이므로 JSON 인덱스만으로 판단 근거를 충분히 확보했다.

## 변경 파일 식별
`git diff --name-only main...HEAD` 로 95개 파일을 확인했고, prompt 상의 파일 목록(95건, 이번 세션 산출물 `review/code/.../13_14_29/**` 는 diff 밖 신규 untracked)과 정확히 일치한다. 실질 코드 변경은 다음 세 그룹으로 좁혀진다:

1. **신규 공유 패키지 `@workflow/masked-markers`** (`codebase/packages/masked-markers/{README.md,eslint.config.mjs,package.json,tsconfig.json,src/index.ts,src/__tests__/index.spec.ts}`) — backend/frontend 가 손으로 복제하던 마스킹 마커 상수(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH`)를 SoT 로 추출.
2. **소비처 재export 전환** — `codebase/backend/src/shared/utils/sanitize-error-message.ts`, `codebase/frontend/src/lib/utils/masked-markers.ts` (값·시그니처 불변, import 경로 유지).
3. **CI/빌드 배선 8곳** (`test-stages.sh`, `packages-checks.yml`, 양쪽 `Dockerfile`(+playwright-e2e), 양쪽 `package.json`, `pnpm-lock.yaml`) + **신규 repo-guard**(`masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`, backend+frontend 사본) + **plan 트래커 정정**(`masked-marker-shared-package.md`, `spec-sync-external-interaction-api-gaps.md`) + **spec frontmatter/R17 서술 정정**(`spec/5-system/14-external-interaction-api.md` — SoT 를 패키지로 갱신, `code:` 에 패키지 경로 추가).

나머지는 전부 리뷰 산출물(`review/code/2026/08/21/{11_27_29,11_53_49,12_25_15,12_50_37}/**`, `review/consistency/2026/08/21/{10_45_52,10_58_25}/**`) — 이전 4라운드의 code-review/consistency-check 결과물로, target 코드 자체가 아니다.

## trigger 매칭 검토 (20개 행 전수)

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매칭 파일 없음. `sanitize-error-message.ts` 는 `src/shared/utils/`, `error-codes.ts` 자체 미변경. 불일치.
- **new-ui-string** (`*.tsx`) — 변경 파일 중 `.tsx` 전무(전부 `.ts`/`.md`/`.json`/`.yml`/Dockerfile). `masked-markers.ts` 등 `.ts` 파일 안의 한국어는 JSDoc 주석이지 런타임 UI 문자열이 아니다. 불일치.
- **new-widget-chrome-string** (`codebase/channel-web-chat/src/**/*.tsx`) — 미변경. 불일치.
- **integration-provider-change** — 무관. 불일치.
- **new-userguide-section-dir** (`content/docs/*/`) — 미변경. 불일치.
- **backend-api-change** (controller/DTO) — 미변경. 불일치.
- **new-bullmq-queue** (`system-status.constants.ts`) — 미변경. 불일치.
- **new-warning-code / new-error-code** (`error-codes.ts`, warningRules) — `error-codes.ts` 자체가 diff 밖. 마커 리터럴 값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)도 이관 전후 **완전 동일**(패키지 `src/index.ts` 대조 확인) — 신규 코드 발행이 아니라 기존 값의 SoT 이동. 불일치.
- **new-cross-cutting-enum** — 무관. 불일치.
- **new-backend-ui-zod-value** — 무관. 불일치.
- **new-handler-output-field** — 무관. 불일치.
- **auth-session-flow-change** (`modules/auth/**`) — `sanitize-error-message.ts` 는 egress 에러 메시지 마스킹 공용 유틸이지 auth 모듈이 아니다. 불일치.
- **auth-config-type-enum-change** — 무관. 불일치.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 신규 패키지는 `codebase/packages/masked-markers/**` 로 별개 디렉터리. `expression-engine` 자체 미변경. 불일치.
- **run-debug-flow-change** — 실행 엔진·디버그 로깅 로직 변경 없음(상수 재배치일 뿐). 불일치.
- **env-runtime-change** (`README.md`) — 루트 `README.md` 미변경. 불일치.
- **spec-major-change** (`spec/5-*/**`) — `spec/5-system/14-external-interaction-api.md` 가 glob 에 매치되지만, 이 행의 target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합(spec-consistency 영역, `consistency-checker` 스코프)이지 본 리뷰어 스코프(docs MDX·i18n dict·backend-labels)가 아니다. 실측: 이번 라운드4 처분에서 `code:` 리스트에 `codebase/packages/masked-markers/src/index.ts` 가 이미 추가됐고 R17 본문도 "SoT 는 `@workflow/masked-markers`" 로 갱신 완료 — 이 행 기준으로도 갭이 없다.
- **userguide-gui-flow-section** (`content/docs/{02-nodes,06-integrations-and-config}/**.mdx`) — 미변경. 불일치.
- **spec-defect-found** — 해당 사항 없음(오히려 이번 diff 가 그 절차를 이미 실행 — R17 정정을 `developer` 권한 밖으로 판단해 plan 문서에 명시하고 이번 라운드에 실제 spec 갱신까지 완료).

## 결론
이 변경은 **사용자 가시 동작·문자열을 하나도 바꾸지 않는 내부 리팩터**다 — backend/frontend 가 손으로 복제하던 마스킹 마커 상수·판정 함수·깊이 상한을 신규 workspace 패키지로 옮기고 재export shim 으로 소비처를 유지했을 뿐이다. 신규 UI 노드·필드·문자열·통합·docs 섹션·auth 흐름·표현식 언어·실행/디버그 흐름·신규 warning/error 코드 중 어느 것도 발생하지 않았으므로 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 대상이 아니다.

이전 4라운드(`11_27_29`, `11_53_49`, `12_25_15` — 세 라운드 모두 독립적으로 동일 매트릭스 전수 대조, `12_50_37` 은 router 가 본 reviewer 를 재호출하지 않음)의 결론과 이번 라운드(누적 diff 기준 재검증)가 수렴한다. 라운드1~4 사이에 있었던 fix(가드 배치 재배선, spec R17 SoT 정정 등)도 모두 CI 배선·repo-guard·spec frontmatter 영역에 국한돼 본 리뷰어 스코프의 판정을 바꾸지 않는다.

## 요약
매트릭스 20개 trigger 행 전부를 95개 변경 파일(git diff 실측 기준)에 전수 대조했고, 매칭되는 trigger 가 없다(spec-major-change 만 glob 매치하나 target 이 본 리뷰어 스코프 밖). 누락 0건 — 해당 없음.

### 위험도
NONE
