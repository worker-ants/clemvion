### 발견사항

- **[INFO]** requiredFields 배열이 최대 15개 항목까지 늘어나 인라인 배열 리터럴 가독성 저하
  - 위치: `order.ts` `subscription/shipments` POST(`requiredFields` 15개), `promotion.ts` `serialcoupons` POST(11개), `store.ts` `subscription/shipments/setting` PUT(6개)
  - 상세: 순수 데이터 배열이라 로직 복잡도는 없으나, 항목 수가 늘어날수록 어떤 필드가 왜 필수인지 한눈에 파악하기 어려움. 특히 `order.ts` 의 `subscription/shipments` 케이스는 12개 이상 필드가 나열되어 있어 리뷰 시점에 개별 필드의 타당성을 검증하기 부담스러움.
  - 제안: 현재 구조(문자열 배열)가 프로젝트 전역 컨벤션(`Cafe24OperationMetadata.requiredFields: string[]`)과 일치하므로 구조 변경은 불필요. 다만 필드 수가 많은 op 에 한해 `// docs 필수: ...` 형태의 인라인 주석으로 근거를 남기면 향후 유지보수(왜 이 필드가 required 인지) 시 docs 재조회 비용을 줄일 수 있음(선택적 개선, 강제 아님).

- **[INFO]** `catalog-required-fields.spec.ts` 의 정규식 기반 markdown 파싱이 다소 밀도 높은 단일 함수(`parseRequiredParamsFromMarkdown`)에 집중
  - 위치: `catalog-required-fields.spec.ts:170-201`
  - 상세: heading 탐색 → section 절취 → Request 표 블록 절취 → 행 파싱까지 하나의 함수에서 4단계 책임을 처리. 각 단계가 정규식과 인덱스 슬라이싱으로 얽혀 있어 초기 파악에 시간이 걸림. 다만 자매 파일 `catalog-docs-drift.spec.ts` 의 `normPath` 를 재사용하는 등 기존 파싱 패턴과의 일관성은 양호하고, 주석(JSDoc)이 각 단계의 의도를 잘 설명하고 있어 실질적 문제는 낮음.
  - 제안: 필요 시 `extractRequestSection(section)` 같은 헬퍼로 표 절취 로직만 분리하면 단위 테스트 및 재사용성이 개선되나, 현재 규모(단일 파일, 130줄)에서는 필수는 아님.

- **[INFO]** `resolveRepoRoot()` 의 fallback 경로가 상대 경로 세그먼트 7단(`'..'` x 7) 하드코딩
  - 위치: `catalog-required-fields.spec.ts:147-156`
  - 상세: `git rev-parse` 실패 시 fallback 으로 `__dirname` 기준 7단계 상위 경로를 사용. 매직 넘버는 아니지만 디렉터리 깊이가 암묵적으로 하드코딩되어 있어, 파일이 이동되면 조용히 깨질 수 있음. 다만 이는 신규 코드가 아니라 기존 `catalog-docs-drift.spec.ts` 등에서 이미 쓰이던 패턴을 답습한 것으로 보이며(일관성 유지 목적), 신규 결함이 아님.
  - 제안: 없음(기존 컨벤션 답습, 별도 리팩터 불필요).

- **[INFO]** 신규 가드 테스트의 `expect(withReq).toBeGreaterThan(80)` 임계값이 매직 넘버
  - 위치: `catalog-required-fields.spec.ts:223-228`
  - 상세: "fail-loud" 목적의 파싱 건전성 체크로, `80` 이라는 값의 근거가 코드에 없음(테스트 이름의 "non-trivial number" 주석만 있음).
  - 제안: 경미한 사항. 필요하다면 주석에 "485 개 op 중 최소 80개는 docs 필수 파라미터를 가진다는 관찰치 기반 하한"이라는 근거를 한 줄 추가하면 다음 유지보수자가 임계값 조정 여부를 판단하기 쉬움.

- **[INFO]** 6개 리소스 파일에 추가된 모듈 docstring 이 완전히 동일한 템플릿(리소스명만 치환)
  - 위치: `notification.ts:4-12`, `order.ts:4-12`, `privacy.ts:5-13`, `salesreport.ts:4-12`, `store.ts:4-12`, `supply.ts:4-12`
  - 상세: 의도적 중복(각 파일이 독립적으로 읽히는 module-level 문서이므로 공용화 대상 아님). 이미 프로젝트 메모리에 기록된 "cafe24 미러 중복은 의도" 컨벤션과 일치하는 패턴. 문제 아님, 참고용 기록.

### 요약
이번 변경은 로직 변경이 아닌 데이터(메타데이터 `requiredFields` 배열) 보강과 그 계약을 영구히 강제하는 회귀 테스트 추가로, 코드 복잡도·중첩·함수 길이 측면에서 우려할 부분이 거의 없다. 17개 리소스 파일의 diff는 모두 동일한 패턴(`requiredFields: [] → requiredFields: [...]`)을 따르며 기존 `Cafe24OperationMetadata` 타입 계약과 `metadata.spec.ts` subset 불변식을 그대로 준수한다. 신규 테스트 파일(`catalog-required-fields.spec.ts`)은 목적과 설계 근거를 상세한 JSDoc으로 설명하고 있고, 기존 자매 가드(`catalog-docs-drift.spec.ts`)의 파싱 유틸(`normPath`)을 재사용해 중복을 피했다. 6개 파일에 추가된 module docstring은 리소스별로 동일한 템플릿을 반복하지만, 이는 프로젝트가 이미 채택한 "cafe24 리소스 파일 미러 방식" 컨벤션에 부합하는 의도적 반복이다. 유일하게 짚을 만한 점은 일부 op의 `requiredFields` 배열이 다소 길어졌다는 것(가장 긴 경우 15개 항목)인데, 이는 순수 데이터이고 근본적으로 docs 계약을 있는 그대로 반영한 결과이므로 구조적 리팩터링을 요구할 수준은 아니다. 전반적으로 가독성·네이밍·일관성 모두 양호하며 유지보수성 관점에서 실질적 리스크는 발견되지 않았다.

### 위험도
NONE
