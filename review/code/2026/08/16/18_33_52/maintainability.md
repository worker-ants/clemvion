# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 테스트 헬퍼 `buildSingleQB` 완전 중복 정의
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:861`(신규) — 기존 정의는 동일 파일 `:396`
  - 상세: 최상위 `describe('ExecutionsService', ...)` 안에 이미 `buildSingleQB`(396~404행: `leftJoinAndSelect`/`leftJoin`/`addSelect`/`where`/`getOne` 스텁)가 있는데, 이번 PR 이 추가한 `describe('Execution.error 응답 마스킹 — 표면 전수', ...)`(854행~)가 같은 스코프 depth 에서 토씨 하나 다르지 않은 구현(861~868행)을 다시 선언한다. 같은 파일에 이미 `buildListQB`(66행)·`buildParentNameQB`(80행)·`buildNodeCountQB`(97행)가 최상위에서 공유되고 있어 재사용 가능한 자리가 명백한데도 복붙됐다. QueryBuilder 체인이 바뀌면(예: `addSelect` 인자 추가) 두 곳을 따로 고쳐야 한다.
  - 제안: 두 `buildSingleQB` 를 최상위 `describe('ExecutionsService', ...)` 스코프로 끌어올려 하나만 남긴다.

- **[WARNING]** 리뷰 라운드 이력·자기 정정 서술이 영구 소스 주석에 박제됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `stop()` JSDoc(799~806행 부근), `toResponseExecution()` JSDoc(984~992행 부근); `codebase/backend/src/shared/utils/redact-stored-error.ts` 파일 헤더 JSDoc(6~56행)
  - 상세: `stop()` JSDoc 에 "종전 이 문장은 '반환 지점이 넷'이라고 썼는데 **틀렸다**(`18_14_50` documentation W1)" 처럼, 이번 PR 자체의 리뷰 라운드 중 저자가 스스로 낸 오류를 정정한 이력이 코드 주석으로 영구 보존된다. `toResponseExecution` 도 "(`17_12_34` maintainability W1)" 형태로 라운드 ID 를 인용한다. 이런 서술은 "지금 이 함수가 무엇을 왜 하는가" 를 넘어 "저자가 리뷰 도중 무슨 실수를 했는가" 라는 리뷰-프로세스 메타데이터까지 담아, 나중에 이 파일을 처음 여는 개발자에게는 맥락 없는 라운드 ID(`18_14_50`, `17_12_34` 등)만 남고 실제 동작 이해에는 도움이 안 되는 잡음이 된다. 함수 본문보다 JSDoc 이 몇 배 긴 것도(`stop`: 본문 3줄·JSDoc 약 30줄, `toResponseExecution`: 본문 6줄·JSDoc 약 27줄, `redact-stored-error.ts`: 함수 본문 8줄·JSDoc 약 50줄) 같은 뿌리다.
  - 제안: "현재 유효한 설계 근거"만 JSDoc 에 남기고, "라운드별로 뭘 틀렸다가 고쳤는가" 류 이력은 커밋 메시지·CHANGELOG·plan 문서로 옮긴다. 이미 `CHANGELOG.md`(Unreleased 항목)와 `plan/in-progress/eia-internal-rest-error-masking.md` 가 그 서사를 담고 있으므로, 코드 안에는 결론과 링크만 남기는 정도로 압축할 수 있다.

- **[INFO]** 신규 타입 네이밍 방향이 파일 내부·코드베이스 관례와 다름
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:77`(`ResponseExecution`), `:91`(`ResponseNodeExecution`)
  - 상세: 같은 파일의 기존 타입은 `ExecutionDetailWithTrigger`(주어 뒤에 수식이 붙는 패턴)인데, 신규 타입은 `Response` 를 접두어로 붙였다. 코드베이스 전역에서 응답 형태를 가리키는 타입은 `*ResponseDto` 접미사 클래스가 (grep 기준) 10개 존재해 그것이 사실상 관례인데, 이번 타입은 방향이 반대다. DTO 클래스가 아니라 서비스 내부 반환 타입이라 완전히 같은 층은 아니지만, 이름만으로는 `ResponseExecution` 과 `ExecutionDto`/`*ResponseDto` 의 관계를 유추하기 어렵다.
  - 제안: 필수 변경은 아니다. 기존 접미사 패턴(`ExecutionResponse` 등)에 맞추거나, 이미 있는 JSDoc 설명("DTO 클래스가 아니라 내부 반환 타입")을 그대로 유지해도 무방하다.

- **[INFO]** Swagger `description` 이 한 줄짜리 장문 문자열
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:65`; `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`(`ExecutionDto.error`/`NodeExecutionSummaryDto.error` 필드의 `description`)
  - 상세: `'에러 정보. 자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음) — 실행 상세의 \`nodeExecutions[].error\` 와 같은 관문. SoT: EIA §R17 ...'` 처럼 마크다운·백틱·SoT 링크까지 포함한 한 줄짜리 긴 문자열이 그대로 Swagger UI 필드 설명으로 렌더링된다. 코드 가독성(긴 한 줄)뿐 아니라, Swagger UI 를 보는 외부 API 소비자에게까지 내부 리뷰 근거(`EIA §R17`)가 노출되는 점도 다소 과하다.
  - 제안: 코드 JSDoc(내부용 "왜")과 Swagger `description`(사용자용 요약)을 분리한다. `description` 은 "마스킹된 값일 수 있음(DB 원문과 다를 수 있음)" 정도로 짧게 두고, 근거·배경은 바로 위 `/** ... */` JSDoc 에만 남긴다.

## 요약

핵심 변경 — 응답 egress 마스킹(`redactStoredErrorForResponse`)을 4개 독립 표면(`toExecutionDto`·`toResponseExecution`이 감싸는 `findById`/`getChain`/`stop`·`background-runs.service.toNodeExecutionDto`)에 일관되게 건 것 — 은 설계·네이밍 모두 양호하다. `stop`/`stopInternal` 분리로 "마스킹 관문이 한 곳" 이라는 불변식을 함수 경계로 강제했고, `as Execution` 무단 캐스트를 제거하고 `ResponseExecution`/`ResponseNodeExecution` 명시 타입으로 `error` 의 null 가능성을 드러냈으며, `error` 가 없는 행은 원본 참조를 그대로 돌려주는 copy-on-change 최적화를 회귀 테스트(`⑤-c`)로 고정한 점은 유지보수성에 실질적으로 기여한다. 다만 (1) 신규 테스트 헬퍼 `buildSingleQB` 가 같은 파일 안에서 완전히 중복 정의됐고, (2) 다수 JSDoc 이 "이번 PR 리뷰 라운드에서 저자가 뭘 틀렸다가 고쳤는가" 라는 리뷰-프로세스 이력까지 코드에 영구 박제해 함수 본문보다 몇 배 긴 주석이 반복되는 점은, 시간이 지날수록 신규 참여자에게 잡음으로 남을 위험이 있다. 두 WARNING 모두 CRITICAL 수준은 아니며 짧은 정리로 해소 가능하다.

## 위험도

LOW
