# 테스트(Testing) 코드 리뷰

## 검토 범위 및 검증 방법

`chat-channel-rules-cleanup` 세션의 최종 diff(`c9bc5dca6..HEAD`, 8커밋)를 검토했다. 애플리케이션
코드 대상은 `chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.{ts,spec.ts}` ·
`repo-guards/__tests__/dto-class-name-collision{-guard,}.{ts,spec.ts}`(신규) + fixture 3개다.
프롬프트 diff 가 예산 제한으로 생략한 부분은 `git diff c9bc5dca6..HEAD -- codebase/` 로 직접 열어
대조했다.

- `npx jest chat-channel-input-rules.spec.ts dto-class-name-collision.spec.ts trigger-dto-validation.spec.ts triggers.service.spec.ts` → **4 suites / 243 tests, 1 skipped(무관 기존 anchor)/242 passed**.
- `npx jest triggers` (모듈 전체) → **9 suites / 276 tests, 275 passed**.
- **뮤테이션 재검증**: `hasField` 의 `typeof … !== 'undefined'` 판별을 `!!value` truthy 판별로
  바꿔 실행 → **4건 RED** (`null`/`''` 로 보낸 `botToken`/`inboundSigningPlaintext` 를 더 이상
  거부하지 못함). 저장소 원본은 `mktemp -d` 스크래치에 `cp` 로 백업 후 `python3` 로 대상 파일만
  치환, 검증 후 스크래치 사본으로 `cp` 원복 완료 — `git status --short`/`git diff` 로 원복 확인
  (도중 한 번 zsh 명령이 사전 차단돼 원복이 지연됐으나, 최종적으로 저장소에는 잔여 diff가
  없음을 재확인했다). 이 뮤테이션으로 신규 `PATCH 는 null/빈 문자열로 보낸 … 도 거부한다`
  테스트(파일 1)의 판별력이 실측으로 확인된다.

## 발견사항

없음 (CRITICAL/WARNING 없음).

아래는 INFO 수준 관찰이다.

- **[INFO]** `throwInvalidField`/`rejectBlockedField` 를 경유하지 않는 6개 직접 호출부
  (`assertChatChannelAlreadySetUp`, `assertInboundSigningPlaintextByProvider`)는
  `field` 리터럴을 손으로 반복해 적는 옛 패턴이 그대로 남아 있고, 이 리터럴 자체를 잠그는
  전용 단위 테스트는 없다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `throwInvalidField`
    선언부(약 56행대), 호출부는 `assertChatChannelAlreadySetUp`(약 205·223행)·
    `assertInboundSigningPlaintextByProvider`(약 270·284·294·301행) 부근.
  - 상세: 각 호출부에 `details.field`/`message` 를 단언하는 `it.each` 케이스가 이미 존재해서
    (`chat-channel-input-rules.spec.ts`) 필드명 오타는 즉시 RED 로 드러난다 — 실제 회귀 위험은
    낮다. 다만 이 보호는 "타입이 막는다"가 아니라 "테스트가 우연히 그 문자열을 단언한다"는
    간접적 형태라, 새 호출부가 추가되고 대응 테스트가 누락되면 이 클래스의 결함은 재현 가능하다.
  - 제안: 현재 트레이드오프로 충분(직전 두 라운드에서 이미 같은 결론). 재발 시에만
    `field` 타입을 좁히는 것을 고려.

