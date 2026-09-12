# 테스트(Testing) 리뷰 — trigger-uuid-and-guide-codes

## 검증 방법

프롬프트의 diff/컨텍스트를 읽은 뒤, 저장소 파일을 수정하지 않고 다음을 직접 실행해 확인했다 (읽기 전용):

- `cd codebase/backend && npx jest src/repo-guards/__tests__/param-uuid-pipe.spec.ts` → **7 passed**
- `cd codebase/backend && npx jest src/modules/triggers/triggers.controller.spec.ts src/modules/auth/auth.controller.spec.ts` → **33 passed** (회귀 없음 확인)
- `cd codebase/frontend && npx vitest run src/lib/i18n/__tests__/backend-labels.test.ts` → **20 passed**
- `grep`으로 `LOCALIZED_ERROR_CODES`/`CHAT_CHANNEL_CODES` 배열의 실제 소비처를 확인 — diff 는 배열 원소 재정렬 + 주석 정정뿐, 원소 집합은 불변이라 두 배열 다 로직 회귀 없음을 직접 확인.
- `triggers.controller.spec.ts` 가 `new TriggersController(...)` 직접 생성 방식임을 grep 으로 재확인(plan 문서의 주장과 일치).
- `codebase/backend/src/common/filters/http-exception.filter.spec.ts` 에 `non-23505 QueryFailedError → 500 INTERNAL_ERROR` 회귀 테스트가 이미 존재함을 확인(500 마스킹 사슬의 절반은 기존에 커버됨).
- `git status --short` — 리뷰 중 저장소에 어떤 파일도 쓰지 않았음(뮤테이션 없음, 원복 불필요).

## 발견사항

- **[WARNING]** `rotateBotToken` 의 500→400 행위 변경(CHANGELOG 에 "Behavior change" 로 명시)을 검증하는 실행 가능한 테스트가 전혀 없다 — 새 가드는 "선언이 있는가"만 정적으로 본다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`) / `codebase/backend/src/modules/triggers/triggers.controller.spec.ts` (기존, 무편집)
  - 상세: `triggers.controller.spec.ts` 는 `new TriggersController(...)` 로 컨트롤러를 직접 생성해 메서드를 호출하므로 Nest 요청 파이프라인이 실행되지 않고 `ParseUUIDPipe` 자체가 아예 동작하지 않는다(직접 grep 으로 재확인). 이 라우트를 타는 e2e 스펙도 저장소에 0건이다(grep 확인). 새로 추가된 `param-uuid-pipe` 가드(`param-uuid-pipe-guard.ts`)는 AST 로 "`@Param` 두 번째 인자 텍스트에 `ParseUUIDPipe` 문자열이 있는가"만 보므로, 데코레이터 표기 실수(오타·잘못된 심볼 import·Nest 버전업으로 인한 파이프 무시 등)가 있어도 이 가드는 못 잡고, 실제 HTTP 응답이 정말 400 인지는 이 PR 안 어디에서도 실행-검증되지 않는다. plan 문서(`plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A "처분")는 이를 알고 "행위 테스트는 쓰지 않는다"고 명시적으로 결정했지만, 그 근거("컨트롤러 직접 생성이라 vacuous")는 맞는 진단이되 대안이 없다는 결론까지 가는 것은 성급하다 — DB 없이도 검증 가능하다.
  - 제안: `Test.createTestingModule({ controllers: [TriggersController], providers: [{provide: TriggersService, useValue: mockService}] }).compile()` 로 `INestApplication` 을 띄우고 (DB 불필요, `TriggersService` 는 mock) supertest 로 `POST /triggers/not-a-uuid/chat-channel/rotate-bot-token` 을 호출해 400 을 확인하는 가벼운 통합 테스트를 `triggers.controller.spec.ts` 옆에 추가하면, DB·e2e 인프라 없이도 "선언이 실제로 파이프라인에서 동작한다"는 축을 닫을 수 있다. 지금 이 가드는 "선언 존재"만 지키고 "선언이 살아 있다"는 미검증 상태로 남는다.

