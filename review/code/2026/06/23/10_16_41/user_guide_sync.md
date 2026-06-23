# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음. 변경 파일이 매트릭스 어떤 trigger 에도 동반 갱신을 요구하지 않는다.

**판단 근거 (trigger 별)**

- **new-ui-string** (id: `new-ui-string`, match: `semantic`, globs: `codebase/frontend/src/**/*.tsx`): 변경된 5개 TSX 파일(`cards/chat-channel-card.tsx`, `cards/external-interaction-card.tsx`, `cards/overview-card.tsx`, `cards/schedule-config-card.tsx`, `cards/webhook-config-card.tsx`)은 기존 `trigger-detail-drawer.tsx` god-component 에서 코드를 verbatim 이동(파일 재구성)한 것이다. `useT()` 로 참조하는 모든 i18n 키(`triggers.chatChannel.*`, `triggers.externalInteraction.*`, `triggers.detail.*`, `triggers.type*`, `triggers.status*` 등)는 `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`와 `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` 양쪽에 이미 완전히 등록되어 있다. 신규 키가 한 건도 추가되지 않았으므로 i18n parity 위반 없음.

- **new-node / node-schema-change** (globs: `codebase/backend/src/nodes/**`): 변경 파일에 backend 노드 경로 파일이 없다. 해당 없음.

- **auth-session-flow-change** (globs: `codebase/backend/src/modules/auth/**`): 변경 파일에 auth 미들웨어·모듈 파일이 없다. 해당 없음.

- **expression-language-change** (globs: `codebase/packages/expression-engine/**`): 변경 파일에 expression-engine 패키지 파일이 없다. 해당 없음.

- **new-userguide-section-dir** (globs: `codebase/frontend/src/content/docs/*/`): 신규 docs 섹션 디렉토리 생성 없음. 해당 없음.

- **new-warning-code / new-error-code**: backend warningRules·`error-codes.ts` 변경 없음. 해당 없음.

- **backend-api-change / new-backend-ui-zod-value / new-handler-output-field / new-cross-cutting-enum**: 해당 파일 경로 변경 없음.

나머지 semantic 행(integration-provider-change, run-debug-flow-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found)도 이번 커밋이 trigger 에 명시된 의미 범주(통합 제공자 추가·디버그 흐름·환경변수·spec 대규모 변경·GUI 절 신규 작성·spec 오류 발견)와 무관한 frontend 내부 컴포넌트 파일 재구성이므로 모두 해당 없음.

## 요약

매트릭스 총 18개 trigger 행 중 직접 매칭된 trigger 1건(`new-ui-string`). 해당 trigger 의 동반 갱신 조건(신규 i18n 키 추가)을 충족하지 않으므로 누락 갯수 0. 이번 변경은 `trigger-detail-drawer.tsx` 1,537줄 god-component 를 5개 카드 파일과 2개 hook 파일로 분리한 verbatim 코드 재구성(behavior-preserving refactor)이며, 유저 가이드·i18n dict·backend-labels 동반 갱신이 필요한 변경은 없다.

## 위험도

NONE
