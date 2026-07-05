### 발견사항

- **[INFO]** `parseRequiredParamsFromMarkdown` 단위 테스트 부재 — 파서 로직에 직접 대응하는 격리 단위 테스트가 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-required-fields.spec.ts:170-201` (`parseRequiredParamsFromMarkdown`, export 됨)
  - 상세: 함수가 `export` 되어 재사용 가능하도록 설계되어 있음에도, 실제 카탈로그 markdown 파일 485개 op 전수를 실행해 간접적으로만 검증한다(`loadDocsRequired` → `beforeAll`). 파서 자체의 회귀(예: 다중 `|` 포함 셀, 필수 컬럼에 "✓(조건부)" 같은 변형 텍스트, 여러 `####` 서브섹션이 있는 op, `필수` 컬럼이 아예 없는 표 등)는 전체 카탈로그가 우연히 그 패턴을 포함하지 않으면 놓칠 수 있다. 자매 파일 `catalog-docs-drift.spec.ts` 의 `normPath` 도 유사하게 fixture 기반 단위 테스트 없이 실전 데이터로만 검증되는 기존 관례를 따른 것으로 보이나(일관성 있음), 정규식 기반 마크다운 파서라는 특성상 회귀 시 실패 지점이 "어느 op 누락"으로만 드러나 원인 진단이 어려움.
  - 제안: 인라인 markdown 문자열 fixture로 `parseRequiredParamsFromMarkdown` 의 엣지 케이스(다중 op heading, Response 표 오인식 방지, 빈 필수 컬럼, 셀 내부 백틱/파이프)를 직접 검증하는 소규모 단위 테스트를 추가하면 향후 회귀 시 디버깅이 쉬워진다. 다만 기존 `catalog-docs-drift.spec.ts` 컨벤션과 일치하는 선택이므로 CRITICAL/WARNING 아님.

- **[INFO]** "fail-loud" 카운트 임계치(`toBeGreaterThan(80)`)가 다소 느슨한 회귀 가드
  - 위치: `catalog-required-fields.spec.ts:223-228`
  - 상세: `parseRequiredParamsFromMarkdown` 이 조용히 깨져서(예: 정규식이 매치 실패) 파싱 결과가 급감해도 80개 초과라는 넓은 하한선만 넘으면 테스트가 그린으로 남을 수 있다. 실제로는 (커밋 메시지 기준) 262건 검출/보강이 있었으므로 현재 파싱 총량은 80보다 훨씬 크다 — 임계치가 실질적으로 헐거움.
  - 제안: 현재 값에 더 가까운 임계치(예: 200) 또는 스냅샷 방식으로 파싱 총량을 고정하면 파서 퇴행을 더 민감하게 잡을 수 있다. 우선순위는 낮음 — CI 게이팅 목적의 "완전 파싱 실패" 방지용 sanity check 로는 현재도 기능함.

- **[INFO]** `fields`에 존재하지 않는 docs-필수 파라미터는 검증에서 제외되는 설계 — 의도적이나 회귀 감지 범위의 경계
  - 위치: `catalog-required-fields.spec.ts:141-144` (docstring), `375-380` (`if (fieldKeys.has(f) && !req.has(f))`)
  - 상세: "fields 에 없는 docs-필수 파라미터는 검증 대상에서 제외"라는 설계는 문서화되어 있고 합리적이지만(미노출 필드까지 강제하면 오탐 유발), 이는 "필드를 아예 안 넣어서 회피"하면 이 가드를 우회할 수 있다는 의미이기도 하다. 이번 diff 범위 내에서 그런 패턴은 관찰되지 않았고, `metadata.spec.ts` 의 subset 불변식과 결합하면 실질적으로 완화된 리스크이므로 CRITICAL 아님. 향후 필드 축소(field 제거)가 requiredFields 완화의 우회 경로가 될 수 있다는 점만 인지해두면 됨.
  - 제안: 별도 조치 불필요. 문서화된 트레이드오프로 수용 가능.

