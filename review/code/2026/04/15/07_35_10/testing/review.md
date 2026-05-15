## 발견사항

### [WARNING] `timeoutMs === 0` 분기에 대한 서비스 레벨 테스트 부재
- **위치**: `execution-engine.service.ts` (새로 추가된 `timeoutMs > 0` 조건 분기)
- **상세**: `timeoutMs === 0`일 때 `timeoutPromise = null`로 설정하고 `Promise.race` 없이 직접 실행하는 새로운 코드 경로가 추가되었으나, 이를 검증하는 단위 테스트가 없음. `WorkflowHandler` 스펙에서는 유효성 검증(`timeout = 0` 허용)만 테스트되고, 실제 서비스의 "무제한 대기" 실행 흐름은 테스트되지 않음.
- **제안**:
  ```typescript
  it('should run without timeout when timeoutMs is 0', async () => {
    // executeSubWorkflow(id, input, { timeoutMs: 0 }) 호출 시
    // Promise.race 없이 runExecution이 완료되어야 함
    await expect(
      service.executeSubWorkflow(workflowId, input, { timeoutMs: 0 })
    ).resolves.not.toThrow();
  });
  ```

---

### [WARNING] chart/table/template 핸들러의 `buttonConfig` 구조 테스트 미갱신 가능성
- **위치**: `chart.handler.ts`, `table.handler.ts`, `template.handler.ts`
- **상세**: `carousel-buttons.handler.spec.ts`는 `buttonConfig`에서 `buttonTimeout`/`buttonTimeoutAction` 제거를 반영하도록 갱신되었으나, chart/table/template 핸들러에 대응하는 스펙 파일에 동일한 필드를 검증하는 테스트가 있다면 미갱신 상태로 잠재적 실패 위험이 있음. 변경된 diff에 해당 파일들의 spec 업데이트가 보이지 않음.
- **제안**: `chart.handler.spec.ts`, `table.handler.spec.ts`, `template.handler.spec.ts`가 존재하는 경우 `buttonConfig` 구조 관련 기대값을 확인하고 업데이트 필요.

---

### [WARNING] 제거된 `button_timeout` interactionType에 대한 폴백 회귀 테스트 부재
- **위치**: `execution-engine.service.ts` (`INTERACTION_STATUSES` 배열, 약 line 1811)
- **상세**: `INTERACTION_STATUSES`에서 `'button_timeout'`이 제거되었고, 타입 화이트리스트 검증에서 알 수 없는 `interactionType`이 들어올 때 폴백 처리 로직이 있음. 기존 DB에 저장된 `button_timeout` 데이터를 읽을 때 이 폴백이 올바르게 동작하는지 검증하는 테스트가 없음.
- **제안**: 
  ```typescript
  it('should fall back to button_continue for unknown interactionType', () => {
    // interactionType: 'button_timeout' 같은 레거시 값이 들어왔을 때
    // resolvedStatus가 'button_continue'로 처리되는지 검증
  });
  ```

---

### [INFO] `ButtonBar` 컴포넌트 단위 테스트 부재 (기존 문제)
- **위치**: `frontend/src/components/editor/run-results/button-bar.tsx`
- **상세**: 카운트다운 타이머 로직(`useEffect` 2개)이 제거되는 큰 변경이 있었으나, `ButtonBar` 컴포넌트 자체에 대한 단위 테스트 파일이 없음. 제거 이전에도 타이머 동작은 테스트되지 않았던 것으로 보임.
- **제안**: 최소한 버튼 클릭 → `onPortButtonClick` 호출, 클릭 후 "clicked" 상태 표시, link 전용 시 Continue 버튼 노출 등의 기본 동작 테스트 추가.

---

### [INFO] `WorkflowHandler.execute()`의 `timeout` 설정값이 서비스로 전달되는지 검증 부재
- **위치**: `workflow.handler.ts` + `execution-engine.service.ts`
- **상세**: `WorkflowHandler`의 유효성 검증은 `timeout = 0`을 허용하도록 변경되었으나, `execute()` 메서드에서 `config.timeout`을 `executionEngine`의 `options.timeoutMs`로 전달하는 연결 고리가 현재 diff에서 명확하지 않음. 단위 테스트에서 `timeout: 0`이 실제로 "무제한 대기"로 동작함을 e2e 또는 통합 수준에서 검증하는 케이스가 없음.
- **제안**: `WorkflowHandler.execute()`에서 `timeout: 0` 설정 시 `executionEngine.executeAsync`/`executeInline`에 올바른 인자로 전달되는지 mock 검증 추가.

---

### [INFO] 제거된 `turnTimeout` 관련 동작의 명시적 문서화 테스트 없음
- **위치**: `ai-agent.handler.spec.ts`, `information-extractor.handler.spec.ts`
- **상세**: `turnTimeout` 관련 검증 테스트는 삭제되었고, "지원하지 않음"임을 명시하는 테스트는 추가되지 않음. `button.types.spec.ts`에서는 `buttonTimeout`에 대해 `"should ignore unknown buttonTimeout field (no longer supported)"` 패턴으로 명시적 문서화를 잘 처리하고 있음. AI 핸들러에도 동일한 패턴 적용 권장.
- **제안**:
  ```typescript
  it('should ignore turnTimeout field if provided (no longer supported)', () => {
    const result = handler.validate({ mode: 'multi_turn', turnTimeout: 600 });
    expect(result.valid).toBe(true); // turnTimeout은 무시됨
  });
  ```

---

## 요약

이번 변경은 타임아웃 기능 전체를 제거하는 대규모 리팩터링으로, 기존 타임아웃 관련 테스트는 적절히 삭제되고 일부는 새로운 동작을 반영하도록 갱신되었습니다. 전반적으로 테스트 코드는 구현 변경과 일관성을 유지하고 있으며 회귀 위험은 낮습니다. 그러나 핵심 변경사항인 `timeoutMs === 0` 분기(무제한 대기) 코드 경로에 대한 서비스 단위 테스트가 없고, chart/table/template 핸들러의 `buttonConfig` 구조 변경이 해당 핸들러의 스펙 파일에 반영되었는지 확인이 필요합니다. `button.types.spec.ts`에서 `"should ignore unknown buttonTimeout field"` 패턴으로 레거시 필드를 명시적으로 문서화한 접근 방식은 우수하며, AI 핸들러에도 동일하게 적용하면 좋겠습니다.

## 위험도

**LOW**