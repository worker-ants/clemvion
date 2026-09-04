# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

- `CHANGELOG.md` — 새 Unreleased 항목 1건 추가(그 아래는 기존 항목, diff 대상 아님)
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold` 필드 타입·데코레이터·JSDoc 변경
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 트래커 갱신(체크박스·근거 보강)

세 파일 모두 문서(md) 또는 단일 DTO 필드 애노테이션 변경이라 함수 길이·중첩 깊이·순환 복잡도 관점의 실질적 코드 구조 리스크는 없다. 아래는 가독성·네이밍·일관성·중복 축에서 발견한 사항이다.

## 발견사항

- **[INFO]** DTO 필드 하나의 JSDoc 이 같은 파일의 다른 10개 필드 대비 5배 이상 길어 시각적 일관성이 깨진다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20`–`35`
  - 상세: `threshold` 필드의 JSDoc 이 16줄(정정 배경·발견 경위·프런트엔드 대조·날짜)인 반면, 같은 파일의 `id`·`workspaceId`·`type`·`window`·`channel`·`workflowId`·`enabled`·`createdAt`·`updatedAt` 은 전부 1~3줄이다(`/** 임계값 */` 형태였던 종전과 비교하면 특히 두드러진다). "왜 이 필드가 문자열인가"(wire 사실)와 "왜 예전엔 틀렸었는가"(정정 서사)가 한 블록에 섞여 있어, 코드를 읽는 사람이 매번 정정 히스토리 전체를 다시 읽어야 한다.
  - 제안: 소스 JSDoc 은 "지금·왜 문자열인가"(numeric 컬럼 → TypeORM 문자열 반환 → 정밀도 보존)만 남기고, "종전에 `number` 라고 잘못 적었던 경위·발견 과정·날짜" 같은 히스토리 서사는 이미 동일 내용을 담은 `CHANGELOG.md` 새 항목에 위임한다. 코드 주석은 향후 유지보수자가 "지금 무엇을 지켜야 하는가"를 빠르게 파악하는 데 최적화하고, 사건의 경위는 CHANGELOG/PR 로 분리하는 편이 장기적으로 더 읽기 쉽다.

- **[INFO]** `CHANGELOG.md` 신규 항목과 DTO JSDoc 이 같은 설명(정밀도 보존 이유·프런트엔드가 이미 분기해 뒀다는 사실·읽기/쓰기 비대칭 의도)을 거의 동일한 문장으로 중복 서술한다
  - 위치: `CHANGELOG.md:5`–`23` (신규 항목 본문) vs `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:21`–`34`
  - 상세: 두 곳 모두 "컬럼이 `numeric(12,4)`이고 TypeORM 이 문자열로 반환한다", "프런트엔드 `lib/api/alerts.ts` 가 읽기/쓰기 타입을 이미 갈라 두었다", "읽기/쓰기 비대칭은 의도"라는 세 사실을 반복한다. 두 문서가 독립적으로 관리되므로, 이 로직이 다시 바뀔 경우(예: DTO 에서 실제로 숫자 변환을 도입) 한쪽만 갱신하고 다른 쪽이 stale 로 남을 위험이 있다.
  - 제안: 코드 주석은 "무엇을 지켜야 하는가"에 집중한 짧은 요약 + `CHANGELOG.md` 해당 항목으로의 링크(또는 "자세한 배경은 CHANGELOG 참조" 한 줄)로 축약하는 것을 고려. 완전한 통합까지는 필요 없지만 SoT 를 하나로 좁히면 향후 drift 위험이 준다.

- **[INFO]** `@ApiProperty({ type: String, ... })` 의 명시적 `type: String` 지정이 같은 파일의 다른 `string` 필드들과 스타일이 다르다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:36`
  - 상세: `id`·`workspaceId`(`@ApiProperty({ format: 'uuid' })`)나 `createdAt`·`updatedAt`(`@ApiProperty({ format: 'date-time' })`) 등 다른 `string` 타입 필드는 `type: String` 을 명시하지 않고 TS 타입 추론(`reflect-metadata`)에 맡긴다. `threshold` 만 `type: String` 을 명시한 이유(과거에 `number` 였던 필드를 문자열로 명확히 못박기 위한 것으로 추정)가 코드에 드러나지 않아, 다음 사람이 "이 필드만 왜 명시적인가"를 다시 추적해야 한다.
  - 제안: 필요하다면(예: reflect-metadata 추론이 애매한 상황을 피하려는 의도라면) 그 이유를 JSDoc 안에 한 줄로 남기거나, 굳이 필요 없다면 다른 필드와 동일하게 `type: String` 을 생략해 스타일을 통일한다.

- **[INFO]** `CHANGELOG.md` 가 단일 파일에 계속 항목을 누적하며 이미 1,800줄을 넘어섰다(이번 diff 는 그중 신규 30줄)
  - 위치: `CHANGELOG.md` 전체(신규 항목은 `CHANGELOG.md:3`)
  - 상세: 이 diff 자체의 책임은 아니지만(기존 관례를 그대로 따른 것), release cut 없이 "Unreleased" 항목만 계속 쌓이는 구조라 파일이 계속 커지고 있다. 리뷰 대상 diff 만 봐도 이미 100건에 가까운 독립 항목이 한 파일에 시간 역순으로 나열돼 있어, 특정 항목을 찾으려면 스크롤/검색에 의존해야 한다.
  - 제안: 이 PR 의 즉각적인 수정 대상은 아니지만, 릴리즈 컷 또는 연도/분기별 파일 분리 같은 아카이빙 정책을 저장소 차원에서 검토할 시점으로 보인다(정보 제공 목적, 이번 diff 에 대한 요구사항 아님).

`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff 는 취소선으로 종전 서술을 보존하면서 반증 결과를 이어 붙이는 방식(`~~(a) ...~~` → `**반증됐다**`)을 쓰고 있어, 이 저장소의 자기-반증 소정정 컨벤션(CLAUDE.md)에 부합하고 가독성도 양호하다 — 별도 지적 사항 없음.

## 요약

이번 변경은 실질적으로 DTO 필드 하나(`AlertRuleDto.threshold`)의 타입 주석을 실제 wire 타입에 맞춰 정정한 것과, 그 결정을 CHANGELOG·plan 문서에 기록한 것이 전부다. 코드 구조(함수 길이·중첩·복잡도·중복 로직)에 영향을 주는 변경은 없으며, 발견된 사항은 전부 문서/주석의 verbosity 및 두 문서 간 서술 중복에 관한 INFO 수준이다. 특히 DTO 필드 JSDoc 이 같은 파일의 다른 필드 대비 과도하게 길어 일관성이 흐트러진 점과, CHANGELOG 항목과 거의 동일한 서사를 반복해 향후 drift 위험을 만든 점은 사소하지만 개선 여지가 있다. 전체적으로 유지보수성을 저해하는 구조적 문제는 없다.

## 위험도

LOW
