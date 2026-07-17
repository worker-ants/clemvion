# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

1. SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]`, 총 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(112~197행) 본문을 보조로 Read.
2. 변경 파일 식별: 이번 리뷰 대상은 커밋 `3b54c8727 refactor(web-chat): staleness 가드 4종 → worldGen 단일화 + 유령 표면 버그 fix` (prompt 상 파일 3개, `git diff 7a9b4ce88..3b54c8727 --name-only` 로 교차 확인 — 정확히 일치):
   - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (테스트 신규 1건 추가)
   - `codebase/channel-web-chat/src/widget/use-widget.ts` (내부 리팩터: `startGenRef`/`sessionRef` 동일성/`cancelled` 지역 플래그 3종 → `worldGenRef` 단일 세대 카운터로 통합)
   - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (plan 주석 갱신 — 구조 개선 근거 기록)
3. 21개 trigger 행 전수 매칭 시도.

## Trigger 매칭 결과 (21행 전수 점검)

| trigger id | glob/semantic | 매칭 여부 | 근거 |
|---|---|---|---|
| new-node | `codebase/backend/src/nodes/**` | 불일치 | backend nodes 디렉터리 무변경 |
| node-schema-change | 동일 glob | 불일치 | 동일 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 불일치 | `codebase/frontend/**` 무변경 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 불일치 | 변경 파일은 `use-widget.ts`(`.ts`, 비-JSX 훅) 와 `*.test.ts` — `.tsx` 글롭에 안 걸림. diff 전수 확인 결과 `WIDGET_STRINGS` 참조·신규 리터럴 추가 없음(주석/JSDoc 갱신과 `worldGenRef` 변수명 교체뿐) |
| integration-provider-change | semantic | 불일치 | provider 변경 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 불일치 | docs 디렉터리 무변경 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 | 무변경 |
| new-bullmq-queue | `system-status.constants.ts` | 불일치 | 무변경 |
| new-warning-code | semantic (backend warningRules) | 불일치 | backend 무변경 |
| new-error-code | `error-codes.ts` | 불일치 | 무변경 |
| new-cross-cutting-enum | semantic | 불일치 | `SeedOutcome`("ended"\|"stale"\|"continue") 3-state 는 이번 diff 밖 기존 타입 그대로 유지(plan 주석에 "SeedOutcome 3-state 는 유지" 로 명시) — 신규 enum 값 추가 없음 |
| new-backend-ui-zod-value | semantic | 불일치 | backend zod 무변경 |
| new-handler-output-field | semantic | 불일치 | handler output 무변경 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 불일치 | 이번 diff 는 위젯 클라이언트 측 async staleness 가드(브라우저 훅의 `sessionRef`/세대 카운터)이며 백엔드 인증·세션 미들웨어(`modules/auth/**`)와 무관 |
| auth-config-type-enum-change | semantic | 불일치 | 무관 |
| expression-language-change | `codebase/packages/expression-engine/**` | 불일치 | 무변경 |
| run-debug-flow-change | semantic (타겟: `05-run-and-debug/`) | 불일치 | 해당 행의 타겟은 메인 에디터의 실행·디버깅(노드 실행 이력/로그) 문서 절이며, 이번 변경은 임베드형 web-chat 위젯(`spec/7-channel-web-chat`)의 내부 상태기계(booting/streaming/ended phase 전이 가드)로 별개 제품 표면. `05-run-and-debug/` 서술과 무관 |
| env-runtime-change | semantic | 불일치 | 무관 |
| spec-major-change | `spec/{2,3,4,5}-*/**`, `spec/conventions/**` | 불일치 | `spec/**` 무변경(이번 diff 는 `plan/in-progress/*.md` 만 — spec 은 별도 이전 커밋에서 이미 갱신된 상태, 이번 커밋 범위 밖) |
| userguide-gui-flow-section | `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` | 불일치 | docs mdx 무변경 |
| spec-defect-found | semantic | 불일치 | plan 주석은 "spec 자체 결함" 이 아니라 이미 반영된 spec 서술(§3.1) 대비 **구현 결함**(유령 표면 부활 버그) 재현+fix 기록 — spec 갱신 제안 성격 아님 |

## 발견사항

없음 — 21개 trigger 행 중 매칭 0건.

이번 변경은 `codebase/channel-web-chat/src/widget/use-widget.ts` 의 순수 내부 리팩터(비동기 staleness 가드 4종 — `startGenRef` 세대 카운터·`sessionRef` 동일성 비교·`cancelled` 지역 플래그·언마운트 무가드 — 를 `worldGenRef` 단일 세대 카운터로 통합)와 그 회귀 테스트, plan 주석으로 구성된다. React 컴포넌트(JSX/TSX) 가 아닌 훅 로직 파일이라 신규 렌더 문자열이 없고, 노드/필드/라벨/에러코드/경고코드/provider/문서 섹션/인증-세션 미들웨어/표현식 엔진/BullMQ 큐/cross-cutting enum/handler output field 어느 것도 건드리지 않는다. 사용자에게 노출되는 동작은 "종료된 대화가 stale 응답으로 부활하지 않는다" 는 버그 fix 이며, 이는 이미 `spec/7-channel-web-chat/1-widget-app.md §3.1`(plan 주석에 인용된 대로 이전 커밋에서 이미 명문화)이 규정한 의도 동작을 구현이 정확히 따르도록 교정한 것 — 신규 사용자 가시 계약이 아니므로 문서 갱신 트리거가 아니다.

## 요약

매트릭스 21개 trigger 전수 점검 결과 매칭 0건, 누락 0건. 변경 파일 3개(`use-widget.ts`, `use-widget-eager-start.test.ts`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`)는 모두 `codebase/frontend`·`codebase/backend` 문서/i18n/라벨 타겟과 무관한 channel-web-chat 위젯 내부 비동기 가드 리팩터 + 회귀 테스트 + plan 주석이며, `.tsx` 가 아닌 `.ts` 훅 파일이라 위젯 chrome 문자열(`WIDGET_STRINGS`) 파리티 요건도 트리거되지 않는다. 유저 가이드 동반 갱신 관점에서 해당 없음.

## 위험도

NONE
