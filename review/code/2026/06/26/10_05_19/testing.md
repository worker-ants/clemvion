# Testing Review — C-2 cluster 4: llm↔model-config forwardRef 순환 제거

## 발견사항

### **[WARNING]** `update(isDefault=true)` 트랜잭션 경로에서 `notifyInvalidated` 호출 미검증
- **위치**: `model-config.service.spec.ts` — `onConfigInvalidated / notifyInvalidated` describe 블록
- **상세**: `ModelConfigService.update`에서 `notifyInvalidated(id)`는 `if (dto.isDefault === true)` / `else` 분기 모두 통과 후 무조건 호출된다. 그러나 `onConfigInvalidated` 테스트 슈트는 `{ name: 'Renamed' }` (non-isDefault) 경로만 검증한다. `isDefault=true` 경로는 `saveWithDefaultSwap` 트랜잭션을 타는 별도 분기이므로, 리팩토링 시 해당 분기에서 `notifyInvalidated` 호출이 누락될 위험에 대한 회귀 방어가 없다.
- **제안**: 기존 `isDefault=true triggers saveWithDefaultSwap transaction` 테스트를 확장하거나, `onConfigInvalidated` 슈트에 `isDefault=true` + 리스너 호출 확인 케이스 추가.

```typescript
it('notifies listener after update with isDefault=true (transaction path)', async () => {
  const listener = jest.fn();
  service.onConfigInvalidated(listener);
  mockRepo.findOne.mockResolvedValue(cfg());
  // saveWithDefaultSwap mock 포함
  mockRepo.manager.transaction.mockImplementation(async (cb) => {
    const txManager = { update: jest.fn(), save: jest.fn().mockImplementation((_, e) => Promise.resolve(e)) };
    return cb(txManager);
  });
  await service.update('cfg-1', 'ws-1', { isDefault: true });
  expect(listener).toHaveBeenCalledWith('cfg-1');
});
```

---

### **[WARNING]** 리스너 throw 시 CRUD 응답 실패 경로 — 방어 테스트 없음
- **위치**: `model-config.service.ts` `notifyInvalidated` / `model-config.service.spec.ts`
- **상세**: `notifyInvalidated`는 리스너를 try/catch 없이 순회 호출한다. 리스너가 throw하면 예외가 `update`/`remove` 호출자까지 전파되어 CRUD 성공 후 HTTP 500을 유발할 수 있다. 현 프로덕션 리스너(`clearClientCache` = `Map.delete`)는 throw하지 않으므로 즉각적 위험은 없으나, 미래 리스너 추가 시 위험이 잠재한다. 클래스 JSDoc에 "리스너는 throw 하지 않는 멱등 무효화여야 한다"고 적혀있지만 테스트 강제가 없다.
- **제안**: `notifyInvalidated` 내부에 리스너 에러 격리(catch + logger.warn)를 추가하거나, 최소한 "리스너가 throw해도 remove/update는 성공으로 완료된다"는 테스트 추가.

```typescript
it('CRUD succeeds even if a listener throws', async () => {
  service.onConfigInvalidated(() => { throw new Error('cache flush failed'); });
  mockRepo.findOne.mockResolvedValue(cfg());
  // Should not propagate listener error
  await expect(service.update('cfg-1', 'ws-1', { name: 'X' })).resolves.toBeDefined();
});
```

---

### **[INFO]** `LlmModelConfigController` — 에러 전파(서비스 throw) 테스트 없음
- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
- **상세**: 세 엔드포인트 모두 정상 경로(happy path)만 검증한다. `LlmPreviewService.previewModels` 또는 `LlmService.testConnection/listModels`가 예외를 던질 때 컨트롤러가 예외를 그대로 전파하는지 확인하는 케이스가 없다. 위임 컨트롤러이므로 낮은 위험이지만 완전한 위임 검증이 아니다.
- **제안**: 각 메서드에 `service.xxx.mockRejectedValue(new Error('upstream'))` 케이스 추가. 특히 `previewModels`는 provider 호출 실패가 `ApiBadRequestResponse`로 문서화되어 있으므로 서비스가 `BadRequestException`을 throw할 때의 전파를 검증하면 유용하다.

---

### **[INFO]** `onModuleInit` 캐시 무효화 테스트 — `clientCache` 미검증
- **위치**: `codebase/backend/src/modules/llm/llm.service.spec.ts` — `onModuleInit (cache invalidation wiring)` 두 번째 테스트
- **상세**: 테스트는 `listModels`가 두 번 호출되는 것(listModels 캐시 무효화 확인)으로 검증하지만, `clearClientCache`가 `clientCache`(LLM 클라이언트 객체 캐시)도 함께 지운다는 것은 직접 검증하지 않는다. `clearClientCache`는 별도 테스트에서 검증되므로 중복 테스트의 필요는 낮으나, 이 테스트에서 리스너가 실제로 `clearClientCache`를 호출하는지를 spy로 확인하면 의도가 더 명확해진다.
- **제안** (선택): `jest.spyOn(service, 'clearClientCache')`를 이용해 리스너 호출 시 `clearClientCache`가 triggered 되었음을 직접 검증하는 assertion 추가 고려.

---

### **[INFO]** `previewModels` 테스트에서 `dto as any` 사용
- **위치**: `llm-model-config.controller.spec.ts` L97, `model-config.controller.spec.ts` 삭제된 테스트
- **상세**: `controller.previewModels(dto as any)`는 컴파일러의 DTO 타입 체크를 우회한다. `previewModels`의 인자 타입인 `PreviewModelListDto`를 올바르게 생성하면 타입 레벨 회귀를 잡을 수 있다.
- **제안**: `as any` 제거 후 `PreviewModelListDto`의 필수 필드를 명시적으로 채운 객체를 사용.

---

### **[INFO]** `testConnection`·`listModels`의 `@Roles` 부재 — 메타데이터 검증 없음
- **위치**: `llm-model-config.controller.spec.ts`
- **상세**: `previewModels`는 `@Roles('editor')` 존재를 테스트하지만, `testConnection`·`listModels`에 롤 가드가 없다는 것(의도적 결정)을 확인하는 테스트가 없다. 향후 실수로 `@Roles` 추가/제거 시 감지하지 못한다.
- **제안**: 두 메서드에 `Reflect.getMetadata('roles', ...)` 가 `undefined`임을 확인하는 assertion 추가 고려 (낮은 우선순위).

---

## 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. `LlmModelConfigController`에 대응하는 신규 spec이 추가되었고, `ModelConfigService.onConfigInvalidated/notifyInvalidated`의 핵심 동작(등록·통지·실패 시 미통지·멀티 구독자·Set 중복 제거)이 6개 케이스로 충실히 검증된다. `LlmService.onModuleInit`의 리스너 등록과 캐시 무효화 연동도 단계적으로 테스트되며, 기존 `ModelConfigController` spec은 책임 이전(cache clear → service 옵저버)을 정확히 반영한다. 주요 갭은 `update(isDefault=true)` 트랜잭션 경로의 리스너 호출 미검증(WARNING)과, 리스너 throw 시 CRUD 실패 방어 로직 부재(WARNING)다. 나머지는 타입 안전성·추가 메타데이터 검증 등 낮은 우선순위의 개선 사항이다.

## 위험도

LOW