- **[INFO]** 메타데이터 데이터 파일(application.ts, category.ts, collection.ts, community.ts, design.ts, mileage.ts, notification.ts, order.ts, personal.ts, privacy.ts 등) 자체는 순수 데이터 리터럴 변경 — 별도 단위 테스트 불필요, 신규 spec 이 유일하고 적절한 커버리지 경로
  - 위치: 각 리소스 metadata 파일의 `requiredFields` 배열 확장
  - 상세: 변경은 로직이 아닌 선언적 데이터(배열 원소 추가)이므로, 개별 파일에 대한 전용 유닛 테스트보다 전수(全數) cross-cutting 가드가 훨씬 효율적인 테스트 전략이다. 이번 PR 이 그 방식(485 op 전수 검증)을 택한 것은 테스트 설계 관점에서 적절하다 — 각 파일마다 별도 assertion 을 만드는 대신 공용 규약 위반을 잡는 archtest 스타일 가드.
  - 제안: 없음 — 이미 적절.

- **[INFO]** 기존 `metadata.spec.ts` (subset 불변식: requiredFields ⊆ fields) 와 신규 spec 이 상호 보완적이나 교차 의존 문서화만 존재, 실행 순서/격리는 독립적으로 보장됨
  - 위치: `catalog-required-fields.spec.ts:130-137` (docstring 이 `catalog-docs-drift.spec.ts`/`metadata.spec.ts` 역할 분담을 명시)
  - 상세: 세 스펙(`metadata.spec.ts`, `catalog-docs-drift.spec.ts`, `catalog-required-fields.spec.ts`)이 서로 다른 불변식을 검증하며 각각 `beforeAll` 로 자체 로딩하므로 테스트 간 상태 공유나 실행 순서 의존성이 없다. `import { normPath } from './catalog-docs-drift.spec.js'` 재사용은 함수 재사용일 뿐 side-effect 공유가 아니므로 격리에 문제없음. Jest 가 `catalog-docs-drift.spec.js` 파일을 import 할 때 그 파일의 `describe`/`it` 블록도 모듈 평가 시 등록되지만, 이는 해당 파일이 자체 테스트 파일로도 별도 수집되므로 실질적 중복 실행 이슈는 없음(node/ts-jest 모듈 캐싱 정상 동작 전제).
  - 제안: 없음 — 정상 설계. 다만 향후 `catalog-docs-drift.spec.ts` 파일명이 변경되면 이 import 가 깨지므로, 재사용 유틸(`normPath`)을 별도 non-spec 모듈로 뽑아내는 리팩터를 고려할 수 있음(우선순위 낮음, 현재 문제 아님).

### 요약
신규 `catalog-required-fields.spec.ts` 는 485개 cafe24 operation 전수에 대해 "docs 필수(✓) ∩ fields ⊆ requiredFields" 불변식을 강제하는 회귀 가드로, 실제 실행 결과 12/12 통과하며 기존 metadata 스위트 117개 테스트도 모두 통과해 회귀가 없음을 확인했다. 데이터 전용 diff(각 리소스 metadata 파일의 requiredFields 배열 확장)에 대해 개별 유닛 테스트를 추가하는 대신 전수 cross-cutting 가드 하나로 커버하는 전략은 테스트 용이성과 유지보수성 면에서 적절하며, 기존 `catalog-docs-drift.spec.ts`/`metadata.spec.ts` 와의 역할 분담도 docstring 으로 명확히 문서화되어 있다. 다만 마크다운 파서(`parseRequiredParamsFromMarkdown`) 자체는 실전 카탈로그 데이터로만 간접 검증되고 격리된 fixture 기반 단위 테스트가 없어, 정규식 파싱 로직이 은밀하게 퇴행할 경우 진단이 어려울 수 있다는 점과 fail-loud 카운트 임계치(80)가 실제 파싱량 대비 느슨하다는 점은 개선 여지가 있으나 모두 INFO 수준이다.

### 위험도
LOW