- **[INFO]** `param-uuid-pipe-guard.ts` 의 파이프 축 판정이 텍스트 부분일치(`pipes.includes('ParseUUIDPipe')`)라 별칭 import(`ParseUUIDPipe as X`)를 쓰면 **조용히** 놓친다(문서화된 한계, 저장소 실측 0건).
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (JSDoc 및 `scanUuidParams` 본문, `pipes.includes('ParseUUIDPipe')` 조건)
  - 상세: 이 가드가 지키려는 계약("id-형 파라미터는 반드시 `ParseUUIDPipe` 를 갖는다")의 회피 경로가 하나 남아 있다 — 심볼 해석이 아니므로 알고도 감수한 한계라 심각도는 낮지만, `@ApiParam` 축(객체 리터럴 파싱 실패 시 "missing" 으로 fail-loud)과 달리 파이프 축은 별칭 상황에서 **fail-silent**라는 비대칭이 있다. 즉 두 축의 실패 모드가 다르다: 문서 축은 정적으로 못 따라가면 시끄럽게 잡고(과탐 방향), 파이프 축은 별칭이면 조용히 통과한다(누락 방향). 리뷰 시점에 지적하는 것은 근거를 남기기 위함이며 지금 당장 조치를 요구하는 수준은 아니다.

- **[INFO]** 이번 PR 이 고친 문서 드리프트(가이드 MDX 가 `TRIGGER_NOT_FOUND` 를 실제로 나지 않는 코드로 적었던 것)와 같은 클래스의 재발을 막는 가드가 없다.
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (`LOCALIZED_ERROR_CODES`, `CHAT_CHANNEL_CODES`) / `codebase/frontend/src/content/docs/**/*.mdx`
  - 상세: `backend-labels.test.ts` 의 parity 가드는 "이 코드가 `ERROR_KO` 에 매핑돼 있는가"만 검증하지, "이 MDX 문서가 이 엔드포인트의 실제 에러 코드를 정확히 나열하는가"는 검증하지 않는다. `param-uuid-pipe` 가드처럼 AST/전수 스캔으로 승격된 것은 UUID 파이프 축뿐이고, 문서-코드 불일치 축은 이번에도 수작업 실측(전수 스윕)으로만 닫혔다. plan 문서 자체가 이 갭을 별도 항목(§C, `ERROR_KO` 배선 미사용 등)으로 등재해 두었으므로 이 PR 의 스코프 밖이라는 처분은 합리적이지만, "같은 실수의 재발 방지 장치가 없다"는 사실 자체는 테스트 관점 기록으로 남긴다.

## 긍정적 관찰 (참고)

- `param-uuid-pipe` 가드/스펙은 이 리뷰가 흔히 지적하는 실패 패턴들을 스스로 선제 방어한다: vacuity floor(스캔 대상 0건 방지) 를 판정과 **같은 순회**에서 계산해 카운터 드리프트를 원천 차단했고, `@ApiExcludeEndpoint()` 면제를 이름 허용목록이 아니라 구조로 두면서 "면제가 문서 축만 끄는가 런타임 축까지 끄는가"를 가르는 **반대 방향 캐너리**(`excludedPipeless`) 를 별도로 심어 뒀다. plan 문서에 예측(RED/GREEN)을 실측 전에 적어 두고 8개 뮤턴트(M1~M8)를 사후 대조한 기록도 있어, 이 리포트가 직접 재현한 `param-uuid-pipe.spec.ts` 7/7 통과 결과와 함께 이 가드의 신뢰도를 뒷받침한다.
- `backend-labels.ts`/`backend-labels.test.ts` 변경은 순수 주석·배열 원소 재배치이며 원소 집합이 그대로임을 실행(20/20 통과)으로 확인했다 — 회귀 없음.
- `auth.controller.ts`/`triggers.controller.ts` 의 나머지 diff(`@ApiParam` 보강, JSDoc 주석)는 Swagger 메타데이터·주석뿐이라 기존 단위 테스트(33/33 통과)에 영향이 없음을 직접 실행으로 확인했다.

## 요약

핵심 신규 산출물인 `param-uuid-pipe` AST 가드는 자체 테스트(vacuity floor·대조군 4종·반대 방향 캐너리·문서화된 8-뮤턴트 예측/실측 표)가 매우 꼼꼼하고, 실행해 보니 그대로 통과한다. 다만 이 PR 이 CHANGELOG 에 명시한 실제 행위 변경(`rotateBotToken` 비-UUID `:id` 500→400)은 그 가드가 "선언의 존재"만 보장할 뿐 "선언이 요청 파이프라인에서 실제로 작동한다"는 것을 검증하는 실행 테스트가 하나도 없다 — 기존 컨트롤러 단위 테스트는 파이프를 우회하고, 관련 e2e 도 0건이다. mock 사용은 기존 관례(`jest.Mocked<Pick<...>>`)를 그대로 따르고 있어 괴리가 없고, 문서(mdx)·i18n 매핑 변경은 실행 확인 결과 회귀가 없다. 남은 갭은 이번 배치의 스코프 밖으로 명시적으로 등재돼 있으나, 테스트 관점에서는 "관측 가능한 행위 변경이 선언 정적 검사로만 뒷받침된다"는 점이 유일한 실질적 공백이다.

## 위험도

LOW
