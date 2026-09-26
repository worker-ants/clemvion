# Cross-Spec 일관성 검토 — `spec/conventions/swagger.md` §5-4 (403 설명 ↔ 가드 거부 코드)

## 검토 대상

`spec/conventions/swagger.md` §5-4 새 엔드포인트 체크리스트의 403 항목 개정 + 신규 Rationale
「§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)」 + frontmatter `code:`
`forbidden-response-codes*.ts` 등재. 직전 `--impl-prep` (`11_12_24`) 의 Critical 1(§5-4 문구가
data-flow 결정과 어긋남)을 planner 커밋 `f262a638e` → `eb40cc802` 가 반영한 뒤의 재검토.

## 대조한 영역

- `spec/data-flow/12-workspace.md` §Rationale 「가드 거부의 오류 코드 (2026-09-25)」· 「멤버십 검증은
  가드 1곳에서」· 「경로 파라미터 워크스페이스도 가드가 본다」
- `spec/5-system/2-api-convention.md` (403 코드 표기)
- `spec/5-system/3-error-handling.md` §1.2/§1.2.1 에러 코드 카탈로그
- `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리
- `spec/5-system/1-auth.md` §3.1/§3.2 RBAC 매트릭스
- `spec/2-navigation/4-integration.md` §8 권한 규칙
- `spec/5-system/13-replay-rerun.md` (이미 두 코드 패턴을 적용한 선례)
- `plan/in-progress/forbidden-desc-codes.md` · `plan/in-progress/integration-personal-owner-followup.md`

## 발견사항

검토 관점 1~6(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 **CRITICAL/WARNING
없음**. 세부:

- **RBAC 모델 정합**: target 이 명시하는 "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`, `@Roles('viewer')`
  는 코드가 하나(멤버십과 동일)" 규칙은 `data-flow/12-workspace.md` §Rationale 「가드 거부의 오류 코드」의
  채택안(나)을 그대로 인용한다 — 새 규칙을 만드는 게 아니라 이미 확정된 data-flow 결정을 swagger 문서화
  층에 반영하는 것이다. `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 네 코드는
  `error-handling.md` §1.2 카탈로그·`api-convention.md`·`error-codes.md` 에 이미 등재돼 있어 새 코드
  발명이 아니다(모두 2026-09-25 기존 결정).
  - `spec/5-system/13-replay-rerun.md:244-245` 가 이미 `NOT_A_MEMBER` + `EDITOR_REQUIRED` 를 나란히
    등재해 target 의 "두 코드 병기" 패턴이 저장소에 선례로 존재함을 확인(교차 검증 통과).
- **소급 적용 범위의 자기 정합**: target 은 §1-4/§3(신규 변경 한정)과 달리 이 규칙을 기존 라우트까지
  소급 적용한다고 명시하고, 그 이유를 §2-4(광고 성공 코드) 선례와 동형이라고 스스로 밝힌다 — 다른 절과의
  잠재적 모순(왜 이 규칙만 소급인가)을 문서 내에서 이미 해소했다.
- **가드 능력 범위 자기수정 확인**: `eb40cc802` 가 체크리스트 문구를 "모든 라우트에 짝을 강제한다" →
  "빠진 가드 코드만 잡는다(남은 코드·서비스 거부는 못 잡는다)" 로 좁혔고, 같은 문서의 Rationale 블록은
  애초에 "모든 라우트에 강제" 라는 과잉 주장을 하지 않고 있었다 — 체크리스트 문구와 Rationale 산문 사이에
  잔여 불일치 없음.
- **frontmatter `code:` 소유권 충돌 없음**: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts`
  글롭을 저장소 전체 `spec/**` 에서 grep 했으나 다른 spec 문서가 동일/중첩 패턴을 이미 소유하고 있지 않음.
  가드가 참조하는 `roles.guard.ts`·`workspace-roles.ts`·`workspaces.controller.ts` 도 어떤 spec 의
  `code:` 프런트매터에도 등재돼 있지 않아(둘 다 미등재) 이중 소유 문제가 없다.
- **integrations Viewer 미해결 사안과의 경계**: `2-navigation/4-integration.md` §8 은 "Viewer 의 자기
  personal 생성·수정·rotate·삭제" 를 `integration-personal-owner-followup.md` 로 아직 미결정 상태로
  남겨 두고 있는데, target 의 403 설명 갱신은 "지금 역할(`@Roles('editor')`)에 맞는 설명" 만 반영하고
  그 미결정 사안의 순서를 바꾸지 않는다고 plan 에 명시돼 있다(검토 경고 처리 표 W1). 역할이 나중에
  내려가면 가드가 "남은 코드"를 잡지 못한다는 한계도 같은 표에서 인지·기록됨 — 잠재 충돌이 아니라 이미
  식별되고 처분된 리스크.
- **§3 길이 규약과의 경계(참고, 재지적 아님)**: `@ApiForbiddenResponse({ description })` 은 §3 길이표의
  "엔드포인트 summary/description" 도 "DTO description" 도 아닌 제3의 범주라 어느 길이 기준도 명시적으로
  적용되지 않는다. 이 갭은 직전 `--impl-prep`(`11_12_24` W2)에서 이미 지적됐고 "트래커 신규 등재·이 PR
  범위 밖" 으로 처분된 상태다(`plan/in-progress/forbidden-desc-codes.md` 검토 경고 처리 표) — 재지적하지
  않고 처분 유지가 타당함만 확인.

## 요약

target(`spec/conventions/swagger.md` §5-4 개정)은 새로운 데이터 모델·API 계약·요구사항 ID·상태
머신·RBAC 규칙을 도입하지 않고, `data-flow/12-workspace.md` 가 2026-09-25 에 이미 확정한 가드 거부
코드 체계를 OpenAPI 문서화 층에서 강제하는 절차 규약이다. 관련된 4개 영역(swagger 규약·workspace
data-flow·auth RBAC·error-handling 카탈로그)과 인접 영역(integration 권한 규칙·replay-rerun 선례)을
대조한 결과 코드 이름·의미·발행 조건·"viewer=멤버십과 동일" 규칙이 전부 일치했고, 직전 라운드에서
지적된 Critical(문구-결정 불일치)과 그 후속 수정(가드 범위 과잉주장)도 반영이 확인됐다. 새로 발견된
CRITICAL/WARNING 은 없다.

## 위험도

NONE
