이제 전체 컨텍스트를 파악했습니다. 분석 결과를 작성합니다.

---

### 발견사항

**(해당 파일들은 HTTP REST 엔드포인트가 아닌 내부 엔진-핸들러 간 인터페이스를 정의합니다. API Contract 검토는 이 내부 계약 및 WebSocket 이벤트 계약을 기준으로 진행합니다.)**

---

- **[INFO]** `ExecutionContext.rawConfig` — 런타임 보장과 타입 서명 불일치
  - 위치: `node-handler.interface.ts:48`, `execution-engine.service.ts:2327`
  - 상세: 엔진은 매 핸들러 호출 전 항상 `rawConfig`를 주입(`Object.freeze`)하지만, 인터페이스는 `rawConfig?: ...`(optional)로 선언되어 있습니다. 이유는 "legacy test fixtures 호환성" 때문입니다. 결과적으로 핸들러 작성자는 타입상 `undefined` 가능성을 고려해야 하는지 모호합니다. 런타임에는 항상 존재하지만 타입 계약은 optional — 두 계약이 어긋납니다.
  - 제안: `rawConfig`를 `Readonly<Record<string, unknown>>`(non-optional)으로 변경하고 레거시 테스트 픽스처만 별도 확장 타입(`Partial<ExecutionContext>`)으로 처리하는 방향을 고려하십시오. 또는 JSDoc에 "엔진은 항상 채운다; 테스트에서만 absent 가능" 주석을 추가해 계약을 명시하십시오.

---

- **[INFO]** `NodeHandler.execute` 반환 타입 이중성 (`Promise<NodeHandlerOutput> | Promise<unknown>`)
  - 위치: `node-handler.interface.ts:119–123`
  - 상세: 핸들러는 `NodeHandlerOutput` 또는 임의의 `unknown`을 반환할 수 있으며, 엔진은 `adaptHandlerReturn`으로 정규화합니다. 이 유니온 반환 타입은 핸들러 작성자에게 "어떤 shape를 반환해야 하는가"에 대한 계약이 불명확합니다. 신규 핸들러가 `unknown`을 반환해도 컴파일 오류가 없어 `config` 필드 누락 같은 묵시적 규약 위반이 발생할 수 있습니다.
  - 제안: 반환 타입을 `Promise<NodeHandlerOutput>`으로 단일화하고, 레거시 raw-return 패턴이 남아있다면 `adaptHandlerReturn`의 타입 레벨 변환을 명시하거나 deprecated 경고를 추가하십시오.

---

- **[WARNING]** `state.rawConfig` 스냅샷 타이밍 — 멀티턴 재개 시 버전 불일치 가능성
  - 위치: `execution-engine.service.ts:1590–1591`
  - 상세: 첫 턴에서 `waiting_for_input` 진입 시 `node.config`를 `state.rawConfig`로 스냅샷합니다. 그러나 `context.rawConfig`는 매 핸들러 호출 전 엔진이 DB에서 최신 `node.config`를 읽어 채웁니다(`2327`행). 사용자가 첫 턴과 재개 사이에 워크플로를 편집하면, `context.rawConfig`(최신 config)와 `state.rawConfig`(첫 턴 스냅샷)이 달라져 핸들러 내에서 두 값이 다른 값을 참조하는 상황이 생깁니다. 현재 핸들러들이 `context.rawConfig`와 `state.rawConfig`를 동일하게 가정한다면 미묘한 버그입니다.
  - 제안: 이 동작이 의도된 설계라면(재개 시 최초 config 기준으로 일관성 유지), 인터페이스 또는 spec에 "resume state의 rawConfig는 첫 waitng 시점 스냅샷" 임을 명시하십시오. 의도하지 않은 경우라면 재개 호출 시 `context.rawConfig`도 `state.rawConfig`에서 복원하는 로직이 필요합니다.

---

- **[INFO]** `structuredOutputCache?` — 동일한 optional 패턴 누적
  - 위치: `node-handler.interface.ts:26`
  - 상세: `rawConfig`와 동일하게 "backward compatibility with existing test fixtures"를 이유로 optional 처리되어 있습니다. 이 패턴이 반복될수록 `ExecutionContext`에서 "런타임에는 항상 있지만 타입은 optional"인 필드가 누적되어 핸들러 작성자의 혼란이 가중됩니다.
  - 제안: 타입 레벨에서 엔진이 주입하는 필드와 외부(테스트 픽스처)가 생략 가능한 필드를 `EngineInjectedContext`와 `HandlerVisibleContext`처럼 구분하거나, 테스트 헬퍼에서 필수 필드를 자동 채우는 factory를 제공하십시오.

---

### 요약

이 변경사항은 HTTP REST API가 아닌 **내부 엔진-핸들러 인터페이스 계약**의 확장입니다. `rawConfig` 추가는 optional 필드이므로 기존 핸들러에 대한 breaking change는 없습니다. 핵심 위험은 "런타임에는 항상 주입되지만 TypeScript 타입은 optional"이라는 계약 이중성으로, 신규 핸들러 작성자에게 혼란을 줄 수 있고 멀티턴 재개 경로에서 `context.rawConfig`와 `state.rawConfig`의 스냅샷 타이밍 차이로 인한 미묘한 불일치 가능성이 존재합니다. WebSocket 이벤트 계약 변경은 없으며, 클라이언트-서버 HTTP 계약은 이 파일들에 포함되어 있지 않습니다.

### 위험도

**LOW**