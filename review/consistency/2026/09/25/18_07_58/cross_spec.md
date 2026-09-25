# Cross-Spec 일관성 검토 — `spec-draft-workspace-path-guard-oracle-census.md`

## 대상 요약

target 은 `spec/data-flow/12-workspace.md` §Rationale «경로 파라미터 워크스페이스도 가드가 본다» 의 두
문장("두 메서드" → "세 메서드")만 정정하는 좁은 소급 정정이다. 원문은 취소선으로 남기고, «(2026-09-25
정정)» 각주로 `transferOwnership` 을 세 번째 오라클 메서드로 추가한다. 결정(가드 확장 + 거부 코드)이나
API 계약·데이터 모델·요구사항 ID·상태 머신·RBAC 구조 자체는 바꾸지 않는다.

## 검증 절차

1. `spec/data-flow/12-workspace.md` 전문을 직접 Read(번들이 예산 초과로 절단해 원본 대조 필수 — prompt 의
   지시대로 절대경로로 열었다).
2. target 이 인용하는 "전 (1)"·"전 (2)" 원문 문자열이 스펙 파일의 실제 텍스트와 정확히 일치하는지 대조.
3. target 이 신설하는 사실 주장(3번째 오라클 = `transferOwnership`, 코드 `CANNOT_TRANSFER_PERSONAL`·
   `OWNER_REQUIRED`)이 같은 도메인의 다른 spec 절 — §1.6 역할/소유권 이전 표, §Rationale "가드 거부의
   오류 코드", `spec/5-system/3-error-handling.md` 에러 카탈로그, `spec/2-navigation/9-user-profile.md`
   §4.1 멤버 관리 표 — 와 모순되는지 확인.
4. `CANNOT_TRANSFER_PERSONAL` 코드의 실제 존재 여부(`codebase/backend/src/modules/workspaces/
   workspaces.service.ts`)와 error-codes 관례상 등재 의무 여부(`spec/conventions/error-codes.md` §3/§5)
   확인.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** §1.6 표가 `transferOwnership` 거부 코드를 이름으로 언급하지 않음
  - target 위치: 없음(target 자체의 결함이 아니라 대조 대상 문서 상태)
  - 충돌 대상: `spec/data-flow/12-workspace.md` §1.6 "역할 변경 / 소유권 이전" 표 — "personal 워크스페이스는
    이양 불가" 라고만 쓰고 `CANNOT_TRANSFER_PERSONAL` 코드명을 적지 않는다. target 이 §Rationale 에 새로
    적는 `CANNOT_TRANSFER_PERSONAL`·`OWNER_REQUIRED` 언급과 같은 문서 내에서 상세도가 비대칭이다.
  - 상세: 모순은 아니다 — §1.6 은 애초에 코드 카탈로그가 아니라 동작 요약 표이고, `TARGET_IS_SELF`·
    `TARGET_ALREADY_OWNER` 등 같은 엔드포인트의 다른 코드들도 §1.6 에는 이미 적혀 있어 `CANNOT_TRANSFER_
    PERSONAL` 만 빠진 것은 사소한 공백이다. `spec/5-system/3-error-handling.md:662` 가 이미 "그 외 workspace
    role/membership 관리 코드(`SOLE_OWNER_CANNOT_LEAVE` 등)는 별도 pass" 라고 명시적으로 유예해 뒀으므로,
    이 공백은 기존에 알려진 채무이지 target 이 만든 새 모순이 아니다.
  - 제안: 이 draft 의 스코프는 아니다. §1.6 표에 코드명을 보완하고 싶다면 그 "별도 pass" 때 함께 처리.

- **[INFO]** `transferOwnership` lock 패턴 서술의 정밀도
  - target 위치: "후 (2)" — "트랜잭션 안에서 락을 잡고 재검사하는 자리(`leaveWorkspace` · `transferOwnership`)"
  - 충돌 대상: 없음(§1.10 이 `leaveWorkspace` 의 비관적 락+TOCTOU 방지를 이미 명시하고 있어 정합. §1.6 은
    `transferOwnership` 의 락 방식을 명시하지 않으나 target 서술을 반박하지도 않는다)
  - 상세: 순수 확인 항목 — 실제 반박 근거 없음.
  - 제안: 조치 불필요.

## 교차 확인한 정합 항목 (충돌 없음 확인)

- **에러 코드 재사용**: `OWNER_REQUIRED` 는 `spec/5-system/3-error-handling.md:48` 에 이미 "워크스페이스
  Owner 역할 필요(`RolesGuard` 의 `@Roles('owner')` 미달 · 워크스페이스 삭제 · **소유권 이전**)" 로 등재돼
  있다 — target 이 `transferOwnership` 비-owner 거부에 `OWNER_REQUIRED` 를 쓴다는 서술과 정확히 일치.
- **RBAC**: `spec/2-navigation/9-user-profile.md` §4.1 "Owner 이양 | Owner" 행과 `spec/data-flow/
  12-workspace.md` §1.6 `@Roles('owner')` 요구가 target 서술(팀 비-owner 는 거부)과 모순 없음.
  `error-codes.md` §3(historical-artifact 레지스트리)·§5(rename 이력)는 `CANNOT_TRANSFER_PERSONAL` 같은
  신규 UPPER_SNAKE 코드에 적용 대상이 아니므로 등재 누락이 아니다.
- **텍스트 앵커 정합**: target 이 인용하는 "전 (1)"·"전 (2)" 원문이 `spec/data-flow/12-workspace.md` 358~359
  행·387~388행의 실제 텍스트와 완전히 일치 — 치환이 다른 절을 잘못 건드릴 위험 없음.
- **코드 실재성**: `CANNOT_TRANSFER_PERSONAL` 은 `codebase/backend/src/modules/workspaces/
  workspaces.service.ts:745` 에 실제 발행되고 `*.spec.ts` 로 테스트된 코드다 — target 인용이 가상의 식별자가
  아니다(다른 병렬 checker `naming_collision` 도 동일하게 확인).
- **범위 경계**: 같은 PR 의 이전 planner 턴(`plan/complete/spec-draft-workspace-path-guard-followup.md`,
  `--spec review/consistency/2026/09/25/15_50_10` BLOCK:NO)이 `9-user-profile.md` §3 카브아웃 미러링·
  `1-auth.md` §부트 캐너리 역방향 각주를 이미 별도로 처리했다 — 이번 target 은 그와 무관한 새 정정이며
  중복·충돌하지 않는다.

## 요약

target 은 `spec/data-flow/12-workspace.md` 한 절의 역사적 실측 기록을 "두 메서드"에서 "세 메서드"로
소급 정정하는 좁은 변경이며, 인용한 원문 텍스트·에러 코드(`OWNER_REQUIRED`·`CANNOT_TRANSFER_PERSONAL`)·
RBAC 요구가 같은 도메인의 §1.6 표·`error-handling.md` 카탈로그·`9-user-profile.md` 화면 스펙과 모두
정합한다. 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC 구조 자체를 바꾸지 않으므로 다른 영역과의
실질적 충돌 표면이 없다. 발견된 두 건은 모두 INFO 수준이며 그중 하나는 이미 기존 spec 이 "별도 pass" 로
유예를 명시한 기존 채무일 뿐 target 이 만든 신규 모순이 아니다.

## 위험도

NONE
