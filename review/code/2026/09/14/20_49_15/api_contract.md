# API 계약(API Contract) 리뷰

## 검토 범위

이 라운드(20_49_15)는 이전 4라운드(18_17_44 / 19_07_43 / 19_44_08 / 20_17_16) API 계약
리뷰가 모두 다룬 `trigger.config` lost-update 수정에, 그 이후 커밋(`12ed21ff1` ·
`c7a9c107e` · `369852b4f` · `889c93cd9`)이 더한 델타를 대상으로 한다. 실제 프로덕션 코드
델타는 다음 넷이다.

- `codebase/backend/src/modules/hooks/hooks.service.ts` — 웹훅 인입 hot path 두 자리를
  `save(trigger)` 에서 `touchLastTriggeredAt()`(컬럼 한정 `update()`)로 교체.
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 인라인 캐스트 3곳을
  묶은 순수 함수 `extractInboundSigningRef` 신규 추가.
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 가 config 락
  (`acquireTriggerConfigLock`)을 잡은 트랜잭션 안에서 삭제하도록 변경.
- `codebase/backend/src/repo-guards/__tests__/*` — `endpoint_path` 충돌-래핑 정적 가드가
  `manager.transaction(async (m) => m.save(Trigger, ...))` 형태를 따라가도록 보강(테스트/가드
  전용, 런타임 코드 아님).

나머지(`CHANGELOG.md`·`plan/**`·`review/**`·각 `*.spec.ts`)는 문서·테스트·리뷰 산출물이라
API 계약 표면과 무관하다. 컨트롤러·DTO·라우트 정의·페이지네이션·인증 미들웨어는 이번 델타에
**일절 포함되지 않는다** (`triggers.controller.ts`, `*.dto.ts` 는 diff 파일 목록에 없음,
`git diff origin/main...HEAD --stat` 로 확인).

## 발견사항

- **[INFO]** `PATCH /api/triggers/:id` 가 특정 삭제-경합 race 에서 이제 404 를 낸다 (이전엔
  삭제된 행을 조용히 되살렸다)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 내
    `if (!fresh) { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... }); }`
    (락 안에서 재읽은 행이 없을 때)
  - 상세: 요청이 `findByIdForUpdate` 로 트리거 존재를 확인한 **직후**, 동시 `DELETE` 가
    그 행을 지우면 종전 코드(`save(trigger)`)는 PK 로 INSERT 를 시도해 삭제된 트리거를
    **고아 상태로 부활**시키며 200 을 반환했다. 이번 변경은 락 재읽기에서 행 부재를 확인해
    `NotFoundException`(`RESOURCE_NOT_FOUND`)을 던진다 — 같은 파일의 다른 404 자리
    (`triggers.service.ts:353-354`, `:483-484`, `:1225-1226`)와 동일한 `code`/에러 형태를
    재사용하므로 에러 응답 스키마 자체는 기존 계약과 일관된다. 정상 경로(동시 삭제가 없는
    절대다수)의 응답·상태 코드는 변경 없음. 이 새 404 는 종전의 "성공했다고 보이지만 실은
    고아 데이터를 만드는" 미정의 동작을 스펙에 맞는 명시적 에러로 바꾼 것이라 하위 호환성
    파괴로 보기 어렵다 — 다만 이 race 를 우연히 관측한 기존 클라이언트가 있었다면(가능성
    낮음) "성공"에서 "404" 로 관측 결과가 바뀐다는 점은 기록해 둔다.
  - 제안: 별도 조치 불요. `spec/2-navigation/2-trigger-list.md` 류의 §5.4 응답-계약 문서에
    이 race 경로의 404 가 아직 명시돼 있지 않다면, 다음 spec 갱신 때 "동시 삭제 시 404" 한
    줄을 추가하는 정도로 충분하다.

