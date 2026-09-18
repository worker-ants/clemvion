# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

- `spec/2-navigation/` 자체의 델타는 **0개 파일**이다 (이 브랜치는 그 spec 영역을 바꾸지 않았다). 따라서 target 문서(`1-workflow-list.md`, `2-trigger-list.md`)의 구조·명명 자체는 이 PR 이 만든 상태가 아니라 기존 baseline이다.
- 실제 변경은 `codebase/` 9개 파일(주석·식별자 rename, 동작 불변 — plan 제목 "trigger-release-stale-comments" 그대로)이다. 정식 규약 준수 관점에서 이 변경이 규약(`spec/conventions/review-citations.md`, `spec/conventions/secret-store.md`, `spec/conventions/spec-impl-evidence.md` 등)과 정합한지를 확인했다.

## 발견사항

- **[INFO]** 리뷰 인용 규약(`review-citations.md`) 준수 개선 — 정정 확인
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 의 diff(주석)
  - 관련 규약: [`spec/conventions/review-citations.md` §2](../../../../../../spec/conventions/review-citations.md) — "bare `hh_mm_ss` 는 쓰지 않는다"
  - 상세: 종전 주석 `` (`/ai-review` 18_45_09 WARNING#2·#4) `` 은 §2 가 명시적으로 금지하는 **bare 시각** 형태였다. 이번 diff 가 이를 `` (`/ai-review` `review/code/2026/09/17/18_45_09` WARNING#2·#4) `` 전체 경로 형태로 정정했다 — 규약 위반 사례를 규약 준수 사례로 바꾼 것이라 지적이 아니라 확인 사항이다.
  - 제안: 없음 (이미 규약대로 고쳐짐). 다만 §4 는 "기존 bare 인용은 다음에 건드릴 때 함께 맞춘다"는 방침이므로, 이번처럼 해당 라인을 건드리는 김에 정정한 패턴을 앞으로도 유지할 것을 권장.

- **[INFO]** 신규/변경 주석의 리뷰 인용 형식은 전부 규약 형태를 따름
  - target 위치: `secret-resolver.service.ts`, `chat-channel-binder.service.ts`, `trigger-config-lock.ts`, `triggers.service.spec.ts` diff 내 주석
  - 관련 규약: `spec/conventions/review-citations.md` §2·§3
  - 상세: 확인된 인용 전부(`` `/ai-review` `review/code/2026/05/22/11_24_03` #24 ``, `` `/ai-review` `review/code/2026/09/15/01_42_04` documentation INFO#17 ``, `` `review/code/2026/09/14/19_44_08` side_effect·concurrency CRITICAL#1 ``)가 "전체 경로(권장)" 형태이며 날짜를 포함한다. DTO/컨트롤러 JSDoc(§3 예외 대상)이 아닌 일반 서비스/테스트 파일이므로 이 규약이 정상 적용되는 자리이고, 위반 없음.

- **[INFO]** 리네임된 식별자(`teardownChannelConfig` → `teardownRegisteredChannel`)의 spec 잔존 참조 없음
  - target 위치: `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md` 전체
  - 상세: `grep -rn "teardownChannelConfig" spec/` 결과 0건 — 옛 메서드 이름을 인용하는 spec 문장이 없다. 코드 주석이 인용하는 `spec 트리거 목록 §4.3`(cascade 동작), `secret-store.md §2.1/§5.3/§R4` 섹션도 실제로 해당 문서에 존재해 인용 링크가 착지한다(dangling reference 없음).
  - 제안: 없음.

- **[INFO]** `spec-impl-evidence.md` R-11 (공유 트래커 승격 규칙)과 target 문서 frontmatter 는 이 브랜치 스코프 밖
  - target 위치: `spec/2-navigation/1-workflow-list.md`, `2-trigger-list.md` frontmatter (`status: partial`, `pending_plans:`)
  - 상세: `spec/conventions/spec-impl-evidence.md` R-11 은 2026-09-18 에 `1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md`·`chat-channel-adapter.md` 4개 문서가 같은 트래커를 가리켰던 사례를 다룬다. 그러나 이 사례는 `spec/2-navigation` 델타 0(이미 `origin/main`에 반영된 이전 커밋)이므로 이번 diff 의 검토 대상이 아니다. target 두 문서의 현재 `pending_plans`(각각 `marketplace-and-plugin-sdk.md`/`workflow-duplicate-nodes-edges.md`, `spec-draft-nullable-notation-followups.md`)는 트리거 삭제 자원 정리 트래커와 무관한 별개 미구현 항목이라 `status: partial` 유지가 R-11 판정 기준(그 문서 몫의 미구현 surface 존재)과 모순되지 않는다.
  - 제안: 없음 — 확인만 하고 통과.

## 요약

이번 diff 는 `spec/2-navigation/` 문서 자체를 변경하지 않았고(델타 0), 실제 변경은 `codebase/` 의 주석·식별자 정리(동작 불변)다. 검토 결과 새 주석의 리뷰 산출물 인용은 전부 `review-citations.md` §2·§3 이 요구하는 "전체 경로 + 날짜" 형태를 따르며, 오히려 기존 bare 인용 하나(`18_45_09`)를 규약 형태로 정정했다. 리네임된 식별자(`teardownRegisteredChannel`)에 대한 spec 상 잔존 구식 참조도 없고, 코드 주석이 인용하는 spec 섹션(`트리거 목록 §4.3`, `secret-store.md §2.1/§5.3/R4`)도 모두 실존해 링크가 착지한다. DTO/컨트롤러/Swagger 데코레이터를 건드리는 변경이 없어 API 문서 규약(swagger.md) 항목은 해당 사항이 없다(N/A). CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
