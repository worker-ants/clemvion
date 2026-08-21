# Cross-Spec 일관성 검토 — `inputOverride` 서버측 마커 거부 (commit 3e96f4b44)

대상 diff: `spec/5-system/14-external-interaction-api.md` §R17 + `spec/5-system/3-error-handling.md` §1.3/§1.7 +
`spec/5-system/13-replay-rerun.md` §8.1/§10.2 + `spec/5-system/12-webhook.md` §5.2 +
`spec/4-nodes/7-trigger/1-manual-trigger.md` §6 + `spec/1-data-model.md` §2.13 + `spec/3-workflow-editor/3-execution.md` §2.2.

(주: prompt 번들에서 `14-external-interaction-api.md` 는 컨텍스트 예산 초과로 절단되어 있었다 —
저장소의 실제 파일과 `git show 3e96f4b44`(변경 diff)을 직접 읽어 대체 검증했다.)

## 발견사항

- **[WARNING]** 서버측 거부의 "재제출 경로 한정" 범위 서술이 실제 엔드포인트 사용 범위와 어긋난다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "서버 (재제출 API)" 행 + 그 아래
    "가드의 범위 — 재제출 경로 한정이다" 캐비엇 (`POST /workflows/:id/execute` 를 재제출 경로 두 곳 중 하나로 지정)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §2.2 "JSON 에디터" 행(자유 텍스트 직접 편집,
    구현) · `spec/4-nodes/7-trigger/0-common.md:30`("Manual | Run 대화상자 폼 또는
    `POST /workflows/:id/execute { parameterValues }`") · `spec/data-flow/10-triggers.md:13`
    ("Manual: 사용자가 UI 의 Run 버튼으로 즉시 실행")
  - 상세: §R17 은 서버측 거부를 정당화하며 *"판정 기준은 값의 성질이 아니라 출처의 성질이다 —
    이 값이 마스킹된 읽기에서 되돌아온 것인가. 출처를 아는 호출부가 판정 지점이다"* 라고 명시하고,
    같은 이유로 webhook·schedule 은 대상에서 제외한다(*"그쪽 body 에 리터럴 `***` 가 담기는 게
    정상일 수 있고(사용자가 폼에 별표를 입력했을 수 있다)"*). 그런데 `POST /workflows/:id/execute`
    는 "Run with Input"(히스토리 리로드) 전용 엔드포인트가 아니라 **모든 Manual 실행의 단일
    진입점**이다 — 같은 다이얼로그의 "JSON 에디터"(자유 직접 편집, 3-execution.md §2.2)로 완전히
    새로 작성한 입력도 동일 엔드포인트로 제출된다. 이 엔드포인트는 호출 시점에 값이 "히스토리에서
    재적재된 것"인지 "사용자가 방금 새로 타이핑한 것"인지 구분할 수 있는 어떤 플래그도 받지 않는다
    (3-execution.md·0-common.md·data-flow/10-triggers.md 어디에도 그런 파라미터 없음). 즉
    webhook/schedule 을 제외한 바로 그 논거("리터럴 값이 정상일 수 있다")가 Manual 의 자유
    JSON 편집 경로에도 동일하게 적용되는데, 이 경로만 예외 없이 거부 대상에 포함됐다. 사용자가
    (드물지만) 필드 값으로 정확히 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 를 의도적으로 입력하면
    —히스토리 리로드와 무관하게— `400 MASKED_VALUE_RESUBMITTED` 로 거부되며, 이는 §R17 이 스스로
    세운 "출처 판정" 원칙의 위반이다. 3-execution.md §2.2 는 "히스토리 로드" 행에만 서버 2층 거부를
    언급했고, "JSON 에디터" 행은 갱신되지 않아 이 확장된 범위가 문서화되지 않았다.
  - 제안: 다음 중 하나로 target 을 정정. (a) 서버 거부를 진짜 재제출 신호(예: 프런트가
    "히스토리에서 로드됨" 플래그를 함께 보내고 서버는 그 필드가 realoded 인 경우에만 검사)로
    좁히거나, (b) 범위를 있는 그대로("Manual 실행 경로 전체, fresh 입력 포함")로 정정하고
    3-execution.md "JSON 에디터" 행에 이 제약(리터럴 마커 문자열 입력 불가)을 명시.
    (b) 를 택하면 §R17 의 "출처의 성질" 논거 문장도 Manual 쪽엔 적용되지 않음을 인정하는 방향으로
    수정 필요.

- **[INFO]** `masked_value_resubmitted` 내부 분류 문자열이 자매 문서 셋 중 하나에서만 누락
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 "응답 봉투" 단락
    (`> **응답 봉투**: ...` 첫 문장의 "내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`)")
  - 충돌 대상: 같은 커밋에서 나란히 수정된 `spec/5-system/3-error-handling.md` §1.7
    ("내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`)")
    및 `spec/5-system/12-webhook.md` §5.2 (동일 패턴, `masked_value_resubmitted` 포함)
  - 상세: 세 문서 모두 "`toTriggerParameterErrorDetails` 가 내부 분류 문자열을 public field code 로
    정규화한다"는 동일한 문장 패턴을 공유한다. 이번 커밋에서 필드 코드 쪽 목록
    (`MISSING_REQUIRED_FIELD`/.../`MASKED_VALUE_RESUBMITTED`)은 세 문서 모두 갱신됐지만, 그 **입력측**
    "내부 분류 문자열" 목록은 error-handling.md·webhook.md 두 곳만 `masked_value_resubmitted` 를
    추가했고 manual-trigger.md 는 누락됐다 — 바로 위 §6 표에 `masked_value_resubmitted` reason 을
    새로 등재한 바로 그 문서인데도 그렇다. 기능적으로 오류를 유발하진 않으나(내부 문자열
    나열은 설명용 요약이지 코드 계약이 아님), 세 자매 문서 중 하나만 갱신을 놓친 전형적인
    "자매 표면 미동기화" 패턴.
  - 제안: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 해당 문장의 내부 분류 문자열 목록에
    `masked_value_resubmitted` 를 추가해 error-handling.md·webhook.md 와 동기화.

## 요약

target 커밋은 `MASKED_VALUE_RESUBMITTED` 라는 새 에러 코드/`details[]` 항목을 도입해 재제출
경로(re-run `inputOverride`, Manual `POST /workflows/:id/execute`)의 마스킹 마커 리터럴 재제출을
서버측에서 2차 방어하며, data-model·error-handling·webhook·replay-rerun·manual-trigger·에디터 실행
문서 7곳을 정합적으로 갱신했다 — 에러 코드 카탈로그·`details[].code` 정규화 배선·마커 리터럴
목록(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)·§R17 참조 링크는 전 문서에서 서로 일치한다("errors"
키 잔재나 카탈로그 개수 불일치 없음). 다만 두 가지 흠이 있다: (1) §R17 이 명시한 "출처 판정"
설계 원칙이 `POST /workflows/:id/execute` 에는 실제로 적용되지 않는다 — 이 엔드포인트는 재제출
전용이 아니라 Manual 실행 전체(자유 JSON 직접 편집 포함)의 단일 진입점이라, webhook/schedule 을
제외한 것과 동일한 논거로 예외 처리돼야 할 케이스(사용자가 리터럴 마커 문자열을 새로 타이핑)가
빠짐없이 거부 대상에 걸린다 — target 문서 자신의 두 부분(§R17 vs 3-execution.md §2.2 "JSON
에디터")이 서로 다른 그림을 그리는 셈이라 WARNING 으로 등재했다. (2) manual-trigger.md 의 응답
봉투 서술에서 내부 분류 문자열 목록이 자매 문서 두 곳과 달리 `masked_value_resubmitted` 를 놓쳤다
(INFO). 나머지 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 관점에서는 발견된 충돌이
없다.

## 위험도

MEDIUM