- **[INFO]** `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(응답 DTO)에 대해
  `response-contract`(선언 vs 실제 런타임 값 대조) 검증이 배선되지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` (게이트
    285-318행 부근, `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, ...)` 데코레이터 자리).
  - 상세: `triggers.service.spec.ts` 의 신규 `it.each`(파일 8, provider 별 identity 필드
    회귀 테스트)는 **서비스 반환값**의 형태를 `toEqual` 로 엄격하게 고정하지만, 컨트롤러가
    실제로 그 값을 그대로 직렬화해 내보내는지 — 즉 swagger 선언(`ChatChannelRotateBotTokenDto`)과
    wire 응답이 실제로 일치하는지 — 는 런타임으로 검증하는 e2e/컨트롤러 테스트가 없다.
    타입 계층에서는 `Promise<ChatChannelRotateBotTokenDto>` 반환 타입 강제로 `tsc` 가 형태
    불일치를 잡지만, `class-transformer`/`TransformInterceptor` 가 실제로 필드를 누락 없이
    통과시키는지는 별개의 런타임 우려다(이 PR 자체가 "손으로 적은 선언이 실제 반환보다
    좁았다"는 결함을 두 차례 냈던 이력이 있는 자리라 더 그렇다). 이 갭은 이번 PR 이 새로
    만든 것이 아니라 저장소 전역에 알려진 60개 엔드포인트 중 4개만 `response-contract` 가
    배선된 기존 갭(`project_response_contract_verifier_and_audit_leak.md`)의 연장이다.
  - 제안: 조치 불요(스코프 밖, 기존 트래커 항목). 다만 후속으로 `rotateBotToken` 을
    `response-contract` 배선 대상에 추가하는 편이 이번 PR 의 반복된 "선언이 좁았다" 결함
    이력과 맞물려 우선순위가 있다는 점만 기록한다.

- **[INFO]** `dto-class-name-collision.spec.ts` 의 대조군(파일 11)은 충돌 그룹이 **1개**인
  경우만 검증하고, `findDtoClassCollisions` 의 `.sort((a,b) => a.name.localeCompare(b.name))`
  (여러 충돌 그룹 간 정렬)와 `files: [...paths].sort()` (같은 그룹 내 파일 정렬)의 실제 정렬
  결과 값(파일명)까지는 단언하지 않는다(`files` 는 `toHaveLength(2)` 로만 개수를 본다).
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` — `[대조군] 같은 이름이 두 파일에 있으면 잡는다` (게이트 73-79행).
  - 상세: 현재 fixture 는 `DuplicatedFixtureDto` 충돌 1건뿐이라 다중 그룹 정렬 로직은
    간접적으로만(코드 리딩으로) 신뢰할 수 있다. 가드 자체의 존재 목적(중복 0건 유지)에는
    영향이 없다 — 정렬은 순전히 출력 가독성 문제라 판정 정확성과 무관하다.
  - 제안: 급하지 않음. 가드가 실사용되며 다중 충돌이 실제로 발생하면 그때 정렬 값까지
    단언을 넓히는 것으로 충분.

## 강점 (참고)

- `chat-channel-input-rules.spec.ts` 의 신규 테스트들은 모두 "왜 이 케이스가 필요한가"를
  이전 라운드의 뮤테이션 결과(예: `hasField` truthy 뮤턴트 GREEN, provider label 스왑 30/30
  GREEN)로 근거를 남기고, 실제로 판별 가능한 fixture(같은 `details`, 다른 `message`)로
  구성돼 있다 — 이번 세션 스스로 재현한 뮤테이션(위 검증 방법 참고)으로도 그 판별력이
  확인된다.
- `triggers.service.spec.ts` 신규 `it.each`(Slack `teamId`/Discord `publicKey`)는
  `objectContaining` 대신 `toEqual` 을 선택해 "필드가 조용히 사라지는" 회귀 클래스(이 PR 이
  실제로 두 차례 냈던 결함)를 원천적으로 다시 잡을 수 있게 했다.
- `dto/trigger-dto-validation.spec.ts` 의 `provider` 필수성 테스트는 미지정(`{}`)과 빈 문자열
  두 형태를 `it.each` 로 나눠, `chat-channel-input-rules.ts` 의 "HTTP 경로에서는 도달 불가"
  주석이 근거 없는 주장으로 남지 않도록 한다 — 주석과 테스트가 서로를 정당화하는 좋은 예.
- 신규 `dto-class-name-collision` 가드는 AST 기반(정규식 아님)이고, 자기 오탐 방지를 위해
  스캔 범위를 `modules`/`common` 으로 좁혀 자신의 fixture 를 배제했으며, vacuous 방지
  단언(`dtoFiles.length > 100`)과 대조군(양성/부정 오탐 방지) 테스트를 모두 갖춰 가드
  테스트로서 모범적인 구조다.
- `triggers.service.spec.ts` 의 `beforeEach` 가 매 테스트마다 `Test.createTestingModule` 을
  새로 구성해 mock 을 재생성하므로, 신규 `it.each` 가 `mockResolvedValueOnce` 를 써도 테스트
  간 상태 누출이 없다 — 격리가 견고하다.

## 요약

CRITICAL/WARNING 급 결함은 발견되지 않았다. 이 PR 은 이미 6라운드에 걸친 리뷰-수정 사이클을
거치며 스스로 두 번 낸 결함(선언이 실제 반환보다 좁음, DTO 클래스명 충돌)을 테스트로 고정했고,
새로 추가된 테스트(내부 필드 3종 × update 모드, null/빈 문자열 두-층 등가성, provider label
스왑 검출, provider PATCH 필수성, provider 별 identity 부가 필드 회귀, DTO 클래스명 충돌 가드)
모두 실제로 판별 가능한 fixture 로 구성돼 있음을 이번 리뷰에서 독립적으로 재현한 뮤테이션
(`hasField` truthy 치환 → 4건 RED)으로 확인했다. 남은 것은 이미 알려진 저위험 갭
(`response-contract` 런타임 미배선, 직접 호출부 리터럴 타이핑, 다중 충돌 정렬 미검증) 세 건뿐이며
전부 INFO 수준으로 즉시 조치가 필요하지 않다.

## 위험도

NONE
