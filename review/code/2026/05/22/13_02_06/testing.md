# 테스트(Testing) 리뷰 결과

## 발견사항

### [WARNING] schedule 타입 거부 테스트 — disallowed 배열 내용 미검증
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 라인 86-103
- 상세: 신규 테스트 케이스는 `VALIDATION_ERROR` 코드와 `details.field='type'` 만 assert한다. 서비스 구현은 `details.disallowed` 배열에 거부된 필드명을 담아 응답하도록 설계되어 있으나, 해당 값의 정확성을 검증하지 않는다. 예를 들어 `endpointPath` 를 보내면 `details.disallowed` 가 `['endpointPath']` 인지, 복수 필드를 보내면 목록이 올바른지 assert 해야 한다.
- 제안:
  ```ts
  await expect(
    service.update('t-sch', 'ws', { endpointPath: '/new-path' }),
  ).rejects.toMatchObject({
    response: {
      code: 'VALIDATION_ERROR',
      details: { field: 'type', disallowed: ['endpointPath'] },
    },
  });
  ```

### [WARNING] 복수 거부 필드 조합 케이스 부재
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
- 상세: schedule 타입 거부 로직은 `endpointPath`, `authConfigId`, `config`, `notification`, `interaction`, `chatChannel` 6개 필드를 각각 확인한다. 현재 테스트는 단일 필드 (`endpointPath`) 만 커버한다. 복수 필드를 동시에 전달했을 때 `disallowed` 배열에 모두 포함되는지 검증하는 케이스가 없다.
- 제안: `{ config: {}, notification: { url: 'https://x.com', events: [] } }` 등 복수 필드 조합을 1건 추가한다.

### [WARNING] schedule name 허용 테스트 — save 호출 여부 미검증
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 라인 105-120
- 상세: `update — schedule 타입의 name 변경은 허용` 테스트는 반환값(`result.name`, `result.isActive`)만 검증한다. `triggerRepo.save` 가 실제로 호출되었는지, `findOne` 이 정확한 인자로 호출되었는지를 assert하지 않아 서비스 내부 persist 경로가 검증 안 된 채로 남는다.
- 제안: `expect(triggerRepo.save).toHaveBeenCalledTimes(1)` 을 추가한다.

### [WARNING] Frontend — OverviewCard / WebhookConfigCard / ScheduleConfigurationCard 단위 테스트 없음
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` (신규 컴포넌트 함수들)
- 상세: plan 체크리스트 §4 에서 `trigger-detail-drawer.test.tsx` 신규 또는 확장을 명시했으나, 이번 커밋에서 프론트엔드 테스트 파일이 추가되지 않았다. `OverviewCard` (편집 모드 진입/저장/취소), `WebhookConfigCard` (endpointPath 변경 시 window.confirm 흐름, USER_CANCELLED 분기), `ScheduleConfigurationCard` (딥 링크 URL 생성) 등 복잡한 상태 전환 로직이 테스트되지 않는 상태다.
- 제안: `@testing-library/react` + `msw` 를 사용하여 다음 케이스를 커버하는 테스트 파일을 추가한다.
  - viewer 역할: Pencil / Edit 버튼 미렌더
  - editor 역할: 이름 변경 후 저장 → `queryClient.invalidateQueries` 호출
  - `endpointPath` 변경 → `window.confirm` 호출, 취소 시 PATCH 미전송
  - 저장 중 버튼 disabled 상태

### [WARNING] window.confirm 사용 — 테스트 비우호적 설계
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, `mutationFn` 내부 (라인 1648-1652)
- 상세: `mutationFn` 내부에서 `window.confirm` 을 직접 호출한다. 이 패턴은 jsdom 환경에서 항상 `false` 를 반환하므로, 단위 테스트에서 "사용자가 확인한 경우" 와 "취소한 경우" 를 독립적으로 검증하려면 반드시 `window.confirm` 을 mock 해야 한다. 또한 `mutationFn` 이 비동기 흐름 중간에 부작용을 발생시키는 구조라 테스트 설정이 복잡해진다.
- 제안: confirm 로직을 `onMutate` 단계 혹은 클릭 핸들러(save 버튼 onClick)로 이동하거나, `confirm` 호출부를 인자로 주입할 수 있는 구조로 리팩터링한다.

### [INFO] ExternalInteractionCard — window.location.reload() 우회 주석 + 테스트 부재
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 2591
- 상세: 코드 주석에 "query invalidate 가 이상적이지만 본 PR 은 단순 reload" 라고 명시되어 있다. `window.location.reload()` 는 jsdom 에서 동작하지 않으므로 이 경로의 성공 케이스를 단위 테스트로 검증할 수 없다. 또한 이 함수에 대한 테스트 자체가 없다.
- 제안: 이후 plan 에서 `queryClient.invalidateQueries` 로 전환할 때 함께 테스트를 추가하도록 plan 에 명시한다.

### [INFO] 빈 describe 블록 — 구조적 앵커 (`it.skip`)
- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 라인 491-497
- 상세: `describe('TriggersService.findOneDetail (helper)')` 는 `it.skip('structural anchor')` 하나만 포함하며 실제 테스트가 없다. lint 에서도 `// lint 무시` 주석이 달려 있다. 이 블록은 유용한 테스트 그룹인 것처럼 보이나 실질적 검증이 없어 리더를 혼란스럽게 한다.
- 제안: 제거하거나 실제 findOneDetail 케이스를 채운다.

### [INFO] i18n 딕셔너리 — 키 완전성 자동 검증 없음
- 위치: `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`, `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: EN/KO 양쪽 모두 `detail.*` 22개 키가 동등하게 추가되었고 수동 비교로는 일치한다. 그러나 자동화된 타입 레벨 키 동등성 검사나 테스트가 없어 향후 키 추가 시 누락 가능성이 있다.
- 제안: Dict 타입 기반의 타입 체크가 이미 EN에만 적용되고 KO는 `as const` 만 사용 중이므로, KO도 `Dict["triggers"]` 타입을 명시하면 컴파일 타임에 키 누락을 잡을 수 있다.

## 요약

백엔드 변경(schedule 타입 PATCH 키 제한)에 대한 핵심 서비스 테스트 2건은 추가되었고 의도가 명확하다. 다만 두 케이스 모두 세부 검증 수준이 낮다. 거부 케이스는 `details.disallowed` 배열을 assert하지 않고, 허용 케이스는 `save` 호출 여부를 검증하지 않는다. 복수 필드 거부 시나리오도 누락되어 있다. 프론트엔드 측은 `OverviewCard`, `WebhookConfigCard`, `ScheduleConfigurationCard` 등 복잡한 상태 전환 로직이 신규로 추가되었음에도 단위 테스트 파일이 전혀 추가되지 않았으며, plan의 검증 항목으로 명시된 `trigger-detail-drawer.test.tsx` 가 이번 커밋에서 빠진 상태다. `window.confirm` 을 `mutationFn` 내부에서 직접 호출하는 패턴은 테스트 작성을 어렵게 만든다.

## 위험도

MEDIUM
