파일 쓰기 권한이 필요합니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `multi_turn` 조건 없음 노드에서 `out` 포트 제거로 인한 기존 워크플로우 엣지 단절 위험, 테스트 커버리지 누락, 포트 로직 하드코딩 등 복합적 개선 사항 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `multi_turn` + 조건 없음 케이스에서 `out` 포트가 완전히 제거되어, 기존 저장된 워크플로우에서 해당 포트에 연결된 엣지가 즉시 dangling 상태가 됨. 스펙 마이그레이션 노트에 이 케이스가 누락됨 | `custom-node.tsx` outputs useMemo, `spec/4-nodes/3-ai-nodes.md` 마이그레이션 섹션 | 스펙 마이그레이션 섹션에 "기존 `multi_turn` ai_agent (조건 없음)의 `out` 포트 연결 엣지는 dangling 상태 — `user_ended` 또는 `max_turns`로 수동 재연결 필요" 추가. 운영 환경 데이터 존재 시 마이그레이션 스크립트 검토 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 코드 품질 | `mode` 변수가 `condPorts.length === 0` 분기 안과 밖에서 동일 표현식으로 두 번 선언됨. 한 쪽만 수정 시 버그 발생 위험 | `custom-node.tsx` ~L51, ~L63 | `useMemo` 블록 상단에서 한 번만 선언하여 공유 |
| 2 | 아키텍처 | AI Agent 포트 계산 로직이 프레젠테이션 컴포넌트 안에 하드코딩됨. OCP/SRP 위반 — 새 모드 추가 시 컴포넌트 수정 필요. 여러 노드 타입 분기가 단일 `useMemo` 안에 중첩되어 순환 복잡도 높음 | `custom-node.tsx` outputs useMemo 전체 | `getAiAgentOutputPorts(config)` 순수 함수로 분리하여 `node-definitions` 또는 별도 유틸로 이동 |
| 3 | 아키텍처 | 포트 타입(`"data" \| "system" \| "error"`)이 컴포넌트 파일 내 인라인으로만 존재하며 `node-definitions`의 포트 타입과 일관성 미보장 | `custom-node.tsx` 전반 | 공유 타입 파일에 `PortType`, `PortDef` 선언 후 컴포넌트와 정의 파일이 동일 타입 참조 |
| 4 | 의존성 | 조건 없음 케이스에서 `getNodeDefinition` 경유를 우회하고 포트를 하드코딩하여 SSOT 분리 위험 발생 | `custom-node.tsx` L53–62 | 포트 로직을 `node-definitions` 또는 전용 헬퍼로 이동하여 SSOT 유지 |
| 5 | 테스트 | `multi_turn` + 조건 있는 경우 테스트가 `handle-out` 부재와 `handle-cond-1` 존재만 검증. `handle-user_ended`, `handle-max_turns`, `handle-error` 미검증 — 구현 경로의 절반이 무방비 | `custom-node.test.tsx` "renders multi_turn ai_agent with conditions and no out port" | 3개 시스템 포트 존재 assertion 추가 |
| 6 | 테스트 | 조건 0개 테스트가 핸들 존재만 검증하며, 다중 출력 렌더링 경로 전환 시 표시되는 레이블 텍스트("User Ended", "Max Turns", "Error")를 미검증 | `custom-node.test.tsx` 조건 0개 케이스 2건 | 레이블 텍스트 렌더링 assertion 추가 |
| 7 | 문서화 | 스펙의 "포트 시각적 구분" 섹션이 "조건 ≥ 1인 경우"로 한정되어, 조건 0개일 때 `hasMultipleOutputs === true`로 다중 출력 레이아웃이 활성화되는 동작에 대한 설명 없음 | `spec/4-nodes/3-ai-nodes.md` "포트 시각적 구분" 섹션 | 조건 0개 케이스에서도 동일 규칙 적용됨을 명시 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `config: {}` (mode 키 없음) 케이스의 `?? "single_turn"` fallback 분기 미검증 | `custom-node.tsx` L47, `custom-node.test.tsx` | `config: {}` 케이스로 fallback 동작 검증 테스트 추가 |
| 2 | 문서화 | 스펙 마이그레이션 노트가 `timeout` 포트만 언급하고 `multi_turn` + `out` 포트 케이스 누락 | `spec/4-nodes/3-ai-nodes.md` 마이그레이션 섹션 | Critical #1과 연계하여 함께 보완 |
| 3 | 사이드이펙트 | `single_turn` + 조건 없음 케이스에서 `error` 포트 신규 추가 — 기존 노드 정의에 `error` 포함 여부에 따라 중복 가능 | `custom-node.tsx` single_turn 분기 | `getNodeDefinition("ai_agent")?.outputs` 원본 확인하여 중복/누락 검증 |
| 4 | 보안 | `data.config.mode`, `conditions` 등에 런타임 타입 검증 없는 `as` 캐스팅 — 외부 소스 데이터 오타입 시 런타임 오류 가능 | `custom-node.tsx` 전반 | `mode` 허용 목록 검증, `conditions` 항목 필드 런타임 가드 추가 권장 |
| 5 | 보안 | 알 수 없는 `mode` 값이 조용히 `single_turn`으로 폴백되어 잘못된 설정이 감지되지 않음 | `custom-node.tsx` L47 | 개발 환경에서 `console.warn` 또는 명시적 오류 발생 |
| 6 | 테스트 | 빈 id 필터링 테스트가 `single_turn`만 커버, `multi_turn` + 빈 id 케이스 명시적 검증 없음 | `custom-node.test.tsx` "filters out conditions with empty id" | 우선순위 낮음 — 동일 코드 경로이나 명시적 케이스 추가 고려 |
| 7 | 성능 | `useMemo` 의존성 배열에 `data.config` 전체 객체 포함 — 부모가 매 렌더마다 객체 재생성 시 불필요한 재실행 | `custom-node.tsx` L32 | 실제 사용 필드만 의존성 배열에 명시 (기존 설계 한계로 우선순위 낮음) |
| 8 | 아키텍처 | 테스트가 DOM 선택자(`data-testid`)로 포트를 검증하여 구현(Handle 컴포넌트)에 의존 — 렌더링 방식 변경 시 테스트 전체 깨질 수 있음 | `custom-node.test.tsx` 전반 | 포트 로직 순수 함수 분리 후 해당 함수 직접 단위 테스트 구조 개선 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM (운영 데이터 존재 시 HIGH) | `multi_turn` out 포트 제거로 기존 워크플로우 엣지 dangling |
| architecture | MEDIUM | 포트 로직 컴포넌트 하드코딩, OCP/SRP 위반, 타입 추상화 불완전 |
| testing | MEDIUM | `multi_turn` + 조건 있는 경우 시스템 포트 미검증, 레이블 텍스트 미검증 |
| documentation | LOW | 조건 0개 케이스 시각적 구분 스펙 누락 |
| maintainability | LOW | `mode` 중복 선언, useMemo 복잡도 |
| dependency | LOW | SSOT 분리 — 포트 로직이 node-definitions와 독립화 |
| requirement | LOW | mode 폴백 경로 테스트 누락 |
| scope | LOW | backward compatibility 파괴 (의도된 변경) |
| security | LOW | 런타임 타입 검증 부재, 알 수 없는 mode 값 조용한 폴백 |
| performance | NONE | mode 중복 선언 (기능 문제 아닌 코드 품질) |

