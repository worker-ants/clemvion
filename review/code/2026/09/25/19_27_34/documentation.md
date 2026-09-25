# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `README.md` 의 캐너리 부팅 로그 예시가 `@WorkspaceParam()` 카운트를 언급하지 않는다 (이 diff 가 아니라 선행 PR `#1399` 에서 생긴 staleness — 다만 이번 diff 가 같은 캐너리·데코레이터를 다시 다루므로 인접 사실로 기록)
  - 위치: `codebase/backend/README.md:57` (해당 파일은 이번 8개 리뷰 대상에 없어 게이트 번호 없음 — 직접 `Read` 로 확인한 실제 줄 번호)
  - 상세: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 의 `assertWorkspaceIdReflectionWorks` 는 이제
    `` `@WorkspaceId() 소비 라우트 ${requestContext}건 인식 · @WorkspaceParam() 소비 라우트 ${pathParam}건 인식 — ...` `` 두 카운트를 함께 로그에 남긴다(2026-09-25~, `#1399`).
    그런데 README §2 는 여전히 `` `@WorkspaceId() 소비 라우트 N건 인식` `` 절반만 인용하고 "정상 기동 시 인식한 라우트 수가 부팅 로그에 남습니다" 라고만 적는다. 운영자가 README 를 SoT 삼아 배포 후 로그를 확인하면 `@WorkspaceParam()` 카운트(경로 워크스페이스 가드 인식 여부 — 이번 세션이 다루는 정확히 그 표면)를 놓칠 수 있다.
  - 제안: 이번 diff 의 범위는 아니므로 이번 PR 을 막을 사유는 아니다. 다만 다음에 이 캐너리를 건드릴 때 README 인용문도 두 카운트를 반영하도록 짧게 갱신을 권한다.

- **[INFO]** `executions.controller.ts` 안에서 `@ApiForbiddenResponse` 설명이 두 스타일로 갈린다(이번 diff 로 격차가 더 두드러짐)
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — 보간 적용된 곳(게이트 282, 311) vs 미적용 곳(`findOne` 78, `findByWorkflow` 110, `continueExecution` 164, `stop` 141)
  - 상세: 이번 diff 는 `re-run`·`chain` 두 엔드포인트의 `description` 만 `` `...(${NOT_A_MEMBER.code})` `` / `` `...(${ROLE_REQUIRED.editor.code})` `` 로 상수 보간했다(plan 요구 2 의 명시 스코프 — "재실행 · chain"). 같은 컨트롤러의 다른 네 라우트(`findOne`/`findByWorkflow`/`stop`/`continueExecution`)는 여전히 코드 없이 `'워크스페이스 멤버가 아님'`·`'editor 이상 권한 필요'` 산문만 적혀 있다. 이는 이번 diff 가 만든 회귀가 아니라 원래 있던 상태이지만, 두 곳만 상수를 인용하게 되면서 한 파일 안에서 "코드가 보이는 설명"과 "코드가 안 보이는 설명"이 나란히 남아 다음 사람이 패턴을 오인할 여지가 생긴다.
  - 제안: 차단 사유는 아님. 후속(별도 plan)에서 나머지 네 곳도 `NOT_A_MEMBER`/`ROLE_REQUIRED.editor` 보간으로 맞추면 컨트롤러 전체가 한 관례로 수렴한다.

## 확인한 강점 (참고용 — 조치 불요)

- `workspaces.service.ts` `transferOwnership` docstring 의 "(2026-09-25 정정 — 종전 이 줄은 «두 멤버를 단일 `IN` 쿼리로 동시에 락» 이라 적었으나, 그 문장을 넣은 `eb009f99c` 의 구현부터 순차 `findOne` 두 번이었다.)" 는 `git show eb009f99c` 로 직접 대조해 사실임을 확인했다 — 해당 커밋은 실제로 `pessimistic_write` `findOne` 을 requester→target 순서로 두 번 호출했지, `IN` 쿼리를 쓴 적이 없다. 취소선 없이 원문을 지우긴 했지만(자기-반증형 소정정 조건 4의 "원문은 취소선으로 남기고" 와는 다른 처리 — 다만 이 파일은 `spec/` 이 아니라 코드 docstring이라 그 조항의 적용 대상이 아니다), 정정 자체는 근거·출처(커밋 해시)를 남긴 모범적인 "주석 정확성" 수정이다.
- `common/decorators/workspace.decorator.ts` 의 신설 헬퍼 `routeArgEntriesMatching` 과 그 위에 얹힌 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 두 docstring 은 왜 공통 골격을 뺐는지, 왜 `workspace-reflection-canary.ts` 가 이 헬퍼가 아니라 두 판별 함수를 직접 호출해야 하는지까지 정확히 설명한다 — 실제로 `workspace-reflection-canary.ts` 를 열어 대조한 결과 그 주장대로 두 함수를 그대로 import·호출하고 있어 문서와 구현이 일치한다.
- `common/constants/workspace-roles.ts` 상단 docstring 은 `integrations.service.ts` 가 세 번째 소비처로 추가된 사실을 정확히 반영하도록 갱신됐고, `workspace-invitations.service.ts` 도 이미 같은 상수를 쓰고 있어 "두 서비스 → integrations 추가" 서술이 실제 코드와 맞는다.
- CHANGELOG 미기재 판정(`plan/in-progress/workspace-guard-followups.md` 체크리스트) — `CHANGELOG.md` 상단 기준 블록의 "동작이 그대로인 리팩터" 제외 조항에 정확히 해당한다: 8개 파일의 변경 전/후 출력 문자열을 대조한 결과(`FORBIDDEN_MEMBER_ROUTE` 등 보간 결과가 종전 리터럴과 바이트 단위로 동일, `ADMIN_ROLES`/`ROLE_REQUIRED.owner.code` 값도 동일) 응답·OpenAPI·에러 코드에 관측 가능한 변화가 없어 항목 생략이 타당하다.
- `workspaces.service.spec.ts` 에 추가된 주석("코드는 가드와 같은 OWNER_REQUIRED 이고, 문장은 이 동작의 서비스 고유 문구다 — 가드의 «Owner 권한이 필요합니다.» 로 바뀌면 e2e 가 어느 층이 막았는지 가르는 근거가 사라진다")은 새로 추가한 `message` 단언의 존재 이유를 명확히 설명해 향후 "왜 이 문자열까지 단언하나" 라는 의문을 막는다.

## 요약

리뷰 대상 8개 파일은 순수 리팩터(동작·응답·OpenAPI 불변)이며 문서화 품질이 전반적으로 높다. 새 헬퍼 함수·상수 이전·docstring 정정 모두 근거(커밋 해시, 인접 파일 실측)를 갖춰 "주석 정확성"·"인라인 주석" 기준을 충족하고, CHANGELOG 미기재 판정도 저장소가 성문화한 기준과 일치한다. 발견된 두 건은 모두 INFO 등급으로, 이번 diff 가 만든 결함이 아니라 (1) 선행 PR 이 남긴 README 부분 staleness, (2) 이번 diff 의 좁은 스코프 때문에 한 컨트롤러 안에 두 문서화 스타일이 공존하게 된 것이며, 둘 다 병합을 막을 사유가 아니다.

## 위험도

NONE
