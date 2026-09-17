# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인 — 직전 라운드 WARNING 처분 검증

이번 diff 는 직전 라운드(`review/code/2026/09/17/18_45_09/maintainability.md`)가 낸 WARNING 3건을
포함한다. 원본 소스를 직접 열어 처분(`097e583e1`)이 실제로 반영됐는지 대조했다 — 모두 확인됨:

- WARNING #1(지연 해석 헬퍼 두 벌) → `trigger-resource-release.ts` 의 `resolveTriggerResourceReleaser(moduleRef)` 하나로 통합, `workflows.service.ts`·`workspaces.service.ts` 둘 다 이를 호출만 함(직접 확인).
- WARNING #2(`setupChatChannel` 보상 블록 중복) → 로컬 클로저 `undoWrite`(`chat-channel-binder.service.ts:249-258`)로 통합, 두 호출부(성공 경로 `:312-315`, degraded 경로 `:349-354`)가 각각 1문으로 축소됨.
- WARNING #3(`triggerSecretPrefix` 가 URI 빌더 미재사용) → `secret-ref.ts` 에 `buildSecretRefPrefix()` 신설, `trigger-resource-release.ts` 의 `triggerSecretPrefix()` 가 이를 위임하도록 재작성됨 + 전용 테스트 3건 추가.

이번 라운드에서는 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash` 대조만 수행,
`git status --short` 로 잔여 변경 없음 확인).

## 발견사항

- **[INFO]** "정리 협력자를 못 찾으면 던진다" 회귀 테스트 2건이 `beforeEach` 의 provider 목록을 통째로 복제
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:1049-1069`(`const bare = await Test.createTestingModule({...})`), `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:685-701`
  - 상세: 두 테스트 모두 `TRIGGER_RESOURCE_RELEASER`(또는 워크스페이스 쪽은 provider 자체)를 뺀 "맨몸" 모듈을 만들려고, 파일 상단 `beforeEach`(workflows 쪽은 provider 10개, workspaces 쪽은 4개)와 거의 동일한 provider 배열을 그 자리에 다시 적었다. `TriggersService`/`WorkspacesService`/`WorkflowsService` 생성자에 새 의존성이 추가되면 이 복제본도 함께 고쳐야 컴파일이 통과하는데, 그 사실을 알려주는 주석이 없어 놓치기 쉽다(같은 파일의 다른 자리는 공용 `mockRepository`/`mockWorkspacesService` 등을 재사용한다). 다만 이 자체는 "어떤 이유로도 아니라 이 토큰이 없어서" 를 검증하려는 의도된 설계이고, 같은 패턴이 이 저장소에 기존에도 있다(`repo-guards/__tests__/trigger-secret-columns.spec.ts` 의 "무엇이 던졌는지 본다" 관용구).
  - 제안: 급하지 않음. 두 서비스의 provider 배열이 자주 바뀐다면, `beforeEach` 의 provider 배열을 변수로 빼 `bare` 쪽이 `providers.filter(p => p !== releaserProvider)` 형태로 파생하게 하면 drift 위험이 사라진다.

