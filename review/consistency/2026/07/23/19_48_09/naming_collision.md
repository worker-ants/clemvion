# 신규 식별자 충돌 검토 — presentation-thread-optout-drift

## 검토 범위 요약

target(`plan/in-progress/presentation-thread-optout-drift.md`)은 `spec/4-nodes/6-presentation/0-common.md §4.6`
의 서술을 "동작(구현됨) / 표면(미구현)" 두 층위로 정밀화하고, `spec/conventions/conversation-thread.md §2.4`
와의 정합을 확인하는 **순수 문서 정밀화 작업**이다. 새 요구사항 ID, 새 엔티티/DTO, 새 API endpoint, 새
이벤트/메시지명, 새 ENV var/config key, 새 spec 파일 경로 중 어느 것도 새로 도입하지 않는다 — 기존
필드 `excludeFromConversationThread` (이미 AI 3노드 + presentation 5노드 spec 에 존재)의 서술을 사실에
맞게 고치는 것이 전부다. 따라서 엄밀한 "신규 식별자" 충돌은 없으나, target 이 **유지·강화**하려는 기존
문구 중 실제 코드/타 영역 SoT 와 어긋나는 라벨이 있어 아래에 보고한다.

## 발견사항

- **[WARNING]** presentation 쪽 `excludeFromConversationThread` UI 그룹 라벨이 AI 카테고리의 실제 GROUP 상수와 다르고 코드 근거가 없다
  - target 신규 식별자: 없음(신규 도입 아님) — target 이 §4.6 개정에서 **유지 대상**으로 남길 가능성이 있는 기존 문구 `UI 그룹: Advanced > Conversation` (`spec/4-nodes/6-presentation/0-common.md:162`)
  - 기존 사용처:
    - `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts:27` — `const GROUP = 'Conversation Context';` (AI 3노드 `ai_agent`/`text_classifier`/`information_extractor` 공유 fragment, `excludeFromConversationThread` 포함 5필드가 모두 이 GROUP 사용)
    - `spec/conventions/conversation-thread.md:187` (§2.4 opt-out) — "UI 그룹은 `Conversation Context`" 라고 명시적으로 SoT 선언
    - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:371,383,395` — `group: 'Advanced'` (평면 문자열, `excludeFromConversationThread` 와 무관한 다른 필드들에 사용)
  - 상세: 런타임 게이트(`ConversationThreadService.appendInternal`/`isOptedOut`)는 노드 종류를 가리지 않고 동일한 `config.excludeFromConversationThread` 를 읽으므로, 이는 "다른 의미로 쓰이는 동일 이름"이 아니라 **같은 필드의 cross-category 재사용**이다. 문제는 presentation 쪽 spec 문구가 주장하는 UI 그룹 라벨 `Advanced > Conversation` (계층형 `Group > Subgroup` 표기)이 (a) presentation schema 가 아직 이 필드를 선언하지 않으므로 코드 근거가 전혀 없고, (b) AI 쪽의 실제 GROUP 상수 `'Conversation Context'` (평면 문자열)와도 다르며, (c) 계층형 `>` 그룹 라벨 문법 자체가 code/spec 어디에도 선례가 없다는 점이다. target 의 개정 방침 2 는 "UI 노출은 Planned — 필요해지면 AI 노드처럼 공유 fragment 선언을 추가한다" 고 명시해 향후 구현이 AI 패턴(=`GROUP = 'Conversation Context'` 재사용)을 그대로 따를 개연성을 시사하는데, 그럴 경우 실제 구현 그룹명은 `Conversation Context` 가 될 것이므로 지금 문서에 남기는 `Advanced > Conversation` 라벨과 최종적으로 어긋난다. 원래 checker 가 지적한 오류(스키마도 없는데 필드 존재를 단정)의 연장선에 있는 세부 항목인데, target 은 "UI 노출은 Planned" 로 톤은 낮추지만 `Advanced > Conversation` 라벨 문자열 자체를 폐기하라는 지시는 명시하지 않아 그대로 남을 위험이 있다.
  - 제안: §4.6 개정 시 `UI 그룹: Advanced > Conversation` 문구를 삭제하거나 "그룹명 미확정 — 구현 시 AI 카테고리 공유 GROUP 상수(`'Conversation Context'`) 재사용 여부를 결정 필요" 로 명시적으로 조정한다. 계층형 `Group > Subgroup` 표기를 신규 컨벤션으로 굳힐 의도가 아니라면 평면 라벨로 정정한다.

- **[INFO]** frontmatter `code:` 후보 파일 경로가 이미 등재된 유사 이름 디렉터리와 혼동될 수 있다
  - target 신규 식별자: 체크리스트 3항 "frontmatter … `code:` 에 게이트 구현 파일(`conversation-thread.service.ts`)을 포함할지 판단"
  - 기존 사용처: `spec/4-nodes/6-presentation/0-common.md` frontmatter 는 이미 `codebase/backend/src/shared/conversation-thread/**` 를 갖고 있다(실측: 이 디렉터리엔 `conversation-thread.types.ts` 만 존재). 실제 게이트 구현(`appendInternal`/`isOptedOut`)은 `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` — 폴더명은 같은 `conversation-thread` 이지만 **다른 상위 경로**(`shared/` vs `modules/execution-engine/`)다.
  - 상세: 두 디렉터리가 말단 폴더명이 동일해 체크리스트 수행자가 "이미 `shared/conversation-thread/**` glob 이 커버한다"고 오판하고 실제로는 커버되지 않는 진짜 게이트 파일을 frontmatter 에 추가하지 않을 위험이 있다(경로 충돌은 아니지만 명명 유사성에 의한 오판 위험).
  - 제안: 항목 실행 시 전체 정확 경로 `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts` 를 새 `code:` 줄로 명시 추가하고, 기존 `shared/conversation-thread/**` 항목과 구분되게 기재한다.

- **[INFO]** plan 파일명이 인용하는 선행 plan 의 명명 패턴과 접미사가 살짝 다르다
  - target 신규 식별자: `plan/in-progress/presentation-thread-optout-drift.md`
  - 기존 사용처: target 이 "선행" 으로 직접 인용하는 같은 계보 plan `plan/in-progress/presentation-previousoutput-spec-drift.md` (PR #997)
  - 상세: 선행 파일은 `presentation-<필드>-spec-drift.md` (중간에 `-spec-`) 패턴인데 target 은 `presentation-<필드>-drift.md` (`-spec-` 생략)로 다르다. 동일 경로 파일은 없어 기능적 충돌은 없고 순수 명명 일관성 문제다.
  - 제안: 강제 아님. 같은 영역에서 세 번째 선재 drift 가 나와 "영역 일괄 정리" 로 전환될 경우, 그 시점에 `-spec-drift` 접미사 통일을 함께 고려.

## 요약

target 은 신규 식별자(요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로)를 하나도 새로
도입하지 않는 순수 문서 정밀화 작업이라 이 검토 관점에서의 정면 충돌은 없다. 다만 target 이 유지·강화
하려는 기존 §4.6 문구 중 `excludeFromConversationThread` 의 "UI 그룹: Advanced > Conversation" 라벨이
AI 카테고리의 동일 필드가 실제로 쓰는 GROUP 상수(`'Conversation Context'`, `conversation-context-schema.ts:27`)
와 다르고 code 근거도 없어, 향후 표면 구현 시(target 자신이 "AI 노드처럼" 이라고 예고한 경로) 라벨
불일치로 이어질 개연성이 있다(WARNING). frontmatter `code:` 보강 항목은 이름이 유사한 두 디렉터리
(`shared/conversation-thread/` vs `modules/execution-engine/conversation-thread/`) 혼동 위험이 있어
정확한 전체 경로 명시를 권고한다(INFO). 두 항목 모두 target 의 실행을 막을 정도는 아니며 §4.6 개정
시 함께 반영 가능한 수준이다.

## 위험도

LOW
