# 유지보수성(Maintainability) Review — masking-gate-consolidation (14_46_46)

## 검토 범위 메모

이 세션의 diff 는 이전 코드 리뷰 라운드(`14_23_44`)가 지적한 WARNING #1(신설 헬퍼의
co-located 유닛 테스트 부재)을 해소하는 후속 커밋을 포함한다. 실제 소스 변경은
`background-runs.service.ts` · `executions.service.ts` · `redact-stored-error.ts` ·
`redact-stored-error.spec.ts` 4곳뿐이며, 나머지 다수 파일(`review/code/2026/08/23/14_23_44/**`,
`review/consistency/2026/08/23/13_55_36/**`)은 이전 리뷰·컨시스턴시 체크 세션이 남긴
산출물이 신규 커밋된 것으로, 코드가 아니라 검토 기록이라 유지보수성 점검 대상에서 제외했다.
`redact-stored-error.ts` · `redact-stored-error.spec.ts` · 호출부 2곳은 저장소 파일을 직접
`Read` 해 게이트 줄 번호와 대조했다(프롬프트 전체 컨텍스트가 크기 제한으로 실리지 않음).

## 이전 라운드 대비 확인된 개선

- **WARNING #1 해소 확인**: `redact-stored-error.spec.ts` 에 `describe('redactStoredFieldsForResponse', …)`
  (183번째 줄)과 `describe('redactNodeExecutionRow', …)`(243번째 줄) 두 스위트가 신설되어,
  이 통합의 핵심 산출물인 신규 헬퍼 2개가 이제 co-located 로 직접 검증된다. 각 스위트는
  3컬럼 개별/동시 마스킹, 부재 처리(정규화 vs 보존), copy-on-change 참조 보존을 모두
  개별 케이스로 고정해, 이 통합이 없애려던 "회귀가 호출부에 흩어진 테스트를 거쳐야만
  드러난다"는 문제를 테스트 층에서도 해소했다.

## 발견사항

- **[INFO]** `redactNodeExecutionRow` 만 파일 내 "…ForResponse" 네이밍 접미사 관례를
  따르지 않음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:144`
  - 상세: 같은 파일의 나머지 export 3개(`redactStoredErrorForResponse`,
    `redactStoredDataForResponse`, `redactStoredFieldsForResponse`)는 모두 접미사로
    "이건 egress 응답 조립용" 임을 이름에 드러내는데 `redactNodeExecutionRow` 만 예외다.
    이전 라운드(`14_23_44`)에서 이미 같은 지적이 나왔고 plan 문서(`plan/complete/masking-gate-consolidation.md`
    "INFO — 미조치 사유")가 "우선순위 낮음, 방금 4곳을 옮긴 직후의 추가 이동은 diff 만
    넓힌다"는 이유로 명시적으로 미조치를 결정했다. 이번 라운드에도 미해결 상태로 남아
    있어 재확인 차원에서 기록하되, 이미 트리아지된 항목이라 등급을 올리지 않는다.
  - 제안: 조치 불요(기존 결정 유지). 다음에 이 파일을 다른 이유로 손댈 때 함께 정리하거나,
    "행 전체 반환 헬퍼는 접미사를 안 붙인다"는 규칙을 docstring 에 한 줄 남기면 다섯 번째
    헬퍼 추가 시 판단 기준이 생긴다.

- **[INFO]** `redactStoredFieldsForResponse` 의 파라미터/반환 타입이 `ResponseExecution`/
  `ResponseNodeExecution` 의 3필드 부분집합과 구조적으로 동일하나 별도 인라인 선언
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97`-`105`, 비교 대상
    `codebase/backend/src/modules/executions/executions.service.ts` 의 `ResponseExecution`·
    `ResponseNodeExecution` 타입 정의
  - 상세: `{ inputData: … | null; outputData: …; error: … }` 형태가 손으로 최소 두 곳
    이상(헬퍼 시그니처, DTO 타입)에 반복된다. 이 PR 이 런타임 로직에서 없앤 "손 동기화"
    패턴이 타입 레이어에는 남아 있다. 다만 세 컬럼의 타입이 안정적이고(현재 변경 이력
    없음) 실제 드리프트가 발생한 적은 없어 리스크는 낮다. 마찬가지로 `14_23_44` 라운드에서
    이미 INFO 로 기록되고 낮은 우선순위로 확정된 항목이다.
  - 제안: 조치 불요. 필요해지면 `Pick<ResponseExecution, 'inputData' | 'outputData' | 'error'>`
    파생 또는 공유 `MaskedTriple` 별칭 도입을 고려.

