# API 계약(API Contract) 리뷰

## 검토 범위

이번 변경은 `PATCH /api/triggers/:id`(update) · `POST /api/triggers`(create) ·
`rotateBotToken`(bot token 회전 엔드포인트) 뒤에 있는 **서비스/영속성 계층의 동시성
버그 수정**이다 — 동시 PATCH 가 서로의 `trigger.config` 를 덮어써 `inboundSigningRef`
(인입 웹훅 서명 검증 대상)가 유실되는 lost-update 를 advisory lock + 락 안 재읽기로 막는다.

변경된 파일 5개(`chat-channel-binder.service.ts` · 신규 `trigger-config-lock.ts` ·
`triggers.service.ts` · 두 테스트 파일)를 확인했으며, **컨트롤러·DTO·라우트 정의는
일절 건드리지 않았다.** 나머지 파일(6~14)은 plan/consistency-check 산출물로 코드가 아니다.

## 발견사항

각 관점을 실제로 적용해 확인했고, 아래 8개 항목 전부 **변경 없음 / 위반 없음**이다.

- **하위 호환성**: 컨트롤러·DTO(`CreateTriggerDto`/`UpdateTriggerDto`)·라우트 서명 변경 없음. 기존 클라이언트에 영향 없음.
- **버전 관리**: 새 엔드포인트·버전 분기 없음 — 해당 없음.
- **응답 형식**: `create()`/`update()` 는 여전히 `setupChatChannel` 완료 **후** `triggerRepository.findOne` 으로 재조회해 응답을 구성한다(`triggers.service.ts:455-458`, `590-594`). `setupChatChannel` 의 쓰기가 `rewriteTriggerConfigLocked` 로 바뀌었어도 그 쓰기는 이 재조회 **이전에 커밋**되므로, 응답 바디가 실제 저장된 `chatChannel`(및 생존한 `inboundSigningRef`)을 정확히 반영한다 — 오히려 기존의 lost-update 로 인한 응답-DB 불일치 가능성이 줄었다. `rotateBotToken` 의 반환값(`rotatedAt`/`chatChannelHealth`/`botIdentity`)도 `rewriteTriggerConfigLocked` 에 넘긴 `columns`·`mergedChannel` 과 동일한 값이라 응답과 영속 상태가 일치한다.
- **에러 응답**: 새 에러 코드·상태 코드 없음. `rewriteTriggerConfigLocked` 를 감싸는 `manager.transaction()` 이 던지면 기존 `triggerRepository.update()` 호출이 던지는 경우와 동일하게 위로 전파된다 — 실패 시 응답 처리 경로에 변화 없음. 트리거가 락 재읽기 시점에 이미 삭제됐으면 함수가 `false` 를 반환하지만 세 호출부 모두 best-effort 로 무시한다(문서화됨) — 이는 기존 `repository.update()` 가 매칭 행이 없을 때 조용히 no-op 하던 것과 동일한 특성이라 신규 회귀가 아니다.
- **요청 검증**: DTO·validation pipe 변경 없음.
- **URL/경로 설계**: 라우트 변경 없음.
- **페이지네이션**: 단일 리소스 PATCH/POST/회전 엔드포인트라 해당 없음.
- **인증/인가**: 엔드포인트 자체의 인증/인가 미들웨어는 변경되지 않았다. 다만 본 수정은 `chatChannel.inboundSigningRef` 유실로 인해 **인입 웹훅 서명 검증이 fail-open 되던 경로**를 닫는 것이 목적이며, `survivesWithFresh` 가 락 안에서 재계산한 presence 로 두 회귀 캐너리(성공/실패 경로 모두)를 커버하도록 배선돼 있음을 `chat-channel-binder.service.ts:196-214, 239-248, 281-300` 에서 확인했다. API 자체의 auth 계약 변경은 아니지만, 인입 채널 서명 검증이라는 인가 성격의 보증을 복원한다는 점에서 이 관점과 맞닿아 있다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 중 `chat-channel-binder.service.ts` 를 처음 Read 했을 때 `survivesWithFresh` 가
재읽은 `freshConfig` 를 전혀 참조하지 않는(=이 수정의 핵심 방어를 무력화하는) 버전이
관측됐다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에
mutate" 상황으로 보인다 — 재확인(`git diff HEAD` / `sed` 직접 조회) 결과 파일은 커밋
`567c82edb`(HEAD) 와 정확히 일치하는 정상 상태였다. 저장소에 잔여 이상 상태는 없다.
다음 라운드 리뷰어를 위해 기록만 남긴다.

## 요약

이 변경은 컨트롤러 라우트·DTO·응답 스키마·인증 미들웨어·페이지네이션 등 API 계약의
외부 표면을 전혀 건드리지 않는 서비스/영속성 계층 동시성 버그 수정이다. 응답 바디는
수정 전과 동일한 방식(쓰기 완료 후 재조회)으로 구성되며, 오히려 lost-update 로 인한
응답-DB 불일치 가능성을 줄인다. 새 에러 코드·상태 코드·요청 검증 변경이 없고, 실패
전파 경로도 기존과 동일하다. API 계약 관점에서 지적할 사항이 없다.

## 위험도

NONE
