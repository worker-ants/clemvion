파일 저장 권한이 필요합니다. 아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Merge 노드 포트 ID 변경(`in_0`/`in_1` → `in`)으로 인해 기존 저장된 워크플로우 데이터가 파손될 수 있으며, 마이그레이션 없이 배포 시 즉각적인 데이터 손상이 발생함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하위 호환성 / 데이터 파손 | 포트 ID가 `in_0`/`in_1` → `in`으로 변경되어, 기존 저장된 워크플로우의 엣지 데이터가 존재하지 않는 포트를 참조하게 됨. 마이그레이션 없이 배포 시 즉시 파손 (dangling edge / silent drop) | `index.ts` merge 노드 inputs 정의, DB 저장 워크플로우 엣지 데이터 | 배포 전 `in_0`/`in_1` → `in` 엣지 포트 ID 변환 DB 마이그레이션 스크립트, 또는 캔버스 로드 시 레거시 포트 ID 자동 변환 호환성 레이어 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 미구현 기능 | 스펙(§11)에 정의된 `partialOnTimeout` 필드가 `MergeConfig` UI에 없음. 타임아웃 시 `MERGE_TIMEOUT` 에러 발생 여부를 제어하는 중요한 동작 분기 필드 | `logic-configs.tsx` MergeConfig | `CheckboxField`로 `partialOnTimeout` 추가, 또는 스펙에 미구현 상태 명시 |
| 2 | 테스트 누락 | `validate` 테스트에 `timeout <= 0` 검증 없음. `execute`에 `partialOnTimeout=true/false` 시나리오 없음. 스펙 핵심 동작 미검증 | `merge.handler.spec.ts` validate/execute 블록 | `timeout` 음수·0 검증, `MERGE_TIMEOUT` 에러, 부분 병합 케이스 추가 |
| 3 | 보안 | `merge_object` 전략 shallow merge 시 `__proto__`/`constructor`/`prototype` 키를 통한 Prototype Pollution 가능. 스펙에 방어 요구사항 미명시 | `merge.handler.ts` 구현, `merge.handler.spec.ts` merge_object 테스트 | `Object.create(null)` 기반 차단 키 필터 적용, 방어 테스트 케이스 추가 |
| 4 | 캔버스 요약 모호성 | `{N} inputs · {strategy}` 포맷에서 `inputCount` 제거 후 N 산출 기준이 미정의 | `spec/4-nodes/1-logic-nodes.md` §13 | "N = 연결된 엣지 수(런타임 집계)" 명시 또는 포맷 변경 |
| 5 | 계약 공백 | 단일 `in` 포트 다중 엣지 수신 시 핸들러에 전달되는 입력 형태(`{ [sourceNodeId]: data }`)가 스펙에 미명시. 테스트가 암묵적으로 의존 | `spec/4-nodes/1-logic-nodes.md` §11, `merge.handler.spec.ts` | 스펙 또는 실행 엔진 스펙에 입력 전달 계약 명시, 타입 반영 |
| 6 | 테스트 | `strategy: first` 테스트가 알파벳 정렬로 도착 순서를 시뮬레이션하나 실제 병렬 실행에서의 비결정적 순서와 갭 존재 | `merge.handler.spec.ts` `strategy: first` | 도착 순서 계약을 스펙에 명시, 별도 테스트 추가 |
| 7 | 테스트 | `context` 객체가 `ExecutionContext` 인터페이스의 필수 필드를 누락할 수 있으며 타입 단언으로 은폐될 위험 | `merge.handler.spec.ts:10-15` | `ExecutionContext` 정의 기준으로 필수 필드 포함 여부 검토 |
| 8 | 스펙-테스트 불일치 | `indexed` 출력 키가 스펙은 `{ "0": ... }` 숫자 키, 테스트는 `{ in_0: ... }` 형태로 불일치 | `merge.handler.spec.ts:135-140`, 스펙 indexed 예시 | 스펙과 테스트 중 하나를 기준으로 통일 |
| 9 | 테스트 | `append` 전략 테스트가 `wait_all`과 동일한 결과만 검증. 스펙상 "도착 순서대로 배열에 추가" 차별점 미검증 | `merge.handler.spec.ts:120-126` | 차이가 없다면 스펙에서 전략 통합 또는 동일 처리 이유 명시 |
| 10 | 동시성 | 모든 테스트가 입력을 미리 집계된 객체로 전달. 실제 병렬 브랜치 비동기 도착 시 내부 버퍼 경쟁 조건 미검증 | `merge.handler.spec.ts` execute 블록 | 실행 엔진이 입력 집계 후 단일 호출하는 계약 문서화 또는 원자적 누적 로직 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 레거시 데이터 | 기존 저장된 config의 `inputCount` 필드가 무시되나 쓰레기 데이터로 잔존 | DB 저장 config | 마이그레이션 스크립트에서 함께 제거 |
| 2 | 구현 확인 | `merge.handler.ts` 변경이 git status에 없음. TDD 순서라면 정상이나 실제 반영 여부 확인 필요 | `merge.handler.ts` | 단일 `in` 포트 기반 입력 처리 로직 반영 여부 검토 |
| 3 | 문서화 | 정렬 기반 결정론 테스트에 정렬 근거 주석 없음 | `merge.handler.spec.ts` sort 테스트 | "소스 노드 ID 알파벳순 정렬로 동일한 출력 순서 보장" 주석 추가 |
| 4 | 테스트 | `MergeConfig` 컴포넌트 렌더링 회귀 테스트 없음 | `logic-configs.tsx` MergeConfig | 컴포넌트 렌더링 테스트 추가 검토 |
| 5 | 테스트 | `node-definitions/index.ts` inputs 배열 변경에 대한 구조 검증 테스트 없음 | `index.ts` merge 노드 정의 | `getNodeDefinition('merge')` inputs/outputs 검증 테스트 추가 검토 |
| 6 | 문서화 | 다중 엣지 집약 메커니즘 설명 없음. 실행 엔진이 어떻게 핸들러에 전달하는지 불명확 | `spec/4-nodes/1-logic-nodes.md` §11 | 실행 엔진 스펙 참조 링크 또는 "keyed object 형태로 집약" 설명 추가 |
| 7 | 성능 | `Object.keys` 정렬 O(N log N). 실사용 수십 개 범위에서는 무시 가능 | `merge.handler.ts` | 대규모 확장 시 `Map` 삽입 순서 보존 검토 |
| 8 | 보안 | 입력 객체 키를 소스 노드 ID로 신뢰하나 형식 검증 없음. 내부 생성 데이터라면 위협도 낮음 | `merge.handler.ts` | 외부 입력 가능성이 있다면 노드 ID 형식 검증 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | **HIGH** | 포트 ID 변경으로 기존 워크플로우 데이터 즉시 파손 위험 |
| api_contract | **MEDIUM** | 저장된 워크플로우 엣지 하위 호환성 파손, 실행 엔진 입력 계약 공백 |
| requirement | **MEDIUM** | `partialOnTimeout` UI 누락, timeout 테스트 미검증, 캔버스 요약 N 모호성 |
| concurrency | **MEDIUM** | `first` 전략 비결정적 순서, 부분 도착 안전성, timeout 완전 미검증 |
| security | **LOW** | `merge_object` Prototype Pollution, timeout 서버사이드 검증 누락 |
| architecture | **LOW** | 실행 엔진 입력 계약 미문서화, `append` 재정의 필요, indexed 키 불일치 |
| testing | **LOW** | timeout/partialOnTimeout 테스트 누락, first+non-array 조합 미검증 |
| documentation | **LOW** | `partialOnTimeout` 미구현 여부 불명확, 캔버스 요약 모호성 |
| maintainability | **LOW** | 입력 키 정렬 암묵적 가정, `append` 차별성 부재, 캔버스 요약 불일치 |
| scope | **LOW** | timeout/partialOnTimeout 테스트 누락, `merge.handler.ts` 변경 여부 불명확 |
| performance | **NONE** | 단일 포트 전환으로 오버헤드 제거 — 긍정적 변경 |
| dependency | **NONE** | 신규 외부 의존성 없음, 기존 import 유효 |
| database | **NONE** | 데이터베이스 레이어와 무관한 변경 |

