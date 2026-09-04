# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상 요약

- `CHANGELOG.md` — `QueryExecutionDto.workflowId` 제거 항목 신규 추가 (문서)
- `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — 죽은 쿼리 필터 필드(`workflowId`) 제거 + 클래스 JSDoc 보강
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `@Transform` 예외 관련 JSDoc 재서술 (로직 변경 없음)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 후속 트래커 체크박스 갱신 (문서)

실질 코드 변경은 `query-execution.dto.ts` 한 곳뿐이며, 죽은 필드를 제거하고 관련 import(`IsUUID`, `Transform`)도 함께 정리한 깔끔한 diff다. `swagger-dto-contract-guard.ts`는 로직 변경 없이 주석만 갱신했다. 나머지 두 파일은 문서(`CHANGELOG.md`, `plan/*.md`)다.

### 발견사항

- **[INFO]** CHANGELOG 항목과 plan 트래커 항목이 같은 설명을 거의 그대로 중복 서술
  - 위치: `CHANGELOG.md:28-34` (`### 부수 — @Transform 예외의 실사례가 0건이 됐다` 단락) 및 `plan/in-progress/spec-draft-nullable-notation-followups.md:321-323` (`부수: swagger-dto-contract 가드의 @Transform 예외가...` 단락)
  - 상세: 두 파일 모두 "`Api*` 필드 1,095개 중 `@Transform` 동반 17개, null 축 불일치 0개, 예외는 남기고 픽스처로 뮤테이션 고정"이라는 동일한 실측 서술을 신규로 담고 있다. `CHANGELOG.md`는 릴리스 로그, `plan/*.md`는 작업 트래커로 SoT 위치가 이 저장소 관례상 원래 분리돼 있어(둘 다 "당시 기록"이라는 성격이 다르므로) 의도된 중복일 가능성이 높지만, 향후 수치가 다시 바뀔 경우(§③ Rationale에서 이미 "같은 PR 안에서도 수치가 낡았다"고 자인한 전례가 있음) 두 곳을 모두 찾아 고쳐야 하는 동기화 부담이 생긴다.
  - 제안: 필수 수정 대상은 아니나, 두 문서 중 한쪽이 다른 쪽을 참조(링크)하는 형태였다면 향후 정정 시 갱신 누락 위험이 줄었을 것 — 다음에 유사 패턴을 쓸 때 참고.

- **[INFO]** 클래스 JSDoc에 날짜가 박힌 "제거 이력" 서술이 영구 주석으로 남음
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` — `QueryExecutionDto` 클래스 선언 바로 위 JSDoc 블록 (diff 게이트 5-14행)
  - 상세: `> **workflowId 쿼리 파라미터를 제거했다 (2026-09-04).**`로 시작하는 9줄짜리 블록쿼트는 "지금의 계약"이 아니라 "왜 지금 이 형태인가"라는 변경 이력 서술이다. CHANGELOG에도 동일 취지 항목이 이미 있으므로 클래스가 이후 더 변경되면 이 주석이 과거 시점에 고정된 채 stale해질 수 있다. 다만 이 저장소는 `swagger-dto-contract-guard.ts`를 포함해 여러 곳에서 "왜 이렇게 됐는가"를 날짜와 함께 소스에 남기는 관례를 이미 광범위하게 쓰고 있어(리뷰 대상 파일 3 자체도 같은 패턴), 이번 diff가 새로 만든 문제라기보다 기존 컨벤션을 따른 것이다.
  - 제안: 조치 불필요 — 컨벤션 일관성 관점의 참고 사항으로만 기록.

- **[INFO]** `query-execution.dto.ts` 필드 제거 diff 자체는 모범적
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts:1-15` (import 정리 포함)
  - 상세: 죽은 필드(`workflowId`)를 제거하면서 더는 쓰이지 않는 `IsUUID`(class-validator), `Transform`(class-transformer) import를 함께 제거해 고아 import를 남기지 않았다. 전체 파일 컨텍스트를 확인한 결과 두 심볼 모두 파일 내 다른 곳에서 참조되지 않는다.
  - 제안: 없음 — 긍정적 관찰.

## 요약

이번 diff의 실질 코드 변경은 죽은 DTO 필드 하나를 제거하고 관련 import를 함께 정리한 소규모·저위험 변경이며, 가드 파일의 변경은 로직이 아닌 주석 재서술에 그친다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 등 구조적 지표에 영향을 주는 코드 변경은 사실상 없고, 네이밍과 스타일도 기존 코드베이스 컨벤션(한국어 JSDoc, 날짜 박힌 근거 주석, `@Transform` 원리 설명 블록쿼트 등)과 일관된다. CHANGELOG와 plan 트래커 간 서술 중복은 이 저장소의 "문서 SoT 분리" 관례상 의도된 것으로 보이나, 수치가 재차 바뀔 경우 두 곳을 함께 갱신해야 하는 부담은 남는다.

## 위험도
NONE
