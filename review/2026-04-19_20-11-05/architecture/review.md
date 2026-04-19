## 아키텍처 코드 리뷰 결과

### 발견사항

---

**[INFO]** NodeHandlerOutput 인터페이스의 `status` 필드가 `string` 타입으로 느슨하게 정의됨
- 위치: `spec/5-system/4-execution-engine.md` §5.1, 실제 구현 `NodeHandlerOutput.status?: string`
- 상세: `status` 가 `'waiting_for_input' | 'resumed' | 'ended' | 'requires_integration' | 'requires_playwright'` 같은 유니온 리터럴 타입이 아닌 `string`으로 선언되어 있어, 컴파일 타임에 잘못된 값 삽입을 차단하지 못함. `ErrorCode`는 `as const`로 타입 안전하게 만들었지만 `status`는 그렇지 않음.
- 제안: `NodeHandlerOutput` 인터페이스의 `status`를 `NodeHandlerStatus` 유니온 타입으로 추출 및 선언

---

**[WARNING]** `output.error`와 `output.result` 공존 패턴이 단일 책임 원칙 경계를 모호하게 함
- 위치: `spec/5-system/3-error-handling.md` §3.2, "LLM 계열 노드의 특이 케이스"
- 상세: LLM 노드에서 `output.error`와 `output.result`가 동시에 존재할 수 있다는 규격은 소비자(downstream 노드, expression resolver)가 항상 두 필드를 모두 점검해야 함을 의미함. 이는 `output.error` 존재 여부로 성공/실패를 판정하는 단순 컨트랙트를 파괴하고, 소비자 레이어에 에러 상태 판별 로직이 누적되는 Shotgun Surgery 패턴으로 이어질 수 있음.
- 제안: 부분 성공 시나리오를 위한 별도 `output.partial` 필드를 도입하거나(`output.result`는 정상 완료 시에만 존재), `status: 'partial'` 을 추가하여 소비자가 단일 필드로 분기할 수 있게 설계

---

**[WARNING]** `migrate-node-output-refs.ts`의 `RELOCATED_FIELDS`, `META_FIELDS`, `RESULT_FIELDS`, `RENAMED_OUTPUT_FIELDS`가 대규모 매핑 테이블로 확장됨 — 확장성 설계 위험
- 위치: `backend/scripts/migrate-node-output-refs.spec.ts` imports, 명세 전반
- 상세: 노드 타입이 늘어날 때마다 이 4개의 매핑 테이블에 수동으로 항목을 추가해야 하는 구조임. 각 노드 핸들러가 자신의 field relocation 메타데이터를 선언하는 대신, 중앙 스크립트에 모든 노드의 매핑이 집중됨 — 개방-폐쇄 원칙(OCP) 위반. 신규 노드 추가 시 스크립트 수정이 강제됨.
- 제안: 각 노드 핸들러 파일 또는 스키마 파일에 `migrationHints` 정적 메타데이터를 선언하고 스크립트가 이를 자동 수집하는 구조로 전환 (장기적으로)

---

**[INFO]** `output.previousOutput` 호환 필드가 스펙 내에서 삭제 예정 표시 없이 잔류
- 위치: `spec/4-nodes/6-presentation-nodes.md` Carousel Resumed 형식 JSON
- 상세: `"previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }` 주석이 스펙 문서에 남아 있음. 스펙이 구현의 과도기 상태를 그대로 반영하면, 이 필드를 구현해야 하는지 말아야 하는지 독자가 혼란을 겪을 수 있음. Spec은 latest 상태를 기술해야 한다고 CLAUDE.md에 명시되어 있음.
- 제안: Phase 3 이전까지는 `previousOutput`을 스펙 본문이 아닌 별도 "하위호환 부록" 섹션 또는 레거시 노트로 분리하거나, 명확한 deprecation 표시 추가

---

**[INFO]** `buildErrorEnvelope` 헬퍼가 `details` 타입을 `Record<string, unknown>`으로 제한하여 배열/원시값 전달 불가
- 위치: `backend/src/nodes/core/error-codes.ts:35-45`
- 상세: `details?: Record<string, unknown>` 타입이 에러 부가정보로 배열(예: 다중 필드 유효성 에러 목록)이나 중첩 구조를 허용하나, 스펙의 설명("stack / originalInput / attempts / missingFields 등")과는 일치함. 다만 실제 `originalInput`이 배열일 수 있는 경우 직렬화 안전성 주석이 없음.
- 제안: JSDoc에 "caller is responsible for ensuring JSON-serializability" 명시 (이미 부분적으로 있으나 `details` 타입 레벨 주석 보완)

---

**[INFO]** 스펙 섹션 번호 `§1.2.x`가 비표준 식별자 — 참조 무결성 위험
- 위치: `spec/5-system/4-execution-engine.md` 새 섹션 헤더
- 상세: `### 1.2.x 블로킹/재개 컨트랙트`는 정수 번호가 아닌 `x`를 사용하여 기존 `### 1.2 NodeExecution 상태` 앞에 삽입되어 있음. 향후 자동화 도구나 교차 참조(`§1.2` 링크)가 잘못된 섹션을 가리킬 수 있음.
- 제안: `### 1.1.x` 대신 `### 1.2.0` 또는 `### 1.1.5`처럼 명확한 번호 부여, 또는 `### 1.2 NodeExecution`을 `### 1.3`으로 재번호화

---

### 요약

전체적으로 이 변경 집합은 **config/output/meta 삼분할 원칙**을 스펙과 구현 전반에 일관되게 적용하고, 에러 컨트랙트를 `ErrorCode` enum으로 중앙화하여 타입 안전성을 높인 아키텍처적으로 올바른 방향의 리팩터링이다. `NodeHandlerOutput` 인터페이스의 명확한 계약, migration 스크립트의 idempotent 단계적 rewriter, 레거시 dual-read 패턴을 통한 점진적 이행 전략 모두 확장성과 하위호환성을 균형 있게 고려한 설계 결정이다. 다만 `status` 필드의 느슨한 타입, LLM 부분 성공 시 `output.error + output.result` 공존으로 인한 소비자 부담 증가, migration 매핑 테이블의 중앙 집중 방식은 시스템이 성장함에 따라 유지보수 부채로 전환될 수 있으므로 중장기적 개선이 권장된다.

### 위험도

**LOW**