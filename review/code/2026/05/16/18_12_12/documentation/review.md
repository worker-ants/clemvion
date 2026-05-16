# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `useCafe24MallIdPrecheck` 훅 — `enabled` 파라미터 의미 문서 보완 여지
  - 위치: `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts`, 함수 시그니처
  - 상세: JSDoc 본문이 훅 동작을 잘 설명하나, `enabled` 파라미터가 구체적으로 무엇을 의미하는지(Cafe24 OAuth2 variant 선택 여부)를 서술하지 않는다. `mallId` 파라미터도 타입·제약 조건(3–50자 소문자) 언급이 없어 소비자가 소스를 직접 봐야 한다.
  - 제안: 함수 시그니처에 `@param mallId` / `@param enabled` JSDoc 태그를 추가하거나, 훅 설명 블록에 "enabled: Cafe24 OAuth2 variant 가 선택된 경우에만 true 를 전달한다" 를 명시한다.

- **[INFO]** `INTEGRATION_LOCALIZED_ERROR_CODES` 의 `PRIVATE` 토큰 설명 — spec 링크 누락
  - 위치: `frontend/src/lib/api/integration-error-codes.ts`, 행 20–21 (`CAFE24_DUPLICATE_MALL` JSDoc)
  - 상세: `코드 이름의 PRIVATE 토큰은 historical artifact (spec Rationale 참조)` 라고만 쓰여 있고 실제 spec 경로가 없다. 동일 파일의 다른 위치에는 `spec/2-navigation/4-integration.md §9.4` 가 명시되어 있어 일관성이 떨어진다.
  - 제안: `(spec/2-navigation/4-integration.md §9.4 Rationale 참조)` 처럼 절대 경로를 기재한다.

- **[INFO]** `IntegrationsService.create()` 분리된 try/catch 블록 — 인라인 주석 품질은 우수하나 `audit 누락은 best-effort 정책` 문구가 두 곳(코드 주석·테스트 설명)에 중복 서술되어 있다
  - 위치: `backend/src/modules/integrations/integrations.service.ts`, 행 526–548 및 `integrations.service.spec.ts` 테스트 설명 블록
  - 상세: 서비스 코드의 블록 주석과 테스트 파일의 멀티라인 주석이 거의 동일 내용을 반복한다. 이 자체가 문제는 아니지만, 향후 정책이 변경될 때 두 곳을 동시에 갱신해야 한다는 점을 명시하면 유지보수성이 높아진다.
  - 제안: 테스트 설명 주석에 "정책 변경 시 `integrations.service.ts` 블록 주석도 동시 갱신" 한 줄을 추가한다. 또는 현재 수준을 유지하되 큰 위험은 없다.

- **[INFO]** `Cafe24ExtraFields` 컴포넌트 — `publicAppAvailable` prop JSDoc이 영문 단행 주석으로만 존재
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx`, `Cafe24ExtraFields` props 정의부
  - 상세: `/** False when server's CAFE24_CLIENT_* env vars are unset → only Private. */` 라는 짧은 주석은 있으나, 이 값이 어떤 환경변수에서 유래하는지(`CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`)를 spec 링크나 참조와 함께 설명하면 더 명확하다. backend 환경변수와 frontend prop 의 연결 고리가 주석만으로는 완전히 추적되지 않는다.
  - 제안: 주석에 `spec/2-navigation/4-integration.md §3.2` 또는 backend 환경변수 이름을 병기한다.

- **[INFO]** `DEBOUNCE_ADVANCE_MS` 상수 — `page.tsx` 의 debounce(350ms)와 hook 내 `PRECHECK_DEBOUNCE_MS`(350ms)의 관계가 테스트 파일 주석에만 설명되어 있음
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`, JSDoc + 상수 정의
  - 상세: `DEBOUNCE_ADVANCE_MS = 360` 이 hook 의 `PRECHECK_DEBOUNCE_MS = 350` 과 연동된다는 사실이 테스트 파일 JSDoc에 설명되어 있지만, hook 파일의 상수(`PRECHECK_DEBOUNCE_MS`)에는 "이 값을 바꾸면 테스트의 `DEBOUNCE_ADVANCE_MS` 도 함께 조정해야 한다"는 역방향 안내가 없다.
  - 제안: `use-cafe24-mall-id-precheck.ts` 의 `PRECHECK_DEBOUNCE_MS` 상수 위에 `// 변경 시 cafe24-precheck.test.tsx 의 DEBOUNCE_ADVANCE_MS 도 함께 조정` 한 줄을 추가한다.

- **[INFO]** `integration-error-codes.ts` — 새 매핑 추가 절차가 파일 내 JSDoc에 상세히 기술되어 있으나, `formatErrorToast` 가 유일한 호출자임을 보장하는 규약 명시 부재
  - 위치: `frontend/src/lib/api/integration-error-codes.ts`, 최상단 모듈 JSDoc
  - 상세: `호출자는 본 모듈만 import — 코드 문자열을 컴포넌트에 직접 박지 않는다 (ai-review W11)` 라고 명시하나, "현재 호출자 목록: `page.tsx` `formatErrorToast`" 처럼 실제 사용처를 열거하면 향후 추가 호출자 관리가 수월해진다.
  - 제안: JSDoc 에 `@see formatErrorToast in page.tsx` 또는 현재 사용처 목록을 간략히 추가한다. 필수는 아니며 코드 품질에 미치는 영향은 낮다.

- **[INFO]** `plan/in-progress/cafe24-mall-dup-followup-b.md` — `AI-REVIEW` / `PR` 체크박스가 미완이나 파일이 `in-progress/` 에 위치하는 것은 규약에 맞음; 완료 후 `complete/` 로 이동하는 절차를 plan 내에 명시하지 않음
  - 위치: `plan/in-progress/cafe24-mall-dup-followup-b.md`, 진행 상태 섹션
  - 상세: `[ ] AI-REVIEW` / `[ ] PR` 이 완료되면 `git mv` 로 `plan/complete/` 로 이동해야 한다는 규약이 CLAUDE.md 에 있으나, plan 파일 자체에는 reminder 가 없다. 타 개발자가 plan 파일만 보면 완료 후 절차를 놓칠 수 있다.
  - 제안: plan 파일 하단에 `## 완료 후 처리` 섹션으로 `git mv plan/in-progress/cafe24-mall-dup-followup-b.md plan/complete/` 를 명기하거나, 기존 CLAUDE.md 규약으로 충분하다고 판단하면 현행 유지.

## 요약

이번 변경(W9 훅 추출, W11 에러코드 상수화, INFO 10/12/13 품질 개선)은 문서화 관점에서 전반적으로 우수하다. 새로 추가된 파일들(`use-cafe24-mall-id-precheck.ts`, `integration-error-codes.ts`)은 모두 모듈 수준 JSDoc 과 인라인 주석을 갖추고 있으며, 인라인 주석이 복잡한 로직(AbortController 생명주기, best-effort audit 정책, debounce 설계 의도)을 충분히 설명한다. spec 링크(`spec/2-navigation/4-integration.md §9.2`, `§9.4`) 도 일관되게 참조된다. 발견된 항목은 모두 INFO 등급으로, spec 링크 누락 1건과 역방향 참조 안내 부재 2건이 주된 지적이다. README 나 API 문서, CHANGELOG 갱신이 필요한 외부 인터페이스 변경은 포함되지 않았으며, 새 환경변수도 도입되지 않았다.

## 위험도

LOW
