# 변경 범위(Scope) 리뷰 — `impl-chat-channel-patch-token`

## 검토 방법

`_prompts/scope.md` 가 제시한 23개 파일(코드 6 + plan 1 + `review/consistency/**` 산출물 16)을
게이트 라인 대조 + 실제 저장소 파일(`Read`/`grep`)로 교차 확인했다. 뮤테이션 실험은 하지 않았다
(스코프 판단에 불필요) — 저장소 트리 변경 없음, `git status --short` 확인 불필요.

핵심 파일 6개(`chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts` ·
`update-trigger.dto.ts` · `triggers.service.spec.ts` · `triggers.service.ts` ·
`trigger-workflow-ref.e2e-spec.ts`)는 plan(`plan/in-progress/impl-chat-channel-patch-token.md`)이
명시한 D-1(PATCH 전용 DTO)·D-2(secret 쓰기 게이팅)·D-3(ref 재유도 회귀 테스트) 세 항목에 정확히
대응한다. `review/consistency/2026/09/10/{21_37_56,22_45_26}/**` 16개 산출물은 developer 가
착수 전 의무인 `/consistency-check --impl-prep` 두 라운드의 결과이며, `CLAUDE.md` 의
"일관성 검토 산출물 → `review/consistency/**`" 규약에 따라 커밋된 것으로 스코프 위반이 아니다.

## 발견사항

- **[INFO]** 신규 `type` 선언 두 개가 import 목록 중간에 끼어들어 import 블록을 둘로 쪼갠다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `type ChatChannelInput = …`,
    `type ChatChannelInputMode = 'create' | 'update';` 두 선언 직후 `import { ChannelAdapterRegistry } …`
    가 이어진다 (diff 게이트 33~63 구간, 실제 파일 33~63번째 줄 대역과 일치 — `Read` 로 직접 대조함).
  - 상세: `import { ChatChannelConfigDto, ChatChannelUpdateConfigDto } from './dto/chat-channel-config.dto';`
    뒤에 두 `type` 선언(JSDoc 포함 약 25줄)이 삽입되고, 그 다음에야 `ChannelAdapterRegistry` 등
    나머지 import 문이 이어진다. ES module import 는 호이스팅되므로 동작에는 영향 없고, 저장소
    `eslint.config.mjs` 에 `import/order`류 규칙도 없어 lint 를 깨지도 않는다. 다만 import 선언부가
    본문 코드로 물리적으로 분단된 형태라 다음 사람이 import 목록을 훑을 때 놓치기 쉽다 — 이번
    작업(D-1 관련 타입 두 개 신설)과 직접 관련된 변경이라 "무관한 수정"은 아니지만, 두 `type`
    선언을 import 블록 **다음**(그러니까 마지막 import 줄 뒤)으로 옮기면 이 부작용이 사라진다.
  - 제안: 두 `type ChatChannelInput`/`ChatChannelInputMode` 선언을 전체 import 문 블록 뒤로 이동.
    기능·스코프상 blocking 사유는 아니며 가독성 개선 수준.

## 스코프 밖 변경 없음 확인

- **spec/ 미접촉**: plan 이 "R-CC-21 산문이 구현보다 넓다"는 spec 문면 결함을 스스로 찾았지만
  실제 diff 23개 파일 중 `spec/**` 파일은 0건이다 — developer 가 spec read-only 경계를 지키고
  planner 턴으로 명시 이관한 것이 diff 로도 확인된다(자기-반증형 소정정 조건 미충족 판단과 일치).
- **`triggers.service.spec.ts` 의 대규모 재작성(`service.update()` → `service.create()` 전환,
  ~10개 테스트 케이스)**: 겉보기엔 광범위한 리팩터링이지만, D-1(PATCH DTO 가 `botToken`/
  `inboundSigningPlaintext` 를 더 이상 받지 않음)의 직접 결과다 — 기존에 PATCH 로 비밀 저장을
  검증하던 케이스들은 그 경로가 막혔으므로 생성 경로로 옮기지 않으면 죽는 테스트가 된다. 각
  변경에 그 이유를 설명하는 주석이 동반돼 "불필요한 리팩토링"으로 보기 어렵다.
  `createWithChannel` 헬퍼 신설도 같은 목적의 중복 제거로 범위 내.
