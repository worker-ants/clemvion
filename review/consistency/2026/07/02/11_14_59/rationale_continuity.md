### 발견사항

- **[INFO]** 실행 엔진 spec Rationale 의 "(C-1·M-7)" 레이블이 이번 PR 의 M-7 과 다른 변경을 가리킴
  - target 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts` (신규 유틸), `execution-engine.service.ts:1475` (단일 전환 사이트)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "continuation publish 실패 동기 surface 통일 (C-1·M-7)" 항목
  - 상세: spec Rationale 의 "(C-1·M-7)" 항목은 `nextSeq` Redis INCR 실패 시 `Math.random` fallback 제거(fail-fast 전환)를 M-7 로 기록하고 있다. 그런데 현재 worktree 이름(`refactor-03-m7-type-assertions`) 및 `plan/in-progress/refactor/03-maintainability.md` 의 M-7 항목은 "execution-engine 내 inline 타입 단언 50+ 곳" 리팩토링을 M-7 로 정의한다. 두 의미의 M-7 이 spec Rationale 에서 단일 항목으로 혼재해 사후 추적 시 혼선 가능성이 있다.
  - 제안: 본 PR 이후 spec Rationale 에 "(C-1·M-7) 타입 단언 리팩토링 첫 클러스터 (`toRecord` 유틸)" 보조 항목을 짧게 추가하거나, 기존 항목 헤더를 "(C-1·M-7[seq])·(M-7[type-assert])" 형태로 분리 표기해 레이블 이중 참조를 명시하면 충분하다. 동작 보존 변경이므로 새 Rationale 절 신설은 필수가 아니다.

### 요약

이번 PR 은 `utils/to-record.ts`(`isRecord`/`toRecord` 가드) 신규 유틸과 `execution-engine.service.ts:1475` 단일 SAFE-TORECORD 사이트 전환으로 구성되며, 동작-보존(property 접근 전용 사이트에서 배열·원시값의 property 접근 결과가 기존 `as` 통과 후 접근과 동일) 리팩토링이다. `plan/in-progress/refactor/03-maintainability.md` M-7 권장안 C("없으면 가드로 시작해 점진 승격")를 따르며, 기각된 대안(Option A 일괄 zod safeParse, Option B 가드만 고정)을 재도입하지 않는다. 엔진 spec Rationale 에 명시된 설계 원칙(invariant I-1 status 유니온 불변, I-5 `_resumeCheckpoint`/`_retryState` credential allow-list, I-6 §4.4 WebsocketService canonical sink, I-7 raw/resolved config 분리, W-2/W-3 에러코드·버전상수 통합 금지)은 전혀 영향받지 않는다. 유일한 Rationale 연속성 이슈는 spec Rationale 의 "(C-1·M-7)" 레이블이 INCR fail-fast 변경을 가리키는 반면 본 PR 이 동일 레이블 공간의 새 클러스터를 시작한다는 추적성 모호함뿐이며, 이는 INFO 수준이다.

### 위험도

LOW
