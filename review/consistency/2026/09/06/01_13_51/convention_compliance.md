# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 및 방법

- **scope**: `spec/5-system/` — 이번 브랜치의 spec 델타는 **0개 파일**(`git diff origin/main...HEAD --stat -- spec/` 실측, 무변경). 본 검토는 신규 spec 위반이 아니라, 구현 diff(32파일/2394줄 — 응답 DTO 필드 보강·§5.4 스윕·`response-contract` 검증자·감사 로그 자격증명 유출 수정)가 기존 `spec/5-system/1-auth.md`·`spec/5-system/2-api-convention.md`·`spec/5-system/3-error-handling.md` 및 `spec/conventions/**`(swagger.md·error-codes.md·audit-actions.md·egress-masking.md)와 정합적으로 맞물리는가를 표준(standing) 감사로 확인했다.
- 프롬프트 자체는 컨텍스트 예산으로 `spec/5-system/` 17개 중 2개(`1-auth.md`·`2-api-convention.md`) 본문만, `spec/conventions/**` 는 파일 목록만(본문 0) 실려 있었고 구현 diff 본문도 예산에 잘렸다. 판정에 필요한 본문은 워킹트리에서 직접 `Read`/`git show`/`git diff`로 절대경로 대조했다: `spec/conventions/swagger.md`(전체) · `spec/5-system/3-error-handling.md`(§1.1·§5.1) · `spec/conventions/egress-masking.md`(관련 절) · 신규/변경 코드 전체(`git diff origin/main...HEAD -- codebase/`, `git log --format='%h %ad %s' origin/main..HEAD -- codebase/ spec/`).
- 이 브랜치는 이미 12라운드의 `/ai-review` + `/consistency-check` 를 거쳤고 직전 라운드(`00_48_52`)는 CRITICAL·WARNING 없이 NONE 으로 수렴했다. 본 라운드는 그 이후 새로 랜딩한 마지막 커밋(`fdb9b7caf`, 01:13:41 — 직전 라운드의 WARNING 4건 처분)까지 포함해 재검토했다.

## 발견사항

