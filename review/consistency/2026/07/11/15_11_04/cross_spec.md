# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md` (impl-done)

## 검토 범위 확인

diff 는 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 단일 파일을
`dto/responses/` 하위 3개 파일로 분리하는 **순수 리팩터**다:

- `dto/responses/execution-status-response.dto.ts` (`ExecutionStatusDto` + `CurrentNodeDto`/`WaitingContextBaseDto`/context variant)
- `dto/responses/interact-ack-response.dto.ts` (`InteractAckDto`)
- `dto/responses/refresh-token-response.dto.ts` (`RefreshTokenResponseDto`)

클래스 정의·필드·데코레이터 내용은 이동 전후 동일하며(git diff 상 rename + import 경로 수정만), JSDoc 안의 spec 상대링크(`../../../../../../spec/...` → `../../../../../../../spec/...`)만 파일이 한 단계 깊어진 디렉터리 구조에 맞춰 보정됐다. 신규 엔드포인트·신규 필드·신규 요구사항 ID·상태 전이·RBAC 변경은 없다.

## 발견사항

없음. 아래는 근거로 확인한 사실들이다.

- **spec 자체가 이미 이 구조를 문서화하고 있었다.** `spec/5-system/14-external-interaction-api.md` §10 "구현 파일 구조"는 origin/main 대비 이번 브랜치에서
  ```
  -      responses.dto.ts
  +      responses/                         # 응답 DTO (swagger §5-1: dto/responses/*-response.dto.ts)
  +        execution-status-response.dto.ts # ExecutionStatusDto + context variant (...)
  +        interact-ack-response.dto.ts     # InteractAckDto
  +        refresh-token-response.dto.ts    # RefreshTokenResponseDto
  ```
  로 갱신되어 있고(커밋 `5047750de docs(external-interaction): DTO 정규화 리뷰 후속 — 체크박스·spec 파일경로 정합화`), 코드 diff 가 정확히 이 문서화된 파일명·구조와 일치한다. 즉 이번 diff 는 spec §10 을 "선언"이 아니라 "실제 구현"으로 채운 것 — spec-코드 간 desync 를 해소하는 방향이며 새로운 충돌을 만들지 않는다.
- **다른 spec 영역(swagger 규약)과도 정합.** `spec/conventions/swagger.md` §5 는 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 네이밍을 SoT 로 명시한다(파일 내 line 278 "`dto/responses/*-response.dto.ts`", checklist "응답 DTO 가 `dto/responses/` 에 있는지"). 이번 리팩터로 `external-interaction` 모듈도 이 컨벤션을 따르게 됐다.
- **동일 패턴이 코드베이스 전역에 이미 정착되어 있다.** `find codebase/backend/src/modules -type d -name responses` 결과 `folders`/`edges`/`notifications`/`auth`/`triggers`/`workflows`/`executions`/`users`/`workspaces` 등 19개 모듈이 이미 `dto/responses/` 서브디렉터리 패턴을 쓰고 있다 — `external-interaction` 이 예외로 남아 있던 것을 정리한 것이며, 계층 책임 분할 관점에서 기존 결정과 충돌하지 않는다.
- **dangling 참조 없음.** `grep -rn "responses\.dto\b" spec/` 와 `codebase/` 전체에서 옛 단일 파일명(`responses.dto.ts`/`responses.dto`)을 참조하는 곳이 0건 — 다른 spec 문서·코드 주석이 옛 경로를 가리켜 깨지는 사례 없음.
- **상대경로 링크 재계산이 정확함.** 이동된 파일(`.../external-interaction/dto/responses/*.ts`)에서 `spec/` 루트까지는 7단계 상위(`responses→dto→external-interaction→modules→src→backend→codebase`)이므로 diff 의 `../../../../../../../spec/...` (7개 `../`) 는 실제 디렉터리 깊이와 일치한다.
- **데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 관점 모두 무영향.** `InteractAckDto`/`RefreshTokenResponseDto`/`ExecutionStatusDto` 의 필드·enum·`waiting_for_input` 오브젝트 shape 는 파일 이동 전후 100% 동일(코드 diff 상 순수 `git mv` + import 경로 수정, 로직·데코레이터 값 변경 없음). `spec/1-data-model.md` §2.13.2 `ExecutionToken`, §2.8 `Trigger.config.notification/interaction` 등 EIA 와 맞닿은 다른 spec 서술과도 모순 없음.

## 요약

이번 diff 는 `spec/5-system/14-external-interaction-api.md` §10 이 이미 선언해 둔 `dto/responses/*-response.dto.ts` 구조와 `spec/conventions/swagger.md` §5 컨벤션을 코드에 그대로 반영하는 순수 파일 재구성이며, 클래스 필드·엔드포인트 계약·요구사항 ID·상태 머신·RBAC 어느 것도 바꾸지 않는다. 코드베이스 전역에 이미 정착된 `dto/responses/` 패턴에 `external-interaction` 모듈을 합류시켜 계층 책임 분할 관점의 기존 결정과도 정합한다. 다른 spec 영역과의 충돌 소지를 찾지 못했다.

## 위험도

NONE
