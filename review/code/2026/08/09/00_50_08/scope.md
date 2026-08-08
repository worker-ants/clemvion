# 변경 범위(Scope) 리뷰 — backend-lint-gate

## 사전 확인 사항

프롬프트에 실린 34개 파일은 대부분 "전체 파일 컨텍스트"만 제공되고 실제 diff 가 생략되어(프롬프트 크기 제한), 그대로는 스코프 판단이 불가능했다. `git diff origin/main...HEAD` 로 34개 파일 전부의 실제 diff 를 직접 대조했다(파일 34는 `plan/in-progress/backend-lint-gate-broken-on-main.md`).

이 PR 은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 문서화된 것처럼 **main 에 이미 깨져 있던 backend lint 게이트를 별도 PR 로 복구**하는 작업이다(2026-08-08 사용자 결정: 보안 fix PR 의 diff 를 78파일 포맷 변경으로 오염시키지 않기 위해 분리). 따라서 넓은 파일 footprint 자체는 의도된 스코프이며 위반이 아니다 — 검증 대상은 "각 파일의 실제 변경 내용이 선언된 의도(prettier 포맷 + `no-unnecessary-type-assertion` 경고 처분)를 벗어나지 않는가" 다.

## 발견사항

- **[INFO]** `console.log` 앞 `// eslint-disable-next-line no-console` 주석 2곳이 완전히 삭제되지 않고 빈 줄로 남음
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts:188`, `:223`
  - 상세: 해당 파일은 eslint.config.mjs 의 `files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts']` 오버라이드로 `no-console: 'off'` 가 적용되어 이 disable 주석이 실제로 unused-disable-directive 였다(plan 문서의 "unused disable 2건"과 일치, 스코프 내 처분). 다만 주석 라인을 지우면서 빈 줄만 남긴 것은 사소한 잔여물이다.
  - 제안: 실질적 문제는 아니므로 그대로 두어도 무방하나, 원한다면 빈 줄도 함께 정리.

- **[INFO]** `plan/in-progress/harness-review-gate-followups.md` 에 이 작업과 직접 관련 없는 별도 harness 버그(리뷰 게이트 `--prepare` 배치 분할 시 세션 디렉터리 충돌) 조사 기록이 추가됨
  - 위치: `plan/in-progress/harness-review-gate-followups.md` (커밋 `51a7c9a8b`)
  - 상세: 이 PR(`backend-lint-gate`)의 `/ai-review --prepare` 실행 중 우연히 발견한 별개 결함을 그 자리에서 문서화한 것. `codebase/**` 변경이 아니라 `plan/**` 문서이며, 코드 diff 를 전혀 건드리지 않고 완전히 분리된 섹션에 기록되어 있어 diff 오염은 없다.
  - 제안: 없음 — 코드 스코프를 벗어나지 않으므로 조치 불필요.

## 스코프 준수 확인 (문제 없음 — 근거)

34개 파일 전체를 `git diff` 로 대조한 결과, 코드 변경은 예외 없이 다음 두 패턴 중 하나였다:

1. **`@typescript-eslint/no-unnecessary-type-assertion` 처분**: `as T` 캐스트 제거(예: `resolve-dynamic-ports.ts`, `ai-memory-manager.ts`, `cafe24-api.client.ts`, `node-component.registry.ts`, `render-tool-provider.ts` 등), 캐스트 제거로 인해 고아가 된 import 제거(`cafe24.handler.ts` 의 `Cafe24Method`, `makeshop.handler.ts` 의 `MakeshopMethod`) — plan 체크리스트의 "고아 import 6건"과 일치.
2. **prettier 포맷 변경**: union 타입 선언의 줄바꿈 `|` 를 한 줄로 병합(`type X = 'a' | 'b' | 'c';` 형태) — plan 이 밝힌 prettier 3.9 규칙 변경 서명과 정확히 일치.

로직/조건문/함수 시그니처/API 계약이 바뀐 곳은 없었고, 신규 기능·불필요한 리팩토링·무관한 파일 수정·의미 있는 주석 변경도 발견되지 않았다.

## 요약

34개 파일 전부를 실제 git diff 로 대조한 결과 선언된 스코프(lint 게이트 복구: prettier 포맷 + `no-unnecessary-type-assertion` 경고 처분)를 벗어나는 변경은 없었다. 넓은 파일 수는 계획서에 명시된 대로 의도된 것이며, 각 파일 diff 는 타입 단언 제거·고아 import 제거·union 타입 한 줄 병합으로 일관된다. 사소한 INFO 2건(빈 줄 잔여물, plan 문서의 부수 기록)은 스코프 위반이 아니다.

## 위험도

NONE
