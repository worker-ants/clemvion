# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `assertMembership`/`assertAdmin` 본문이 `removeMember` 수정과 함께 바뀐다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:928-934`(`assertMembership`), `:936-941`(`assertAdmin`)
  - 상세: 이번 PR 의 의도된 변경은 `removeMember` 한 메서드의 인가 순서 재배치다. 그런데 diff 는 `assertMembership`·`assertAdmin` 의 예외 발생 로직도 새로 뽑은 `throwNotAMember()`/`throwAdminRequired()` 호출로 교체한다(`:913-926`에 헬퍼 신설). 겉보기엔 "현재 작업과 무관한 두 메서드를 건드림"으로 보일 수 있다.
  - 다만 이는 순수 리팩토링이 아니라 이번 변경이 만든 필요다: `removeMember` 가 동일한 `NOT_A_MEMBER`/`ADMIN_REQUIRED` 예외를 요청자 role 재사용 경로에서 직접 던져야 하는데, 그 리터럴을 인라인으로 세 번째 복제하면 이 파일에서 이미 한 번 리뷰 지적을 받은 패턴(주석이 인용하는 `throwMemberNotFound()` 선례, `/ai-review review/code/2026/09/21/12_57_05` maintainability WARNING 3)이 반복된다. 동작 변화는 없다 — 메시지·코드·호출 조건이 전부 그대로이고, `throwXxx()` 로 위임만 바뀌었다. `assertMembership`/`assertAdmin` 자체의 로직(널 체크·admin 체크)은 한 글자도 안 바뀌었다.
  - 제안: 조치 불필요. 스코프 위반이 아니라 "새 호출자가 기존 두 곳과 같은 예외를 던져야 한다"는 이번 변경의 직접적 파생 요구로 판단된다. plan(`plan/in-progress/member-auth-order.md` §B)도 이 추출을 명시적으로 예고·정당화하고 있다.

- **[INFO]** `wireFindOne` 헬퍼 시그니처 변경(`requesterMembership` 타입에 `| null` 추가)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`(`wireFindOne` 정의, diff 상 `requesterMembership: Record<string, unknown> | null = {...}`)
  - 상세: 기존 테스트 헬퍼의 타입 시그니처를 넓힌 것으로, 언뜻 무관한 변경처럼 보이지만 신설된 "비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다" 테스트가 `requesterMembership = null`(비-멤버 표현)로 이 헬퍼를 호출하기 위해 필요한 최소 확장이다. 기존 호출부의 동작은 바뀌지 않는다.
  - 제안: 조치 불필요.

## 점검 관점별 확인

1. **의도 이상의 변경** — 없음. diff 전체(13 파일)가 "`removeMember` 인가 순서 재배치 + 회귀 테스트(unit 2건 + e2e 1건) + 필수 파생 리팩토링(예외 헬퍼 추출) + 작업 추적 plan 문서 + 의무 `--impl-prep` consistency-check 산출물"로만 구성되어 있다. 서비스 파일의 다른 메서드(`addMemberByEmail`·`updateMemberRole`·`updateWorkspaceSettings` 등)는 로직 변경 없이 그대로다.
2. **불필요한 리팩토링** — 위 INFO 항목의 헬퍼 추출은 이번 변경이 요구하는 최소 범위이며, 기존 두 assert 메서드의 판정 로직 자체는 손대지 않았다. 그 외 리팩토링은 없다.
3. **기능 확장** — 없음. 새 기능이 아니라 기존 권한 오류(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`CANNOT_REMOVE_OWNER`)의 발생 순서 재배치다. plan `§E`는 "13개 라우트 축"이라는 더 큰 확장을 명시적으로 **이번 PR 범위에서 제외**하고 별도 항목으로 분리해 두었다 — 스코프 관리가 오히려 잘 되어 있다.
4. **무관한 수정** — 없음. `git diff origin/main...HEAD --numstat` 결과 13개 파일이 모두 위 목적에 직접 연결된다: 서비스/서비스 스펙/e2e 스펙(코드), 작업 plan 2건(신규 항목 등재 + 트래커 각주 분리), consistency-check 산출물 8개(`--impl-prep` 의무 절차의 산출물, `review/consistency/**`가 정식 저장 위치).
5. **포맷팅 변경** — 실질 변경과 섞인 무의미한 공백/줄바꿈 변경 없음. 각 hunk 는 diff 로 본 것과 `git diff` 원본이 일치하며 불필요한 리포맷 흔적이 없다.
6. **주석 변경** — 주석이 많이 추가됐지만(판정 순서 근거, 오라클 위협 모델, 뮤턴트 근거 등) 전부 이번 순서 변경의 "왜"를 설명하는 것으로, 무관한 주석 삭제·수정은 없다(예: 코드 삭제된 옛 주석 "흔한 경우를 assertAdmin 전에 끊는 이른 가드…"는 같은 자리에서 새 근거로 자연스럽게 교체됨).
7. **임포트 변경** — 없음. `workspaces.service.ts` 상단 import 블록은 diff에 나타나지 않는다(불변).
8. **설정 변경** — 없음. `package.json`/CI/lint 설정 등 어떤 설정 파일도 diff 에 포함되지 않았다.

플랜·리뷰 산출물(파일 4~13)에 대한 별도 확인: `plan/in-progress/member-auth-order.md`(신규)와 `spec-draft-nullable-notation-followups.md`(트래커에 각주를 분리해 별 항목으로 등재)는 CLAUDE.md 가 규정한 작업 추적 규약을 따른 것이고, `review/consistency/2026/09/24/10_22_24/**` 8개 파일은 구현 착수 전 의무 절차(`--impl-prep`)의 정식 산출 위치에 정확히 대응한다 — 둘 다 "코드 변경과 무관한 파일 오염"이 아니라 이 저장소의 워크플로 규약이 요구하는 동반 산출물이다.

## 요약

diff 는 `WorkspacesService.removeMember` 의 인가 순서를 대상 조회보다 앞으로 옮기는 단일 목적에 매우 타이트하게 수렴한다. 서비스 코드에서 추가로 건드린 두 메서드(`assertMembership`/`assertAdmin`)는 새 호출자와 예외 리터럴을 공유하기 위한 최소 추출이며 동작 변화가 없고, 이 파일에 이미 있던 DRY 선례(`throwMemberNotFound`)를 그대로 따른다. 테스트 변경(unit 2건, e2e 1건, 헬퍼 타입 확장)도 전부 새 순서·새 오라클 방어를 고정하기 위한 필수 변경이다. plan 문서는 스코프 밖 축(13-라우트 가드 갭)을 명시적으로 분리해 등재했고, consistency-check 산출물은 의무 워크플로 산출물이다. 포맷팅·임포트·설정·무관 주석 변경은 발견되지 않았다.

## 위험도

NONE
