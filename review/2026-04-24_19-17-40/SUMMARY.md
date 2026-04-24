파일 저장 권한이 거부되었습니다. 보고서 내용을 직접 출력합니다.

---

# Code Review 통합 보고서

> **브랜치**: `assistant-integration` | **변경**: ED-AI-40 (런타임 포트 hint + retry-recovered 배지)

## 전체 위험도
**MEDIUM** — 구현 완성도는 높으나 `update_node` 경로 테스트 공백, 보안 sanitize 누락, 프론트엔드 타입 선언 불일치가 복합적으로 남아 있어 회귀 위험이 낮지 않음

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 사용자 설정 포트 `label`이 `sanitizeLlmProvidedString` 없이 LLM tool result에 삽입됨 — 간접 프롬프트 인젝션 표면 | `workflow-assistant-stream.service.ts` — `portResolver` 내 `p.label` | `sanitizeLlmProvidedString(p.label, 80)` 통과 후 포함 |
| 2 | Testing | `update_node` 성공 경로의 `result.ports` 반환 검증 테스트 전무 — `add_node`만 커버 | `shadow-workflow.spec.ts` — `update_node` describe 블록 | `returns runtime ports` / `omits without portResolver` / `caps at 50` 3건 mirror 추가 |
| 3 | Testing | `portResolver` 타입 계약 변경(`string[]` → `ShadowRuntimePort[]`) 서비스 단위 테스트 부재 — `p.type` 정규화 로직 비검증 | `workflow-assistant-stream.service.ts` — `portResolver` 클로저 | 비-error/non-data 타입 정규화 결과 단위 테스트 추가 |
| 4 | Testing | `mergeRecoveryGroups` 연속 복구 쌍(`fail_A → success_A → fail_B → success_B`) 미테스트 | `tool-call-badge.test.ts` — recovery merge describe | 두 연속 PORT_NOT_FOUND → 성공 시퀀스 각각 독립 `retried` 그룹으로 축약 테스트 |
| 5 | API Contract | 포트 수 상한(50) 초과 시 무음 절단 — `PORT_NOT_FOUND` 디버깅 어려워짐 | `shadow-workflow.ts` — `buildRuntimePorts` | `ShadowResult`에 `portsTruncated: true` 또는 경고 로그 추가 |
| 6 | Architecture | 백엔드 에러 코드 의미론이 UI 파일에 하드코딩 — `RECOVERABLE = new Set([...])` | `tool-call-badge.tsx:131` | `@/lib/api/assistant.ts`로 이동 또는 백엔드 응답에 `recoverable: true` 플래그 추가 |
| 7 | Side Effect | `ShadowResult.ports` 신규 필드가 프론트엔드 타입 선언에 반영 안 됨 | 프론트엔드 `AssistantToolCallRecord` result 타입 | `ports?: { outputs: ShadowRuntimePort[]; inputs: ShadowRuntimePort[] }` 명시적 추가 |
| 8 | Documentation | `system-prompt.spec.ts` 헤더 docblock이 ED-AI-40 이후와 반대 기술 — "get_node_schema 선행 호출 필수" (구 동작) 그대로 남음 | `system-prompt.spec.ts` 파일 상단 docblock 1번 항목 | "result.ports로 live 포트 id 공급, get_node_schema 불필요"로 수정 |
| 9 | Maintainability | `RECOVERABLE` Set이 함수 내부에 정의되어 렌더마다 인스턴스 재생성 | `tool-call-badge.tsx` — `mergeRecoveryGroups` 내부 | 모듈 최상위 `RECOVERABLE_ERROR_CODES` 상수로 이동 |
| 10 | Dependency | `ResolvedNodePorts` breaking change (`string[]` → `ShadowRuntimePort[]`) — diff 외 `as` 캐스트 소비자 미확인 | `shadow-workflow.ts` — `ResolvedNodePorts`, `NodePortResolver` | CI에서 `tsc --noEmit` 전체 통과 + `grep -r "NodePortResolver\|ResolvedNodePorts"` 결과 검증 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `buildRuntimePorts`가 배열 길이 무관 항상 `.slice()` 복사 — 99% 불필요 | `shadow-workflow.ts` — `buildRuntimePorts` | `length <= MAX ? array : array.slice(0, MAX)` 분기 |
| 2 | Performance | `portResolver`에서 label 없는 포트마다 빈 `{}` 생성 후 즉시 파기 | `workflow-assistant-stream.service.ts` — `portResolver` | 조건부 프로퍼티 할당 패턴 교체 |
| 3 | Performance | `t("...RetryRecovered")` 이 `retried=false` 배지에서도 무조건 호출 | `tool-call-badge.tsx` — `ToolCallBadge` | `retried && t(...)` 단락평가 |
| 4 | Testing | `add_node + NODE_NOT_FOUND` recovery 케이스 테스트 없음 — 의도적 지원 여부 불명확 | `tool-call-badge.test.ts` | 케이스 추가 또는 `RECOVERABLE`에서 `add_node` 경로 제외 |
| 5 | Testing | `remove_node + NODE_NOT_FOUND` recovery 경로 미검증 | `tool-call-badge.test.ts` | `remove_node → NODE_NOT_FOUND → 성공` 케이스 추가 |
| 6 | Testing | `toDesc` / `ids` 동일 헬퍼가 두 describe 스코프에서 중복 정의 | `shadow-workflow.spec.ts` | 파일 최상위 `toDesc` 하나로 통일 |
| 7 | API Contract | `port.type` 정규화 규칙(`system`/`control` → `data`) 인터페이스 주석에 미기재 | `shadow-workflow.ts` — `ShadowRuntimePort.type` | JSDoc에 "error 외 모든 타입을 data로 정규화" 명시 |
| 8 | API Contract | `portResolver` 미주입 시 `ports` 생략 — 프로덕션·테스트 응답 shape 불일치 | `shadow-workflow.ts` — `ShadowResult.ports?` | 스펙 주석에 "운영 경로에서 non-optional" 명시 |
| 9 | Architecture | `ResolvedNodePorts`가 검증 입력·LLM 응답 payload 이중 역할 | `shadow-workflow.ts` | JSDoc으로 이중 역할 명시; 규모 커지면 분리 검토 |
| 10 | Architecture | `mergeRecoveryGroups`가 인접 쌍만 처리 — 중간에 다른 call 끼면 축약 불가 | `tool-call-badge.tsx` | 현 스펙 범위 무방; JSDoc 경계 조건 설명 충분 |
| 11 | Maintainability | `isSameEditTarget`의 `add_node` label 매칭 주석이 "왜 label인지" 미설명 | `tool-call-badge.tsx` — `isSameEditTarget` | `LABEL_CONFLICT 가드가 label 유일성 보장하므로 안전` 주석 추가 |
| 12 | Maintainability | `{...(title ? { title } : {})}` 불필요한 conditional spread | `tool-call-badge.tsx` — `ToolCallBadge` 반환부 | `title={title}` 으로 단순화 |
| 13 | Documentation | `readEdgeEndpoint` 함수에 JSDoc 없음 — snake_case/camelCase 양쪽 수용 이유 비직관적 | `tool-call-badge.tsx` — `readEdgeEndpoint` | 한 줄 설명 주석 추가 |
| 14 | Requirement | `portResolver` 주입 상태에서 특정 노드 타입 `null` 반환 시 `ports` 생략 — LLM이 구분 불가 | `shadow-workflow.ts` — `buildRuntimePorts` | 의도적이면 문서 명시 |
| 15 | Side Effect | 히스토리 메시지 배지가 `mergeRecoveryGroups` 소급 재계산으로 변경됨 | `tool-call-badge.tsx` — `groupToolCalls` | 의도된 UX 개선; QA 시 기존 이력 렌더 확인 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **MEDIUM** | `update_node` ports 테스트 공백, 서비스 레이어 타입 계약 테스트 없음, 연속 복구 쌍 미검증 |
| Security | **LOW** | 포트 `label` sanitize 누락으로 간접 프롬프트 인젝션 표면 존재 |
| Performance | **LOW** | `RECOVERABLE` Set 함수 내 재생성, 무조건 `.slice()` 복사, 빈 `{}` 생성 |
| Architecture | **LOW** | `ResolvedNodePorts` 이중 역할, 백엔드 에러 코드 프론트엔드 하드코딩 |
| Dependency | **LOW** | breaking change — diff 외 소비자 tsc 검증 필요 |
| API Contract | **LOW** | 포트 상한 무음 절단, `port.type` 정규화 암묵적, breaking change |
| Documentation | **LOW** | `system-prompt.spec.ts` 헤더 docblock 미갱신 |
| Maintainability | **LOW** | `RECOVERABLE` 함수 내 정의, 테스트 헬퍼 중복 |
| Requirement | **LOW** | `update_node` ports 검증 누락, docblock 불일치 |
| Side Effect | **LOW** | 프론트엔드 타입 미갱신, `add_node` label 매칭 false-positive |
| Scope | **NONE** | 변경 범위 적절, 불필요한 파일 수정 없음 |
| Concurrency | **NONE** | 모든 변경이 동기/요청-로컬, 공유 가변 상태 없음 |
| Database | **NONE** | 인메모리/프론트엔드 범위, DB 무관 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경 전체가 인메모리 연산·프론트엔드 렌더링 범위에 국한 |
| Concurrency | 동기 순수 함수 또는 요청-로컬 객체, Node.js 단일 스레드 안전 |
| Scope | 무관한 리팩토링 없음, ED-AI-40 두 하위 기능에만 집중 |

