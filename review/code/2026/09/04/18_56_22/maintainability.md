# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상 요약

실질 코드/테스트 변경은 3개 파일이며, 나머지(10곳)는 문서(`CHANGELOG.md`, plan) 또는 이전 리뷰·일관성 검토 라운드(`18_34_04`, `18_51_26`)가 생성한 신규 리포트 산출물(prose/JSON, 로직 없음)이다. 후자는 함수 길이·중첩·순환 복잡도 등 코드 구조 지표의 대상이 아니므로 아래 발견사항은 실질 코드/테스트 3파일에 집중했다.

- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은 쿼리 필드(`workflowId`) 제거 + 미사용 import(`IsUUID`, `Transform`) 정리 + 클래스 JSDoc 신설
- `codebase/backend/src/common/pipes/validation.pipe.spec.ts` — `forbidNonWhitelisted` 축을 고정하는 신규 `describe` 블록(테스트 2건) 추가
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 JSDoc 재서술(로직 `findSwaggerContractMismatches` 불변, 직접 `Read` 로 확인)

## 발견사항

- **[WARNING]** 신규 테스트 2건만 한국어 설명을 쓰고, 같은 파일의 기존 테스트 3건은 영어 설명이다 — 파일 내부 언어 컨벤션 불일치
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:92`, `:101` (신규, `it(...)` 첫 인자) vs 동일 파일의 기존 `it('returns the transformed instance when validation passes', ...)`(26행), `it('emits path-qualified details for nested array errors', ...)`(34행), `it('emits details for a top-level field error', ...)`(56행) — 전부 `Read` 로 재확인.
  - 상세: 기존 `describe('CustomValidationPipe', ...)` 블록의 세 `it()` 는 전부 영어 서술이다. 이번 diff 가 추가한 두 번째 `describe('CustomValidationPipe — forbidNonWhitelisted', ...)` 블록의 두 `it()` 는 한국어(`'DTO 에 없는 키가 오면 400 이다 — 조용히 벗기지 않는다'`, `'[대조군] 알려진 키만 오면 통과한다 — 위 단언이 공허하지 않다'`)다. 저장소 전반은 한국어 JSDoc/주석이 관례이지만, 같은 파일·같은 클래스를 대상으로 한 테스트 설명이 위아래로 언어가 갈리면 `jest --listTests`/실패 로그를 훑을 때 일관된 패턴 매칭이 어려워지고, 다음에 이 파일에 테스트를 추가하는 사람이 어느 언어를 따라야 할지 판단 기준이 없어진다. 파일 단위의 새 결함은 아니지만(프로젝트 전체는 이미 혼재), 이 diff 가 "같은 파일 안에서" 그 혼재를 새로 만들었다는 점이 다르다.
  - 제안: 최소한 새 `describe` 블록 내부만이라도 기존 세 개와 언어를 맞추거나(영어), 이 파일을 한국어로 통일하는 후속 리팩터를 별도로 열어 전체를 정리한다. 지금 당장 막을 일은 아니다.

- **[INFO]** 신규 JSDoc 이 ephemeral 한 리뷰 세션 ID 를 근거로 인용한다
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.spec.ts:77` (게이트, `* (리뷰 `18_34_04` W2).`)
  - 상세: 소스 파일 주석이 `review/code/2026/09/04/18_34_04/` 라는 리뷰 산출물 디렉터리의 발견 항목 번호(W2)를 직접 인용한다. 이 저장소의 관례(`CLAUDE.md`)상 `review/**` 는 SoT 가 아니며 히스토리 아카이브로만 다뤄진다 — 향후 그 세션 디렉터리가 정리·이동돼도 이 인용은 정정되지 않고 남아 dangling reference 가 될 수 있다. spec/plan 문서를 인용하는 기존 관례(예: 같은 diff 의 `query-execution.dto.ts` JSDoc 이 `spec/2-navigation/14-execution-history.md:345` 를 인용)와 결이 다르다.
  - 제안: 조치 불요 수준이나, 향후 유사 인용을 쓸 때는 리뷰 세션 ID 대신 plan 항목(`plan/in-progress/...md` 앵커)처럼 이 저장소가 이미 SoT 로 취급하는 문서를 가리키는 편이 더 오래간다.

