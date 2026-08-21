STATUS=success scope review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — `inputOverride` 서버측 마커 리터럴 거부 (EIA §R17)

## 검토 방법

프롬프트가 첨부한 41개 대상 파일 diff 를 전수 확인하고, `git diff --stat origin/main -- codebase/`,
`-- plan/ spec/`, `-- review/` 로 커밋 경계별 변경 규모를 실측했다. 브랜치는 3개 커밋으로 구성된다:

- `3e96f4b44` docs(spec): 초안 (+ `19_34_37`·`19_48_56` consistency 산출물, planner 턴)
- `871d3fcb0` docs(spec): impl-prep 정정 (+ `23_33_00` consistency 산출물, planner 턴)
- `137a48200` fix(security): 실제 구현 (developer 턴) — `codebase/` **8개 파일, +427/-6줄만** 포함

## 발견사항

- **[INFO]** `executions.service.ts` 의 `errors:` → `details:` 배선 교정은 문자 그대로의 요청
  범위("마스킹 값 재제출 거부")를 넘어 **별개의 선존 버그**(re-run 경로가 `details[]` 대신
  `errors` 키로 던져 `GlobalExceptionFilter` 가 필드별 내역을 조용히 버림)를 함께 고친다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:509`(게이트 기준,
    `details: toTriggerParameterErrorDetails(err.errors),`)
  - 상세: 다만 이 수정 없이 새 `MASKED_VALUE_RESUBMITTED` 코드만 얹으면 re-run 경로에서는
    그 코드가 응답에 전혀 실리지 않아(execute 경로만 안내 도달) 기능이 절반만 동작한다 —
    커밋 메시지·인라인 주석·spec(`13-replay-rerun.md`, `1-manual-trigger.md:184`)이 모두 이
    인과관계를 명시하고 있어 "요청 이상의 추가 수정"이 아니라 **기능이 목표를 달성하기 위한
    필수 선결 수정**으로 판단된다. 스코프 이탈로 보지 않는다.
  - 제안: 조치 불요 — 정상 판단.

- **[INFO]** `review/consistency/2026/08/20/{19_34_37,19_48_56,23_33_00}/**` (24개 파일,
  +1477줄) 이 실제 기능 diff(427줄)보다 3배 이상 크며 브랜치에 포함돼 있다.
  - 위치: `review/consistency/2026/08/20/19_34_37/`·`19_48_56/`·`23_33_00/` 전체
  - 상세: 이 저장소 CLAUDE.md 는 `project-planner` 가 `spec/` 쓰기 직전 `consistency-check
    --spec` 을, `developer` 가 구현 착수 직전 `--impl-prep` 을 의무화하고 review 산출물을
    `review/consistency/**` 에 저장하도록 명시한다(gitignore 대상 아님). 실측 결과 이 산출물은
    구현 커밋(`137a48200`, developer 턴)이 아니라 두 planner 커밋(`3e96f4b44`·`871d3fcb0`)에
    자연스럽게 분산돼 있어, 워크플로가 요구하는 게이트 통과 기록이지 임의로 끼워 넣은 무관한
    파일이 아니다. 스코프 이탈이 아니라 이 저장소의 표준 SDD 관행이다.
  - 제안: 조치 불요.

## 스코프 내로 확인한 항목 (문제 없음)

- **핵심 구현 8파일**(`trigger-parameter.types.ts`, `reject-masked-resubmission.ts`(+spec),
  `executions.service.ts`, `executions-rerun.service.spec.ts`, `workflows.controller.ts`(+spec),
  `sanitize-error-message.ts`) 전부 "마스킹 마커 재제출 서버측 거부" 라는 단일 기능의 필수
  구성 요소다. 새 에러 코드(`MASKED_VALUE_RESUBMITTED`) 추가, 판정 유틸(`findMaskedResubmissions`)
  신설, 두 호출부(re-run·execute) 배선, 테스트 — 무관한 리팩토링·불필요한 정리 없음.
- `sanitize-error-message.ts` 의 `isMaskedMarker`/`MASKED_MARKERS` **export 승격**은 새 유틸이
  프런트와 동일 판정 로직을 재구현하지 않고 재사용하기 위한 최소 표면 변경이며, 자체 주석으로
  근거("미러 발산으로 반복해 뚫렸다")를 남긴다 — 무관한 API 확장이 아니다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,164`(게이트 기준)
- 테스트(경계·캐너리·스택 회귀)는 함수 하나(`findMaskedResubmissions`/`hasMaskedLeaf`)와
  그 호출부 배선만 겨냥하며, 신규 기능 확장(over-engineering)이 아니라 이 문서군이 반복 요구해
  온 "정확 일치 경계"·"깊이 상한 순서"에 대한 회귀 방지다.
- `plan/in-progress/spec-draft-inputoverride-marker-reject.md` 본문을 직접 열어 확인한 결과
  전체가 이 단일 트래커 항목(W6) 집행에 국한되며, 무관한 결정·범위 확장 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 변경은 W5 체크박스를 실제
  종결 근거와 함께 닫는 것뿐 — 관련 없는 항목 손대지 않음.
- spec 7개 파일(`1-data-model.md`·`3-execution.md`·`1-manual-trigger.md`·`12-webhook.md`·
  `13-replay-rerun.md`·`14-external-interaction-api.md`·`3-error-handling.md`) 변경은 전부
  frontmatter `spec_impact` 목록과 정확히 일치하고, 각 hunk 가 새 에러 코드/서버측 행 추가에
  국한된다. 임포트·포맷팅·주석의 무관한 변경 없음.
- import 변경(`executions.service.ts`·`workflows.controller.ts` 의 `findMaskedResubmissions`
  추가, `toTriggerParameterErrorDetails` 추가)은 전부 실제로 그 파일 안에서 사용된다 — 미사용
  임포트 없음.
- 설정 파일(`.env`, CI, `package.json` 등) 변경 없음.

## 요약

브랜치 전체(3개 커밋)를 대상으로 스코프를 검토했다. 실제 기능 코드(`codebase/`)는 8개 파일·
427줄로 "마스킹 마커 재제출 서버측 거부"라는 단일 목적에 정확히 대응하며, 무관한 리팩토링·
포맷팅·주석·임포트·설정 변경은 발견되지 않았다. `executions.service.ts` 의 `errors`→`details`
배선 교정은 표면적으로는 "추가 수정"처럼 보이지만 새 기능이 두 호출부 모두에서 실제로
동작하기 위한 필수 선결 조건이며 커밋·spec 이 그 인과관계를 명시적으로 밝히고 있어 스코프
이탈로 보지 않는다. spec/plan 변경 7(+1)곳도 발의 문서(`spec-draft-inputoverride-marker-reject.md`)
의 `spec_impact` 목록과 정확히 일치한다. `review/consistency/**` 산출물(1477줄)이 diff 크기의
대부분을 차지하지만, 이는 이 저장소가 CLAUDE.md 로 의무화한 게이트 통과 기록이 두 planner
커밋에 자연스럽게 분산된 것이지 임의로 끼워 넣은 무관한 파일이 아니다.

## 위험도

NONE