---

## 발견 없는 에이전트

- **database** — 변경사항이 DB와 무관한 순수 프론트엔드 컴포넌트
- **api_contract** — REST API 엔드포인트/요청·응답 구조와 무관
- **concurrency** — `useMemo` 내 순수 동기 연산만 사용, 동시성 요소 없음

---

## 권장 조치사항

1. **[스펙 즉시 수정]** `spec/4-nodes/3-ai-nodes.md` 마이그레이션 섹션에 `multi_turn` + 조건 없음의 `out` 포트 제거로 인한 엣지 dangling 주의사항 추가. 운영 환경 워크플로우 데이터 존재 시 마이그레이션 스크립트 검토
2. **[테스트 보강]** `multi_turn` + 조건 있는 경우 테스트에 `handle-user_ended`, `handle-max_turns`, `handle-error` 존재 assertion 추가
3. **[테스트 보강]** 조건 없는 케이스 테스트에 다중 출력 레이블 텍스트 렌더링 assertion 추가
4. **[코드 정리]** `mode` 변수 중복 선언 제거 — `useMemo` 블록 상단에서 한 번만 선언
5. **[스펙 보완]** "포트 시각적 구분" 섹션에 조건 0개 케이스도 동일 규칙 적용됨을 명시
6. **[테스트 추가]** `config: {}` (mode 미설정) 케이스의 `single_turn` 폴백 동작 검증 테스트 추가
7. **[중장기 리팩토링]** `getAiAgentOutputPorts(mode, conditions)` 순수 함수를 `node-definitions` 또는 별도 유틸로 분리하여 SSOT 유지 및 컴포넌트 책임 분리. `PortType`, `PortDef` 공유 타입 파일로 통일