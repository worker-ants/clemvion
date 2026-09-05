# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 방법 메모

`scope(spec/5-system) 델타 = 0` 이지만 구현 diff 9개 파일(`codebase/backend/src/modules/audit-logs/**`,
`codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}`,
`execution-response.dto.spec.ts`, 4개 e2e-spec)은 실재했다. 프롬프트의 diff 섹션이 예산으로
잘려 있어 `git -C <worktree> diff origin/main...HEAD` 를 직접 재실행해 실제 변경분을 확인했고,
관련된 두 in-progress plan(`spec-draft-nullable-notation-followups.md`,
`spec-sync-auth-gaps.md`) 전문을 대조했다. 이 두 plan 은 이번 diff 에 함께 포함돼 있어(즉
이 세션 자신이 갱신함), 코드 변경과 plan 서술이 실제로 동기화됐는지를 직접 diff-대 diff 로
검증했다.

## 발견사항

- **[INFO]** §5.4 검증자(`response-contract.ts`)가 여전히 어떤 spec 의 `code:` glob 에도
  안 걸린다 — 이미 추적 중인 기존 갭
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (9개 경로, 목록에
    `codebase/backend/src/shared/testing/response-contract.ts` 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속
    "`2-api-convention.md` frontmatter `code:` 에 §5.4 검증자 등재" (미체크, planner 담당)
  - 상세: 이번 PR 이 바로 그 `response-contract.ts` 를 신설하고 4개 DTO(`ExecutionDto`·
    `WorkflowDto`·`AuditLogDto`·`SessionDto`)를 배선해 §5.4 시행 코드로서의 비중이 커졌는데,
    frontmatter 갱신은 plan 이 이미 planner 트랙으로 분리해 둔 대로 이번 developer PR 범위
    밖으로 남아 있다. 갭 자체는 새로 발견한 것이 아니라 plan 이 정확히 서술한 그대로다 —
    target 이 그 미해결 결정을 우회하거나 일방적으로 판단을 내리지 않았다.
  - 제안: 새 조치 불요. 다음 planner 턴에서 그 항목을 집행할 때 이번에 새로 생긴
    `response-contract.ts` 배선 4곳(§5.4 실제 시행 지점)을 함께 참조하면 등재 근거가 더
    분명해진다.

## 정합성 확인 (문제 없음, 기록용)

- 구현 diff(감사 로그 `findAll` 과다 노출 수정 + `AuditLogListItem` 타입 축소 + §5.4
  검증자 신설)는 `spec-draft-nullable-notation-followups.md` §후속의 두 open 항목
  ("§5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO 78곳", "audit-logs.service.ts 주석
  '12개+'→'12개' 통일")이 예고한 작업과 정확히 일치하고, 이번 PR 이 그 두 plan 파일의
  체크박스·서술을 함께 갱신했다(diff 로 확인). 줄 번호 인용도 stale 되지 않도록
  "줄 번호를 뺐다" 로 스스로 정정해 뒀다.
- "`User` 엔티티에 컬럼 수준 방어(`select:false`)를 둘지" 는 plan 이 이미 별도 결정
  항목으로 열어 둔 채, 이번 PR 은 그 결정을 선취하지 않고 쿼리 하나만 좁혀 고쳤다 —
  plan 서술("이번 PR 에서 하지 않은 이유")과 실제 diff 범위가 일치한다. 미해결 결정을
  일방적으로 내린 흔적 없음.
- `spec/5-system/2-api-convention.md` §5.4 본문(응답 바디 한정·소급 적용 배제·DTO 선언
  세 갈래)과 신설된 `response-contract.ts`·`execution-response.dto.spec.ts` 의 판정 규칙이
  1:1 로 대응한다 — 특히 "OPTIONAL_NULLABLE_DRIFT" 10개 필드를 "위반" 이 아니라 "추적 중인
  drift" 로 다루는 것은 §5.4 의 "소급 적용 대상 아님" 조항과 정확히 부합한다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` (완료 근접, 잔여 1건 —
  코드 주석 프레이밍, developer 트랙)와 `node-output-redesign/README.md` 는 이번 diff 의
  변경 영역(audit-logs, response-contract)과 무관해 충돌 없음.
- 예산 절단으로 본문이 생략된 나머지 spec/5-system 하위 파일(14/15/`_product-overview`/
  4/6/8/9/10/12/13/17/5/7/11/16) 과 59개 plan 파일 제목을 훑었으나, 이번 diff 의 변경
  영역(감사 로그 응답 형태·§5.4 검증)과 이름·키워드가 겹치는 것은
  `spec-draft-nullable-notation-followups.md`·`spec-sync-auth-gaps.md` 둘뿐이었다
  (`grep -rl "response-contract\|AuditLogUserDto\|audit-logs.service" plan/in-progress/`
  로 확인).

## 요약

이번 diff(감사 로그 `findAll` 과다 노출 수정 + `AuditLogListItem` 타입 축소 + §5.4 응답
계약 검증자 신설·4개 DTO 배선)는 target(`spec/5-system/`) 을 직접 편집하지 않았지만, 그
내용은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 와
`spec-sync-auth-gaps.md` 가 미리 등재해 둔 open 항목과 정확히 대응하며, 이번 세션이 그
두 plan 파일도 함께 갱신해 체크박스·서술이 실제 diff 와 어긋나지 않는다. 미해결 결정을
우회하거나 일방적으로 판단한 흔적은 없고("User 엔티티 컬럼 방어"·"frontmatter code: 등재"
모두 plan 이 이미 연 채로 그대로 남아 있다), 선행 plan 미해소나 후속 항목 누락도 발견되지
않았다. 유일하게 적을 만한 것은 이미 추적 중인 §5.4 검증자 미등재 갭이 이번 PR 로 실질적
비중이 커졌다는 INFO 수준의 재확인뿐이다.

## 위험도

NONE
