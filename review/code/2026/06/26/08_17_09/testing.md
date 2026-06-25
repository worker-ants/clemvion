# Testing Review — fix(web-chat): 로더 iframe 코너 고정

## 발견사항

### [INFO] 새로 추가된 테스트 3건 — 변경 코드를 적절히 커버
- 위치: `bridge.spec.ts` lines 37–65 (신규 추가)
- 상세: bottom-right 기본 anchor, bottom-left anchor, zIndex override 3가지 케이스를 각각 독립 it 블록으로 커버. `index.spec.ts` 에도 boot→appearance 전달 2건 추가.
- 제안: 현 커버리지 수준 양호. 별도 조치 없음.

### [INFO] bottom-right 케이스에서 `left`가 빈 문자열인지 단언 — 올바른 네거티브 테스트
- 위치: `bridge.spec.ts` line 43 (`expect(b.element.style.left).toBe("")`)
- 상세: jsdom 에서 설정하지 않은 style 속성은 빈 문자열("")로 반환되며, 테스트가 이를 명시적으로 검증해 의도치 않은 left 설정이 없음을 보증한다. bottom-left 케이스의 `right`도 동일하게 검증(line 55). 패턴 일관성 양호.
- 제안: 없음.

### [WARNING] zIndex=0 엣지 케이스 미테스트 — falsy 값이 DEFAULT_Z_INDEX 로 fallback 될 수 있음
- 위치: `bridge.ts` line 67 (`deps.zIndex ?? DEFAULT_Z_INDEX`)
- 상세: `??` 연산자는 `null`/`undefined` 만 fallback 하므로 `zIndex: 0` 은 `"0"` 으로 올바르게 적용된다. 그러나 이 동작(0이 허용값)은 테스트로 검증되어 있지 않다. 호스트 페이지에서 z-index를 0으로 명시 지정하는 경우 의도대로 동작함을 보증하는 테스트가 없다.
- 제안: `bridge.spec.ts` 에 `it("zIndex:0 는 DEFAULT_Z_INDEX fallback 아님", ...)` 케이스 추가. `expect(b.element.style.zIndex).toBe("0")` 단언.

### [WARNING] `position: "bottom-right"` 명시 전달 케이스 미테스트
- 위치: `bridge.spec.ts` 신규 테스트 블록
- 상세: 현재 기본(undefined) bottom-right와 명시 "bottom-left" 두 케이스만 테스트된다. `position: "bottom-right"` 를 명시적으로 넘겼을 때 right:0 이 설정되는지는 검증하지 않는다. `else` 브랜치(`bridge.ts` line 66)가 position 미지정과 position="bottom-right" 를 같은 경로로 처리하므로 분리 검증이 필요하다. 향후 "bottom-right" 를 별도 조건으로 분리하는 리팩터가 발생할 때 회귀 테스트 역할을 할 수 있다.
- 제안: `it("position='bottom-right' 명시 전달 시 right:0, left 미설정", ...)` 케이스 추가.

### [INFO] `beforeEach` DOM 초기화 — 테스트 격리 충분
- 위치: `bridge.spec.ts` line 24–26, `index.spec.ts` line 12–15
- 상세: 각 spec 파일에서 `beforeEach`로 `document.body.innerHTML = ""`를 실행해 iframe 잔류를 막는다. `index.spec.ts`는 추가로 `setWidgetBase`를 초기화해 모듈 상태 격리. 테스트 간 의존성 없음.
- 제안: 없음.

### [INFO] Mock 사용 패턴 적절 — `jest.spyOn`만 최소 사용
- 위치: `bridge.spec.ts` lines 71–84 (명령 큐 테스트)
- 상세: postMessage 스파이 외에 전체 테스트가 실제 jsdom DOM을 사용한다. bridge.ts의 position/zIndex 관련 신규 로직은 DOM style 직접 설정이므로 mock 없이 실제 DOM 속성 단언으로 검증하는 것이 적절.
- 제안: 없음.

### [INFO] `index.spec.ts` 신규 테스트에 `!` non-null assertion 사용
- 위치: `index.spec.ts` lines 49, 58 (`document.querySelector("iframe")!`)
- 상세: boot 성공 직후 iframe이 반드시 존재함을 가정하는 `!` 단언. boot 실패 시 테스트 자체가 TypeError로 폭발해 실패 원인이 모호해질 수 있다. 기존 테스트들과 동일 패턴으로 일관성은 있으나 방어적 단언(`expect(iframe).not.toBeNull()`)을 앞에 두는 것이 더 명확하다.
- 제안: `const iframe = document.querySelector("iframe"); expect(iframe).not.toBeNull();` 를 선행 단언으로 추가 후 `iframe!` 사용. 단, 기존 코드베이스 스타일과 일치하는 수준이라 필수는 아님.

### [INFO] `primaryColor` appearance 필드에 대한 boot 전달 테스트 없음 — 범위 외 확인
- 위치: `types.ts` line 11 (`primaryColor?: string`), `index.ts` line 89–90
- 상세: `appearance.primaryColor`는 현재 bridge로 전달되지 않고 `wc:boot` payload 전체가 iframe으로 전송되므로 bridge 레벨 테스트 대상이 아니다. 범위 외 이슈이며 이번 PR의 변경 범위와 무관.
- 제안: 없음(범위 외).

### [INFO] 회귀 테스트 유효성 — 기존 45개 테스트 영향 없음
- 위치: 기존 `describe` 블록 전체
- 상세: 신규 생성자 파라미터(`position`, `zIndex`)는 모두 optional이고 `makeBridge()`는 인자 없이 호출되므로 기존 테스트 동작이 변경되지 않는다. `beforeEach` DOM 초기화로 새 테스트가 기존 테스트 상태를 오염시키지 않음을 확인.
- 제안: 없음.

---

## 요약

이번 변경은 버그 수정에 직접 대응하는 단위 테스트(bridge.spec 3건 + index.spec 2건)를 함께 추가했으며 TDD 원칙을 따르고 있다. 테스트 격리(beforeEach DOM 초기화), mock 최소화(실제 jsdom 사용), 네거티브 단언(left/right 미설정 빈 문자열 확인) 등 전반적인 테스트 품질이 양호하다. 주요 미커버 갭은 두 가지다: `zIndex: 0` falsy-but-valid 경계값과 `position: "bottom-right"` 명시 전달 케이스. 두 갭 모두 현재 구현 버그를 초래하지는 않지만 향후 리팩터 시 회귀 보호 역할을 한다. 이 두 케이스는 경미한 WARNING 수준이며, 즉각 수정이 필요한 Critical 이슈는 없다.

## 위험도

LOW