- **[INFO]** 같은 사건("QueryExecutionDto.workflowId 제거, 200→400")의 서술이 이제 4곳에 중복된다
  - 위치: `CHANGELOG.md`(신규 섹션), `plan/in-progress/spec-draft-nullable-notation-followups.md:307-324`(게이트), `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:5-14`(게이트, 클래스 JSDoc), 그리고 이번 diff 가 새로 추가한 `codebase/backend/src/common/pipes/validation.pipe.spec.ts:79-82`(게이트, "2026-09-04 에 `QueryExecutionDto.workflowId`(죽은 파라미터)를 제거했고...") — 네 곳 모두 "죽은 파라미터를 지웠고 그 결과 200 이 400 이 됐다"는 동일 사실을 각자의 표현으로 다시 서술한다.
  - 상세: 이전 리뷰 라운드(`18_34_04` maintainability.md)가 이미 CHANGELOG·plan 두 곳의 중복을 INFO 로 지적했는데, 이번 diff(`validation.pipe.spec.ts` 신규 JSDoc)가 같은 서사를 세 번째·네 번째 자리에 추가했다. 숫자 그 자체(예: 1,095/17/0)는 반복되지 않아 동기화 리스크는 크지 않지만, "무엇이 왜 없어졌는가"라는 서사가 4곳에 흩어져 있으면 그중 하나만 수정되고 나머지가 낡을 여지가 생긴다(이 저장소가 이미 겪은 "종결 조건 서술이 두 번 낡음" 패턴과 같은 클래스).
  - 제안: 필수 조치는 아니다. 다음에 유사 서사를 또 추가할 필요가 생기면, 산문 전체를 반복하는 대신 "자세한 배경은 `query-execution.dto.ts` JSDoc 참고" 식으로 한쪽을 SoT 로 지정하고 나머지는 짧게 링크하는 편이 안전하다.

- **[INFO]** `query-execution.dto.ts` 필드 제거 diff 자체는 모범적
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:1-3`(게이트, import) 및 파일 전체(`Read` 로 재확인, 39줄)
  - 상세: 죽은 필드(`workflowId`)를 제거하면서 더는 쓰이지 않는 `IsUUID`(class-validator), `Transform`(class-transformer) import 를 함께 제거해 고아 import 를 남기지 않았다. 나머지 `status` 필드의 `@ApiPropertyOptional`/`@IsIn` 구조도 그대로 유지돼 diff 범위가 정확히 제거 대상에만 국한된다.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc 재서술, 로직 불변 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:100-121`(게이트) — `findSwaggerContractMismatches` 함수 본문(122행 이하)은 diff 밖이며, 직접 `Read` 로 대조한 결과 `hasTopLevelNull`·`readBooleanOption`·`@Transform` 판정 조건(166행 `!decorators.some((d) => d.name === 'Transform')`)이 모두 그대로임을 확인했다.
  - 제안: 없음.

## 요약

이번 diff의 실질 코드/테스트 변경(DTO 필드 제거 1건, 신규 단위 테스트 2건, JSDoc 재서술 1건)은 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 구조적 영향이 없는 소규모 변경이며, DTO 필드 제거와 함께 미사용 import 를 정리한 점은 모범적이다. 다만 신규 테스트 파일에서 두 가지 새로운 지엽적 결함을 발견했다 — (1) 같은 파일 안에서 기존 영어 테스트 설명과 신규 한국어 테스트 설명이 섞여 파일 내부 언어 컨벤션이 diff 로 인해 새로 깨졌고(WARNING), (2) 그 신규 JSDoc 이 SoT 가 아닌 리뷰 세션 ID(`18_34_04` W2)를 소스 코드 영구 주석의 근거로 인용해 향후 dangling reference 위험을 만든다(INFO). 또한 동일한 "workflowId 제거" 서사가 이제 CHANGELOG·plan·DTO JSDoc·spec JSDoc 네 곳에 중복 서술돼(INFO) 이전 라운드가 이미 지적한 동기화 부담 패턴이 한 곳 더 늘었다. 셋 다 병합을 막을 수준은 아니며, 첫 번째만 후속 정리를 권장할 만한 실질적 지적이다.

## 위험도

LOW