- **`triggers.service.ts` 콜백 URL 테스트 스위트의 `baseTrigger` fixture 변경**(`config: {}` →
  기존 `chatChannel` 포함, `chatChannelHealth: 'unknown'` → `'healthy'`): 신설된
  `assertChatChannelAlreadySetUp` 가드(PATCH 로 최초 설정 불가) 때문에 그 스위트의 PATCH 호출이
  통과하려면 사전 setup 이 끝난 트리거가 필요해졌다 — 가드 신설의 직접 파생, 무관한 변경 아님.
  동봉된 세 곳의 `chatChannel: { provider: 'telegram', botToken: '111:TestToken' }` → `{ provider:
  'telegram' }` 축소도 동일 이유(PATCH 가 이제 `botToken` 을 거부).
- **`trigger-workflow-ref.e2e-spec.ts` 의 docstring 재작성**: 이전에 "판정된 결함을 그대로
  재현한다"고 경고하던 캐너리가 이번 구현으로 그 결함(R-CC-10 우회)이 해소됐음을 기록하는
  것으로 교체됐다 — 코드 변경(바디에서 `botToken` 제거)과 1:1 대응하는 문서 갱신이며, 새 기능
  추가나 무관한 정리가 아니다.
- **임포트 변경 전수**: 파일 1(`OmitType` 추가)·파일 2(`CustomValidationPipe`/`ArgumentMetadata`/
  `BadRequestException` 추가)·파일 3(`ChatChannelConfigDto`→`ChatChannelUpdateConfigDto` 치환)·
  파일 5(`ChatChannelUpdateConfigDto` 추가) 모두 해당 파일 내에서 실제로 참조되는 것을 확인했다.
  사용하지 않는 import 추가나 불필요한 정리는 없다.
- **설정 파일 변경 없음**: `package.json`/`tsconfig*`/`eslint.config.mjs` 등 어떤 설정 파일도
  diff 에 포함되지 않았다.
- **순수 포맷팅 변경 없음**: 상기 import 순서 건 외에는 diff 전체가 의미 있는 코드/주석/테스트
  변경으로만 구성돼 있고, 공백·줄바꿈만 바뀐 hunk 는 발견되지 않았다.
- **plan 자체의 자기 규율**: plan 문서가 "이 턴에서 고치지 않는다" 절을 두어 스코프 확장 유혹
  (spec 문구 정정, `SecretResolver.store()` vs `rotate()` 표기 불일치 등)을 명시적으로 defer 하고
  있다 — 스코프 관리가 사후적이 아니라 설계 단계에서 이미 적용된 흔적이다.

## 요약

핵심 코드 변경(파일 1~6)은 plan 이 정의한 D-1/D-2/D-3 세 항목에 좁게 대응하며, 테스트 파일의
넓어 보이는 리팩터링(특히 `triggers.service.spec.ts`)도 DTO 계약 변경이 강제하는 필연적 파생이지
독립적인 코드 정리가 아니다. spec/ 파일은 전혀 건드리지 않아 developer 권한 경계도 지켜졌고,
발견한 spec 결함(R-CC-21 산문 폭)은 코드로 우회 수정하지 않고 plan 문서에 planner 인계 항목으로만
남겼다. 유일한 지적은 `triggers.service.ts` 에서 신규 `type` 선언 두 개가 import 블록을 물리적으로
쪼개 놓은 사소한 배치 문제이며, 기능·빌드·lint 에 영향은 없다. `review/consistency/**` 16개
산출물은 프로젝트 컨벤션에 따른 정상 커밋 대상이다.

## 위험도

LOW