- **[INFO] 동일 `code: INTERNAL_ERROR` 가 두 갈래 언어의 `message` 를 낸다**
  - target 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` (`getExecutions` 의 `if (!t)` 분기, 최신 커밋 `fdb9b7caf` 신설) vs `codebase/backend/src/common/filters/http-exception.filter.ts` (`GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE`, 이번 PR 무변경)
  - 관련 규약: `spec/5-system/3-error-handling.md` §1.1 시스템 에러 표 — `INTERNAL_ERROR` 행의 "사용자 메시지" 열이 `"서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."` 로 명시 · `spec/5-system/2-api-convention.md` §5.3(에러 응답 형식 — CWE-209 방지, 상태코드별 기본 코드)
  - 상세: 신설된 `schedules.controller.ts` 코드는 `InternalServerErrorException({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' })` 를 던진다 — 이 문자열은 spec §1.1 표의 `INTERNAL_ERROR` 행과 **정확히 일치**해 그 자체로는 규약 위반이 아니다(오히려 spec 본문을 문자 그대로 지킨 사례). 문제는 같은 `code=INTERNAL_ERROR` 를 내는 **기존** 제네릭 폴백 경로(`GlobalExceptionFilter` 의 매핑되지 않은 순수 `Error` → `UNHANDLED_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'`, 영어, 이번 PR 이 건드리지 않음)가 spec §1.1 의 한국어 문구를 따르지 않고 있어, **동일 코드값이 호출 경로에 따라 영어/한국어로 갈리는 상태가 이번 커밋으로 처음 관측 가능해졌다.** `error-codes.md §77행` 이 지적하듯 프론트가 `code` 분기 없이 `message` 를 직접 표시하는 소비처가 이미 존재하는 패턴이라, 이 drift 는 잠재적으로 사용자 노출 표면이다.
  - 제안: target(spec) 은 그대로 두고, `GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE` 를 spec §1.1 의 한국어 문구로 맞추는 코드 정정을 향후 트래커에 등재할 것을 권한다(이번 PR 의 회귀는 아니므로 본 PR 의 블로커는 아님). 대안으로 spec §1.1 "사용자 메시지" 열이 실제로는 "프론트가 표시하는 문구"(클라이언트 측 매핑, §5.1 토스트 표와 동형)이지 "wire 의 `error.message` 리터럴"이 아님을 뜻한다면, 그 점을 §1.1 헤더나 각주에 명시해 두 문서 해석의 모호함을 없애는 것도 방법이다.

## 확인한 준수 근거 (위반 아님 — 교차검증 결과)

- **§5.3 CWE-209 마스킹**: 신설 코드가 내부 원문(`schedule.id`, 컬럼명 `trigger_id`, join 추론 힌트)을 `this.logger.error(...)` 로만 남기고 응답 바디에는 고정 문구만 싣는다 — §5.3 "내부 구현 원문을 echo 하지 않는다" 를 정확히 따른다. 직전 라운드는 이 CWE-209 를 놓쳤던 버전(`InternalServerErrorException(문자열)`)을 지적했고, 이번 커밋이 그것을 닫았다.
- **§5.4 검증자 등재**: `repo-guards/__tests__/swagger-dto-contract*.ts` · `shared/testing/response-contract*.ts` · `shared/testing/swagger-probe*.ts` 가 `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md` 양쪽 frontmatter `code:` 에 모두 등재돼 있고, 파일이 실제로 그 경로에 존재함을 `ls` 로 확인. `response-contract.ts` JSDoc 의 판정 규칙 표(§5.4 축 vs 확장 축 구분)가 spec §5.4 "검증 층" 절의 서술과 일치.
- **swagger.md §1-4/§5-1 (엔티티 패스스루 차단)**: `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto` 신설이 조인 엔티티 전체 노출(트리거 회전 secret·`notificationSecretV2`/`chatChannelTokenV2` 유출 포함)을 참조-전용 DTO 로 좁혔다 — swagger.md §5-1 "엔티티를 그대로 노출하지 말 것" 원칙과 일치. 두 자매 DTO 의 필드 차이(`id` 포함 여부)는 이번 마지막 커밋에서 상호 참조 JSDoc으로 명시돼 향후 "한쪽을 다른 쪽으로 치환" 오독을 방지한다.
- **swagger.md §3 (JSDoc 공개/`//` 내부 서사 분리)**: 이번 커밋이 건드린 모든 DTO·컨트롤러 파일에서 정정 경위·리뷰 인용(`review/code/...`, `review/consistency/...`)은 `//` 에, 소비자용 설명은 `/** */` 에 정확히 분리돼 있다.
- **감사 로그 자격증명 유출 수정 (`audit-logs.service.ts`)**: `leftJoinAndSelect('al.user','user')`(엔티티 전체 26키 유출) → `.leftJoin` + `.addSelect(['user.id','user.name','user.email'])` 로 정정 — `AuditLogUserDto` 가 광고하는 3필드만 DB 밖으로 나가며, 워크스페이스 멤버 목록 등 저장소 기존 선례와 동형이다. `secret-store.md`/`egress-masking.md` 가 다루는 "값-패턴 마스킹" 범주는 아니지만(이쪽은 애초에 select 범위를 좁히는 쿼리 계층 수정), swagger.md §5-1 이 요구하는 "응답 DTO 가 실제로 좁혀졌는가"의 실질 요건은 충족한다.
- **audit-actions.md ↔ 1-auth.md §4.1 카탈로그**: 이번 diff 는 신규 액션을 추가하지 않으므로 재확인만 — 기존 정합 유지(직전 라운드 확인과 동일).
- **numeric wire 타입(§1-6)**: 이번 diff에 `numeric`/`decimal` 패스스루 필드 신규 없음 — 위반 표면 자체가 없음.
- **문서 구조(Overview/본문/Rationale)**: `spec/5-system` 델타가 0이므로 재확인 대상 없음(직전 라운드에서 `1-auth.md`·`2-api-convention.md` 3섹션 구성 확인 완료).

## 요약

이번 라운드는 spec/5-system 자체를 건드리지 않았고(델타 0), 마지막 커밋(`fdb9b7caf`)까지 포함한 구현 diff 전체를 재대조해도 CRITICAL·WARNING 급 정식 규약 위반은 없다. 오히려 최신 커밋은 직전 라운드가 지적한 CWE-209 결함(에러 메시지에 내부 식별자·컬럼명 echo)을 spec §5.3 문면대로 정확히 닫았다. 유일하게 새로 관측된 것은 그 정정이 spec §1.1 의 한국어 `INTERNAL_ERROR` 문구를 문자 그대로 채택하면서, 손대지 않은 기존 `GlobalExceptionFilter` 제네릭 폴백(영어)과 같은 코드값에 대해 언어가 갈리게 됐다는 점이다 — 이는 이 PR 이 만든 회귀가 아니라 기존에 잠재해 있던 spec-구현 drift가 이번에 처음 나란히 드러난 것이며, 규약 위반이라기보다 후속 정리 항목(INFO)이다.

## 위험도

NONE
