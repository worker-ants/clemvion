# Cross-Spec 일관성 검토 — user-entity-column-defense (impl-done, scope=spec/5-system/)

## 검토 방법 메모

- scope(`spec/5-system/`) 델타는 이번에도 **0개 파일** — 이 브랜치는 spec 을 바꾸지 않는 코드 전용 PR 이다. 델타 0 자체를 CRITICAL 근거로 쓰지 않았다.
- 프롬프트 번들의 `## 구현 변경 사항`(diff)·다수 `spec/5-system/*.md` 는 컨텍스트 예산에 잘려 비어 있었다. 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`, 세션 cwd 와 동일)에서 `git diff origin/main...HEAD` 를 직접 실행해 실제 코드 diff(11 files, 955 insertions / 3 deletions — CHANGELOG·plan·`review/**` 제외 시 8개 코드 파일)를 확인했다.
- 이 세션은 동일 브랜치의 **직전 라운드**(`review/consistency/2026/09/06/10_13_23`)의 후속 재검토다. 그 라운드가 지적한 WARNING 3건 중 1건(e2e 케이스 레터 `F.` 중복)은 이번 diff 에서 실제로 수정됐음을 확인했다(`workspace-rbac.e2e-spec.ts` 신규 케이스가 `J.` 로 명명됨, 기존 `F.` 는 그대로 하나). 나머지 2건(WARNING 1·2)은 **"이 브랜치에서 고칠 수 없다"** 는 명시적 사유(spec 쓰기 권한은 planner 전담)로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재됐다 — 아래에서 그 등재가 실제로 되어 있는지, 그리고 spec 본문의 모순이 여전히 남아 있는지를 재확인했다.
- 변경 요지: (1) `WorkflowVersionsService.findOne` 의 `creator` 관계 무투영 로드를 `select` 투영으로 닫음(살아있는 `User` 전 컬럼 유출 수정), (2) `WorkspaceMemberDto.joinedAt` 필드 추가, (3) `User` 관계 전체 로드를 잡는 구조 가드(`user-entity-exposure-guard.ts`)와 응답 값의 이름 기반 부재를 잡는 가드(`user-secret-absence.ts`) 신설 + 소비 e2e 3건, (4) plan 체크박스·CHANGELOG 갱신.

## 발견사항

- **[WARNING]** §5.4 "두 검증자" 서술이 신규 검증자군 등장으로 실측과 어긋남 + 신규 가드가 `code:` 미등재
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`, `codebase/backend/src/shared/testing/user-secret-absence.spec.ts` (모두 신규, `spec/5-system/` 델타 없음)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 "검증 층" (227~238행) — *"본 절은 ... 그 자리를 **두 검증자**가 나눠 맡는다"* 라고 명시하고, 표는 `swagger-dto-contract-guard.ts`(선언↔선언)와 `response-contract.ts`(값↔선언) **정확히 두 행**만 갖는다. 또한 `spec/conventions/swagger.md` frontmatter `code:`(6~9행)는 `swagger-dto-contract*.ts`·`response-contract*.ts`·`swagger-probe*.ts` 만 등재하고 있어 신규 4파일과 매칭되지 않는다.
  - 상세: 신규 두 가드는 §5.4 절이 "컨트롤러가 엔티티를 그대로 반환하는 경로에서 `tsc` 가 대조할 지점이 없다" 고 지목한 바로 그 사각지대(엔티티 패스스루)를 잡는 **개념적으로 같은 클래스**의 검증자이지만, 구조 축(AST, `User` 관계 무투영 로드 탐지)과 이름 축(런타임, 응답 값에서 비밀 컬럼명 부재 단언)이라는 **기존 두 축과 다른 제3의 축**을 도입한다. 그런데도 (a) §5.4 표에 행이 추가되지 않아 "두 검증자" 서술이 문언 그대로 유지되고, (b) 파일명이 `swagger.md`/`2-api-convention.md` 어느 `code:` glob 에도 매칭되지 않는다. 정본 게이트(`review_guard._spec_linked_changes`)로 직접 확인한 바 신규 4파일 중 spec-linked 판정은 0건이다 — 이 가드들을 약화·삭제해도 `--impl-done` SPEC-CONSISTENCY 게이트가 걸리지 않는다. §5.4 자신이 "한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다" 고 경고한 실패 모드가 그대로 재현된 형태다.
  - **처분 확인**: developer 는 이 지적을 인지했고(직전 라운드 `10_13_23` WARNING 1과 동일 지적), spec 쓰기 권한이 없어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목("신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재")으로 정식 등재했다(체크박스 미체크 `- [ ]`, 2026-09-06 등재로 명시). 이는 프로젝트 write-boundary 관례(spec 변경은 planner 전담)를 정확히 따른 처분이다. 다만 **spec 본문 자체는 아직 고쳐지지 않았으므로**, 이 라운드 시점 기준으로 "두 검증자" 서술과 코드 실측 사이의 불일치는 여전히 유효한 WARNING이다.
  - 제안: planner 턴에서 `spec/5-system/2-api-convention.md` §5.4 표에 3번째 행(구조 축 / 이름 축, 둘을 합쳐 "패스스루 탐지" 그룹으로 서술할지 별도 행 2개로 할지는 planner 판단)을 추가하고, `code:` 를 `spec/conventions/swagger.md` 와 `spec/5-system/1-auth.md`(또는 신설 규범 절)에 등재한다.

- **[WARNING]** `User` 엔티티 민감 7컬럼의 "응답 노출 금지" 규범이 spec 본문 어디에도 없음 — 대칭 사례(Trigger/AuthConfig)와 문서화 수준 비대칭
  - target 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` 의 `USER_SECRET_KEYS`(`passwordHash`, `twoFactorSecret`, `totpRecoveryCodes`, `webauthnRecoveryCodes`, `emailVerifyToken`, `passwordResetToken`, `emailChangeToken`)
  - 충돌 대상: `spec/1-data-model.md` §2.1 User (실측: 이 7컬럼 설명 어디에도 "응답에 노출 금지" 문구 없음) vs `spec/conventions/secret-store.md` §1.1 "비대상 필드도 응답 바디에는 나가지 않는다"(86~101행) — 여기는 `AuthConfig.config`·`Trigger.config.interaction.triggerToken`·`Trigger.notification_secret_v2`·secret store ref 필드에 대해 **정식 규범 문장**("응답 DTO 에 선언되어서도, 응답 바디에 실려서도 안 된다")과 "시행 축은 두 개다"(§5.4 + swagger §5-1)라는 명시적 계보를 갖는다.
  - 상세: `User` 의 7개 민감 컬럼은 성격상(비밀번호 해시·2FA secret·복구 코드·계정 탈취용 토큰) `secret-store.md §1.1` 이 보호하는 필드군보다 민감도가 낮지 않은데도, 그 불변식의 **단일 진실이 코드(`USER_SECRET_KEYS` 배열)뿐**이다. `secret-store.md §1.1` 자신이 *"이 절은 2026-09-05 에 추가됐다. 그 전까지 '이 컬럼들이 응답에 나가면 안 된다' 는 요구가 `spec/**` 어디에도 정규 문장으로 없었고, 실제로 두 엔드포인트에서 나가고 있었다"* 고 스스로의 존재 이유를 적어 두었는데, `User` 에 대해서는 바로 그 상태(spec 문장 부재 + 실제 유출 발생 — `WorkflowVersionsService.findOne`)가 이번 PR 직전까지 재현되어 있었다. 코드는 고쳤지만 spec 문서는 여전히 이 대칭성을 반영하지 않는다.
  - **처분 확인**: 동일하게 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목("`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로")으로 등재됨(체크박스 미체크). 결정 근거(전수 열거 수치·기각한 두 대안)를 plan/CHANGELOG 에서 spec `## Rationale` 로 옮기는 것도 같은 항목에 함께 묶여 있다.
  - 제안: planner 턴에서 `spec/1-data-model.md §2.1` 또는 `spec/conventions/secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 절을 추가하고, `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 를 그 절의 `code:`/본문 링크로 잇는다(위 WARNING 항목과 동일 planner 작업으로 묶어도 무방).

## 요약

이번 diff 는 spec 이 정의한 데이터 모델(`WorkspaceMember.joined_at: Timestamp?`, `Execution.executed_by → User`)·§5.4 nullable 표기 규약(`joinedAt` 을 기본형 `@ApiProperty({nullable:true})` 로 선언한 근거를 실측으로 정정)·`WorkflowVersionDto.creator` 계약(참조 3필드 `id/name/email`)과 정면으로 모순되는 지점은 없다. `WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출 수정은 기존 자매 메서드·기존 DTO 계약을 그대로 따른 것이다. 직전 라운드가 지적한 3건 중 e2e 레터 중복은 이번 diff 에서 실제로 고쳐졌음을 확인했다. 남은 2건(§5.4 "두 검증자" 서술의 실측 초과, `User` 노출 금지 규범의 spec 부재)은 developer 권한 밖이라 정당하게 planner 후속으로 등재됐지만, **spec 본문 자체는 이번 라운드 시점에도 여전히 그 상태**이므로 재확인 차원에서 WARNING 으로 다시 낸다 — 둘 다 기능을 저해하거나 직접 모순을 일으키지는 않고, 등재된 plan 항목이 재검토 경로를 이미 확보해 두었으므로 등급은 WARNING 유지, 위험도는 LOW 로 판단한다.

## 위험도

LOW
