# API 계약(API Contract) 리뷰

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 변경 파일 전수를 재확인했다. 컨트롤러
(`triggers.controller.ts`, `hooks.controller.ts`)와 DTO(`dto/**`)는 이번 라운드도 **diff 0건**이다
— 라우트·HTTP 메서드·요청 검증 스키마는 이 배치 전체(6개 커밋, `567c82edb`~`bf2becd0c`)를
통틀어 한 번도 건드려지지 않았다. 실제 변경은 서비스/영속성 계층
(`triggers.service.ts` · `chat-channel-binder.service.ts` · 신규 `trigger-config-lock.ts` ·
`hooks.service.ts`)의 `trigger.config` lost-update 동시성 수정과, 그 수정을 지키는 테스트·정적
가드(`endpoint-path-conflict-wrap-guard.ts` 등)다. `CHANGELOG.md`·`plan/**`·`review/**` 는
문서/산출물이라 API 표면과 무관하다.

이번 라운드(21_50_09)는 직전 라운드(21_18_21) 이후 커밋 `e5319a409`(락 관측 고리·상한
하드닝)·`bf2becd0c`(삭제 실패 전파 하드닝·orphan JSDoc 정정)의 델타를 대상으로 했으며, 두
커밋 모두 컨트롤러/DTO diff 가 없음을 `git show --stat` 로 직접 확인했다 — 테스트 강화와
서술 정정이 전부다.

## 발견사항

이번 델타에서 API 계약 표면(라우트·응답 스키마·에러 코드·인증/인가·페이지네이션)에 영향을 주는
변경은 없다. 이전 라운드들이 이미 지적·해소한 항목들을 재확인한 결과는 다음과 같다.

- **[정보/비-이슈]** 이전 라운드가 지적한 "형제 엔드포인트 응답 불일치"(`update()` 는 404,
  `rotateBotToken` 은 200+거짓 감사)는 `triggers.service.ts` `rotateBotToken()` 의
  `if (!wrote) this.throwTriggerNotFound();` (창 1 의 `assertTriggerFound`/`throwTriggerNotFound`
  분리 이후에도 동일 동작 유지)로 이미 닫혔고, 이번 델타로 되돌아가지 않았음을 재확인했다.
  두 엔드포인트가 같은 삭제-경합 조건에서 동일하게 `RESOURCE_NOT_FOUND` 404 를 던지고, 감사
  로그도 함께 스킵된다.
- **[정보/비-이슈]** `DELETE /api/triggers/:id` 의 5초 lock-timeout(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
  타임아웃 시 Postgres `query_canceled`(57014)가 `GlobalExceptionFilter`
  (`codebase/backend/src/common/filters/http-exception.filter.ts`)의 일반 `Error` 분기로 떨어져
  500 `INTERNAL_ERROR` 로 마스킹되는 좁은 엣지 케이스는 21_18_21 라운드가 이미 INFO 로 기록·수용한
  항목이며, 이번 델타는 그 동작을 바꾸지 않는다(오히려 `SET LOCAL lock_timeout` 이 advisory
  lock 뿐 아니라 트랜잭션의 모든 락 대기에 걸린다는 서술 정정이 `bf2becd0c` 에 추가돼, 문서와
  구현의 간극이 좁혀졌다). 원본 postgres 에러 메시지가 클라이언트로 echo 되지 않는 것도
  `mapHttpErrorLike`/일반 `Error` 분기 양쪽에서 CWE-209 대응이 유지됨을 `http-exception.filter.ts`
  에서 직접 확인했다.
- **[정보/비-이슈]** 웹훅 인입 hot path(`hooks.service.ts` `touchLastTriggeredAt`)의 리팩터는
  응답 바디 조립 경로(`engine.execute()`/어댑터 결과에서 구성)와 무관 — 21_18_21 이전 라운드
  확인이 이번 델타(`bf2becd0c` 의 JSDoc 위치 정정)에도 그대로 유지된다.
- **[정보/비-이슈]** 신규 하드닝 커밋 둘(`e5319a409`, `bf2becd0c`)은 테스트 강화(락 순서·상한·
  게이트 관측, 삭제 실패 전파 단언)와 CHANGELOG/plan 서술 정정만 담고 있으며, 요청/응답 스키마·
  HTTP 상태 코드·인증 미들웨어에 닿는 라인이 없다.

## 관점별 확인

1. **하위 호환성**: 컨트롤러·DTO·라우트 서명 변경 없음. 유일한 관측 가능 변화(삭제-경합 시
   `update()`/`rotateBotToken` 모두 404)는 이미 이전 라운드에서 버그 수정 성격으로 확인된
   비-breaking 변화이며 이번 델타로 재확인됐다.
2. **버전 관리**: 새 엔드포인트·버전 분기 없음 — 해당 없음.
3. **응답 형식**: `create()`/`update()`/`rotateBotToken` 의 응답 구성 방식(커밋 후 재조회 →
   정화)은 변경되지 않았다.
4. **에러 응답**: 신규 에러 코드 없음. 기존 `RESOURCE_NOT_FOUND`/`RESOURCE_CONFLICT` 포맷을
   재사용. 락 타임아웃의 500 마스킹은 기존 관례(비문서화 5xx)와 일치하며 이번 델타로 새로
   생긴 것이 아니다.
5. **요청 검증**: DTO·validation pipe·`assertChatChannelInputSafe` 류 변경 없음.
6. **URL/경로 설계**: 라우트 변경 없음.
7. **페이지네이션**: 목록 API 변경 없음 — 해당 없음.
8. **인증/인가**: 엔드포인트 자체 인증/인가 미들웨어 변경 없음. 이번 델타는 인입 웹훅 서명
   검증(`inboundSigningRef`) 유실을 막는 이전 수정의 관측/하드닝 연장으로, 인가 성격의
   보증을 약화하지 않는다.

## 요약

이번 델타(`e5319a409`, `bf2becd0c`)는 직전까지 API 계약 관점에서 이미 NONE 으로 확정된
`trigger.config` lost-update 수정 위에 테스트 하드닝(락 순서·상한·게이트의 관측 고리 확보,
삭제 실패 전파 및 감사 미기록 단언)과 문서/JSDoc 서술 정정만을 더한 것이다. 컨트롤러·DTO·라우트·
페이지네이션·인증 미들웨어는 이번 배치 전체를 통틀어 한 번도 수정되지 않았고, 이전 라운드가
지적했던 형제 엔드포인트 응답 불일치(WARNING#3)는 이미 닫힌 채 유지되고 있다. 유일하게 남아 있는
관찰(삭제 락 타임아웃의 일반 500 마스킹)은 발생 조건이 좁고 이미 이전 라운드에서 INFO 로
기록·수용된 항목이며 이번 델타로 새로 생기거나 악화되지 않았다. API 계약 관점에서 이번 배치를
막을 사유가 없다.

## 위험도

NONE
