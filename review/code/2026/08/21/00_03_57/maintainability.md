# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 발견사항

- **[WARNING]** 마스킹 재제출 거부 가드(`find + length 체크 + throw`)가 두 호출부에 문자 그대로 중복된다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:498-503`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts:316-322`
  - 상세: 두 파일 모두
    ```ts
    const masked = findMaskedResubmissions(parameters);
    if (masked.length > 0) {
      throw new TriggerParameterValidationException(masked);
    }
    ```
    를 그대로 반복한다. `reject-masked-resubmission.ts` 의 최상단 docstring 은 "왜 이 판정을
    `resolveTriggerParameters` 공유 함수 **안에** 넣지 않는가"(webhook/schedule 오염 방지)는
    상세히 근거를 대지만, `find→length 체크→throw` 세 줄 자체를 왜 별도 헬퍼로 한 번 더
    묶지 않았는지는 다루지 않는다. 호출부가 정확히 둘뿐이고 로직이 동일하므로 향후 세
    번째 호출부가 생기거나(예: 노드 단위 실행 `POST /nodes/:nodeId/execute`) 이 가드가
    적용 대상에서 누락되는 실수가 나기 쉽다 — 실제로 이 판정이 "Manual 실행 경로 한정"
    임을 코드가 아니라 사람이 매 호출부에서 기억해야 하는 구조다.
  - 제안: `reject-masked-resubmission.ts` 에 `rejectMaskedResubmission(parameters): void`
    (또는 `assertNotMaskedResubmission`) 를 추가해 find+throw 를 캡슐화하고, 두 호출부는
    `rejectMaskedResubmission(parameters);` 한 줄로 축약한다. `catch` 블록의 응답 포맷
    (`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)은 호출부마다 달라 그대로 두되,
    던지는 지점만 공유하면 됨.

- **[INFO]** `ExecutionsService.reRun` 이 이미 137줄(§421-557)로 길고 이번 변경이 그 안에
  책임을 하나 더 얹는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드
    (§421 시작, §557 종료), 신규 마스킹 검사 블록은 §498-503
  - 상세: `reRun` 은 이미 (1) 404/권한 체크, (2) dry-run pre-flight, (3) chain depth 체크,
    (4) 입력 해석(원본 재사용 vs `inputOverride` 검증), (5) 실행 트리거, (6) audit log 기록
    까지 6가지 책임을 한 메서드 안에서 순차 수행한다. 이번 PR 은 (4) 안에 마스킹 재제출
    검사를 추가로 끼워 넣어 그 블록의 책임을 더 늘린다. 이 구조 자체는 이 PR 이전부터
    있었고 신규 로직 자체는 4줄로 작지만, 계속 커지는 함수에 조건 분기가 누적되는
    패턴이라 다음 확장 때 가독성이 더 나빠질 수 있다.
  - 제안: 이번 PR 스코프에서 강제할 사안은 아님. 다음에 `reRun` 을 손댈 일이 생기면
    입력 해석 블록((4), §484-519)을 `resolveRerunInput(...)` 류의 private 헬퍼로 추출하는
    것을 고려.

- **[INFO]** 새 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 블록에 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:316-318`(신규,
    한국어) 바로 아래 `:325-327`(기존, 영어 — `// `details` so GlobalExceptionFilter
    surfaces the per-field breakdown ...`)
  - 상세: 신규 주석이 편집한 바로 그 `try/catch` 블록 안에 언어가 다른 주석이 섞여
    있다. 이 저장소 최근 커밋들은 서술형 근거 주석을 한국어로 쓰는 쪽으로 수렴하는
    추세라(직전 5개 커밋 메시지·본 diff 의 다른 신규 주석 전부 한국어), 이 파일만
    영어 주석이 남아 다음에 이 블록을 여는 사람이 어느 언어로 이어써야 할지 헷갈릴
    수 있다. 이번 diff 가 도입한 문제는 아니고(해당 영어 줄은 컨텍스트 라인, 미변경),
    강제할 사안도 아님.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일 검토.

## 요약

핵심 구현(`reject-masked-resubmission.ts`)은 작고(67줄), 책임이 하나이며(정확 일치·깊이
상한 두 경계를 명시적으로 문서화), 순환 복잡도가 낮고(중첩 2단 이내), 매직 넘버 없이
`MAX_REDACT_DEPTH` 상수를 재사용한다. `trigger-parameter.types.ts` 의 신규 열거값·매핑
추가도 기존 3항목과 동일한 형태·네이밍 컨벤션(`snake_case` reason ↔ `UPPER_SNAKE_CASE`
code)을 그대로 따르고, `coerce_failed` 를 재사용하지 않기로 한 결정에 근거를 doc comment
로 남겨 향후 오분기를 막았다. 테스트(`reject-masked-resubmission.spec.ts` 및 두 호출부
spec)는 경계값(깊이 상한 자리·상한+1·배열 분기)·정상 값 통과(부분 포함)·스택 안전성까지
캐너리 태그로 의도를 명시해 다루므로 가독성이 높다. 유일하게 지적할 만한 것은 두 호출부
(`executions.service.ts`/`workflows.controller.ts`)에 동일한 3줄 가드가 그대로 중복된
점으로, 헬퍼 함수로 한 번 더 캡슐화하면 세 번째 호출부가 생겼을 때 누락 위험을 줄일 수
있다. 그 외에는 기존 코드베이스 스타일(문서화 밀도·네이밍·주석 언어)과 잘 정합한다.

## 위험도

LOW
