# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `extractClientIpFromHeaders` 반환 타입 변경 — 소비처 타입 호환성 파급
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` L556 (diff)
- 상세: `extractClientIpFromHeaders` 의 반환 타입이 `string | null` 에서 `string | undefined` 로 변경됐다. `hooks.service.ts` 의 소비처 두 곳(`clientIp`, `sourceIp` 전달)은 정상 반영됐다. 그러나 이 함수를 import 하는 다른 파일(예: `ip_whitelist` guard, rate-limit guard 등)이 `null` 체크(`=== null`, `!= null`, `?? undefined`)로 분기하고 있다면 런타임 동작은 유지되지만 TypeScript 타입 컴파일 오류나 숨겨진 falsy 처리 불일치가 생길 수 있다. 이번 diff 에 포함된 소비처(`hooks.service.ts` 두 곳)는 `?? undefined` 제거로 올바르게 정리됐으나, 외부에서 이 함수를 사용하는 다른 guard/service 가 `null`을 기대하는지 확인이 필요하다.
- 제안: `extractClientIpFromHeaders` 의 모든 호출처(`grep -r extractClientIpFromHeaders`)를 검색하여 `null` 비교를 하는 곳이 없는지 확인하고, 있다면 `undefined` 비교로 변환하거나 falsy 체크(`if (!ip)`)로 통일한다.

### [WARNING] `getActiveExecutionStatus` — private 브래킷 접근 제거의 테스트 mock 불일치 잠재적 위험
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L884–L578 (diff), `hooks.service.spec.ts` L618–L633 (diff)
- 상세: `getActiveExecutionStatus` 가 `this.executionsService['executionRepository']?.findOne?.()` 브래킷 접근에서 `this.executionsService.getStatusById()` 공개 메서드 호출로 변경됐다. spec 파일의 mock 은 `getStatusById` 내에서 `executionRepository.findOne()` 을 그대로 위임한다. 이 위임 로직은 인자를 전달하지 않은 채 `.findOne()` 를 호출한다(`executionRepository.findOne()` — 인자 없음). 실제 `getStatusById` 는 `{ where: { id: executionId }, select: ['id', 'status'] }` 를 넘기므로, 테스트 mock 의 findOne 호출과 실제 구현의 findOne 호출이 인자 면에서 다르다. 테스트 목적상 반환값 제어는 동작하지만, mock 의 `findOne()` 이 인자를 무시하기 때문에 "어떤 executionId 로 조회했는가"를 assert 하지 않는다는 점에서 테스트 정밀도가 낮아졌다.
- 제안: 테스트 mock `getStatusById` 구현에서 `findOne()` 에 `executionId` 를 전달하거나(`findOne(executionId)`), 또는 `getStatusById` mock 을 `jest.fn().mockResolvedValue(null)` 처럼 단순화하고 각 테스트에서 `mockResolvedValueOnce`로 상태를 직접 제어하는 방식으로 대체한다. 현행 위임 방식은 의도를 숨겨 향후 혼란을 야기할 수 있다.

### [INFO] `hooks.service.spec.ts` — mock 내 IIFE `executionRepository` 노출
- 위치: `hooks.service.spec.ts` L618–L633 (diff)
- 상세: IIFE 안에서 생성된 `executionRepository` 객체가 반환되는 mock 객체의 프로퍼티로 노출된다(`return { stop, executionRepository, getStatusById }`). 기존 테스트들이 `moduleRef.get(ExecutionsService).executionRepository.findOne.mockResolvedValue(...)` 패턴으로 상태를 제어하므로, 이 노출은 의도적이다. 그러나 `executionRepository` 는 실제 `ExecutionsService` 의 public API가 아닌 내부 구현 세부사항이다. 테스트가 내부 구현에 계속 의존하면 향후 리팩터링 시 깨질 가능성이 있다.
- 제안: 중장기적으로 `executionRepository.findOne` 을 직접 제어하는 대신 `getStatusById.mockResolvedValue(status)` 로 제어하는 방향으로 기존 23개 테스트를 순차 이관하는 것이 권장된다. 이번 변경은 하위 호환성 유지 목적의 과도기 조치로 허용 가능하다.

### [INFO] `extractClientIp` 는 여전히 `string | null` 반환 — 두 함수의 반환 타입 비대칭
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` L610
- 상세: `extractClientIpFromHeaders` 는 `string | undefined` 로 변경됐으나 `extractClientIp` 는 여전히 `string | null` 을 반환한다. 두 함수가 같은 파일에 공존하며 유사한 역할을 하므로, 소비처에서 null/undefined 혼재로 혼란을 줄 수 있다. 현재 두 함수의 소비처가 다르므로 즉각적인 버그는 없으나, 팀 내 일관성 규약을 위반한다.
- 제안: 이후 PR에서 `extractClientIp` 도 `string | undefined` 로 통일하거나, 함수 JSDoc에 두 함수가 의도적으로 다른 반환 타입을 사용하는 이유를 명시한다.

### [INFO] `ExecutionsService.getStatusById` — `.catch(() => null)` 가 모든 DB 오류를 삼킴
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` L696–L701 (diff)
- 상세: 새로 추가된 `getStatusById` 는 `.catch(() => null)` 로 DB 오류를 전부 흡수한다. 이는 의도적인 설계(주석에 명시)이나, 네트워크 단절·DB down 같은 시스템 오류와 "행이 없음"을 구분하지 않고 동일하게 `null`을 반환한다. 호출자(`getActiveExecutionStatus`)는 `null` 반환 시 "활성 execution 없음"으로 처리하므로, DB 장애 시 실제로 활성 중인 execution 이 있음에도 "없음"으로 잘못 판단해 새 execution 을 중복 시작할 수 있다.
- 제안: 오류 흡수 정책을 유지한다면 오류 발생 시 `logger.warn` 으로 기록하는 것을 권장한다. 또는 오류를 상위로 전파하고 호출자에서 fail-safe 처리를 결정하게 한다.

## 요약

이번 변경의 핵심은 세 가지다: (1) `extractClientIpFromHeaders` 반환 타입을 `null → undefined` 로 통일하여 소비처의 `?? undefined` 변환을 제거, (2) `HooksService.getActiveExecutionStatus` 에서 private 브래킷 접근(`executionsService['executionRepository']`)을 공개 메서드 `getStatusById` 로 대체, (3) 이에 맞춰 테스트 mock 갱신. 전역 상태·파일시스템·환경 변수의 의도치 않은 변경은 없다. 반환 타입 변경은 직접 소비처(hooks.service.ts)에서 올바르게 반영됐으나, 이 함수를 사용하는 다른 파일에서 `null` 비교를 하고 있다면 숨겨진 타입 불일치가 생길 수 있어 전수 검토가 필요하다. `getStatusById` 의 오류 삼킴(`catch(() => null)`) 은 DB 장애 시 chat-channel 분기에서 "active execution 없음"으로 오판해 새 execution 을 중복 시작하는 잠재적 부작용이 있다.

## 위험도

LOW
