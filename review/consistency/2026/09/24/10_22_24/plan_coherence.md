# Plan 정합성 검토 — target: `spec/5-system` (--impl-prep)

## 컨텍스트

이번 --impl-prep 은 `plan/in-progress/member-auth-order.md`(`removeMember()` 권한 검사 순서 —
존재 오라클 수정) 착수 전 검토다. 이 plan 은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
의 developer 항목("`removeMember()` 의 권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재
오라클이 된다")을 닫는 것을 목표로 한다. 실제 소스(`workspaces.service.ts`)를 대조해
plan 이 서술한 현재 코드 순서(`findOne` → 404 → self 위임(`leaveWorkspace`) → owner 403
`throwCannotRemoveOwner` → `assertAdmin`)가 **정확함**을 확인했다 — 같은 파일의
`getMemberRole` 호출 위치(`:889`, `:902`)·형제 메서드의 `assertAdmin` 선행 호출
(`:257`·`:306`)도 실측과 일치한다. `member-owner-toctou.md`(같은 날 `complete/` 로 이동,
owner TOCTOU 별건)가 이미 반영된 현재 코드 기준으로 검증했다.

## 발견사항

- **[WARNING]** 트래커의 "에러 코드 계약 변경" 캐비트가 실제 설계와 어긋나는데 plan 이 이를
  정정하도록 체크리스트에 명시하지 않음
  - target 위치: (직접적 target 충돌은 아님 — plan 간 정합성 문제)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4911-4915` (닫힐
    항목의 註) vs `plan/in-progress/member-auth-order.md` §B·§C
  - 상세: 트래커 항목은 "그 PR 에서 함께 고치지 않은 이유"로 "비-admin 이 owner 를 지목했을
    때의 코드가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 **바뀐다**. 에러 코드 계약
    변경이라 `spec/5-system/3-error-handling.md` 기준의 자체 consistency 라운드가 필요하다"
    고 적어 뒀다. 그런데 `member-auth-order.md` §B 가 채택한 실제 설계(`assertAdmin` 을 맨
    앞으로 옮기지 않고, 멤버십 사전 확인만 앞에 얹는 2단 구조)는 이 계약 변경을 **일으키지
    않는다** — §C 관측표가 "멤버(비-admin) | 세 갈래 그대로 | 그대로" 로 명시한다. 즉 트래커가
    예고한 리스크(에러 코드 계약 변경 → 3-error-handling.md consistency 라운드 필요)는 이번
    설계에서 **발생하지 않는데**, `member-auth-order.md` 의 체크리스트("트래커 항목 해소 +
    plan complete/ 로 (한 커밋으로)")는 이 캐비트를 명시적으로 정정하도록 요구하지 않는다.
    바로 위 이웃 항목(`removeMember()` owner TOCTOU, 2026-09-24 해소)은 정확히 이 패턴 —
    "후보 처방 그대로가 아니었다" 는 정정을 선례로 남겼다(같은 파일 4965-4968행, 이웃
    항목까지 부수로 바로잡음). 이번 항목을 [x] 로 닫을 때 같은 관례를 안 따르면, 트래커에
    "에러 코드 계약이 바뀔 것" 이라는 **틀린 예상**이 완료 이력에 그대로 남아 다음 사람이
    있지도 않은 후속 consistency 라운드를 찾게 만든다.
  - 제안: `member-auth-order.md` 종결 커밋에서 트래커 항목을 닫을 때, "에러 코드 계약 변경 →
    consistency 라운드 필요" 캐비트가 이번 설계에서는 해당 없음을 한 줄 정정으로 남길 것
    (plan 쪽 수정, spec 아님).

- **[INFO]** 두 planner 후속 항목이 아직 별도 plan 으로 등재되지 않음 — 계획대로면 정상
  - target 위치: `spec/5-system/3-error-handling.md` §1.2 `NOT_A_MEMBER` 행(경로 열거에
    `removeMember()` 미포함) · (경로 파라미터 워크스페이스 가드 커버리지는 spec 미서술 영역)
  - 관련 plan: `plan/in-progress/member-auth-order.md` §E · 체크리스트 "13-라우트 축 별 항목
    등재 + `NOT_A_MEMBER` 카탈로그 planner 항목 등재"
  - 상세: 전수 확인 결과 "17개 중 13개 라우트가 가드 커버리지 밖" 축과 `NOT_A_MEMBER` 카탈로그
    경로 열거 갱신은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 와
    `member-auth-order.md` 두 곳에만 註로 존재하고, 아직 독립 plan 파일로 분리 등재되지 않았다.
    `member-auth-order.md` 자신이 "이 PR 스코프 아님 — 별 항목으로 갈라 등재한다" 고 이미
    올바르게 선언했고, 체크리스트에도 올라 있어 --impl-prep 시점 기준으로는 결함이 아니다.
  - 제안: 구현 종결 커밋에서 체크리스트의 두 등재 항목이 실제로 새 plan 파일(또는 planner
    턴 산출물)로 만들어졌는지 `--impl-done` 이후 재확인. 놓치면 "가드 커버리지 모델 결정"
    이라는 더 큰 축이 이 PR 로 조용히 닫힌 것처럼 보이는 위험이 있다(§E 가 스스로 경고한
    바로 그 위험).

## 요약

`member-auth-order.md` 는 착수 전 실측이 촘촘하고(현재 코드 순서·형제 메서드 선례·
`NOT_A_MEMBER` 카탈로그 존재 여부를 전부 소스 대조로 확인), target `spec/5-system` 의
기존 서술(§1.2 `NOT_A_MEMBER`·§Rationale "Admin CRUD 정정"·§1.3 `X-Workspace-Id` 3분기)과
직접 충돌하는 결정을 내리지 않는다. 가드 커버리지 축("13-라우트")과 카탈로그 경로 열거
갱신은 developer 권한 밖으로 올바르게 분리해 planner 후속으로 미뤘고, 이는 이 저장소의
기존 관례(`auth-guard-reflection-hardening.md` 의 동형 처리)와 일치한다. 유일한 흠은
트래커(`spec-draft-nullable-notation-followups.md`)가 미리 적어 둔 "에러 코드 계약 변경"
캐비트가 실제 채택 설계에서는 발생하지 않는데, 종결 시 이를 명시적으로 정정하도록 체크리스트가
요구하지 않는다는 점 — plan 위생 차원의 WARNING 이며 구현 방향 자체를 바꿀 사안은 아니다.

## 위험도

LOW
