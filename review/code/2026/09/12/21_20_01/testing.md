# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** HTTP 왕복 describe 블록이 unit-test 파일 안에 integration 스타일로 섞여 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:229` (`describe('POST /triggers/:id/chat-channel/rotate-bot-token — :id 파이프 (HTTP)'`)
  - 상세: 같은 파일 상단 두 `describe` 는 `new TriggersController(...)` 직접 인스턴스화(순수 unit), 새 블록은 `Test.createTestingModule` + `supertest` + `GlobalExceptionFilter` 를 태우는 실질적 integration 테스트다. 파일명(`*.controller.spec.ts`)과 파일 헤더 docstring(`TriggersController.rotateBotToken 단위 테스트`)은 여전히 "단위 테스트"를 표방한다. 형제 `health.controller.spec.ts` 가 이미 이 패턴이라는 선례가 문서화되어 있어 저장소 관례상 허용 범위이나, 다음 사람이 이 파일에서 "직접 생성 = 파이프 미실행" 관례를 다시 believe 하고 새 vacuous 단언을 넣을 여지가 있다.
  - 제안: 지금 당장 조치는 불필요. 다음에 같은 패턴이 3번째로 생기면(`param-uuid-pipe` 트래커가 이미 예고한 후속 자리) 파일을 `triggers.controller.http.spec.ts` 등으로 분리하는 것을 고려.

- **[INFO]** `param-uuid-pipe-guard.ts` 는 별칭 import·객체 스프레드 `@ApiParam` 을 놓치는 정적 스캐너 한계가 문서화되어 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`scanUuidParams` docstring, `apiParamUuidFlags` 함수)
  - 상세: `ParseUUIDPipe` 존재 판정은 텍스트 부분일치(`pipes.includes('ParseUUIDPipe')`)이고, `@ApiParam` 은 인라인 객체 리터럴만 인식한다. 저장소 실측(별칭 0건, 비-리터럴 0건)으로 현재는 안전하다고 스스로 밝히고 있고, 이 한계를 테스트(`param-uuid-pipe.spec.ts`)가 감추지 않고 docstring에 그대로 노출해 다음 사람이 검증 가능하다.
  - 제안: 조치 불필요 — 이미 알려진 스코프 경계이며 실측 근거가 코드에 남아 있다.

## 검증 내역 (뮤테이션 재현)

- `triggers.controller.spec.ts` (13 cases)·`param-uuid-pipe.spec.ts` (7 cases) 를 실제로 `npx jest` 로 실행해 **20/20 GREEN** 확인 (문서 주장이 vacuous 하지 않음을 직접 재현).
- `codebase/backend/src/modules/triggers/triggers.controller.ts:291` 의 `@Param('id', ParseUUIDPipe)` 를 `@Param('id')` 로 되돌리는 뮤테이션을 저장소 파일에 직접 적용(원본은 `mktemp` 스타일 scratch 디렉터리 `/private/tmp/claude-501/testing-review-scratch/`에 `cp` 로 백업) → **예측대로 RED** (`비-UUID id → 400 VALIDATION_ERROR` 케이스 1건 실패, `Expected: 400, Received: 200`) → `cp` 로 즉시 원복 → `git status --short`/`git diff` 로 클린 확인 후 재실행해 baseline **20/20 GREEN** 재확인. `git checkout`/`restore`/`stash` 는 사용하지 않았다. 작업 트리는 현재 리뷰 산출물(`review/**`) 외 dirty 상태 없음.
- `GlobalExceptionFilter.getCodeFromStatus(400) === 'VALIDATION_ERROR'` 및 핸들러의 `INVALID_BOT_TOKEN` throw 지점을 직접 읽어, HTTP 테스트의 세 기대값(`VALIDATION_ERROR`/`INVALID_BOT_TOKEN`/200)이 실제 소스와 일치함을 대조 확인.
- `@CurrentUser`/`@WorkspaceId` 데코레이터 구현을 직접 읽어, 테스트가 `RolesGuard`/인증 가드 없이도 `req.user` 부재 상황에서 안전하게(옵셔널 체이닝) 동작함을 확인 — 크래시로 인한 우연한 200/400 이 아님.
- `param-uuid-pipe.spec.ts`·`sample.controller.ts` fixture 를 읽고 대조군 4종(정상/파이프만 빠짐/문서만 빠짐/둘 다 빠짐 + 면제 방향 캐너리 2종 + AST-vs-정규식 decoy)이 실제로 서로 다른 사유로 갈리는 것을 소스 대조로 확인. `collectTsFiles` 기본 동작(`.spec.ts` 자동 제외, `node_modules`/`dist` 스킵)도 확인해 스캔 대상이 fixture 오염 없이 격리됨을 검증.
- `backend-labels.test.ts` diff는 `TRIGGER_NOT_FOUND` 항목을 같은 배열(`LOCALIZED_ERROR_CODES`) 안에서 주석·위치만 재배치한 것이며 실제 검증 대상 코드 집합은 불변임을 전체 파일(`Read`)로 대조 확인 — 별도의 `CHAT_CHANNEL_CODES` 배열(수정 범위 밖, plan에도 "지우지 않고 주석만" 이라 명시)도 여전히 `TRIGGER_NOT_FOUND` 를 포함하지만 이는 i18n 매핑 존재 여부 검증이라 귀속 오류와 무관해 테스트 유효성에 영향 없음.

## 요약

`rotateBotToken`의 `:id` UUID 파이프 결함을 세 층(정적 AST 가드 — 전수 베이스라인 0·vacuity floor·대조군 4종, HTTP 왕복 테스트 — 3케이스·대조군 포함, 기존 unit 테스트 — 회귀 무영향)으로 나눠 커버했고, 실제로 jest 를 실행해 GREEN을 재현했으며 핵심 뮤테이션(파이프 제거) 1건을 저장소에 직접 적용해 예측대로 RED가 됨을 재현 검증했다(원복 후 클린 확인). Mock 사용(`TriggersService` stub, `GlobalExceptionFilter` 실물 부착)은 실제 응답 봉투를 검증하기 위한 적절한 선택이고, `@WorkspaceId()`/`@CurrentUser()` 가 가드 없이도 안전하게 동작함을 소스 레벨로 대조해 우연한 통과 가능성을 배제했다. `param-uuid-pipe` 가드는 정적 스캐너의 알려진 한계(별칭 import·비-리터럴 `@ApiParam`)를 스스로 문서화하고 실측 근거(0건)를 남겨 뒀다. 지적 사항은 모두 INFO 수준(파일 내 unit/integration 테스트 레벨 혼재, 이미 문서화된 정적 스캐너 스코프 경계)이며 이번 diff 자체의 결함이 아니라 향후 유지보수 시 참고할 관찰이다.

## 위험도

NONE