---

## 발견 없는 에이전트
- **database** — 데이터베이스 스키마/쿼리/ORM과 무관한 변경
- **dependency** — 신규 패키지 없음, 모든 import 유효, dead import 없음
- **performance** — 동적 포트 관리 오버헤드 제거로 성능 향상

---

## 권장 조치사항

1. **[즉시 필수]** 기존 워크플로우 데이터 마이그레이션 — `in_0`/`in_1` 엣지를 `in`으로 변환하는 DB 마이그레이션 스크립트 또는 캔버스 로드 시 레거시 포트 ID 자동 변환 호환성 레이어 구현. **이 조치 없이 배포 불가.**
2. **[고우선]** `partialOnTimeout` UI 필드 추가 또는 스펙에 미구현 명시.
3. **[고우선]** `merge.handler.spec.ts` 테스트 보강 — `timeout` 유효성 검증, `partialOnTimeout` 분기별 동작 케이스 추가.
4. **[고우선]** `merge_object` Prototype Pollution 방어 — 구현에 차단 키 필터 적용, 방어 테스트 추가.
5. **[보통]** 스펙 보강 — 실행 엔진 다중 엣지 입력 계약 명시, `indexed` 키 명명 통일, 캔버스 요약 N 산출 기준 명시.
6. **[보통]** `append` 전략 재정의 또는 `wait_all`과 통합.
7. **[낮음]** 테스트 주석 보강 — 정렬 근거 및 실행 엔진 입력 전제 명시.
8. **[낮음]** `merge.handler.ts` 구현 검토 — 단일 포트 기반 입력 처리 로직 반영 여부 확인.