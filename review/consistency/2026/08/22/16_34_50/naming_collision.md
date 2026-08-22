# 신규 식별자 충돌 검토 — eia-error-code-unify

## 발견사항

- **[INFO]** `INVALID_TRIGGER_PARAMETERS` 는 "신규 식별자"가 아니라 기존 값의 3번째 소비처 확장
  - target 신규 식별자: `POST /executions/:id/re-run` 이 발행하는 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 변경
  - 기존 사용처: `codebase/backend/src/modules/workflows/workflows.service.ts:931`, `workflows.controller.ts:324` (실측 확인 — grep 결과 두 곳 모두 현재 `code: 'INVALID_TRIGGER_PARAMETERS'`), spec 상 `spec/4-nodes/7-trigger/1-manual-trigger.md:180`, `spec/5-system/3-error-handling.md:189`
  - 상세: 세 엔드포인트 모두 동일한 발행처(`resolveTriggerParameters` → `TriggerParameterValidationException`)에서 오는 **같은 의미**의 검증 실패를 감싼다. 즉 이 값은 이미 "Manual Trigger 파라미터 스키마 검증 실패"라는 고정된 의미로 두 곳에서 쓰이고 있고, target 은 그 의미를 세 번째 호출부로 **일관되게 확장**하는 것이지 다른 의미를 가진 값과 이름이 충돌하는 것이 아니다. `spec/5-system/3-error-handling.md` §1.3 카탈로그 표(56~89행)에는 현재 `INVALID_TRIGGER_PARAMETERS` 행 자체가 없고(테이블 grep 확인, `INVALID_INPUT` 행(80행)만 존재) — target 이 80행을 rename 하면 이 카탈로그 갭도 우연히 메워진다.
  - 제안: 조치 불요(설계 의도가 곧 통합이므로). 다만 §1.3 표의 새 행 설명에 "세 엔드포인트 공용" 임을 명시하도록 target 의 "동반 개정 표면" 절 지시가 실제 편집 시 반영되게 할 것(이미 target 문서가 `1-manual-trigger.md` §6 표·`3-error-handling.md` 카탈로그를 개정 대상으로 명시하고 있어 누락 위험은 낮음).

- **[INFO]** `error-codes.md §5` Rename 이력 "PR" 컬럼 값 미지정 — 인접 커밋 해시와 혼동 여지
  - target 신규 식별자: `error-codes.md §5` 표에 신설되는 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 행의 "PR" 컬럼
  - 기존 사용처: 같은 표의 기존 3행은 `PR4b`/`#566` 형식의 실제 PR/티켓 참조를 쓴다(`spec/conventions/error-codes.md` §5, 220행 부근)
  - 상세: target 본문은 §5 선례 실측 근거로 "(2026-08-22, `7b0e65aa8`)" 를 인용하는데, 이 커밋(`7b0e65aa8 refactor(ci): 미러 가드...`)은 이번 rename 작업과 무관한 **이전 PR**(git log 상 최근 커밋)이다. 구현자가 이 해시를 실측 근거 인용이 아니라 §5 표의 "PR" 컬럼 값으로 그대로 옮기면, 실제로 이 작업을 수행한 PR 이 아닌 엉뚱한 PR 번호가 rename 이력에 남아 추후 추적 시 혼선을 유발할 수 있다.
  - 제안: spec 편집 시 §5 신규 행의 "PR" 컬럼에는 **이 작업의 실제 PR 번호**(머지 시점에 결정)를 쓰고, `7b0e65aa8` 은 실측 방법론 인용으로만 남긴다는 점을 명시적으로 확인할 것.

- **[INFO]** `code:` frontmatter 확장은 기존 컨벤션 재사용, 신규 키 아님
  - target 신규 식별자: `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록에 `resolveTriggerParametersRejectingMasked` / `reject-masked-resubmission.ts` 추가
  - 기존 사용처: 두 파일 모두 이미 `code:` frontmatter 를 갖고 있고(`spec-impl-evidence` 컨벤션의 표준 키), `reject-masked-resubmission.ts` 는 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 로 이미 존재하는 코드 파일이다(신규 생성 아님). 어느 spec 의 `code:` 목록에도 아직 등재되어 있지 않음을 grep 으로 확인(0건) — 등재 시 다른 문서의 `code:` 목록과 겹치거나 의미가 갈리는 충돌은 없다.
  - 제안: 조치 불요.

- **[INFO]** 파일 경로 충돌 없음
  - target 신규 식별자: `plan/in-progress/eia-error-code-unify.md`
  - 기존 사용처: 없음. `plan/in-progress/`(eia-context-schema-followups.md, eia-terminal-payload.md 등)·`plan/complete/`·`.claude/worktrees/` 전수 검색 결과 동일/유사 파일명 충돌 없음. `spec_impact` 6개 파일도 모두 기존 spec 파일이며 target 이 신규 spec 파일을 만들지 않는다.
  - 제안: 조치 불요.

## 요약

target 은 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로를 **하나도 신설하지 않는다.** 유일하게 "값이 바뀌는" 대상인 `error.code` 는 이미 다른 두 엔드포인트에서 동일한 의미로 쓰이고 있는 `INVALID_TRIGGER_PARAMETERS` 를 세 번째 호출부로 확장하는 것이며, 이는 "다른 의미로 이미 쓰이던 이름과의 충돌"이 아니라 "같은 의미를 가진 기존 값의 통합"이라 정의상 CRITICAL/WARNING 대상이 아니다. `code:` frontmatter 확장 대상 파일(`reject-masked-resubmission.ts`)도 이미 존재하는 코드 파일을 뒤늦게 문서에 등재하는 것뿐이며 다른 spec 의 `code:` 목록과 겹치지 않는다. 유일하게 주의를 요하는 지점은 `error-codes.md §5` 신규 행의 "PR" 컬럼에 근거 인용용 커밋 해시(`7b0e65aa8`, 이번 작업과 무관한 이전 PR)가 실수로 옮겨 적힐 위험으로, INFO 수준에서 명시해 둔다.

## 위험도
NONE
