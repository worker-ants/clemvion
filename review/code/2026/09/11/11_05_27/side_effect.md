# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 에러 응답 페이로드 shape 변경 — `details[]`/`details` 객체에 `code: 'INVALID_FIELD'` 키가 15자리 신규 추가된다 (공개 API 인터페이스 변경, 하위호환 방향은 additive)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:509,654,655,662,663,668,669,700,701,707,708,730,731,741,742,794,795,809,810,818(부근),821,822,830,831,995,996` (git show 상 대응 hunk 13곳) / `codebase/backend/src/common/utils/password.util.ts:66,87`
  - 상세: `BadRequestException` 의 `details` 필드는 컨트롤러 응답 그대로 클라이언트로 나가는 공개 계약이다. 이번 변경으로 기존에 `{ field }` 또는 `{ field, message }` 만 실리던 15개 throw 자리에 `code: 'INVALID_FIELD'` 가 추가된다. 추가된 키는 기존 소비자가 특정 키만 읽는 partial-match 라면 영향이 없지만, 만약 어딘가(외부 API 소비자, 통합 테스트)가 `details` 를 `toEqual`/deep-equal 로 **정확히** 비교하고 있었다면 그 자리는 깨진다. 저장소 내부는 이번 PR 이 해당 단언들(unit 13곳 + e2e 5곳)을 함께 갱신해 그물을 쳤음을 커밋(`0710021f0`)·plan(`plan/in-progress/impl-details-code-wiring.md` "뮤테이션" 절)에서 확인했다 — frontend 쪽은 `details.field` 를 문서(mdx)에서만 참조하고 정확-일치 코드 소비는 발견되지 않았다(grep 결과 `codebase/frontend/src` 에 `INVALID_FIELD` 매치 0건).
  - 제안: 외부(서드파티) API 소비자가 있다면 변경 로그/버전 노트에 `details[].code` 필드 추가를 additive breaking-change 없음으로 명시해 두는 것을 권장. 이 PR 범위에서는 추가 조치 불필요.

- **[INFO]** `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 신규 추가 — 검증 동작이 엄격해진다 (기존에 통과하던 `botToken: ''` 요청이 이제 400으로 거부됨)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192` (게이트 기준 `@MinLength(1)`)
  - 상세: `@ApiProperty` 는 이미 `minLength: 1` 을 광고하고 있었으나 검증 체인에는 없어 `''` 가 통과했고, 그 값이 `setupChatChannel` 의 `SecretResolver.rotate(botTokenRef, ws, '')` 로 흘러 **빈 시크릿이 먼저 저장된 뒤** provider 호출이 실패하는 상태-불일치가 있었다(PR 설명 §C). 이번 결정으로 그 요청 자체가 DTO 단계에서 조기 차단되어, 상태 불일치를 만들던 경로가 막힌다 — 의도된 강화이며 인터페이스 관점에서는 "선언(OpenAPI) == 구현" 으로 좁아지는 회귀 방지 수정이다. PATCH 경로(`ChatChannelUpdateConfigDto`)는 `OmitType` 이 부모 데코레이터를 제거하고 `@IsEmpty()` 로 재선언하므로 영향받지 않음을 전용 캐너리 테스트(`trigger-dto-validation.spec.ts` `[C]`)로 확인했다.
  - 제안: 추가 조치 불필요. 이미 방향별(생성=거부, PATCH=허용) 캐너리 테스트가 존재.

- **[INFO]** 신규 공유 상수 모듈 `chat-channel-rejection-messages.const.ts` 도입 — 순수 데이터 상수(`as const`)이며 부작용 없음. import 하는 3개 파일(`chat-channel-config.dto.ts`, `triggers.service.ts`, `trigger-dto-validation.spec.ts`, `triggers.service.spec.ts`)이 동일 리터럴을 참조하게 되어 문자열이 어긋날 가능성은 오히려 낮아진다. 전역 mutable state 없음.

## 확인한 항목 (부작용 없음으로 판정)

- **함수 시그니처**: `validatePasswordStrength`, `hashPassword`, `comparePassword`, `TriggersService` 의 관련 메서드들 시그니처 변경 없음. throw 되는 예외 객체의 payload 내용만 변경.
- **전역 변수**: 신규 전역 변수 없음. `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`/`CHAT_CHANNEL_BLOCKED_FIELDS` 는 module-scope `const … as const` — 불변, 재할당 지점 없음.
- **파일시스템**: 코드 변경 자체는 파일 I/O 없음. 커밋에 포함된 `plan/in-progress/impl-details-code-wiring.md`, `review/consistency/2026/09/11/10_28_52/**` 는 워크플로 산출물(계획서·컨시스턴시 체크 리포트)로 프로젝트 관례상 정상적인 생성물이며 런타임 코드의 부작용이 아니다.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음. `SecretResolver.rotate` 등 기존 호출부는 변경되지 않았고, `botToken` 빈 값이 DTO 단계에서 조기 차단되어 오히려 불필요한 후속 provider 호출(및 그 실패)이 줄어드는 방향.
- **이벤트/콜백**: 없음. 예외 throw 경로와 조건 분기 자체는 그대로이고 payload 필드만 추가됨.
- **공유 뮤테이션 흔적**: `git status --short` 로 확인 — 저장소 내 미커밋 변경은 `plan/in-progress/impl-details-code-wiring.md` (체크리스트 체크 표시, 리뷰 전 정상 워크플로 변경)와 신규 `review/code/2026/09/11/11_05_27/` 리뷰 산출물뿐. 리뷰 대상 코드 파일은 이미 커밋(`0710021f0`)되어 있고 별도 뮤테이션 테스트를 위해 저장소 파일을 건드리지 않았다.

## 요약

이번 변경은 (1) 15개 에러 throw 자리에 `details[].code: 'INVALID_FIELD'` 를 추가하는 응답 payload 확장, (2) `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가해 선언(OpenAPI)과 구현(class-validator)의 불일치를 좁히는 검증 강화, (3) 5쌍의 바이트 동일 거부 메시지를 공유 상수로 추출하는 순수 리팩터, 이 세 축으로 구성된다. 세 축 모두 전역 상태·환경 변수·파일시스템·네트워크·이벤트 콜백에 대한 의도치 않은 부작용은 관측되지 않았고, 함수 시그니처도 변하지 않았다. 유일하게 부작용 관점에서 주목할 지점은 공개 에러 응답 shape 가 additive 하게 넓어진다는 점과 `botToken` 빈 문자열 요청이 이제 거부된다는 점인데, 둘 다 PR 이 스스로 문서화(plan 파일 §C, §A, 커밋 본문)하고 unit(13+2)·e2e(5) 양쪽에서 뮤테이션 검증(15/15 개별 RED)까지 마친 의도된 변경이라 회귀라기보다 하네스가 요구하는 정상적 인터페이스 진화로 판단된다.

## 위험도

LOW
