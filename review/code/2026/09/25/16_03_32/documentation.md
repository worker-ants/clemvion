# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `roles.guard.ts` 클래스 docstring 한 줄이 주변 줄바꿈 폭(~80자)을 벗어나 한 줄에 몰려 있다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:126` (`대상 제외` 섹션, `workspaceParamNamesOf` 로 실제 소비 여부를 reflection 확인한다. 이 예외가 없으면 FE `apiClient` 가 습관적으로 모든 요청에 붙이는` 줄)
  - 상세: 같은 JSDoc 블록의 다른 모든 줄은 `*` 정렬 + 짧은 줄바꿈을 지키는데 이 줄만 훨씬 길게 이어져 있다(전후 diff 대조 결과 `@WorkspaceParam()` 를 리스트에 추가하면서 줄바꿈을 다시 하지 않은 것으로 보임). 의미상 오류는 없고 순수 스타일 불일치다.
  - 제안: `prettier`/수동 정리로 다른 줄과 같은 폭으로 재줄바꿈. 급하지 않음(lint가 comment 폭을 강제하지 않는 저장소라면 무시 가능).

- **[INFO]** `executions.controller.ts` 내에서 같은 파일의 `@ApiForbiddenResponse` 설명 스타일이 이번 diff로 부분적으로만 갱신되어 파일 내부 일관성이 깨졌다(이미 트래커에 등재된 항목이라 이번 PR 결함은 아님).
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — `findOne`(74행)·`findByWorkflow`(106행)·`continueExecution`(160행)은 여전히 `'워크스페이스 멤버가 아님'`처럼 코드 없는 설명이고, 같은 diff가 건드린 `reRun`(277행)·`getChain`(307행)만 `NOT_A_MEMBER`/`EDITOR_REQUIRED` 등 코드를 명시한다.
  - 상세: `RolesGuard`가 이제 전 라우트에 대해 코드가 실린 403 본문을 내므로, 같은 파일 안에서 일부 엔드포인트만 코드를 문서화하면 OpenAPI 소비자 입장에서 "이 엔드포인트만 코드가 있다"는 오해를 줄 수 있다. 다만 `plan/in-progress/workspace-path-guard-impl.md:65-67`가 이번 PR 범위를 "경로 15곳·재실행·chain"으로 명시적으로 좁혔고, `plan/in-progress/spec-draft-nullable-notation-followups.md:4985-4992`에 "기존 `@ApiForbiddenResponse` 설명 ~120곳" 후속 항목으로 실측치(63/54/4/2/기타 20여)까지 남아 있어 갭이 아니라 의도된 범위 축소로 확인된다.
  - 제안: 조치 불필요 — 이미 추적됨. 후속 PR에서 처리 시 이 파일도 포함 대상.

## 확인된 강점 (참고용)

- `workspace.decorator.ts`·`workspace-reflection-canary.ts`·`roles.guard.ts`의 JSDoc이 "무엇을/왜/한계"를 모두 갖춘 수준 높은 문서다 — 특히 `roles.guard.ts` 클래스 docstring은 새 "경로 워크스페이스" 섹션과 "거부 코드" 섹션을 추가하며 기존 "두 검사는 독립이다"·"DB 왕복" 서술과 모순 없이 이어 붙였다.
- `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드" 섹션이 실제로 존재하며 코드 주석의 인용과 정합한다(직접 `grep` 확인).
- `CHANGELOG.md`가 이미 이번 변경에 대해 "Unreleased" 항목 두 개(제품 동작 변화 + 가드 신설)로 갱신되어 있고, 관측 가능한 동작 변화(비멤버 403 코드 통일, nil UUID 400→403 전환, 헤더 미사용 등)를 구체적으로 나열한다 — `CHANGELOG.md` 상단 기준("무엇이 항목을 만드는가")을 충족.
- `workspace-rbac.e2e-spec.ts:665-673`에서 더 이상 참인 서술을 삭제하지 않고 취소선(`~~...~~`)으로 남긴 뒤 정정 문단을 추가한 방식은 이 저장소의 소정정 관례(원문 보존 + 인접 서술 불변)를 잘 따른다.
- 신규 저장소 가드 두 개(`workspace-param-binding-guard.ts`, `param-uuid-pipe-guard.ts`의 `WorkspaceParam` 분기)와 그 fixture·spec 파일 모두 "왜 이 가드인가"·"판정 규칙"·"이웃 가드와의 경계"를 갖춘 헤더 docstring을 갖고 있다.
- `@ApiForbiddenResponse` 갱신이 실제 코드 변경(디코레이터 교체·`@Roles` 추가)과 1:1로 대응하며, `auth.controller.ts`의 `switchWorkspace` 설명도 함께 갱신되어 누락이 없다.
- API 계약 변경(신규 403 코드, 400→403 전환)에 대해 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 관련 없는 후속 두 건(레거시 `@ApiForbiddenResponse` 설명 미갱신 ~120곳, POST 200 광고/201 응답 불일치)까지 등재되어 있어 "알고 있는 갭"과 "이번 PR이 닫은 갭"이 명확히 구분된다.

## 요약

리뷰 대상 22개 파일 전반의 문서화 수준이 매우 높다. 신규 공개 API(`WorkspaceParam`, `workspaceParamNamesOf`, `WorkspaceConsumingRouteCount`)에는 목적·근거·한계를 설명하는 JSDoc이 모두 갖춰져 있고, `RolesGuard`의 동작 변경(경로 워크스페이스 판정·거부 코드 도입)은 클래스 docstring·Swagger 데코레이터·CHANGELOG·spec Rationale·e2e/unit 테스트 설명이 서로 어긋남 없이 일관되게 갱신됐다. 발견한 문제는 스타일 수준의 줄바꿈 불일치 1건과, 이미 트래커에 별도 항목으로 등재된 기존 `@ApiForbiddenResponse` 설명 공백 1건뿐이며 둘 다 이번 PR이 새로 만든 문제가 아니다.

## 위험도

NONE
