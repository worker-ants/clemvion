# 신규 식별자 충돌 검토 — `patch-body-followups` (scope: spec/2-navigation/ 번들 + 실제 구현 대상 plan)

## 검토 범위 확인

`--impl-prep` 대상은 번들 헤더의 `spec/2-navigation/` 이 아니라, "추가 Read 블록" 이 지목한
`plan/in-progress/patch-body-followups.md` 다. 실제 코드 변경 표면은:

- `UpdateWorkflowDto.description` (`codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`)
- `UpdateNodeDto.description` (`codebase/backend/src/modules/nodes/dto/update-node.dto.ts`)
- `UpdateAuthConfigDto.ipWhitelist` (`codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`)
- 기존 e2e(`codebase/backend/test/patch-partial-body.e2e-spec.ts`) 에 케이스 추가
- 기존 단위 테스트(`workflows.service.spec.ts` 패턴)를 `nodes`/`auth-configs` 서비스 스펙에 반복
- 헬퍼 JSDoc(`omit-undefined.ts`), CHANGELOG, 트래커(`spec-draft-nullable-notation-followups.md`) 문서 갱신

세 필드 모두 **데코레이터 선언만** `@ApiPropertyOptional({ nullable: true })` + `T | null` 로 바꾸는
것이며, 새 엔티티·DTO 클래스·API endpoint·이벤트·ENV/설정키·spec 파일 경로 중 어느 것도 신설하지
않는다. `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 본문(bundle 로
전달된 부분)도 이 변경과 겹치는 신규 식별자를 선언하지 않는다(트리거/스케줄 축은 이 plan 의 코드
스코프 밖).

## 발견사항

없음 — 아래는 확인한 근거이지 결함이 아니다.

- **패턴 재사용, 신규 아님**: `description?: T | null` + `nullable: true` 조합은 이미
  `UpdateWorkflowDto.folderId` · `UpdateNodeDto.containerId`/`toolOwnerId` 에 쓰이고 있고, SoT 규약
  `spec/5-system/2-api-convention.md:278` 가 이 조합을 "PATCH tri-state" 요청 DTO 전용 예외로
  **이미 성문화**했다(선례로 `UpdateAssistantSessionDto.llmConfigId` 를 인용). target 이 새 명명
  관례를 만드는 것이 아니라 기존 관례를 두 곳 더 적용하는 것이라 충돌 여지가 없다.
- **단위 캐너리 제목 재사용, 충돌 없음**: `workflows.service.spec.ts:492` 의
  `it('명시적 null 은 로드한 값을 지운다', ...)` 를 `nodes`/`auth-configs` 서비스 스펙에 같은
  제목으로 추가할 계획이나, Jest 테스트명은 파일(= describe 블록) 스코프라 동일 문자열이 다른
  파일에 있어도 충돌이 아니다(grep 확인 — 현재 workflows 축에만 존재).
  `codebase/backend/src/modules/workflows/workflows.service.spec.ts:492`
- **e2e 케이스 문자 슬롯**: `patch-partial-body.e2e-spec.ts` 는 현재 `A~D` 네 케이스만 있다
  (`codebase/backend/test/patch-partial-body.e2e-spec.ts:67,101,137,215`). 신규 케이스는 다음
  문자(`E` 이상)를 쓰면 되며 기존 라벨과 겹치지 않는다.
- **신규 트래커 항목("PATCH NOT NULL 필드의 null 이 500")**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  전체(6,600줄+)에 `PATCH.*NOT NULL`/`NOT NULL.*500` 패턴이 현재 0건이라(grep 확인) 제목·범위가
  기존 항목과 겹치지 않는다. 단, 이 항목은 구체적 에러 코드를 아직 결정하지 않은 채 등재만 하므로
  ("처방(검증 데코레이터 vs 필터의 23502 매핑)이 결정 사항") — 실제 구현 시점에 새 에러 코드를
  도입한다면 그때 `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`INTERNAL_ERROR` 등 기존
  `spec/conventions/error-codes.md` 코드와의 충돌 여부를 별도로 재검토해야 한다(현재는 코드가
  없어 검사 대상 자체가 없음).
- **`ipWhitelist` 의미 중복(참고, 식별자 충돌 아님)**: `UpdateAuthConfigDto.ipWhitelist` 설명에
  이미 "빈 배열(`[]`) 전송 시 화이트리스트 전체 삭제" 가 명시돼 있어, 이번에 추가되는
  `null` 도 같은 "전체 삭제" 효과를 갖게 되면 `[]` 와 `null` 두 값이 같은 의미를 갖는 표현
  중복이 생긴다. 이는 **동일 이름 재사용 충돌이 아니라 값 공간(value-space) 설계 이슈**라 본
  checker 관점(신규 식별자 충돌) 밖이다 — 참고로만 남긴다.

## 요약

target(`patch-body-followups` 구현 스코프)은 새 요구사항 ID·엔티티/DTO/인터페이스명·API
endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 신설하지 않는다. 변경은 기존 세 DTO
필드의 nullable 선언을 이미 성문화된 PATCH tri-state 관례(`spec/5-system/2-api-convention.md`
§5.4)에 맞추는 것이고, 추가되는 테스트 제목·e2e 케이스 라벨·트래커 항목 제목도 grep 으로 확인한
결과 기존 사용처와 겹치지 않는다. 신규 식별자 충돌 관점에서 이 target 은 위험이 없다.

## 위험도

NONE
