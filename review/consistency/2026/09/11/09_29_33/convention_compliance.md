# 정식 규약 준수 검토 — `spec-draft-chat-channel-conventions.md`

대상: `plan/in-progress/spec-draft-chat-channel-conventions.md` (검토 모드 `--spec`)
대조: `spec/conventions/**` (특히 `swagger.md`·`chat-channel-adapter.md`·`audit-actions.md`·`error-codes.md`), `spec/5-system/2-api-convention.md §5.3/§5.4`, `spec/5-system/3-error-handling.md §1.10/§2.1`, `spec/5-system/15-chat-channel.md §5.4.1/§5.4.1.1/§5.4.1.2`, `CLAUDE.md`

## 방법

이 target 은 **spec 문서 자체가 아니라 spec 변경을 제안하는 plan draft** 다. 따라서 3섹션(Overview/본문/Rationale) 구조 요구는 대상이 아니고(그건 최종 spec 문서에 적용될 요구), 검토 초점은 (1) plan 이 인용·전제하는 기존 규약 내용이 실제 규약과 맞는가, (2) plan 이 확정하려는 새 규약 문구가 기존 규약의 구조·명명·경계 관례와 정합하는가, (3) plan 자체의 frontmatter/구조가 plan lifecycle 관례를 따르는가에 두었다. 인용된 실측(60곳 `details:` 분류, 18개 `Update*Dto`, `password.util.ts` 무-`code` 배열 2곳 등)을 저장소에서 직접 재확인했다.

## 발견사항

