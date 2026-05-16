# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
작업: `Cafe24Config` fields "추가" 버튼 버그 수정 — `KeyValueEditor` 빈 key 행 유지를 위한 내부 React state 도입

---

## 발견사항

### [INFO] `fields` 지역 변수와 신규 draft state 명칭 주의

- **target 신규 식별자**: 구현 시 `Cafe24Config` 내부에 도입될 keyvalue draft용 React state 변수 (구체적 이름은 아직 미정 — 예: `localRows`, `kvRows`, `draftRows` 등)
- **기존 사용처**: `integration-configs.tsx:297` — `const fields = normalizeCafe24Fields(config.fields)` 로 이미 `fields` 라는 지역 변수가 선언됨. `config.fields` 는 백엔드 계약 키명(`Record<string,unknown>`)으로 spec과 DB schema에서 고정.
- **상세**: 신규 React state를 `fields` 또는 `setFields` 로 명명하면 기존 지역 변수 `const fields`와 동일 스코프에서 선언 충돌이 발생한다. TypeScript/ESLint 는 same-scope 재선언을 컴파일 에러로 거부하므로 실수로 같은 이름을 쓰면 즉시 빌드 실패가 난다. 다만 스펙 레벨의 식별자 충돌은 아니며 런타임 혼선 위험도 없다.
- **제안**: draft state는 `localRows` 또는 `fieldRows`처럼 기존 `fields` 변수와 명확히 구분되는 이름을 채택한다. `useState<{ key: string; value: string }[]>` 형태로 초기화하고, `useEffect` 또는 controlled pattern으로 `config.fields` 와 동기화. 기존 `const fields` 선언은 draft state로 교체하거나 제거해 스코프 내 의미 중복을 없앤다.

---

### [INFO] `normalizeCafe24Fields` 함수 — 신규 state 도입 후 역할 재검토

- **target 신규 식별자**: 신규 React state 도입 시 `normalizeCafe24Fields` 의 호출 위치·시점이 변경됨
- **기존 사용처**: `integration-configs.tsx:270-293` — `normalizeCafe24Fields(config.fields)` 를 매 렌더마다 호출하여 `fields` 배열을 파생함
- **상세**: draft state 패턴을 도입하면 `normalizeCafe24Fields` 는 초기화(mount 시) 또는 외부 props 변경 시에만 호출하게 된다. 함수 이름 자체의 충돌은 없으나, 동일 이름 함수가 다른 역할(전체 렌더 파생 vs 초기화 전용)로 쓰이면 읽는 사람에게 혼동을 줄 수 있다.
- **제안**: 함수 이름은 그대로 유지하되, 사용 시점을 `useState` 초기값(`useState(() => normalizeCafe24Fields(config.fields))`) 또는 `useEffect` 내에서 명시적으로 제한해 역할을 명확히 한다.

---

## 종합 평가

이번 구현은 프론트엔드 컴포넌트 내부의 React state 패턴 변경으로, 스펙 레벨 식별자(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로)의 신규 도입이 전혀 없다. 백엔드 계약(`config.fields: Record<string,unknown>`)과 spec(`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)은 그대로 보존된다. 유일한 주의 사항은 `Cafe24Config` 내부 스코프에서 기존 `const fields` 지역 변수와 신규 draft state 이름이 충돌하지 않도록 하는 것으로, 이는 TypeScript 컴파일러가 즉시 잡아주므로 실질 리스크는 낮다. 명확한 이름(예: `localRows`)을 처음부터 선택하면 혼동 없이 구현 가능하다.

## 위험도

NONE
