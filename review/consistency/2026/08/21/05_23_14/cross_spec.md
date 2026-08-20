# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, `MASKED_VALUE_RESUBMITTED` 서버측 거부)

## 검토 대상 변경 요약

`origin/main` 대비 실제 diff는 다음 7개 spec 파일에 걸쳐 있다 (target 은 `spec/5-system/` 이나 diff-base 로 전체 repo 를 대조):

- `spec/5-system/14-external-interaction-api.md` (§R17) — 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 재제출을 서버가 Manual 실행 경로 두 곳(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`)에서 거부하는 4번째 가드 소비처로 등재
- `spec/5-system/13-replay-rerun.md` (§8.1, §10.2) — `INVALID_INPUT` 에러 표에 `MASKED_VALUE_RESUBMITTED` 사유 추가
- `spec/5-system/12-webhook.md` (§5.2) — 카탈로그에 4번째 코드 추가하되 webhook 런타임 경로는 대상 아님을 명시
- `spec/5-system/3-error-handling.md` (§1.3, §1.7) — `INVALID_INPUT` 카탈로그 행 신설, `details[].code` 4종 카탈로그에 `MASKED_VALUE_RESUBMITTED` 추가, re-run 이 헬퍼의 3번째 소비처가 된 배선 교정 서술
- `spec/4-nodes/7-trigger/1-manual-trigger.md` (§6, Rationale) — `masked_value_resubmitted` reason 행, raw-우선 + resolve-후 2단계 검사 시점 Rationale
- `spec/3-workflow-editor/3-execution.md` — JSON 에디터/히스토리 로드 UI 서술에 서버 2층 방어 언급
- `spec/1-data-model.md` — `Execution.input_data` 컬럼 설명에 서버측 거부 서술 추가

구현은 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`)가 담당하며 `workflows.controller.ts`(주 실행 경로, `INVALID_TRIGGER_PARAMETERS`)와 `executions.service.ts`(re-run, `INVALID_INPUT`) 두 호출부에서만 쓰인다. `hooks.service.ts`(webhook)·`schedule-runner.service.ts`(schedule)는 여전히 `resolveTriggerParameters` 를 직접 호출해 이 가드를 우회하지 않는다 — 코드가 spec 서술과 정확히 일치함을 절대경로로 확인했다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다. 아래는 확인했으나 실제로는 이미 spec 본문이 스스로 해소해 둔 잠재 충돌 후보들이다 (참고용, 조치 불요):

- **[해소 확인] `useOriginalInput` 기본값 이원성** — `executions.service.ts` 의 DTO 기본값(`dto.useOriginalInput ?? true`)과 EIA §R17 서술("Re-run 모달의 `useOriginalInput` **기본값이 `false`**")이 언뜻 모순처럼 보이나, `spec/5-system/13-replay-rerun.md` §10.2 UI 명세 표가 정확히 이 지점을 캐비엇으로 이미 처리해 뒀다 — "프론트엔드는 토글 상태로부터 `useOriginalInput` 을 **항상 명시 전송**하므로, §8.1 의 API 기본값 `true` 는 필드를 생략한 직접 API 호출자용 안전 폴백일 뿐 UI 기본값(OFF=false)과 모순되지 않는다". 두 레이어(API 계약 기본값 vs UI 상태 기본값)가 분리돼 있고 문서가 그 분리를 명시적으로 설명한다.
- **[해소 확인] "공유 함수 안에 넣지 않는다" vs "adapter `resolveTriggerParameters` 전후 2단계"** — `1-manual-trigger.md` §6 표 문구("adapter `resolveTriggerParameters` **전후** 2단계")가 EIA §R17의 "거부를 `resolveTriggerParameters` 공유 함수 안에 넣지 않는다"는 서술과 상충하는 것처럼 읽힐 수 있으나, 실제 구현은 별도 wrapper(`resolveTriggerParametersRejectingMasked`)가 `resolveTriggerParameters` 를 감싸는 형태이고 webhook/schedule 은 wrapper 를 거치지 않고 원본 함수를 직접 호출한다 — "전후"는 wrapper 내부에서 원본 함수 호출 전/후 지점을 가리키는 것이지 원본 함수 내부에 로직을 넣었다는 뜻이 아니다. 코드-스펙 일치 확인.
- **[해소 확인] 에러 코드 명명 규약(`conventions/error-codes.md`)** — `MASKED_VALUE_RESUBMITTED` 는 `UPPER_SNAKE_CASE`·의미 기반 명명 원칙을 따르고, 기존 §3 historical-artifact 레지스트리·§5 rename 이력 어디와도 문자열 충돌이 없다. `INVALID_INPUT`(re-run 최상위 코드) 역시 repo 전체에서 재사용처가 이 diff 가 건드린 두 곳(`13-replay-rerun.md`, `3-error-handling.md`) 뿐이며 다른 도메인에서 동명의 다른 의미로 쓰이지 않는다.
- **[해소 확인] webhook 카탈로그 서술 순서** — `12-webhook.md`/`3-error-handling.md` 가 `MASKED_VALUE_RESUBMITTED` 를 "webhook 봉투의 `details[]` 항목 코드"라고 먼저 말한 뒤 곧바로 "webhook 런타임 경로에서는 발생하지 않는다"고 스코프를 좁히는 2단 서술이라 처음 읽으면 자기모순처럼 보이지만, 이는 "헬퍼가 공유하는 카탈로그 표"와 "실제 발행 스코프"를 구분하는 기존 문서 관례(`INVALID_SCHEMA` 행도 동일 패턴으로 이미 존재)를 그대로 재사용한 것이라 신규 결함이 아니다.

## 요약

이번 target 변경(`MASKED_VALUE_RESUBMITTED` 서버측 2층 방어)은 데이터 모델(`spec/1-data-model.md`), API 계약(`13-replay-rerun.md` §8.1, `12-webhook.md` §5.2), 에러 코드 카탈로그(`3-error-handling.md` §1.3/§1.7, `conventions/error-codes.md`), 도메인 트리거 스펙(`1-manual-trigger.md` §6), UI 스펙(`3-execution.md`) 전 영역에 걸쳐 있음에도 상호 참조가 촘촘하고 정의가 한 곳(EIA §R17)을 SoT 로 일관되게 가리킨다. 특히 잠재적으로 모순처럼 보일 수 있는 세 지점(useOriginalInput 이원 기본값·"공유 함수 안에 넣지 않는다"는 서술과 "전후 2단계" 표현·webhook 카탈로그 등재 vs 미발행 범위)을 spec 본문이 이미 명시적 캐비엇으로 선제 해소해 뒀고, 코드(`reject-masked-resubmission.ts`, `workflows.controller.ts`, `executions.service.ts`, `hooks.service.ts`, `schedule-runner.service.ts`)를 절대경로로 대조한 결과도 서술과 정확히 일치했다. git 이력상 이미 11라운드의 리뷰를 거친 브랜치라는 점과 부합하는 결과다. 데이터 모델·API 계약·요구사항(에러 코드) ID·상태 전이·RBAC·계층 책임 여섯 관점 모두에서 신규 CRITICAL/WARNING 충돌을 찾지 못했다.

## 위험도
NONE
