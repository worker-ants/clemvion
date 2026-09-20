# 신규 식별자 충돌 검토 — `dup-delete-audit` (impl-prep, scope=spec/2-navigation)

## 검토 대상 요약

target 은 `spec/2-navigation` 번들 전체 + 이번에 착수하려는
`plan/in-progress/dup-delete-audit.md` (developer 작성, `spec_impact: none`)다. 이 plan 은
`WorkflowsService.remove()` 의 동시 중복 DELETE 감사 로그 이슈를 고치는 순수 버그픽스로,
새로 제안하는 표면은 다음 세 가지뿐이다:

1. 기존 helper `TriggerResourceReleaserService.lockParentAndListTriggerIds()` 의 반환 타입을
   `Promise<string[])` → `Promise<{ parent: 'present' | 'absent'; triggerIds: string[] }>` 로 확장.
2. 워크플로 삭제 경로에서 `parent === 'absent'` 일 때 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 던지기.
3. 워크스페이스 삭제 호출부는 새 반환 형태에 타입만 맞춤(동작 불변, `assertWorkspaceDeletable` 재검사가 이미 존재).

새 REQ ID, 새 엔티티/DTO, 새 API endpoint, 새 이벤트/큐 이름, 새 ENV var·config key, 새 spec 파일
경로는 이 plan 에 전혀 없다 — 검토 관점 1·3·4·5·6 은 해당 사항 없음(N/A)이다. 아래는 관점 2(엔티티/타입명)
축에서 확인한 내용이다.

## 확인한 사항 (충돌 없음)

- **`RESOURCE_NOT_FOUND` 코드 재사용, 신규 아님**: `codebase/backend/src/common/filters/http-exception.filter.ts:141`,
  `codebase/backend/src/modules/triggers/triggers.service.ts:414`,
  `codebase/backend/src/modules/nodes/nodes.service.ts:68` 등 여러 서비스가 이미 동일 코드를
  동일 의미(리소스 없음 → 404)로 쓰고 있다. plan 이 이 코드를 재사용하는 것은 신규 도입이 아니라
  기존 관례를 따르는 것 — 오히려 `spec/2-navigation/2-trigger-list.md` §4.4 "동시 삭제: 두 클라이언트가
  동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 가 이미 문서화한 것과 정확히
  같은 패턴이다. 충돌이 아니라 선례와의 정합.
- **`'present' | 'absent'` 리터럴, 익명 타입 — 이름 있는 타입·인터페이스와 충돌 없음**: 코드베이스
  전체에서 `'present'`/`'absent'` 사용처를 확인했으나(예:
  `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:117-118` 의
  로그 문자열 `'present' : 'empty'`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1355,1406,3426`
  의 `status ?? 'absent'` 로그 폴백, `agent-memory-admin.service.spec.ts:255` 의 테스트용 workspaceId
  문자열) 전부 로그 문자열이나 테스트 픽스처 값으로, export 되는 타입이나 공개 계약이 아니다. plan 의
  반환 필드는 `lockParentAndListTriggerIds` 시그니처에 지역적으로만 존재하는 익명 객체 타입이라
  이들과 이름공간이 겹치지 않는다.
- **`spec/2-navigation/6-config.md:190` 의 `presence_penalty`**: LLM 샘플링 파라미터로 완전히
  다른 도메인(우연한 부분 문자열 일치일 뿐 "presence" 개념 자체가 없다) — 혼동 소지 없음.
- **`TriggerParent` 타입과의 관계**: 기존 파라미터 타입 `TriggerParent`
  (`codebase/backend/src/modules/triggers/trigger-resource-release.ts:115`)는 그대로 유지되고,
  plan 은 그 타입을 바꾸지 않는다. 새 반환 필드명 `parent`(상태 문자열을 담는 키)가 같은 함수
  시그니처 안에서 파라미터 이름 `parent`(엔티티 참조 객체)와 같은 단어를 쓰는 것은 사실이나, 이는
  같은 파일·같은 함수의 지역 변수/반환 필드 수준 명명이라 "기존 사용처와의 충돌"(다른 의미로 이미
  쓰이는 식별자)에는 해당하지 않는다 — 굳이 지적한다면 가독성 차원의 아주 약한 혼동 소지 정도이며,
  이 checker 의 판정 기준(CRITICAL/WARNING 은 식별자 재사용에 따른 실질적 혼선)에는 못 미친다.

## 발견사항

없음 — CRITICAL/WARNING 대상 식별자 충돌을 찾지 못했다.

## 요약

`plan/in-progress/dup-delete-audit.md` 는 `spec/2-navigation` 에 spec 변경을 가하지 않는
(`spec_impact: none`) 순수 코드 버그픽스이며, 새로 도입하는 식별자 표면 자체가 극히 작다(기존
helper 반환 타입의 지역적 확장 하나, 기존 에러 코드 `RESOURCE_NOT_FOUND` 재사용 하나). 두 항목
모두 코드베이스·spec 전반의 기존 사용처와 대조했을 때 의미가 겹치거나 다른 뜻으로 이미 쓰이고
있는 사례를 찾지 못했다 — 오히려 `RESOURCE_NOT_FOUND` 재사용은 `2-trigger-list.md` §4.4 가 이미
기록한 "동시 삭제 → 두 번째 요청 404" 관례와 정확히 합치한다. 요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·ENV/설정키·spec 파일 경로 축은 모두 신규 도입이 없어 해당 사항이 없다(N/A).

## 위험도

NONE