- **[WARNING]** `audit-actions.md` 를 그 문서 자신이 선언한 소유 범위 밖의 SoT 로 인용
  - target 위치: `(a)` 절 "층 판정" 표(❌ 행) 및 `## 결정` CV-1 세 번째 불릿 — *"감사 로그 `details`(22곳) 는 §5.3 적용 범위 밖이다 — 그 형식의 SoT 는 `1-auth.md §4.1` · `conventions/audit-actions.md` 이고, 에러 봉투와 달리 자유형이다."*
  - 위반 규약: `spec/conventions/audit-actions.md` 의 `## Overview` "책임 경계" — *"감사 로그 적재·조회 파이프라인·커버리지 추적: `data-flow/1-audit.md §1.1` (SoT)"* 라고 명시하고, 본 문서가 유일하게 소유하는 것은 "① `<resource>.<verb>` 구조 규칙, ② verb 시제 3분류 taxonomy, ③ 도메인별 분류 레지스트리" 뿐이라고 스스로 한정한다.
  - 상세: `audit-actions.md` 는 `AuditLog.action` **문자열의 명명·시제**만 다루며 `details` **페이로드 형태**에 대해서는 어떤 절도 두지 않는다(본문 전체 확인: `## 1 구조` · `## 2 시제 3분류` · `## 3 레지스트리` 뿐). `details` 가 액션마다 자유형(ad-hoc key)이라는 사실은 오히려 `data-flow/1-audit.md §1.1` 의 레지스트리 표(`details.mode`/`details.field`/`details.from/to` 등 행별 표기)에서 드러난다 — 그 문서가 audit-actions.md 자신이 "적재 파이프라인" SoT 로 위임한 바로 그 문서다. 이 인용 오류는 CV-1 실행 시 `2-api-convention.md §5.3` 본문에 **그대로 박제**될 예정이라(변경안 #1), 다음 사람이 "감사 로그 `details` 형식을 어디서 바꿔야 하나"를 물을 때 잘못된 문서로 안내한다.
  - 제안: CV-1 문구의 인용을 `1-auth.md §4.1` (액션별 `details` 예시가 실제로 나열되는 곳) · `data-flow/1-audit.md §1.1` (적재 파이프라인 SoT, audit-actions.md 자신이 위임한 곳) 로 정정하고, `conventions/audit-actions.md` 는 (명명 규약과의 혼동 방지 목적이 아니라면) 이 인용에서 제외한다.

- **[INFO]** CV-1 이 신설하는 "`field` 있으면 `code` 필수" 규칙에 검증 층(누가 강제하는가) 서술이 없다
  - target 위치: `## 결정` CV-1 전체 / `## 변경안` #1
  - 위반 규약: 명시적 위반은 아니고 인접 관례와의 **완결성 격차**. `spec/5-system/2-api-convention.md §5.4` 는 "검증 층 — 이 규칙을 무엇이 강제하는가"라는 전용 소절을 두어 모든 출력-포맷 규칙에 강제 메커니즘(정적 가드/런타임 가드/사람이 안다)을 명시한다. `swagger.md §1-6` 도 같은 패턴("가드가 강제" vs "규약이 담당")을 명문화했다.
  - 상세: `2-api-convention.md §5.3` 본문이 스스로 "`GlobalExceptionFilter` 는 `details` 를 **그대로 통과**시키며 … 형태를 강제하지 않는다"고 밝히고 있어, CV-1 이 추가하는 "field 있으면 code 필수" 도 **강제 메커니즘이 없는 규칙**이 된다. 이 저장소는 정확히 같은 형태의 실패를 이미 한 번 겪었다 — `swagger.md §3 Rationale` 이 *"37% 미준수는 규칙이 안 지켜진다가 아니라 그건 규칙이 아니었다는 뜻"* 이라고 스스로 기록한 사례다. CV-1 은 기존 15곳을 이번 PR 에서 고치지 않고 "배선(developer)" 로 후속 등재만 하므로, 병합 직후 규칙과 현실의 괴리가 확정적으로 존재한다.
  - 제안: 규칙 위반이 아니므로 후속 조치를 요구하진 않되, `§5.3` 본문에 짧게 "현 시점 강제 메커니즘 없음 — 신규 발행 지점부터 적용, 기존 15곳은 트래커 항목으로 배선 예정"처럼 상태를 명시하면 §5.4 의 기존 패턴과 정합하고 재발(37% 사례) 반복을 예방하는 신호가 된다.

## 검증된 정합 사항 (참고 — 문제 없음)

- CV-2(`Update<Entity>Dto` 접두 범위 한정)는 `swagger.md §1)` 의 기존 넘버링 관례(`1-1`~`1-6`)에 `1-7` 을 잇는 자연스러운 위치이며, `§5-4` 체크리스트 확장도 기존 항목 스타일과 일치한다. 18/18 `Update*Dto` 가 top-level `@Body()` 라는 실측, `ChatChannelUpdateConfigDto` 가 `OmitType(ChatChannelConfigDto, …)` 로 도메인-우선 명명 계열에 속한다는 근거도 코드에서 확인됨.
- CV-1 의 `INVALID_FIELD` 채택은 `error-codes.md §1` 의 "시스템 전역 공용 코드는 prefix 없이" 예외와 `3-error-handling.md §2.1` 의 기존 카탈로그 등재 상태(실측: `CustomValidationPipe` 가 이미 배열 형태에 `code: 'INVALID_FIELD'` 를 방출)와 정합한다.
- CV-3(`chat-channel-adapter.md §1.1` 멱등 셀 각주)은 기존 표 셀의 인라인 설명 스타일과 같은 톤이며, `R-CCA-N` Rationale ID 컨벤션(신규 Rationale 절 전용)과 충돌하지 않는다 — 각주는 본문 표 셀 주석이지 신규 Rationale 절이 아니다.
- CV-4 가 겨냥한 `15-chat-channel.md §5.4.1`(3열 표의 회전 행) · `§5.4.1.1`(회전 행) · `§5.4.1.2`(닫는 문장)의 정확한 텍스트를 직접 확인했고, 초판이 이걸 섞어 CRITICAL 을 만들었다는 서술도 실제 파일 구조(§5.4.1.2 가 §5.4.1.1 보다 앞서 나오는 순서 포함)와 부합한다.
- 결정 라벨을 `D-1`/`D-2`(이미 `R-CC-21` 하위결정으로 codebase 10여 곳이 인용) 대신 `CV-*` 로 분리한 것은 정확한 판단이다 — `15-chat-channel.md` 의 "Rationale ID 컨벤션"(`R-CC-N` prefix, `## Rationale` 절 전용)과 이 plan 의 결정 라벨은 애초에 다른 네임스페이스(하나는 spec 본문에 영구 박히는 ID, 하나는 plan 내부 추적용)이므로 충돌 자체가 성립하지 않는다.
- frontmatter(`title/status/owner/worktree/started/spec_impact`)는 plan lifecycle 스키마를 따르고, `spec_impact` 는 4개 실재 spec 경로의 리스트다(bare `none`·빈 배열 아님). 편집하지 않는 `2-trigger-list.md` 를 "주어 단위 전수 확인" 후 `spec_impact` 에서 명시적으로 제외한 판단도 관례(spec_impact 는 실재 편집 대상만)에 맞는다.

## 요약

target 은 세 건의 규약 신설/보정(details.code 필수 요건, Update 접두 명명 범위, setupChannel 멱등성 각주)을 제안하는 plan draft 로, 넘버링·배치·명명 스타일 면에서 기존 conventions 문서 구조와 대체로 잘 맞고 인용된 실측 다수(60곳 분류, 18개 Update DTO, password.util.ts 무-code 배열 등)를 코드베이스에서 직접 재확인해도 정확했다. 다만 감사 로그 `details` 자유형의 SoT 로 `audit-actions.md` 를 인용한 것은 그 문서 자신이 명시한 "책임 경계"(적재 파이프라인은 `data-flow/1-audit.md` 소관)를 벗어나며, 이 인용이 `2-api-convention.md §5.3` 에 그대로 삽입될 예정이라 정정이 필요하다. 신설되는 "field 있으면 code 필수" 규칙에 강제 메커니즘이 명시되지 않은 점은 이 저장소가 이미 겪은 "강제 없는 규칙의 조용한 미준수" 패턴(swagger.md §3)과 같은 형태라 참고용으로 남긴다.

## 위험도

LOW
