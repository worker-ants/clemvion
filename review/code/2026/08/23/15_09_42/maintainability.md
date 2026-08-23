# 유지보수성(Maintainability) Review — masking-gate-consolidation (15_09_42)

## 검토 범위 메모

이번 라운드의 diff(37개 파일)는 실질적으로 두 종류로 나뉜다.

- **실제 코드 변경 4곳**: `background-runs.service.ts`(호출부 1곳), `executions.service.ts`(호출부 3곳 + import), `redact-stored-error.ts`(신설 헬퍼 3개), `redact-stored-error.spec.ts`(신설 테스트 2 스위트). 이 넷은 저장소 파일을 직접 `Read` 로 전문 대조했다.
- **나머지 33개**: `plan/**`(트래커 갱신·완료 이관), `spec/conventions/egress-masking.md`(§3 stale 예고 정정), `review/code/2026/08/23/14_23_44/**`·`review/code/2026/08/23/14_46_46/**`·`review/consistency/2026/08/23/13_55_36/**`(직전 두 코드 리뷰 라운드 + 컨시스턴시 체크 산출물이 이번 커밋에 그대로 편입). 이들은 코드가 아니라 검토·계획 기록이므로 유지보수성(가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도/일관성) 점검 대상에서 제외했다.

`redact-stored-error.ts`/`redact-stored-error.spec.ts`는 이전 라운드(`14_23_44`, `14_46_46`)와 **바이트 단위로 동일**함을 소스 직접 대조로 확인했다(신규 변경 없음) — 두 헬퍼(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)의 co-located 테스트 부재 WARNING은 `14_46_46` 라운드에서 이미 해소됐고, 이번 라운드는 그 상태를 유지한다.

## 발견사항

- **[INFO]** `redactNodeExecutionRow`만 파일 내 "…ForResponse" 네이밍 접미사 관례를 따르지 않는다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:163`(`redactNodeExecutionRow` 선언)
  - 상세: 같은 파일의 나머지 export 3개 — `redactStoredErrorForResponse`(28행), `redactStoredDataForResponse`(66행), `redactStoredFieldsForResponse`(97행) — 는 모두 "…ForResponse" 접미사로 "이건 egress 응답 조립용" 임을 이름에 드러낸다. `redactNodeExecutionRow`만 예외라, 다섯 번째 헬퍼가 추가될 때 어느 쪽 네이밍 규칙을 따를지 판단 기준이 이름 자체에는 없다. 이전 두 라운드(`14_23_44`, `14_46_46`)에서 이미 지적됐고 plan(`plan/complete/masking-gate-consolidation.md`)이 "우선순위 낮음 — 통합 직후 추가 이동은 diff만 넓힌다"는 이유로 명시적으로 미조치를 확정한 항목이다. 등급을 올릴 근거는 없다.
  - 제안: 조치 불요(기존 트리아지 유지). 다음에 이 파일을 다른 이유로 손댈 때 접미사를 통일하거나, "행 전체 반환 헬퍼는 접미사를 안 붙인다"는 규칙을 docstring에 한 줄 남기면 향후 판단 기준이 생긴다.

- **[INFO]** 3필드 마스킹 타입 형태가 3곳에 손으로 반복된다 — 타입 레이어의 손동기화
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97`-`105`(`redactStoredFieldsForResponse` 파라미터/반환 타입) vs `codebase/backend/src/modules/executions/executions.service.ts:90`-`99`(`ResponseExecution`), `:108`-`115`(`ResponseNodeExecution`)
  - 상세: `{ inputData: Record<string, unknown> | null; outputData: …; error: … }` 형태가 헬퍼 시그니처와 두 DTO 타입 정의에 각각 인라인으로 반복된다(현재 3곳). 세 컬럼 중 하나가 타입을 바꾸면(예: `error`가 배열도 허용) 세 자리를 모두 손으로 맞춰야 한다 — 이 PR이 런타임 로직에서 없앤 "손 동기화" 패턴이 타입 레이어에는 남아 있다. 다만 세 컬럼 타입이 안정적이고 실제 드리프트가 발생한 이력은 없어 리스크는 낮다. 이전 두 라운드에서도 같은 등급(INFO)으로 확정된 항목이다.
  - 제안: 조치 불요. 필요해지면 `Pick<ResponseExecution, 'inputData' | 'outputData' | 'error'>` 파생 또는 공유 `MaskedTriple` 타입 별칭 도입을 고려.

