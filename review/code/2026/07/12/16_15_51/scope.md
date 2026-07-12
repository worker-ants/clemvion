# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[WARNING]** `.claude/config/doc-sync-matrix.json` 전체가 불필요하게 재포맷됨 — 의도된 변경(신규 행 1개 추가)과 무관한 대규모 포맷팅 diff 가 섞임
  - 위치: `.claude/config/doc-sync-matrix.json` 전 구간 (diff 상 거의 모든 기존 entry — `new-node`/`node-schema-change`/`new-ui-string`/`integration-provider-change`/`new-userguide-section-dir`/`backend-api-change`/`new-bullmq-queue`/`new-warning-code`/`new-error-code`/`new-cross-cutting-enum`/`new-backend-ui-zod-value`/`new-handler-output-field`/`auth-session-flow-change`/`auth-config-type-enum-change`/`expression-language-change`/`run-debug-flow-change`/`env-runtime-change`/`spec-major-change`/`userguide-gui-flow-section`/`spec-defect-found`)
  - 상세: 이번 태스크가 실제로 필요로 하는 변경은 파일 말미에 `new-widget-chrome-string` entry 1개를 추가하는 것뿐이다. 그런데 diff 는 **기존 entry 전부**의 `trigger.globs`/`trigger`/`guard_tests`/`targets` 배열·객체를 한 줄(compact) 표기에서 여러 줄(pretty) 표기로 재포맷했다. 값 자체(키·문자열)는 전혀 바뀌지 않았고 순수 whitespace/줄바꿈 변경이다 — 아마 JSON 을 수동 Edit 이 아니라 `json.dump(..., indent=2)` 류의 스크립트로 전체 파일을 다시 써서 발생한 것으로 보인다. 결과적으로 실질 변경(1 entry 추가, PROJECT.md 표 1행과 대응)이 약 90 라인의 무관한 포맷팅 노이즈에 묻혀 리뷰 난이도를 높이고, 향후 이 파일을 동시에 건드리는 다른 PR 과의 merge conflict 위험을 키운다. 이는 점검 관점 5(포맷팅 변경)·8(의도하지 않은 설정 변경)에 해당.
  - 제안: `new-widget-chrome-string` entry 추가만 diff 에 남기고, 기존 entry 들의 포맷은 원래 compact 스타일로 되돌릴 것. 파일 전체를 pretty-print 하는 리포맷이 필요하다면 별도의 formatting-only 커밋/PR 로 분리.

## 요약

이번 변경셋(36개 파일)의 핵심 — 위젯 로컬 i18n 모듈 신설(`catalog.ts`/`resolve-locale.ts`/`context.tsx`/`index.ts` + 콜로케이트 테스트), 5개 위젯 컴포넌트(`composer`/`dynamic-form`/`launcher`/`panel`/`presentations`)·`use-widget.ts`·`widget-app.tsx` 의 하드코딩 한국어 → `t()` 치환, `vitest.setup.ts` 의 테스트 로케일 고정, 그리고 관련 spec 6개·`PROJECT.md`·plan 파일 갱신 — 은 모두 "channel-web-chat 위젯 chrome 문자열 EN 다국어화" 라는 명시된 태스크 범위 안에 정확히 들어맞는다. 코드 diff 에 불필요한 리팩토링·과잉 기능 추가·무관한 임포트/주석 변경은 관찰되지 않았고, 각 컴포넌트의 `useTranslation` 도입·문자열 치환은 최소 diff 로 이뤄졌다. `review/consistency/2026/07/12/14_34_23/**` 산출물과 `plan/in-progress/spec-draft-webchat-en-i18n.md` 는 CLAUDE.md 가 강제하는 SDD 프로세스(project-planner 의 `--spec` 게이트 의무 + 산출물 커밋 규칙)의 정상 결과물이라 스코프 이탈이 아니다. 유일한 실질적 스코프 문제는 `.claude/config/doc-sync-matrix.json` 에서 의도한 1-entry 추가에 파일 전체 재포맷팅이 섞여 들어간 것이며, 기능적 영향은 없으나(순수 whitespace) 리뷰 가독성·향후 merge 안전성 관점에서 되돌릴 것을 권장한다.

## 위험도

MEDIUM