---

## 권장 조치사항

1. **[즉시] 포트 `label` sanitize 적용** — `portResolver` 내 `sanitizeLlmProvidedString(p.label, 80)` 통과 후 삽입 (W-1)
2. **[즉시] `update_node` result.ports 테스트 3건 추가** — `add_node` 블록 mirror (W-2)
3. **[즉시] `system-prompt.spec.ts` 헤더 docblock 수정** — get_node_schema 필수 → 불필요로 정정 (W-8)
4. **[단기] 프론트엔드 타입 선언 보완** — `AssistantToolCallRecord` result에 `ports?` 추가 (W-7)
5. **[단기] `RECOVERABLE` 상수 모듈 최상위 이동** — Set 재생성 제거 + 계층 분리 시작점 (W-9 / W-6)
6. **[단기] CI `tsc --noEmit` + `grep NodePortResolver` 검증 추가** — breaking change 소비자 전수 확인 (W-10)
7. **[단기] `portResolver` 서비스 레이어 단위 테스트 추가** — `p.type` 정규화 로직 검증 (W-3)
8. **[단기] 연속 복구 쌍·`remove_node` recovery 테스트 추가** — 경계값 커버리지 보완 (W-4, INFO-5)
9. **[선택] `portsTruncated` 필드 추가** — 무음 절단 디버깅 개선 (W-5)
10. **[선택] 마이크로 성능 정리** — `.slice()` 조건부 분기, 빈 `{}` spread 제거, `title={title}` 단순화 (INFO 1·2·12)