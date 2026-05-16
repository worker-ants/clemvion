# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` factory 함수: 테스트당 매번 신규 객체 할당
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L42–87
  - 상세: 테스트 파일 전역에 걸쳐 약 15회 이상 `buildFakeCafe24Integration()`이 호출된다. 각 호출마다 `credentials` 중간 객체와 반환 객체를 새로 할당한다. 테스트 환경에서의 비용이므로 프로덕션 성능에는 영향이 없으나, `jest.fn().mockResolvedValue([...])` 내부에서 배열 + 객체를 매 테스트마다 반복 생성하는 구조다.
  - 제안: 테스트 파일 단위에서 허용 가능한 수준이며 기존 인라인 중복 선언 방식보다 오히려 개선이다. 현상 유지가 적절하다.

- **[INFO]** `AbortController` 생성 위치가 `useEffect` 콜백 본문(setTimeout 외부)에 있어 debounce 만료 전 cleanup 시 불필요한 controller 인스턴스가 항상 생성됨
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` L120–226 (추가된 블록)
  - 상세: `useEffect` 실행 시마다 `new AbortController()`가 즉시 생성된다. debounce 대기(350ms) 도중 `cafe24MallIdInput`이 바뀌어 effect cleanup이 실행되면 해당 controller는 `abort()` 호출 후 곧바로 GC 대상이 된다. 사용자가 빠르게 타이핑하는 상황에서는 fetch가 시작되지 않은 controller가 다수 생성·소멸된다. 객체 하나의 크기가 매우 작으므로 실질적 비용은 무시 가능하지만, 구조적으로 setTimeout 콜백 내부에서 controller를 생성하면 "fetch 직전"에만 할당이 발생한다.
  - 제안: 현재 구현은 `controller.abort()`로 in-flight 요청 취소를 보장하기 위해 timeout 외부에 위치시킨 것으로 의도가 명확하다. 성능상 허용 범위이므로 현상 유지가 적절하다. 개선이 필요하다면 `setTimeout` 콜백 내에서 controller를 생성하고, cleanup에서는 `clearTimeout` 만 호출하면 되지만 abort 타이밍 보장이 복잡해지므로 trade-off가 있다.

- **[INFO]** metadata 배열 파일들(`application.ts`, `collection.ts`, `community.ts`, `design.ts`, `mileage.ts`, `notification.ts`, `personal.ts`, `privacy.ts`, `promotion.ts`, `translation.ts`)에서 대규모 정적 배열 항목 삭제
  - 위치: 파일 5~18 전체
  - 상세: Phase 8 계획 항목(미구현 오퍼레이션)을 각 `*Operations` 배열에서 제거하고 `planned.ts`의 `CAFE24_PLANNED_BY_RESOURCE` 레코드로 이동했다. 이로 인해 런타임에 로드되는 정적 배열의 크기가 줄어든다. 기존에는 미구현 오퍼레이션 메타데이터가 프로덕션 번들에 포함되어 있어 메모리를 낭비했다. 이번 변경으로 초기 로드 시 불필요하게 할당되던 약 30~40개 오퍼레이션 메타데이터 객체가 제거된다.
  - 제안: 이 변경 자체가 성능 개선이다. `planned.ts`에 옮겨진 항목들은 label/id만 포함하는 경량 객체로, 상세 fields·requiredFields 등을 포함하는 전체 메타데이터보다 훨씬 작다. 추후 planned 오퍼레이션을 실제로 구현할 때 해당 항목을 다시 각 도메인 파일에 full 메타데이터로 추가하는 패턴이 명확해졌다. 지연 로딩(lazy) 관점에서 올바른 방향이다.

- **[INFO]** `integrations.service.ts` 트랜잭션 미적용 주석: 현재 구조는 단일 `save()` 후 `auditLogsService.record` 호출로, 두 작업이 순차적으로 실행됨
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L371–407
  - 상세: 추가된 주석은 트랜잭션 미적용이 의도적임을 문서화한다. 성능 관점에서 불필요한 트랜잭션 래핑을 피함으로써 DB 커넥션 점유 시간을 줄이는 효과가 있다. `save()` 실패 시 audit log가 기록되지 않아 일관성이 깨지지 않는다는 근거도 타당하다. 다만 audit log 기록 실패 시 이미 커밋된 integration row에 대한 audit 공백이 발생할 수 있다는 점은 비즈니스 요구에 따라 허용 여부가 달라진다.
  - 제안: 성능 관점에서는 현재 구조가 최적이다. audit log 기록 실패 시 별도 알림 또는 재시도 메커니즘을 두는 것은 비기능 요구사항에 따라 결정하면 된다.

## 요약

이번 변경은 성능 관점에서 전반적으로 긍정적이거나 중립적이다. 핵심 개선 사항은 두 가지다. 첫째, Phase 8 미구현 오퍼레이션 메타데이터를 각 도메인 배열에서 경량 `planned.ts` 레코드로 이동시켜 런타임 메모리 할당과 모듈 로드 크기를 줄였다. 둘째, frontend의 precheck debounce 로직에 `AbortController`를 도입해 사용자 타이핑 중 in-flight 요청을 서버 도달 전에 중단함으로써 백엔드 부하와 rate-limit 카운터 소모를 줄였다. 테스트 파일의 `buildFakeCafe24Integration` factory 도입은 객체 할당 패턴에 변화가 없거나 오히려 더 명료하며, 성능에 부정적인 영향을 주지 않는다. 발견된 모든 항목이 INFO 수준으로, 즉각 수정이 필요한 성능 문제는 없다.

## 위험도

NONE
