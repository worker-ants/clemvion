# Cross-Spec 일관성 검토 — `spec/5-system` (impl-prep)

검토 대상 작업: `plan/in-progress/jest-esm-native-load.md`(NestJS `@nestjs/typeorm` v12 부분
범프 + jest ESM native-load 전환, `#1339` 대응). 이 작업은 CI/테스트 러너 설정과 의존성
버전만 바꾸고 spec 문서 자체를 변경하지 않으므로, 본 검토는 **현재 커밋된 `spec/5-system`
(특히 전문이 포함된 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)이 다른 영역과
이미 정합적인지**를 확인한다. `4-execution-engine.md` 이하 15개 파일과 `spec/1-data-model.md`
등 다수 관련 문서는 번들 컨텍스트 예산 초과로 본문이 생략돼 있어, 상호참조가 걸린 항목은
`Read`로 원본을 직접 열어 대조했다(§"확인 방법" 참고).

## 발견사항

- **[INFO]** `CANNOT_REMOVE_OWNER` / `OWNER_ROLE_PROTECTED` / `SOLE_OWNER_CANNOT_LEAVE` 가 중앙
  에러 카탈로그(`3-error-handling.md` §1)에 미등재
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주 †(line 377-381, 553-554) — `removeMember()`
    대상-조건 거부 코드로 `CANNOT_REMOVE_OWNER` 를 이름으로 인용
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1(에러 코드 공용 카탈로그) ·
    `spec/data-flow/12-workspace.md:139`(`OWNER_ROLE_PROTECTED`) ·
    `spec/data-flow/12-workspace.md:189`(`SOLE_OWNER_CANNOT_LEAVE`)
  - 상세: `2-api-convention.md` §5.3 은 "등재되지 않은 코드는 소비자가 존재를 알 방법이 없다"
    고 등재를 명시적으로 의무화하고, 같은 워크스페이스 멤버십 계열의 자매 코드
    `CANNOT_ASSIGN_OWNER`/`ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH` 는 §1.9 에 실제로
    등재돼 있다(codebase 실측: `workspaces.service.ts`가 세 코드 모두 실제로 throw 함,
    `CANNOT_REMOVE_OWNER` 포함 — grep 으로 wire 상 살아있는 코드임을 확인). 다만 이 갭은
    **이미 알려진 상태**다 — `3-error-handling.md` §1.9 Rationale(line 660)이 스스로
    "그 외 workspace role/membership 관리 코드(`SOLE_OWNER_CANNOT_LEAVE` 등)는 별도 pass"
    라고 명시했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:5097-5100`
    이 오늘(2026-09-24) 같은 `--impl-prep` 계열 세션(`07:29:15` 런)에서 이미 planner 낮은
    우선순위 항목으로 등재했다(`review/consistency/2026/09/24/07_29_15/cross_spec.md` 가
    동일 INFO 를 이미 기록함). 이번 세션이 새로 만든 갭이 아니다
  - 제안: 오늘 착수하는 `jest-esm-native-load`(의존성/CI 작업)의 스코프는 아니다.
    `spec_impact` 변경 근거로 쓰지 말 것 — 이미 planner 백로그에 등재돼 있으므로 재등재 불필요.

## 정합성 확인 (충돌 없음, 기록용)

아래는 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 를 다른 영역과 대조해 **일치를
확인**한 주요 지점이다(반증하려 했으나 반증되지 않음):

- **RBAC 매트릭스**: `1-auth.md` §3.2(Auth Config `CRUD/CRUD/R/R` + Reveal Admin+)가
  `2-navigation/6-config.md:257`("mutation 은 Admin+, 조회는 Viewer 이상")과 정확히 일치하며
  후자가 전자를 SoT 로 명시 인용한다. `2-navigation/9-user-profile.md` §4.2 의 별도(이진
  ✅/❌) RBAC 표는 "관리(쓰기) 가능 여부"만 구분하는 형태라(예: "워크플로우 조회" 행을
  "생성/수정/삭제" 행과 분리해 둠) `1-auth.md` §3.2 의 세분화된 CRUD 표기(Editor/Viewer=R)와
  의미상 상충하지 않는다 — 다만 "멤버 관리" 행처럼 대응하는 "조회" 행이 없는 경우 두 표를
  나란히 보지 않으면 "Editor/Viewer 는 멤버 목록도 못 본다"로 오독될 여지가 있다(INFO 미만,
  실제 API 계약과 모순은 없음).
- **System Status 전역 API**: `1-auth.md` §3.2 각주("모든 역할이 동일하게 읽기만 가능, admin
  가드 없음")가 `5-system/16-system-status-api.md:49`(`admin role 가드 없음`)와 일치.
- **Chat Channel 비활성 트리거 202 예외**: `2-api-convention.md` §6 의 "config.chatChannel 트리거는
  비활성이어도 410 이 아니라 202"가 `5-system/15-chat-channel.md:494,714`(비활성 trigger →
  `202 + {executionId:'ignored'}`, 서명 검증은 무조건 선행)와 정확히 일치.
- **`WORKFLOW_FORBIDDEN_WORKSPACE`(W-6)**: `3-error-handling.md` §1.4 의 W-6 서술이
  `4-nodes/2-flow/1-workflow.md`·`4-nodes/2-flow/0-common.md`·`5-system/4-execution-engine.md:1825`·
  `conventions/chat-channel-adapter.md` 다섯 지점 모두와 같은 트리거 조건·매핑을 공유 — 요구사항
  ID 충돌 없음.
- **데이터 모델 정합**: `1-auth.md` §1.4.1 의 `totp_recovery_codes`/`webauthn_recovery_codes`
  분리·SHA-256 해시·`password_hash` nullable 서술이 `1-data-model.md:67,87-88` 와 필드명·의미
  동일. `login_history.event`/`failure_reason` enum 도 `1-data-model.md §2.18.2` 와 일치.
- **워크스페이스 컨텍스트/헤더 우선순위**: `2-api-convention.md` §2.3 의 header-first 규칙 +
  `1-auth.md` §2.2/§3.3 의 `activeWorkspaceId` dual-read 서술이 `data-flow/12-workspace.md`
  (전환·`RolesGuard`·UUID 검증 강도 비대칭 Rationale)와 표현만 다를 뿐 동일한 모델을 가리킨다.
- **감사 로그 workspace 귀속**: `1-auth.md` §4.1 의 `user.*` 액션 workspace 귀속 규칙·
  `workspace.deleted` 감사 제외 사유가 `data-flow/1-audit.md`·`data-flow/12-workspace.md` 의
  대응 Rationale 과 모순 없이 상호 참조된다.
- **초대 흐름 vs 사용자 프로필 §4.1**: `1-auth.md` §1.5(토큰 정책·7일 만료·1회 사용·이메일 일치
  강제)가 `2-navigation/9-user-profile.md` §4.1/§4.1.1 과 수치·정책 모두 동일.
- **workspace member 제거 계약**: `data-flow/12-workspace.md:141`("owner 는 제거 불가, 본인
  제거는 leaveWorkspace 로 위임")이 `1-auth.md` §3.2 † 및 `2-navigation/9-user-profile.md`
  §4.1 의 "제거 | Admin+" 행과 같은 계약을 가리킨다(최근 코드 커밋 `33caa750c`·`fc56873be`는
  이 계약을 바꾸지 않는 순서/TOCTOU 수정이며 둘 다 "spec 변경 없음"으로 커밋됨 — 실측).

## 확인 방법

번들(`_prompts/cross_spec.md`)에서 컨텍스트 예산 초과로 생략된 `spec/1-data-model.md`,
`spec/5-system/4-execution-engine.md`, `spec/5-system/15-chat-channel.md`,
`spec/5-system/16-system-status-api.md`, `spec/data-flow/12-workspace.md`,
`spec/2-navigation/6-config.md`, `spec/2-navigation/9-user-profile.md`,
`spec/4-nodes/2-flow/1-workflow.md` 등은 저장소에서 `Read`/`grep` 로 직접 열어 대조했다
("생략됨"을 "충돌 없음"의 근거로 쓰지 않기 위함).

## 요약

target(`spec/5-system`, 특히 전문이 포함된 `1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`)은 오늘 착수하는 `jest-esm-native-load`(NestJS/TypeORM 의존성 버전
범프 + jest ESM 설정) 작업과 관련해 새로운 cross-spec 충돌을 유발하지 않는다 — 이 작업은
spec 문서·API 계약·RBAC·상태 전이를 변경하지 않는 순수 인프라/의존성 작업이다. RBAC 매트릭스,
API 계약(에러 봉투·상태 코드·라우팅 규칙), 감사 로그 workspace 귀속, 데이터 모델 필드,
요구사항 ID(W-6 등)를 `data-flow/12-workspace.md`·`1-data-model.md`·
`2-navigation/6-config.md`·`2-navigation/9-user-profile.md`·`5-system/15-chat-channel.md`·
`5-system/16-system-status-api.md`·`4-nodes/2-flow/1-workflow.md` 등과 교차 대조한 결과 CRITICAL/
WARNING 급 모순은 발견되지 않았다. 유일한 관찰 사항(`CANNOT_REMOVE_OWNER` 등 3개 코드의 중앙
카탈로그 미등재)은 문서 스스로 "별도 pass"로 유예를 선언한 기존 갭이며 오늘 이른 시각의 다른
`--impl-prep` 세션이 이미 동일하게 INFO 로 기록·planner 백로그에 등재했으므로, 이번 작업을
막을 이유가 아니다.

## 위험도

LOW
