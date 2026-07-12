# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** package.json 배열 포맷팅 변경이 devDependency 추가와 섞여 있음
  - 위치: `codebase/packages/chat-channel-validation/package.json`, `codebase/packages/expression-engine/package.json`, `codebase/packages/graph-warning-rules/package.json`, `codebase/packages/node-summary/package.json`, `codebase/packages/sdk/package.json` — 각 `"jest.moduleFileExtensions"` 배열, sdk 의 `"files"`/`"keywords"` 배열
  - 상세: 5개 package.json 모두에서 `"moduleFileExtensions": ["js", "json", "ts"]` 한 줄짜리 배열이 3줄 멀티라인으로 재포맷됐고, `sdk/package.json` 은 추가로 `files`/`keywords` 배열까지 동일하게 재포맷됐다. eslint devDependency 4종(`@eslint/js`, `eslint`, `globals`, `typescript-eslint`) 추가라는 실질 변경과는 무관한 순수 공백/줄바꿈 변경이며, 아마 파일을 스크립트로 전체 재작성(`JSON.stringify(pkg, null, 2)` 류)하면서 부수로 발생한 것으로 보인다. diff 노이즈를 늘리지만 기능적 영향은 없다.
  - 제안: 실질 변경(신규 devDependency)만 최소 diff 로 남기고 무관한 배열 재포맷은 되돌리거나, 별도 "chore: package.json 포맷 통일" 커밋으로 분리했으면 더 깔끔했을 것. 이번 PR 을 되돌릴 필요는 없음(low risk).

- **[INFO]** expression-engine dead-import/미사용 타입 제거가 "harness 배선" 원 스코프에 코드 정리를 더함
  - 위치: `codebase/packages/expression-engine/src/functions/date.ts` (미사용 `ManipulateUnit` 타입 제거), `codebase/packages/expression-engine/src/functions/string.ts` (미사용 `FunctionError` import 제거)
  - 상세: 이번 변경의 핵심 의도는 "내부 packages harness/CI 배선"(eslint.config.mjs 신설 + test-stages.sh/CI 배선)인데, 그 신설 eslint.config.mjs 가 `@typescript-eslint/no-unused-vars: error` 를 명시 활성화하면서 기존에 존재하던 미사용 코드 2건이 lint 실패를 유발해 함께 제거됐다. 순수 "배선" 범위를 살짝 벗어난 실제 프로덕션 코드 수정이지만, 신규 lint 활성화의 직접적 인과 결과이고 plan 문서(`plan/in-progress/eia-context-schema-followups.md`)에도 "dead-import 2건 정리"로 명시돼 있어 은폐된 확장은 아니다.
  - 제안: 별도 조치 불필요. 다만 향후 유사 "lint 신설" PR 에서는 커밋 메시지/plan 기록에 "lint 활성화로 드러난 기존 dead code 제거" 임을 계속 명시할 것.

- **[INFO]** 동일 PR 에서 plan 잔여 항목 3건을 동시에 종결
  - 위치: `plan/in-progress/eia-context-schema-followups.md` diff — "다른 내부 packages harness 배선", "`packages/sdk` eslint 커버리지", "`spec-impl-evidence.md §4.2` 편집 절차 사후 확인" 세 체크박스가 한 커밋에서 함께 `[ ]` → `[x]` 전환
  - 상세: 세 항목은 plan 문서에 개별 백로그로 기재돼 있었으나 실제로는 "내부 패키지 lint 커버리지 확장"이라는 단일 테마로 묶인다(§4.2 항목은 코드 변경 없이 절차 결정 텍스트만 추가). worktree 이름(`eia-context-dev-residuals`)과 plan 상단 커밋 이력을 볼 때 "잔여 항목 일괄 정리"가 이번 작업의 명시적 목적으로 보이므로 의도 이상의 확장으로 보기는 어렵다.
  - 제안: 없음(정보 제공 목적).

## 요약

변경 파일 17개는 "내부 backend-공유 packages(expression-engine·graph-warning-rules·node-summary·chat-channel-validation·sdk) 의 lint 커버리지를 harness(test-stages.sh)·CI(신규/기존 workflow)에 배선"이라는 단일 목적에 긴밀히 수렴한다. 신규 `eslint.config.mjs` 5개는 기존 backend/web-chat-sdk 관례를 그대로 복제한 보일러플레이트이고, `package.json`/`pnpm-lock.yaml` 변경은 그 lint 도입에 필요한 devDependency 추가의 직접 산물이며, `test-stages.sh`·`packages-checks.yml`(신규)·`web-chat-checks.yml` 변경은 각 패키지를 lint/test/build 파이프라인에 실제로 연결하는 배선 자체다. `plan/in-progress/*.md` 갱신은 표준적인 작업 추적이다. 유일하게 스코프 경계에 걸치는 것은 (1) 5개 package.json 에서 신규 devDependency 추가와 무관한 배열 재포맷(순수 포맷팅 노이즈)과 (2) 신규 lint 규칙 활성화로 촉발된 expression-engine 2개 파일의 dead-import/미사용 타입 제거인데, 둘 다 실질 위험이 없고 후자는 plan 문서에 사유가 명시돼 있다. 의도하지 않은 기능 확장, 무관한 파일 수정, 불필요한 리팩토링, 주석/임포트 오염, 설정 파일의 임의 변경은 발견되지 않았다.

## 위험도

LOW
