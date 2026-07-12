# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 동일 이름 상수 `EXECUTION_STATUS_VALUES` 가 이미 다른 모듈에 존재하며 순서가 다르다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` (신규) vs `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:42`
  - 상세: 신규 파일의 JSDoc 은 "EIA 응답에서 노출하는 execution 상태 리터럴 집합 (SoT)" 라고 스코프를 명확히 한정해 그 자체로는 부정확하지 않다. 다만 `workflow-assistant/tools/explore-tools.service.ts` 에 동일한 6값 집합을 담은 **동명의** `export const EXECUTION_STATUS_VALUES`(순서: `pending,running,completed,failed,cancelled,waiting_for_input`)가 이미 존재하고, 신규 파일의 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 다르다. 두 파일은 서로 다른 모듈이라 컴파일에는 문제없고 소비 목적도 다르지만(하나는 swagger DTO enum, 하나는 AI 도구 스키마 필터), 향후 이 이름으로 grep 하는 개발자가 "이미 SoT 가 있다"고 오인해 잘못된 파일을 재사용하거나 순서 불일치를 놓칠 위험이 있다.
  - 제안: 신규 JSDoc 주석에 "동일 개념의 별도 상수가 `workflow-assistant/tools/explore-tools.service.ts` 에도 존재하며 본 파일과 무관/미통합" 임을 한 줄 남기거나, 최소한 이름 충돌을 인지할 수 있도록 통합 여부를 별도 후속 항목으로 plan 에 남길 것(현재 plan 잔여 항목 목록에는 미등재).

- **[INFO]** swagger.md §5-1 이 "형제 DTO 간 enum 값 공유용 로컬 리터럴 파일" 패턴을 아직 문서화하지 않음
  - 위치: `spec/conventions/swagger.md` §5-1 (응답 DTO 위치 규약)
  - 상세: 이번 PR 이 `execution-status.literal.ts` 라는 `*.literal.ts` 네이밍의 신규 파일 유형을 `dto/responses/` 안에 도입했다(`*-response.dto.ts` 규약과 다른 파일명 패턴). 설계 근거(엔티티 enum 파생 회피, 순서 보존)는 파일 JSDoc + plan 항목에 잘 남아 있으나, 이는 향후 다른 모듈에서 "두 응답 DTO 가 같은 enum 을 공유"하는 동일 문제에 부딪힐 때 재사용 가능한 패턴이다. 현재는 이 패턴이 EIA 모듈 로컬 지식으로만 존재해 §5-1 을 읽는 다른 개발자에게는 안 보인다.
  - 제안: 필수는 아니나, §5-1 에 "형제 DTO 간 enum 값 공유가 필요하면 `<name>.literal.ts` 로 `as const` 배열 + 파생 타입을 두고 엔티티 enum 에서 직접 파생하지 않는다(순서 보존)" 한 줄을 추가하면 이 패턴이 재발견 가능해진다.

## 검증한 사항 (문제 없음)

- `execution-status.literal.ts` 신규 파일의 JSDoc 이 주장하는 두 가지 사실을 코드로 대조 확인함: (a) `Execution.status` 엔티티 enum 순서(`pending,running,completed,failed,cancelled,waiting_for_input`, `codebase/backend/src/modules/executions/entities/execution.entity.ts:14-21`)가 DTO wire 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 실제로 다름 — 주석의 순서 불일치 근거가 정확하다. (b) "두 DTO 가 동일 6값 유니온을 각자 선언했었다"는 diff 와 일치.
- `execution-status-response.dto.ts` / `interact-ack-response.dto.ts` 의 기존 클래스·필드 JSDoc(예: `waiting_for_input 상태에서만 실값`, EIA §5.1/§5.4 참조)은 이번 diff 로 인해 stale 해지지 않았다 — 변경은 `status`/`currentStatus` 필드의 타입·enum 소스만 교체했을 뿐 그 필드들 자체에는 별도 필드-레벨 주석이 없었고 신규로도 추가하지 않았으나(회귀는 아님), 클래스 상단 JSDoc 은 여전히 정확하다.
- CHANGELOG.md 미갱신은 프로젝트 관례와 일치. `CHANGELOG.md` 는 wire/사용자-가시 변경(예: 위젯 다국어화, breaking `__` prefix 금지 등)만 기록하며, 과거 유사한 순수 내부 리팩터(`spec-links.ts 중복 정리`, `external-interaction 응답 DTO 위치 정규화`)도 CHANGELOG 항목이 없다. 본 변경은 plan 문서에 "런타임·OpenAPI wire 무변경" 으로 명시돼 있어 동일 범주 — CHANGELOG 누락이 아니다.
- `plan/in-progress/eia-context-schema-followups.md` 의 완료 표기(`- [x]`)와 완료 노트는 실제 diff 내용(신규 SoT 파일 도입, `[...EXECUTION_STATUS_VALUES]` 로 두 DTO 공유)과 정합한다. frontmatter `worktree` 값도 현재 worktree(`eia-context-dev-cleanups-109831`)와 일치. 다른 미완료 항목(`- [ ]`)들은 그대로 남아 있어 in-progress 상태 유지가 맞다.
- 신규 `execution-status.literal.ts` 자체의 모듈 JSDoc 은 목적·SoT 근거·엔티티 비파생 이유(2가지)까지 상세히 서술되어 있어 이 리뷰 관점에서 모범적 수준이다. `EXECUTION_STATUS_VALUES`/`ExecutionStatusLiteral` 는 공개 export 이나 이름 자체가 자기설명적이라 별도 함수 수준 독스트링 없이도 사용법이 명확하다.
- API 문서(swagger) 관점: 엔드포인트 계약(요청/응답 wire, enum 값 자체)은 무변경이므로 OpenAPI 문서 재생성 외 별도 API 문서 갱신은 불필요.

## 요약

이번 변경은 두 응답 DTO(`ExecutionStatusDto.status`, `InteractAckDto.currentStatus`)가 중복 선언하던 6값 상태 리터럴 유니온을 신규 `execution-status.literal.ts` 로 통합한 순수 리팩터로, wire 포맷·엔드포인트 계약에 영향이 없다. 신규 파일의 JSDoc 은 SoT 근거와 엔티티 enum을 파생하지 않는 이유(순서 보존, 레이어 분리)를 상세히 남겨 문서화 수준이 높고, 코드로 대조한 결과 주장한 사실관계(엔티티 vs DTO enum 순서 차이)도 정확했다. plan 파일 갱신도 실제 구현 내용과 일치하며 CHANGELOG 누락도 프로젝트 관례(내부 리팩터는 미기재)와 부합한다. 유일한 옥에 티는 `workflow-assistant/tools/explore-tools.service.ts` 에 이미 존재하는 동명·다른-순서의 `EXECUTION_STATUS_VALUES` 상수와의 관계가 신규 JSDoc 에 언급되지 않아 향후 grep 시 혼동 소지가 있다는 점과, 이번에 도입한 "형제 DTO 간 enum 공유용 로컬 literal 파일" 패턴이 swagger.md §5-1 규약 문서에는 아직 반영되지 않았다는 점 — 둘 다 INFO 수준으로 차단 사유는 아니다.

## 위험도

LOW
