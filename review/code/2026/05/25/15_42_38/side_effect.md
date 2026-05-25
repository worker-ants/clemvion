# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `button_click` 분기에서 무한 루프 가능성 — 이론적 무제한 대기
- 위치: `execution-engine.service.ts` line 3066-3085 (`waitForAiConversation` while 루프 내)
- 상세: `button_click` 분기는 `unknownSkipCount`를 증가시키지 않고 warn 로그만 출력한 뒤 루프를 재진입한다. 설계 의도는 "stale 클릭이 아무리 많이 와도 대화를 죽이지 않는다"이며 spec §10.9 line 407의 graceful degradation을 정확히 구현한 것이다. 다만 부작용 관점에서, 외부 cancel/ai_end_conversation 신호 없이 `button_click`만 계속 들어오는 경우 루프가 이론적으로 영구 지속된다. 기존 `MAX_UNKNOWN_SKIPS` cap이 이 케이스에서 작동하지 않으므로, 악의적이거나 오작동하는 채널이 `button_click`을 지속적으로 발행하면 해당 execution의 worker 스레드가 무기한 점유될 수 있다. 단, 기존 `ai_message` / `form_submitted` 분기도 동일하게 외부 신호에만 의존하는 구조이므로 본 변경이 새로운 구조적 위험을 추가한 것은 아니다.
- 제안: 현재 구조로 허용 가능하나, `button_click` 전용 별도 연속 skip 카운터(`buttonClickSkipCount`)를 도입해 극단적으로 큰 임계값(예: 1000)에서 경고를 남기는 안전망을 선택적으로 고려할 수 있다. 즉각적인 수정 요구 수준은 아님.

### [INFO] `button_click` 분기에서 `pendingContinuations` Map에 새 resolver 등록 타이밍 확인 필요
- 위치: `execution-engine.service.ts` line 3014-3022, 3066-3085
- 상세: while 루프의 상단에서 `pendingContinuations.set(executionId, ...)` 로 새 resolver를 등록한다. `button_click` 분기는 루프를 재진입할 뿐이고 `conversationEnded = true`를 설정하지 않으므로, 다음 iteration에서 새 resolver가 정상적으로 등록된다. 테스트(`execution-engine.service.spec.ts` line 79-84)의 `pendingEntry?.resolve(...)` + `await flushPromises()` 패턴이 이 사이클을 정확히 검증하고 있다. 상태 변경 순서에 경쟁 조건(race condition)은 없다.
- 제안: 현재 구현 정확. 특별한 수정 불필요.

### [INFO] `warnSpy.mockRestore()` — 테스트 전역 상태 오염 위험 점검
- 위치: `execution-engine.service.spec.ts` line 101 (새 테스트 케이스 내)
- 상세: `jest.spyOn(logger, 'warn')`으로 spy를 설정한 뒤 테스트 종료 시 `mockRestore()`를 호출한다. 테스트가 중간에 throw 없이 정상 완료되는 경우만 restore가 보장된다. 해당 테스트의 실행 경로를 보면 `service.endAiConversation` → `await execPromise` 후에 restore가 호출되므로 실제로 throw가 발생할 경우 `mockRestore()`가 누락될 위험이 있다. 그러나 동일 패턴이 `beforeEach`에서 완전한 module 재생성으로 격리되어 있어 다음 테스트가 동일 spy를 공유하지 않으므로 실질적인 글로벌 상태 오염은 없다.
- 제안: 방어적으로 `try/finally`로 `mockRestore()`를 감싸는 패턴을 권고하지만, 현재 모듈 격리 구조에서 필수 수준은 아니다.

### [INFO] 새 테스트에서 `resolvedService` 공유 변수를 통한 lazy reference 사용
- 위치: `execution-engine.service.spec.ts` line 176-177, 400-444
- 상세: `ContinuationBusService` mock의 `publish` closure가 외부 `resolvedService` 변수를 lazy reference로 사용한다. `beforeEach`에서 `resolvedService = service`로 설정되므로 테스트 간 올바르게 업데이트된다. 새로 추가된 테스트 케이스도 동일 `beforeEach`를 거치므로 `resolvedService`가 올바른 service 인스턴스를 참조한다. 이는 의도된 패턴이며 부작용 없음.
- 제안: 해당 없음.

### [INFO] 일관성 검토 산출물 파일 (파일 3-6) — review 폴더 쓰기 부작용
- 위치: `review/consistency/2026/05/25/15_27_39/` 하위 4개 파일
- 상세: `_retry_state.json`, `SUMMARY.md`, `convention_compliance.md`, `cross_spec.md`는 일관성 검토 프로세스가 정상적으로 생성한 산출물이다. CLAUDE.md의 "review/consistency/**" 쓰기 권한 정책에 부합하며 의도된 파일시스템 부작용이다. 예상치 못한 파일 생성이 아니다.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 `waitForAiConversation` 루프 내 `else` 분기 앞에 `else if (action.type === 'button_click')` 분기를 추가해 `unknownSkipCount` 증가를 우회하는 것이다. 변경으로 인한 전역 변수 신규 도입, 공유 상태 예상 외 변경, 시그니처 변경, 네트워크 호출, 환경 변수 접근은 전혀 없다. `this.logger.warn()`과 loop 재진입이라는 의도된 부작용만 발생한다. `buttonIdRaw`에 대한 64자 슬라이스 방어 처리도 로그 인젝션 방지 측면에서 적절하다. 테스트 파일의 변경도 기존 mock 구조와 완전히 정합하며 새로운 전역 상태를 도입하지 않는다. 이론적으로 `button_click` 전용 cap이 없어 무제한 루프가 가능하나, 이는 설계 의도이자 spec에 명시된 동작이며 기존 `ai_message`/`form_submitted` 분기와 동일한 수준의 위험이다.

## 위험도

LOW
