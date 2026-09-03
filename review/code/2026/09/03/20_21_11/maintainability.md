# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

`WorkspaceInvitationDto.invitedBy` nullable 정정(코드 2건: DTO 선언 + 컨트롤러 spec 신규 테스트 2건), CHANGELOG 항목, plan 문서 갱신, 그리고 직전 리뷰 라운드(`20_02_03`)의 산출물(SUMMARY/RESOLUTION/개별 reviewer 리포트/`_retry_state.json`/`meta.json`)이 신규 커밋 파일로 포함되어 있다. 후자는 이 저장소 관례상(`review/` 는 gitignored 아님) 프로세스 이력이지 리뷰 대상 "코드"가 아니므로, 실질 코드 변경(파일 2·3)과 코드에 준하는 서술 문서(파일 1·4)에 집중했다.

## 발견사항

- **[INFO]** `invitedBy?: string | null`(optional key) 표기가 같은 파일의 `invitedByName: string | null`(non-optional, 항상 존재)과 다른 컨벤션을 쓴다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:110` (대조: `:155`)
  - 상세: 실제 응답은 두 필드 모두 키가 항상 존재하고 값만 `null` 일 수 있는 형태다(핸들러가 코어션 없이 그대로 통과시킴). 그런데 하나는 `?:`(optional key) + `| null`, 다른 하나는 `| null` 만 쓴다. 같은 파일 안에서 같은 의미론에 두 가지 표기가 공존해 다음 필드를 추가하는 사람이 어느 쪽을 따라야 할지 판단하기 어렵다.
  - 제안: 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md`(§후속, `--impl-done 19_02_06` INFO#1)에 planner 턴 위임 항목으로 명시 추적 중이므로 이 PR 범위에서 재조치는 불요. §5.4 표기가 확정되면 두 필드를 함께 통일할 것.

- **[INFO]** 신규 `listInvitations` 테스트 블록의 설명 주석이 같은 파일의 다른 describe 블록보다 눈에 띄게 장문·산문체다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:61-69` (대조: `update`/`remove`/`leave`/`transferOwnership` 블록은 `it()` 설명만 있고 블록 docstring 없음)
  - 상세: 새 블록은 FK cascade 배경, 테스트가 고정하는 대상, 회귀 시 재검토 대상까지 5줄짜리 JSDoc 스타일 주석을 달았다. 내용 자체는 정확하고 유용하지만(왜 이 테스트가 존재하는지, 무엇을 깨면 다시 봐야 하는지) 파일 내 다른 블록과 스타일이 갈린다. 결함은 아니고, 다음에 이 파일을 건드리는 사람이 "이 파일의 관례가 뭐지" 판단할 때 참고할 정보로 남긴다.
  - 제안: 조치 불요. 다만 향후 유사하게 배경 설명이 필요한 회귀 테스트를 추가할 때 이 형태를 파일의 새 관례로 굳힐지, 혹은 plan 문서 참조로 대체해 spec 파일은 terse 하게 유지할지 팀 컨벤션으로 정리하면 좋다.

- **[INFO]** DTO 필드 변경 자체(가독성·네이밍·매직넘버·중복·복잡도)에는 결함 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
  - 상세: `@ApiProperty` → `@ApiPropertyOptional({ format: 'uuid', nullable: true })` 전환과 JSDoc 주석(FK `ON DELETE SET NULL` 근거 명시)은 파일 내 기존 패턴(`WorkspaceSettingsDto.timezone` 등 `required: false` 필드들)과 일관되고, 변경 이유가 코드 자체에 남아 있어 가독성이 좋다.
  - 제안: 해당 없음(참고용 확인 사항).

- **[INFO]** 신규 테스트 2건의 구조적 중복(모킹 설정 → 호출 → 단언)은 문제 삼을 수준이 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:70-103`
  - 상세: 정상 케이스(`invitedBy: null`)와 대조군(`invitedBy: 'user-uuid-1'`) 두 테스트가 mock 데이터 한 필드만 다르고 나머지 구조가 동일하다. 그러나 이는 같은 파일의 기존 happy-path/error-path 페어 패턴과 일치하고, 케이스 수가 2개로 작아 헬퍼 추출이 오히려 간접성만 늘린다.
  - 제안: 해당 없음.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "48건" 관련 신·구 절 모순은 이 diff 안에서 이미 해소됨
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` §「배치 3 — 잔여 전량」절 (구 서술에 폐기 배너 + 전방 포인터 추가됨)
  - 상세: 직전 리뷰 라운드(`20_02_03`) WARNING#3 이 지적했던 신·구 절 모순은, 이번에 검토 대상인 diff 안에서 이미 취소선 처리 + "폐기됐다" 배너 + 전방 포인터로 조치되어 있다(`RESOLUTION.md` W3 조치 내역과 일치). 별도 신규 발견 아님.
  - 제안: 해당 없음(이미 조치됨 확인).

## 요약

핵심 코드 변경(`WorkspaceInvitationDto.invitedBy` nullable 전환 + 테스트 2건 추가)은 범위가 작고 목적이 명확하며, 변경 이유가 JSDoc·테스트 주석에 남아 있어 가독성이 좋다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 문제 삼을 만한 대목이 없다. 유일한 유지보수성 관찰 사항은 (1) `invitedBy?: string | null` 과 `invitedByName: string | null` 의 optional-key 표기 불일치인데, 이는 이미 plan 문서에서 planner 턴으로 위임 추적 중이라 이번 PR 범위 재조치 대상이 아니고, (2) 신규 테스트 블록의 주석 밀도가 파일의 기존 관례보다 높다는 점인데 결함이라기보다 스타일 관찰이다. 나머지 변경(CHANGELOG, plan 문서, 직전 리뷰 라운드 산출물)은 코드가 아니라 문서/프로세스 이력이며 구조·형식 모두 기존 관례를 따른다.

## 위험도
NONE