- **[INFO]** `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 는 파일 내 기존
  두 함수와 달리 `@param`/`@returns` 형식 태그 없이 산문 docstring만 사용
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:73`-`111`(함수 앞
    docstring), `:134`-`143`
  - 상세: 산문이 파라미터·반환 의미를 이미 충분히 설명해 기능적 이해에는 지장이 없다.
    문서화 관점 리뷰(`documentation.md`, `14_23_44`)가 이미 같은 항목을 낮은 우선순위로
    기록했다. maintainability 관점에서도 등급을 올릴 근거는 없다.
  - 제안: 조치 불요.

## 검토했으나 문제 없음으로 확인한 것들

- **함수 길이·중첩·복잡도**: `redactStoredFieldsForResponse`(15줄), `maskIfPresent`(5줄),
  `redactNodeExecutionRow`(16줄) 모두 단일 책임을 유지하며 중첩 깊이 1단(삼항/단락 평가)을
  넘지 않는다. 순환 복잡도 낮음.
- **호출부 일관성**: `executions.service.ts`(3곳)·`background-runs.service.ts`(1곳) 모두
  `...redactStoredFieldsForResponse(row)` 스프레드 패턴을 동일하게 쓰고, 노드 레벨 루프만
  `redactNodeExecutionRow(ne)` 직접 반환으로 갈린다 — 이는 "부재 처리가 다르다"는 문서화된
  설계 이유와 일치하는 **의도된** 비대칭이지 실수로 갈린 스타일 불일치가 아니다.
- **중복 코드**: `redactNodeExecutionRow` 내 3컬럼 `maskIfPresent` 호출과
  `redactStoredFieldsForResponse` 내 3컬럼 마스킹 호출이 구조적으로 유사해 보이지만,
  두 헬퍼를 하나로 합치지 않은 이유(부재 처리·참조 보존 의미 차이)가 파일 최상단
  docstring 비교표에 명시돼 있어 "우연한 중복"이 아니라 "의도적으로 나란히 둔 유사 형태"다.
  합치면 이 PR 이 막으려는 결함 클래스(자매 표면 뭉개짐)가 재발한다.
  `plan/complete/masking-gate-consolidation.md` 가 이 설계 결정과 뮤테이션 검증(M1/M2/M3)
  근거를 기록해 향후 "왜 헬퍼가 둘인가" 재문의를 차단한다.
- **네이밍(전반)**: `redactStoredErrorForResponse`/`redactStoredDataForResponse`/
  `redactStoredFieldsForResponse` 세 함수명은 동사(redact)+대상(Stored…)+수식(ForResponse)
  패턴을 일관되게 따르며 목적이 이름에서 명확히 드러난다.
- **매직 넘버**: 신규 코드에 하드코딩된 의미 불명 숫자·문자열 없음.

## 요약

세 파일(`background-runs.service.ts`, `executions.service.ts`, `redact-stored-error.ts`)에
걸쳐 4곳에 흩어져 "사람이 읽는 주석 표"로만 동기화되던 `inputData`/`outputData`/`error`
마스킹 로직을 헬퍼 2개로 응집시킨 리팩터다. 이번 라운드의 핵심 변화는 이전 코드 리뷰가
지적한 co-located 테스트 부재(WARNING)를 실제로 해소한 것이며, 뮤테이션 기반 검증(M1/M2/M3)
까지 스펙 파일에 옮겨 이 통합의 설계 결정("헬퍼를 하나로 합치지 않는다")을 테스트로 고정했다.
남은 발견사항은 모두 INFO 수준으로, 대부분 이전 라운드에서 이미 저비용·낮은 우선순위로
트리아지된 항목(네이밍 접미사 불일치, 타입 손동기화, JSDoc 태그 스타일)의 재확인이며 신규로
발견된 CRITICAL/WARNING 급 유지보수성 결함은 없다. 함수는 짧고 단일 책임을 유지하며, 헬퍼가
왜 둘로 나뉘는지·왜 합치면 안 되는지를 정본 docstring 한 곳에 상세히 남겨 향후 "자매 표면
누락" 재발을 구조적으로 방지했다.

## 위험도

LOW
