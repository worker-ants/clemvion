# Cross-Spec 일관성 검토 — `spec/5-system/`

## 검토 범위와 방법

target 은 `spec/5-system/` 전체이나, 프롬프트 번들에는 예산 초과로 `1-auth.md` ·
`2-api-convention.md` · `3-error-handling.md` 세 파일만 전문이 실렸고 나머지 15개
(`4-execution-engine.md`, `6-websocket-protocol.md`, `12-webhook.md`,
`14-external-interaction-api.md` 등)와 관련 spec 108개는 절단됐다. 이 세 파일이 다른 영역과
맺는 교차 참조(데이터 모델·RBAC·에러 카탈로그·상태 전이)를 실제 diff 대상으로 보고, 절단된
파일들은 `Read`/`grep` 으로 디스크에서 직접 열어 아래 항목을 대조했다:

- `spec/1-data-model.md` (User/§2.1.1 · WebAuthnCredential §2.21 · LoginHistory §2.18.2 · AuthConfig §2.17)
- `spec/2-navigation/{6-config,9-user-profile,2-trigger-list,3-schedule}.md`
- `spec/data-flow/12-workspace.md` (§4 RBAC 요약, 멤버 관리 CRUD)
- `spec/5-system/{4-execution-engine,14-external-interaction-api,16-system-status-api}.md`
- `spec/conventions/audit-actions.md`
- `codebase/backend/src/shared/testing/user-secret-absence.ts` (`USER_SECRET_KEYS`)

## 발견사항

검증한 교차 참조는 모두 **정합했다** — RBAC 매트릭스(Auth Config/Model Config/Trigger/System
Status), 에러 코드 카탈로그(§1.2.1/§1.5~§1.10 도메인-참조 패턴과 각 도메인 SoT 본문), 데이터
모델 앵커(`§2.1.1` 응답 노출 금지 민감 7컬럼, `§2.18.2` LoginHistory event/failure_reason,
`§2.21` WebAuthnCredential), 상태 토글 패턴(§12.1 PATCH `{ field }` — Trigger/Schedule/Node/
Notification/AuthConfig 전부 준수), Execution 취소 사유(`EXECUTION_QUEUE_WAIT_TIMEOUT` ·
`WEBCHAT_IDLE_TIMEOUT`)의 상태 전이가 `4-execution-engine.md`·`14-external-interaction-api.md`
양쪽에서 일치했다. CRITICAL/WARNING 급 모순은 찾지 못했다.

- **[INFO]** "멤버 관리" 라는 동일 용어가 두 RBAC 표에서 다른 스코프로 쓰인다
  - target 위치: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 — "멤버 관리 †" 행,
    Editor/Viewer = **R**
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` "역할 권한 매트릭스" — "멤버 관리" 행,
    Editor/Viewer = **❌**
  - 상세: 표면적으로는 같은 이름의 권한 행이 값이 다르다(R vs ❌). 실제로는 모순이 아니다 —
    `9-user-profile.md §6.1` 의 `GET /api/workspaces/:id/members`(멤버 목록)는 역할 제한이
    명시돼 있지 않고, §4.1 의 "멤버 관리" 서술도 초대/역할변경/제거 등 **mutation 액션**만
    나열한다. 즉 `1-auth.md` 의 "R" 은 "멤버 목록 조회"를, `9-user-profile.md` 의 "❌" 는
    "멤버 관리 **액션**(초대·제거·역할변경)"을 가리켜 스코프가 다르다. 하지만 두 문서 모두
    "멤버 관리"라는 동일 레이블을 쓰고 있어, 두 표만 diff 하면 R↔❌ 충돌로 오독하기 쉽다.
  - 제안: 새로운 작업은 아니므로 `--spec` 필수 항목은 아니나, 후속 편집 시 `9-user-profile.md
    §4.2` 행 레이블을 "멤버 관리 (초대/역할변경/제거)" 로 좁히거나 `1-auth.md §3.2` 각주에
    "본 R 은 목록 조회에 한정, 관리 액션 권한은 `9-user-profile.md §4.1` 참조" 를 한 줄 추가하면
    두 표를 직접 비교하는 다음 사람의 오독을 막는다.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 target 문서는 최근
여러 라운드의 자기 교정(#1288~#1299)을 거쳐 데이터 모델·RBAC·에러 카탈로그·상태 토글 패턴 등
주요 교차 참조 축에서 다른 영역과 이미 높은 수준으로 정합돼 있다. 이번 검토에서 새로운
CRITICAL/WARNING 급 cross-spec 모순은 발견하지 못했고, 유일한 관찰은 두 RBAC 표가 같은 용어를
다른 스코프로 재사용하는 명명 중복(INFO)뿐이다.

## 위험도

LOW
