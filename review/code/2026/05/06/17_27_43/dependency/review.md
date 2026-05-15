이제 전체 그림이 파악되었습니다. 분석 결과를 작성합니다.

---

## 의존성 코드 리뷰

### 발견사항

---

**[INFO] 새로운 외부 패키지 없음 — 순수 내부 변경**
- 위치: 세 파일 전체
- 상세: `package.json` 변경이 전혀 없다. `Object.freeze()`, spread 연산자 등 모두 내장 JS API만 사용한다. 추가 번들 비용·라이선스·취약점 위험 없음.
- 제안: 해당 없음.

---

**[INFO] 내부 모듈 의존 추가: `spec.ts` ← `ForEachHandler`, `LoopHandler`, `MapHandler`**
- 위치: `execution-engine.service.spec.ts` L37–39, L2404–2406
- 상세: 세 핸들러가 테스트 파일에 직접 임포트되어 `handlerRegistry`에 실제 인스턴스로 등록된다. 컨테이너 노드 통합 테스트에 필요한 의존이다. 테스트 목적의 실 구현 사용은 정상 패턴이며, 도메인 로직이 없는 핸들러 등록 레이어에 국한된다.
- 제안: 해당 없음 (의도적 선택).

---

**[INFO] `ExecutionContext` 인터페이스 확장: `rawConfig?: Readonly<Record<string, unknown>>`**
- 위치: `node-handler.interface.ts` L48
- 상세: 필드가 `?`(선택적)로 추가되어 기존 `NodeHandler` 구현체 및 테스트 픽스처가 수정 없이 동작한다. 인터페이스 주석에 "레거시 resume state에서 absent일 수 있으며 소비자는 `''`로 fallback해야 한다"고 명시되어 있어 하위 호환성이 문서화되어 있다.
- 제안: 향후 `rawConfig`에 의존하는 핸들러가 생기면, `undefined` 가드 없이 사용하는 코드가 레거시 context에서 런타임 오류를 낼 수 있다. 신규 핸들러 작성 가이드에 "rawConfig는 항상 null-check 후 사용"을 명시할 것을 권장한다.

---

**[WARNING] 얕은 동결(shallow freeze)의 범위 제한**
- 위치: `execution-engine.service.ts` L2327, L1591
- 상세: `Object.freeze({ ...(node.config ?? {}) })`는 최상위 키만 동결한다. `node.config` 내 중첩 객체(배열, 중첩 레코드)는 핸들러에 의해 여전히 변경 가능하다. 주석에 "top-level mutation 을 차단"이라고 명시되어 있어 의도는 정확하지만, 핸들러 개발자가 "rawConfig = 완전 불변"으로 오인할 수 있다.
- 제안: 인터페이스 주석 혹은 CONVENTIONS에 "shallow freeze — 중첩 객체는 불변이 아님"을 한 줄 추가한다. 완전한 불변이 필요한 핵심 설정이라면 `structuredClone` 후 deep-freeze를 고려할 수 있으나, 성능 트레이드오프가 있다.

---

**[INFO] `resumeState.rawConfig` — DB 저장 JSON blob 구조 변경**
- 위치: `execution-engine.service.ts` L1590–1592
- 상세: 첫 `waiting_for_input` 진입 시 `resumeState`에 `rawConfig` 스냅샷을 삽입한다. 이 데이터는 `NodeExecution.outputData` JSON 컬럼에 그대로 직렬화되어 저장된다. 칼럼 타입 자체는 변경이 없으므로 마이그레이션 불필요. `!('rawConfig' in resumeState)` 가드로 기존 저장된 resume state(rawConfig 없는)를 그대로 처리할 수 있어 배포 중 롤아웃 안전성이 확보된다.
- 제안: 해당 없음.

---

**[INFO] 내보내기 표면적 확장: `buildAiMessageDebugFromResumeState`, `buildConversationMetaFromResumeState`**
- 위치: `execution-engine.service.ts` L135, L191; `spec.ts` L7–9
- 상세: 두 유틸 함수가 `export`로 공개되어 있으며, 테스트 파일이 직접 임포트한다. 서비스 파일 내 로직 유출 없이 테스트 가능성을 높이는 적절한 설계다. 외부 소비가 의도된 API가 아니라면 `/** @internal */` 주석을 추가하는 편이 좋다.
- 제안: 공개 API 목적이 아닌 테스트 보조 목적이라면 주석으로 명시 (`@internal` 또는 `@visibleForTesting`).

---

### 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않은 순수 내부 리팩터링**이다. `ExecutionContext`에 `rawConfig` 필드를 선택적으로 추가하고, 엔진이 각 핸들러 호출 직전에 `Object.freeze()`된 원본 config 스냅샷을 주입하는 구조다. 인터페이스 확장이 하위 호환적이고, resume state 삽입에 방어 가드가 있으며, 테스트 커버리지도 신규 동작 전반을 검증하고 있다. 유일한 주의 사항은 얕은 동결의 한계가 개발자에게 충분히 전달되지 않을 수 있다는 점이며, 이는 문서 보완으로 해결 가능한 수준이다.

### 위험도

**LOW**