- **[INFO]** `DELETE /api/triggers/:id` 의 응답 계약(코드·상태·바디)은 변경 없음 — 내부
  직렬화만 추가
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:960-963`
    (`this.triggerRepository.manager.transaction(async (m) => { await
    acquireTriggerConfigLock(m, id); await m.remove(trigger); })`)
  - 상세: `remove()` 시그니처(`Promise<void>`)·컨트롤러의 204/200 매핑·에러 전파 경로 모두
    그대로다. 추가된 것은 삭제 자체를 트리거 단위 advisory lock 트랜잭션 안으로 넣은 것뿐이라
    (`teardownChatChannel` 등 외부 호출은 여전히 락 **밖**), 정상 삭제 요청의 관측 가능한
    응답은 이전과 동일하다.
  - 제안: 없음.

- **[INFO]** 웹훅 인입 hot path(`handleWebhook`)의 응답 바디는 `touchLastTriggeredAt` 리팩터와
  무관
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:227`, `:686`
    (`await this.touchLastTriggeredAt(trigger);`), 응답은 각각 `{ executionId, ... }` /
    `{ executionId, status: 'pending' }` 로 로컬 변수에서 조립됨(`hooks.service.ts` 여러
    `return { executionId: ... }` 지점)
  - 상세: `save(trigger)` → `update({id}, {lastTriggeredAt})` 전환은 `trigger` 엔티티의
    `config` 등 나머지 컬럼을 되쓰지 않게 하는 동시성 수정이며, 웹훅 응답 바디는 애초에
    저장된 `trigger` 엔티티가 아니라 `engine.execute()`/어댑터 결과에서 조립되므로 응답
    스키마·상태 코드에 영향이 없다. 확인 완료.
  - 제안: 없음.

- **[INFO]** 신규 `extractInboundSigningRef` 는 내부 순수 함수, 요청/응답 검증 로직 변경
  아님
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`
  - 상세: 세 자리(‎`triggers.service.ts` 두 곳, `chat-channel-binder.service.ts` 한 곳)에
    복제돼 있던 동일한 인라인 캐스트를 이름 있는 함수로 뽑은 것뿐이며, 반환 타입
    (`string | undefined`)과 동작(옵셔널 체이닝)이 원래 인라인 표현과 동일하다.
    `chat-channel-input-rules.spec.ts` 의 신규 `describe('extractInboundSigningRef')` 가
    7가지 입력 shape(정상·필드 부재·`null`·`undefined` config 등)에 대해 동일 동작을
    고정했다. DTO 검증(`assertChatChannelInputSafe` 등)은 건드리지 않음.
  - 제안: 없음.

## 관점별 확인

- **하위 호환성**: 컨트롤러·DTO·라우트 서명 변경 없음. 유일한 관측 가능 변화는 위 첫 항목의
  희귀 삭제-race 404(버그 수정 성격)뿐이고, 정상 요청 경로의 요청/응답 형태는 동일하다.
- **버전 관리**: 새 엔드포인트·버전 분기 없음 — 해당 없음.
- **응답 형식**: `create()`/`update()` 의 재조회-후-응답 구성 방식은 이전 라운드(18_17_44)가
  이미 확인한 그대로 유지된다. 이번 델타(hooks 컬럼-한정 update, delete 락)는 응답 바디
  구성 경로에 관여하지 않는다.
- **에러 응답**: 신규 404 는 기존 `RESOURCE_NOT_FOUND` 코드·`NotFoundException` 포맷을
  재사용 — 새 에러 코드·새 HTTP 상태를 도입하지 않는다. `rethrowEndpointPathConflict` 의
  409 매핑 경로도 변경 없음.
- **요청 검증**: DTO·validation pipe·`assertChatChannelInputSafe` 류 검증 로직 변경 없음.
- **URL/경로 설계**: 라우트 변경 없음.
- **페이지네이션**: 목록 API 변경 없음 — 해당 없음.
- **인증/인가**: 엔드포인트 자체 인증/인가 미들웨어 변경 없음. `remove()` 의 lock 추가는
  인가 로직이 아니라 삭제-쓰기 직렬화이며, `touchLastTriggeredAt` 전환은 인입 웹훅 서명
  검증(`inboundSigningRef`) 유실을 막는 이전 라운드 수정의 연장으로 인가 성격의 보증을
  더 단단히 하는 방향이다(약화 아님).

## 요약

이번 델타는 이전 4라운드가 이미 API 계약 관점에서 NONE 으로 확정한 lost-update 수정에,
(1) 웹훅 인입 hot path 를 컬럼 한정 `update()` 로 바꾸고 (2) `DELETE` 도 같은 advisory
lock 트랜잭션 안으로 넣고 (3) 중복 인라인 캐스트를 순수 함수로 추출한 것이 전부다. 컨트롤러·
DTO·라우트·페이지네이션·인증 미들웨어는 이번 델타에 포함되지 않았고, 정상 경로의 요청/응답
계약은 변경되지 않는다. 유일하게 관측 가능한 신규 동작은 `update()` 에서 극히 희귀한 동시
삭제 race 에 대해 이전의 "조용한 고아 데이터 부활"을 기존 관례와 동일한 형태의 명시적 404
로 바꾼 것으로, 이는 버그 수정이며 breaking change 가 아니다. API 계약 관점에서 이번 배치를
막을 사유는 없다.

## 위험도

NONE
