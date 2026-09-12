# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `throwInvalidField(field: string, message: string)` 의 `field` 매개변수가 넓은 `string` 이라, `rejectBlockedField` 를 경유하지 않고 직접 호출하는 6개 자리(`chatChannel`·`provider`·`inboundSigningPlaintext` 리터럴)는 `ChatChannelBlockedField` 유니언이 주는 오타 방지 혜택을 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56` (선언), 호출부는 `:205`·`:223`·`:270`·`:284`·`:294`·`:301`.
  - 상세: `rejectBlockedField(chatChannel, field: ChatChannelBlockedField)` 는 5개 차단 필드에 한해 "필드명을 한 번만 적어 오타를 컴파일 에러로 만든다" 는 목표를 달성했지만, 직접 호출부는 `field` 리터럴과 `message` 안의 필드명을 손으로 맞춰 적는 옛 패턴이 그대로 남아 있다. 다만 각 호출부에 `details.field` 단언 테스트가 붙어 있어 오타는 런타임 테스트에서 즉시 잡힌다(무편집 회귀 위험은 낮음). 이미 직전 라운드(`review/code/2026/09/12/16_17_57` SUMMARY INFO 5)에서 같은 지적이 나왔고 "재발 시 고려" 로 보류된 항목이라 이번 라운드에서 새로 발견된 결함은 아니다.
  - 제안: 현재 트레이드오프(범용 헬퍼 vs 타입 안전)는 문서화돼 있어 즉시 조치가 필수는 아니다. 재발하거나 호출부가 늘면 `field: ChatChannelBlockedField | 'chatChannel' | 'provider'` 형태로 좁히는 것을 고려.

## 요약

`chat-channel-input-rules.ts` 의 에러 봉투 생성 로직을 `throwInvalidField` / `hasField` / `rejectBlockedField` 세 헬퍼로 추출해, 이전에 11곳에 흩어져 있던 거의 동일한 `BadRequestException` 생성 코드와 2곳의 `as unknown as Record<string, unknown>` 캐스팅 중복을 완전히 제거했다. 각 헬퍼는 단일 책임(봉투 생성/필드 존재 판정/차단-필드 조합)을 가지며 JSDoc 이 "왜 이렇게 설계했는가"(3번째 인자를 안 두는 이유, `never` 반환 이유, `ChatChannelBlockedField` 리터럴 유니언으로 오타를 컴파일 에러화한 이유)를 근거와 함께 남겨 다음 사람이 재발명하지 않도록 했다. 함수 길이·중첩 깊이 모두 적절하고(최대 2단 중첩), 매직 넘버는 이번 배치가 정확히 해소했다고 재판정한 항목(`256`)이 실측으로 사라졌음을 확인한 뒤 종결 처리했다. 테스트 파일도 `it.each` 로 슬랙/디스코드 대칭 케이스·provider label 스왑 검출·`null`/`''` 두-층 등가성 등을 추가해 커버리지와 가독성을 함께 높였고, 각 테스트 블록에 왜 그 케이스가 필요한지(이전 라운드에서 어떤 뮤턴트가 살아남았는지) 근거를 남겨 회귀 시 맥락을 잃지 않게 했다. `chat-channel-rejection-messages.const.ts`·`chat-channel-config.dto.ts` 의 stale `TriggersService` 귀속 주석도 실제 구조(module-level 함수)에 맞게 갱신됐고, 신규 `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto` 는 기존 `ChatChannelBotIdentityDto` 와의 네이밍 충돌(직전 라운드 CRITICAL)을 해소한 상태로 도입되어 스타일·네이밍 컨벤션도 일관적이다. 전반적으로 이번 diff 는 유지보수성을 개선하는 방향의 리팩터이며, 남은 관찰사항은 이미 알려져 있고 의도적으로 유예된 저위험 트레이드오프 하나뿐이다.

## 위험도
NONE
