# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/4-nodes/5-data/` (0-common.md · 1-transform.md · 2-code.md)
검토일: 2026-06-12

---

## 발견사항

### [INFO] `spec/4-nodes/0-overview.md §5` 메모리 제한이 env 조정 가능성을 누락

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7.2` — "기본 128MB 하드 리밋 (env 조정 가능)", `CODE_NODE_MEMORY_LIMIT_MB` env 로 최대 512MB 까지 clamp 조정 가능하다고 정의
- **충돌 대상**: `spec/4-nodes/0-overview.md §5` — `code` 노드 메모리 제한을 "isolate `memoryLimit: 128`(MB) 하드 리밋"으로만 기술하고 env 변수 및 512MB clamp 상한에 대한 언급 없음
- **상세**: 두 spec 이 모순은 아니지만, `0-overview.md §5` 가 "128 고정"으로 읽히는 반면 `2-code.md §7.2` 는 운영자 env 변수로 조정 가능한 것으로 정의한다. 구현자가 `0-overview.md` 만 참고하면 env 변수 반영을 생략할 수 있다.
- **제안**: `spec/4-nodes/0-overview.md §5` 메모리 제한 행을 "기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 로 운영자 조정 가능 (상한 512MB clamp)"으로 동기화.

---

### [INFO] `spec/5-system/5-expression-language.md §8.3.3` `$vars` 자동완성 참조 항목과 Code 노드 컨텍스트 객체 기술 불일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §2.1` — `$vars` 를 "워크플로우 변수 (읽기/쓰기)" 로 정의. `§4.5` 에서 deep clone + 전체 교체 메커니즘을 상세 기술
- **충돌 대상**: `spec/5-system/5-expression-language.md §8.4.2` 자동완성 표 — `$var.` (점 포함) 형식으로 "선언된 변수 목록" 을 제안하는 것으로 기술되어 있으나, Code 노드 내부에서 변수 접근은 `$vars` (복수형, 전체 객체) 로 다른 노드의 `$var.name` 표현식 형식과 다름. Code 노드 내에서 `$var.` 자동완성 입력이 의미 없다는 점에 대한 명시적 정의가 없음
- **상세**: 이 항목은 Code 노드 에디터에서 `$var.` 자동완성이 잘못 동작하거나 혼란을 줄 수 있는 가능성을 시사한다. Code 노드는 Monaco 에디터를 사용하며 (§2) `$input`, `$vars`, `$execution`, `$node`, `$helpers` 를 자동완성으로 지원한다고 명시하나, 표현식 언어 자동완성 팝업의 `$var.` 제안과의 관계가 불명확하다.
- **제안**: `spec/4-nodes/5-data/2-code.md §2` 에 "Code 노드 Monaco 에디터의 자동완성은 Code 노드 전용 컨텍스트(`$vars` 등)를 지원하며, 표현식 언어의 `$var.` 자동완성 팝업은 Code 에디터 내에서는 적용되지 않는다" 는 명시 추가를 검토. 또는 `spec/5-system/5-expression-language.md §8.4.2` 에 Code 노드 제외 주석 추가.

---

### [INFO] `spec/conventions/node-output.md Principle 2` Code 계열 `meta.logs` 필드명이 target 과 정합하나, 선택/권장 지위를 명확히 할 필요 있음

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.1, §5.3` — `meta.success`, `meta.logs` 를 Code 노드 전용 반환 필드로 명시
- **충돌 대상**: `spec/conventions/node-output.md Principle 2` 표 — Code 계열 항목: `meta.durationMs`, `meta.success`, `meta.logs?` (logs 는 `?` 선택) 로 기술
- **상세**: target (`2-code.md §5.1`) 예시는 `"logs": []` 를 항상 포함하는 형태로 제시한다. `node-output.md` 의 `?` 표기는 "logs 가 있을 수도 없을 수도 있음"을 암시하나, Code 핸들러가 항상 `logs` 배열(비어있을 때도 `[]`)을 반환한다면 두 spec 간 표기 방식이 다르다. 모순은 아니지만 구현자가 `logs` 생략 가능으로 오해할 수 있다.
- **제안**: 의도를 명확히 하려면 `node-output.md Principle 2` 의 Code 행에 `meta.logs` 를 `(항상 빈 배열 포함)` 주석으로 명시하거나, `2-code.md` 에 `logs` 가 항상 배열임을 보장한다는 문구 추가.

---

### [INFO] `spec/4-nodes/0-overview.md §2.5` Code 노드 출력 포트를 "2" 로 단순 기술 — target 과 레이블 차이

- **target 위치**: `spec/4-nodes/5-data/2-code.md §3.2` — 출력 포트를 `success` / `error` 두 개로 명시
- **충돌 대상**: `spec/4-nodes/0-overview.md §2.5` 데이터 노드 목록 표 — Code 노드의 출력을 "2" 로만 기술하고 포트 라벨(`success`/`error`)을 명시하지 않음. Transform 노드는 "1" 로 표기
- **상세**: 포트 수만 표기하는 것은 요약 테이블 수준에서 허용되지만, 다른 노드들(예: `http_request` — "2 (success/error)")은 포트 라벨까지 명시하는 패턴을 사용해 일관성 차이가 있다.
- **제안**: `spec/4-nodes/0-overview.md §2.5` Code 행의 출력 포트를 "2 (success/error)" 로 동기화.

---

## 요약

`spec/4-nodes/5-data/` (0-common.md · 1-transform.md · 2-code.md) 는 다른 영역 spec 과 **직접적으로 모순되는 항목이 없다**. 데이터 모델(5필드 규약 Principle 0), API 계약(포트 라벨·에러 코드 정규화 매핑), 권한·RBAC 모델, 상태 전이 규칙, 계층 책임 분할 모두 기존 spec (node-output.md, error-codes.md §4, 0-overview.md, 1-data-model.md) 과 일관되게 정렬되어 있다. 발견된 항목들은 모두 INFO 등급 — 동기화 권장 수준의 누락 또는 표기 비일관성이며, 구현 착수를 차단하는 수준의 충돌은 없다.

---

## 위험도

LOW
