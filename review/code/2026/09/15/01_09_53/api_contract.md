# API 계약(API Contract) 리뷰

## 검토 범위

이번 라운드(01_09_53)의 실제 코드 변경은 `git diff origin/main...HEAD --stat` 기준
13개 파일이며, 다음 4개 서비스/유틸 소스가 API 계약 관점의 검토 대상이다(나머지는
`*.spec.ts`·`__test-utils__`·`repo-guards/__tests__` 테스트/정적-가드 코드, 또는
`plan/`·`review/` 산출물이라 API 표면과 무관):

- `codebase/backend/src/modules/hooks/hooks.service.ts` — `lastTriggeredAt` 갱신을
  `touchLastTriggeredAt()` 공용 헬퍼로 통합 (컬럼 한정 `update`, 이미 이전 라운드에
  도입된 패턴을 두 호출부가 공유하도록 리팩터)
- `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()`의
  트리거 동기화를 `save(entity)` → 컬럼 한정 `update()`로 전환, `remove()`의 트리거
  cascade 삭제 경로에 `acquireTriggerConfigLock`(+ `TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
  추가
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` —
  `extractInboundSigningRef()` 추출 (세 자리에 중복돼 있던 인라인 캐스트를 단일 함수로)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — 기존 유틸(전
  라운드에서 이미 검토됨), 이번 diff 는 JSDoc 갱신뿐

컨트롤러(`triggers.controller.ts`, `schedules.controller.ts`)·DTO·라우트 정의·Swagger
데코레이터는 이번 diff 에서 **전혀 수정되지 않았다** (`git diff --stat` 에 해당 파일
없음). 이 기능(트리거 config lost-update 방지)에 대한 API 계약 검토는 이미 여러
선행 라운드(`review/code/2026/09/14/18_17_44`, `19_07_43` 등)에서 컨트롤러·DTO·응답
스키마·인증 미들웨어 변경 없음을 확인했고, 이번 라운드는 그 위에 (a) 스케줄 삭제
cascade 도 같은 락을 적용, (b) 중복 코드를 헬퍼로 통합하는 순수 내부 리팩터다.

## 발견사항

CRITICAL/WARNING 급 위반은 없다. 실제 코드를 열어 다음 두 가지를 직접 확인했다.

- **[INFO]** 스케줄 cascade 삭제에 새로 추가된 락 타임아웃 실패가 기존 에러 응답
  포맷과 일관되게 처리된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()`
    내 `this.triggerRepository.manager.transaction(...)` 블록 (`TRIGGER_DELETE_LOCK_TIMEOUT_MS`
    적용부); `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `catch()`
  - 상세: `acquireTriggerConfigLock`이 `SET LOCAL lock_timeout`을 걸어 두므로,
    `DELETE /api/schedules/:id`의 트리거 cascade 삭제가 락 경합으로 Postgres
    `55P03`(lock_timeout)을 던질 수 있는 새 실패 경로가 생겼다. 이 에러는
    `HttpException`도 `isPostgresUniqueViolation`도 아니므로 `GlobalExceptionFilter`의
    `else` 분기를 타 **일반 500 `INTERNAL_ERROR`** 봉투(`{error:{code,message,requestId}}`)로
    마스킹되고 원문은 서버 로그로만 남는다 — 이는 이 필터가 다른 미매핑 `Error`에
    이미 적용하던 것과 동일한 처리이며, `DELETE /api/triggers/:id`(같은 락, 같은
    타임아웃 상수를 이미 쓰던 경로)에서도 동일하게 동작한다는 것을 `triggers.service.ts`
    `remove()`에서 대조 확인했다. 새로운 에러 포맷 불일치나 내부 정보 유출은 없다.
  - 제안: 조치 불요. 다만 락 경합으로 인한 일시적 실패를 클라이언트가 재시도로
    복구 가능한 신호(예: `503`/`Retry-After`)로 구분하고 싶다면, 이는 이번 PR
    범위를 넘는 별도 개선 항목으로 백로그화할 수 있다(현재도 클라이언트 관점에서
    깨지는 계약은 없음).

- **[INFO]** `TriggersService.update()`의 `manager.transaction()` 전환 후에도
  `endpointPath` UNIQUE 충돌(409)·트리거 부재(404) 매핑이 그대로 보존된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`의
    `.catch((err) => this.rethrowEndpointPathConflict(err))`(라인 앵커 `update()` 본문
    끝), `assertTriggerFound`/`throwTriggerNotFound`, `rethrowEndpointPathConflict`
  - 상세: 이번 배치 이전 라운드들에서 저장 호출이 `save(trigger)`에서
    `manager.transaction(async (m) => m.save(Trigger, target))`으로 옮겨갔는데,
    `rethrowEndpointPathConflict`는 `isEndpointPathUniqueViolation(err)`가 아닌
    에러는 그대로 `throw err`하므로 트랜잭션 콜백 안에서 던진 `NotFoundException`
    (트리거가 락 재읽기 시점에 이미 삭제된 경우, `trigger-config-lock.ts` JSDoc의
    "창 1은 404로 드러낸다" 표에 대응)이 삼켜지거나 형태가 바뀌지 않고 그대로
    전파된다. `endpoint-path-conflict-wrap-guard.ts`/`endpoint-path-conflict-wrap.spec.ts`
    의 이번 diff(콜백 경계를 넘어 `.catch` 를 추적하도록 정적 가드 확장 + 회귀
    fixture 추가)가 정확히 이 대칭을 지키기 위한 것임을 코드로 확인했다.
  - 제안: 조치 불요 — 이미 정적 래칫(가드 테스트)이 이 계약을 고정하고 있다.

## 관점별 확인

1. **하위 호환성**: 컨트롤러·DTO·응답 빌더 무변경. 기존 클라이언트 영향 없음.
2. **버전 관리**: 신규 엔드포인트·버전 분기 없음 — 해당 없음. 동작 변화(lost-update
   방지로 인해 PATCH 응답이 "커밋 시점 최신 상태"를 반영하게 되는 점)는 이미
   `CHANGELOG.md`에 "Behavior change"로 명시돼 있다.
3. **응답 형식**: `hooks.service.ts`의 `touchLastTriggeredAt()`, `schedules.service.ts`의
   컬럼 한정 `update()` 모두 응답 바디 구성 로직을 건드리지 않는다 — 두 경우 다
   in-memory 로컬 객체(`trigger.lastTriggeredAt`/`trigger.name`/`trigger.isActive`)를
   먼저 갱신한 뒤 그 값으로 DB 컬럼을 쓰므로, 응답에 실리는 값과 실제 영속 값이
   여전히 일치한다.
4. **에러 응답**: 위 발견사항 참조 — 신규 실패 경로(락 타임아웃)도 기존 전역 필터의
   봉투·마스킹 규칙을 그대로 타고, `endpointPath` 409/트리거 404 매핑도 리팩터
   전후 동일하게 유지된다.
5. **요청 검증**: DTO·validation pipe 변경 없음.
6. **URL/경로 설계**: 라우트 변경 없음.
7. **페이지네이션**: 단일 리소스 PATCH/DELETE 경로라 해당 없음.
8. **인증/인가**: 엔드포인트 자체의 인증/인가 가드는 변경 없음. `schedules.service.ts`의
   `remove()`가 cascade 삭제 대상 `triggerId`를 사용하기 전에 `findById(id, workspaceId)`로
   워크스페이스 소유권을 이미 검증한 뒤라 크로스-테넌트 노출 위험은 없다.

## 요약

이번 라운드는 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부
표면을 전혀 건드리지 않는 서비스/영속성 계층 리팩터다 — 스케줄 cascade 삭제에도
트리거 config 락을 적용하고, 두 자리에 중복돼 있던 `lastTriggeredAt` 컬럼-한정 갱신과
`inboundSigningRef` 추출 로직을 공용 헬퍼로 통합했다. 새로 생긴 유일한 실행 경로
차이(스케줄 삭제 시 락 타임아웃으로 인한 `55P03`)는 기존 전역 예외 필터의 일반
500 마스킹 경로를 그대로 타므로 에러 응답 포맷 일관성을 깨지 않고, `endpointPath`
409/트리거 404 매핑도 트랜잭션 콜백 전환 이후에도 정적 가드로 고정되어 보존된다.
차단할 사항은 없다.

## 위험도

NONE
