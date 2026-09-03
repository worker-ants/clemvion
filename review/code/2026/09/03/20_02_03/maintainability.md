# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceInvitationDto.invitedBy` 를 `string` → `string | null`(optional) 로 정정 + 근거 주석 추가
- `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts` — `listInvitations` 캐너리 테스트 2건 추가
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — plan 서술 갱신 (응용 코드 아님, 참고용으로만 훑음)

## 발견사항

- **[INFO]** 같은 파일 안에서 "항상 존재하지만 nullable" 필드의 optional 표기가 두 가지로 갈린다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:110` (`invitedBy?: string | null;`, `@ApiPropertyOptional`) vs `:155` (`invitedByName: string | null;`, `@ApiProperty({ nullable: true })`)
  - 상세: `invitedBy` 는 컨트롤러가 `i.invitedBy` 로 **항상** 매핑하는 필드(생략되는 경우 없음, `workspaces.controller.ts:397-404` 확인)인데도 `?:` (optional) 로 선언됐다. 반면 같은 파일의 `invitedByName` 은 의미상 동일한 "삭제된 초대자" 케이스를 다루면서도 non-optional 로 선언돼 있다. `?:` 표기는 "키가 생략될 수 있다" 는 뜻이라 실제 동작(상시 존재)과 어긋난다. 저장소 전체로 보면 이번 변경이 다수 패턴(`@ApiPropertyOptional({nullable:true})` + `field?: T | null` — grep 확인 시 `nodes`/`triggers`/`statistics`/`audit-logs` 등에서 지배적)을 따른 것이라 신규 결함은 아니고, 오히려 소수파인 `invitedByName`/`AuthConfigUsageCallDto.sourceIp` 쪽이 예외다.
  - 제안: 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` §할일(`INFO#1` 재인용)에 planner 턴 결정 사항으로 명시적으로 트래킹되어 있다(규약 §5.4 문구를 고칠지 `sourceIp`/`invitedByName` 을 규약에 맞출지 결정 필요). 이번 diff 범위에서 추가 조치는 불필요 — 그대로 두되, 다음에 이 표기를 인용할 때 근거로 참고.

- **[INFO]** 캐너리 테스트 위 주석 블록이 파일 내 다른 `it()` 들과 스타일이 다르다(장문 JSDoc)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:61-69`
  - 상세: `describe('listInvitations', ...)` 블록의 첫 테스트 위에만 8줄짜리 JSDoc 주석(회귀 근거·뮤테이션 검증 결과 포함)이 붙어 있고, 같은 파일의 `update`/`remove`/`leave`/`transferOwnership` 등 다른 `describe` 블록의 `it()` 들은 주석 없이 이름만으로 의도를 전달한다. 내용 자체는 유용하다(왜 이 값이 nullable 이어야 하는지, 어떤 변경이 이 테스트를 깨야 하는지 명시) — 다만 이 파일에서는 이례적으로 밀도가 높다.
  - 제안: 내용을 지우기보다는 유지 가치가 있다(캐너리의 "무엇을 고정하는가" 를 명시하는 것은 이 저장소가 다른 곳에서도 쓰는 패턴 — `workspace-invitations.service.spec.ts` 헬퍼 등). 굳이 손볼 필요는 없음. 다만 이후 이 파일에 같은 수준의 주석이 산발적으로 늘면(현재는 1곳) 일관성 재검토 대상이 될 수 있다.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 는 응용 코드가 아니라 작업 추적 문서라 함수 길이·중첩·매직넘버 등 통상 기준이 적용되지 않는다
  - 위치: 파일 전체
  - 상세: 이번 diff 는 새 섹션(`## 정본(라이브 스키마) 대조`)과 기존 체크박스 갱신으로 구성돼 있다. 근거·실측·반증 이력을 남기는 서술 방식은 이 저장소의 plan 문서 관례와 일치한다(다른 완료 plan 들도 동일 톤). 표(`| 사례 | 왜 정당한가 |`)와 인용 블록이 섞여 다소 밀도가 높지만, 내용이 스스로를 반증·정정하는 과정을 투명하게 남기는 것이 이 저장소가 반복적으로 요구해 온 규약(CLAUDE.md 개발 이력·`--impl-done` 게이트)과 부합한다.
  - 제안: 없음. 문서 리뷰는 별도 `consistency-checker`/`project-planner` 축이 더 적합.

- **[INFO]** DTO 주석의 마이그레이션 참조(`V017`)가 그대로 코드에 남는 것은 이 파일의 다른 필드 주석과 형태가 다르다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-108`
  - 상세: `WorkspaceInvitationDto` 의 다른 필드(`id`, `email`, `role`, `expiresAt`, `createdAt`)는 주석이 전혀 없고, 이번에 추가된 `invitedBy` 만 4줄짜리 JSDoc 을 갖는다. "왜 nullable 인가" 를 근거(FK `ON DELETE SET NULL`)와 함께 남기는 것은 이 필드가 non-null → nullable 로 뒤늦게 정정된 계약 변경이라는 맥락에서 정당한 설명 부채 상환이다(저장소 다른 곳도 `V001:326` 처럼 마이그레이션 라인 참조를 근거로 쓴다).
  - 제안: 없음. 오히려 권장되는 패턴(계약이 왜 이렇게 됐는지 코드에 남기는 것).

## 요약

리뷰 대상 diff 는 스코프가 좁고(DTO 필드 1개 optional/nullable 정정 + 그 동작을 고정하는 캐너리 테스트 2건 + plan 문서 갱신) 함수 길이·중첩·복잡도·중복 축에서 새로 만든 결함이 없다. 유일하게 눈에 띄는 것은 같은 DTO 파일 안에서 "항상 존재하는 nullable 필드"의 optional 표기(`?:`)가 두 갈래(이번 필드 vs `invitedByName`)로 갈리는 기존부터의 불일치인데, 이는 이번 diff 가 만든 것이 아니라 저장소 다수 패턴을 그대로 따른 결과이며, 해당 불일치 자체는 이미 같은 plan 문서에 planner 턴 결정 항목으로 명시 추적되고 있어 이 리뷰에서 추가 조치를 요구하지 않는다. 테스트 코드는 기존 파일의 관용구(`as never` 캐스트, `[대조군]` 네이밍)를 그대로 따르고 있어 일관성 측면에서도 무리가 없다.

## 위험도

LOW