- **[INFO]** 신설 함수 2개가 같은 파일 기존 함수와 달리 `@param`/`@returns` 형식 태그 없이 산문 docstring만 사용
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:73`-`111`(`redactStoredFieldsForResponse` 앞 docstring), `:113`-`151`(`maskIfPresent`), `:153`-`162`(`redactNodeExecutionRow` 앞 docstring). 비교 대상 `redactStoredErrorForResponse`(6-27행, `@param`/`@returns` 있음)·`redactStoredDataForResponse`(37-65행, 동일).
  - 상세: 산문이 파라미터·반환 의미·설계 이유를 이미 충분히(비교 표까지 포함해) 설명해 기능적 이해에는 지장이 없다. 스타일 일관성 관점의 사소한 간극이며, 문서화 리뷰(`documentation.md`, `14_23_44`/`14_46_46` 라운드)가 이미 같은 항목을 낮은 우선순위로 기록·보류했다.
  - 제안: 조치 불요. 다음에 이 파일을 손댈 때 4개 export 함수의 JSDoc 형식을 통일하는 것을 고려.

## 검토했으나 문제 없음으로 확인한 것들

- **함수 길이·중첩·복잡도**: `redactStoredFieldsForResponse`(15줄), `maskIfPresent`(5줄, `value == null ? value : (mask(value) ?? value)` 단일 삼항), `redactNodeExecutionRow`(16줄, 삼항 1단)로 모두 단일 책임을 유지하며 순환 복잡도가 낮다.
- **호출부 일관성**: `executions.service.ts`(3곳: `:704`·`:1005`·`:1069`)·`background-runs.service.ts`(1곳: `:302`)가 모두 같은 임포트 소스에서 같은 스프레드/직접호출 패턴을 쓴다. 노드 레벨 루프만 `redactNodeExecutionRow(ne)` 직접 반환으로 갈리는데, 이는 "부재 처리가 다르다"는 문서화된 설계 이유와 일치하는 **의도된** 비대칭이지 실수로 갈린 스타일 불일치가 아니다.
- **중복 코드**: `redactNodeExecutionRow`의 3컬럼 `maskIfPresent` 호출과 `redactStoredFieldsForResponse`의 3컬럼 마스킹 호출이 구조적으로 유사해 보이지만, 두 헬퍼를 하나로 합치지 않은 이유(부재 처리 `null` 정규화 vs 참조 보존, copy-on-change 유지)가 파일 최상단 docstring 비교표(84-87행)에 명시돼 있어 "우연한 중복"이 아니라 "의도적으로 나란히 둔 유사 형태"다. 합치면 이 PR이 막으려는 결함 클래스(자매 표면 뭉개짐)가 재발한다 — plan(`plan/complete/masking-gate-consolidation.md`)이 이 설계 결정과 뮤테이션 검증(M1/M2) 근거를 기록해 향후 "왜 헬퍼가 둘인가" 재문의를 차단한다.
- **네이밍(전반)**: `redactStoredErrorForResponse`/`redactStoredDataForResponse`/`redactStoredFieldsForResponse` 세 함수명은 동사(redact)+대상(Stored…)+수식(ForResponse) 패턴을 일관되게 따르며 목적이 이름에서 명확히 드러난다.
- **매직 넘버**: 신규 코드에 하드코딩된 의미 불명 숫자·문자열 없음.
- **테스트 층 유지보수성**: `redact-stored-error.spec.ts`의 신설 두 스위트(183-233행, 243-314행)는 각각 "왜 이 테스트가 필요한가"를 설명하는 docstring을 상단에 두고, `it.each`/`describe.each`로 3컬럼 각각·부재 형태(undefined/null) 각각을 개별 케이스로 고정해 "한 컬럼만 보면 나머지가 새는" 형태의 vacuous 테스트를 구조적으로 방지한다. 자매 스위트 간 부재 처리(정규화 vs 보존)가 반대라는 점을 각 스위트 상단 docstring이 명시해 다음에 이 파일을 읽는 사람이 그 비대칭을 실수로 "버그"로 오인할 여지를 줄였다.

## 요약

세 코드 파일(`background-runs.service.ts`, `executions.service.ts`, `redact-stored-error.ts`)에 걸쳐 4곳에 흩어져 "사람이 읽는 주석 표"로만 동기화되던 `inputData`/`outputData`/`error` 마스킹 로직을 헬퍼 2개로 응집시킨 리팩터이며, 이번 라운드에서 소스가 이전 두 라운드(`14_23_44`, `14_46_46`) 대비 변경되지 않았음을 직접 대조로 확인했다. 함수는 짧고 단일 책임을 유지하며, 헬퍼가 왜 둘로 나뉘는지·왜 합치면 안 되는지를 정본 docstring 한 곳(비교 표 포함)에 상세히 남겨 향후 "자매 표면 누락" 재발을 구조적으로 방지했다. 신설 헬퍼의 co-located 유닛 테스트 부재(직전 WARNING)는 이미 해소됐고, 남은 발견은 모두 이전 라운드에서 이미 저비용·낮은 우선순위로 트리아지된 INFO 3건(네이밍 접미사 불일치, 타입 손동기화 3곳, JSDoc 태그 스타일)의 재확인뿐이다. 신규로 발견된 CRITICAL/WARNING 급 유지보수성 결함은 없다.

## 위험도

LOW