- **[INFO]** `ChatChannelBinderService.setupChatChannel` 이 여전히 단일 함수로 268줄(89~356행)이고, 이번 PR 로 클로저가 하나(`undoWrite`) 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:89-356`
  - 상세: 직전 라운드가 지적한 "거의 동일한 보상 블록 두 벌" 자체는 로컬 헬퍼 `undoWrite`(:249-258)로 잘 없앴다. 다만 그 헬퍼도 함수 내부 지역 클로저로 추가돼, 이 함수는 이제 `survivesWithFresh`·`buildChannel`·`undoWrite` 세 개의 지역 클로저 + try/catch 양쪽 성공/실패 로직을 한 스코프에 담은 채로 오히려 조금 더 길어졌다(직전 라운드 diff 기준 순증가 약 +13줄). 각 클로저는 JSDoc 이 잘 붙어 있어 개별 블록의 가독성은 나쁘지 않지만, 함수 전체를 한 번에 읽어야 하는 부담은 그대로 남아 있다.
  - 제안: 지금 당장 조치는 불요(직전 라운드에서도 WARNING 이 아니라 함수 길이 자체는 별도 등급을 매기지 않았다). 세 클로저(`survivesWithFresh`, `buildChannel`, `undoWrite`)를 이 함수의 로컬 상태(`trigger`, `internalCfg` 등)를 캡처하는 작은 private 헬퍼 메서드로 승격하면, 함수 본문 자체의 길이는 줄이지 않아도 각 블록을 독립적으로 테스트/탐색할 수 있어진다.

- **[INFO]** 파일명이 한 글자(`releaser` vs `release`) + 접미사(`.service`)로만 갈리는 두 협력 모듈
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`(정책 함수 SoT) vs `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`(Nest DI 배선)
  - 상세: 두 파일은 역할이 명확히 다르고(순수 함수 vs Injectable), import 문에서도 `from './trigger-resource-release'` 와 `from './trigger-resource-releaser.service'` 로 항상 구분되므로 실제 오류로 이어지진 않는다. 다만 `triggers/` 디렉토리를 파일명만 보고 훑거나 fuzzy-find 할 때 `trigger-resource-release*` 로 검색하면 둘 다 걸리고, 리뷰·PR 설명·커밋 메시지에서 사람이 옮겨 적을 때(이번 diff 의 review 산출물 여러 곳에서도 실제로 혼용 서술이 나온다) 어느 파일을 가리키는지 헷갈리기 쉽다.
  - 제안: 필수는 아님. 두 파일이 앞으로도 늘어날 계획이 없다면 현행 유지 가능. 혼동이 반복되면 정책 파일을 `trigger-resource-release-policy.ts` 처럼 접미사를 붙여 시각적으로 더 벌리는 것을 고려.

- **[INFO]** `TriggerResourceReleaserService.lockParentAndListTriggerIds` 의 if/else 두 분기가 여전히 구조를 반복 (직전 라운드 INFO, 처분 "유지" — 재확인만)
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:72-84`
  - 상세: `'workflowId' in parent` 분기와 else 분기가 `manager.findOne(Workflow, ...)` / `manager.findOne(Workspace, ...)` 만 다르고 `select`/`lock` 옵션은 동일하게 반복된다. 직전 라운드가 이미 INFO 로 지적했고 RESOLUTION 이 "부모 타입 2종에서 추상화는 복제보다 읽기 어렵다 — 늘어나면 재검토"로 명시적으로 유지 결정했다. 코드는 그 결정대로 변경 없이 남아 있다 — 새 결함이 아니라 재확인.
  - 제안: 없음 — 기존 결정 유지.

## 요약

이번 diff 는 직전 `/ai-review` 라운드가 낸 유지보수성 WARNING 3건(지연 해석 헬퍼 중복·binder 보상 블록 중복·secret prefix 하드코딩)을 전부 실제로 해소했다(원본 소스 대조로 확인). 새로 추가된 정책 모듈(`trigger-resource-release.ts`)·서비스(`trigger-resource-releaser.service.ts`)·테스트는 책임 분리가 깨끗하고 함수 길이·중첩이 적절하며, 삭제 안무의 순서를 검증하는 테스트들이 이벤트 배열 하나에 순서를 모아 단언하는 일관된 패턴을 쓴다. 남은 관측은 전부 INFO 등급이다 — (1) 두 회귀 테스트가 `beforeEach` provider 목록을 그대로 복제해 향후 drift 여지를 남겼고, (2) `ChatChannelBinderService.setupChatChannel` 은 중복은 없앴지만 함수 자체 길이(268줄·클로저 3개)는 이번 PR 로 소폭 더 늘었으며, (3) `trigger-resource-release.ts`/`trigger-resource-releaser.service.ts` 두 파일명이 한 글자 차이라 사람이 서술할 때 혼동 여지가 있고, (4) 부모 타입 2종의 if/else 분기 반복은 직전 라운드가 이미 검토해 유지하기로 한 상태 그대로다. 넷 다 동작을 해치지 않고 즉시 조치가 필요하지 않다.

## 위험도

LOW
