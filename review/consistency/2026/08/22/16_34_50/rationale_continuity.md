# Rationale 연속성 검토 — `plan/in-progress/eia-error-code-unify.md`

## 검토 범위·방법

- target(plan draft)과 번들된 관련 Rationale 발췌(`spec/1-data-model.md`, `1-manual-trigger.md`,
  `2-api-convention.md`, `3-error-handling.md`, `12-webhook.md`, `13-replay-rerun.md`,
  `14-external-interaction-api.md` 등)를 대조.
- 번들에 `spec/conventions/error-codes.md` 본문이 **누락**돼 있어(다른 파일은 "컨텍스트 예산 초과"로 절단
  표시됐으나 이 파일은 그 표시조차 없이 목록에서 빠짐) target 이 §2/§3/§4/§5/Rationale 을 정확히 인용하는지
  직접 저장소에서 원문을 읽어 대조했다.
- target 이 "실측했다"고 주장하는 grep 결과(`rerun-modal.tsx` `ERROR_CODE_TO_KEY`, frontend/위젯
  `INVALID_INPUT` 히트, backend 발행처)를 코드베이스에서 재실행해 검증.
- target 이 인용한 과거 결정(PR4b `LLM_CONFIG_*`→`MODEL_CONFIG_*`, `#566` `WORKSPACE_REQUIRED`→
  `WORKSPACE_ID_REQUIRED`)의 실제 커밋 로그를 `git log`로 대조.

## 발견사항

- **[WARNING] "§5 선례 3건도 같은 한계에서 같은 판단을 내렸다" — 실제 이력에 없는 근거를 정합 근거로 인용**
  - target 위치: "이것은 규약의 명시적 예외다 — 근거를 실측했다" 절, `> **남는 위험을 숨기지 않는다**` 콜아웃
    (target 본문 line 80-83 부근)
  - 과거 결정 출처: `spec/conventions/error-codes.md §5` Rename 이력 표 3행(`LLM_CONFIG_NOT_FOUND`,
    `LLM_CONFIG_INVALID`, `WORKSPACE_REQUIRED`) + 해당 커밋(`27f390700` PR4b, `47282085b` #566)
  - 상세: target 은 "§5 의 선례 3건도 같은 한계에서(=저장소 밖 서드파티 클라이언트가 값으로 분기했을
    가능성을 코드로는 배제할 수 없다는 한계) 같은 판단을 내렸다" 고 서술한다. 그러나 실제로
    `error-codes.md §5` 표의 비고 칸과 `27f390700`(PR4b) · `47282085b`(#566) 커밋 메시지 어디에도
    "외부 제3자가 값으로 분기했을 가능성을 배제할 수 없으나 그 잔여 위험을 수용한다" 는 서술이 없다.
    실제 근거는 전부 **"자사 코드 grep 으로 하드코딩 분기 없음을 확인"**(`client 하드코딩 분기 없음`,
    `client 코드 분기 0`) 이었지, "제3자가 분기했을 수도 있으나 감수한다" 는 명시적 잔여위험 인수가
    아니었다. 즉 target 은 자신의 새 판단(제3자 잔여위험을 명시적으로 인수)을 과거 3건에도 동일하게
    있었던 것처럼 소급 서술해 정합성 근거로 쓰고 있다 — 실제로는 target 이 과거보다 **더 엄격한 새
    기준**을 세우고 있는 것이며, 이는 나쁜 게 아니라 오히려 진전이지만, "선례가 이미 그렇게 판단했다"는
    인용은 이력과 어긋난다.
  - 제안: "§5 의 선례 3건도 같은 한계에서 같은 판단을 내렸다" 를 사실 진술이 아니라 **target 자신의
    추론/유추**로 톤을 낮춰 서술(예: "§5 선례는 '자사 코드 미분기'만 확인했고 제3자 잔여위험을 명시
    다루지 않았다 — 본 건은 그 잔여위험까지 명시적으로 적어 선례보다 한 단계 더 엄격하게 처리한다").
    `error-codes.md §5` 신설 행 비고에도 이 차이(제3자 잔여위험을 최초로 명시 인수한 사례)를 남기면
    후속 rename 판단에 실제로 재사용 가능한 선례가 된다.

- **[INFO] `POST /executions/:id/re-run` 을 "인증된 공개 API" 로 서술한 것이 EIA §R11 의 internal/external
  분리와 용어상 긴장**
  - target 위치: "남는 위험을 숨기지 않는다" 콜아웃
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` Rationale R11
    ("`/api/external/executions/*` … 기존 `/api/executions/*` (워크스페이스 JWT, **에디터·UI 전용**)")
  - 상세: R11 은 `/api/executions/*` (re-run 포함, `@ApiBearerAuth('access-token')` = 워크스페이스 JWT)를
    "에디터·UI 전용" 내부 API 로, EIA 의 진짜 공개 표면(`/api/external/executions/*`, 별도 토큰 family)과
    명시적으로 분리해 두었다. target 은 이 내부 API 를 "인증된 공개 API" 라 불러 EIA 의 공개 표면과
    같은 위험군처럼 서술한다. 실질적 위험 판단(워크스페이스 JWT 를 가진 임의 스크립트가 `error.code` 로
    분기할 수 있다는 것)은 유효하지만, R11 이 이미 그어 둔 internal/external 경계 용어를 재사용하면
    혼동을 줄 수 있다.
  - 제안: "인증된 공개 API" 를 "워크스페이스 JWT 만 있으면 공식 UI 밖에서도 호출 가능한 API"처럼 R11 의
    분류(내부 API, `access-token`)와 모순되지 않는 표현으로 다듬는다. 결정 자체를 바꿀 필요는 없다.

- **[INFO] 나머지 실측·인용은 저장소 상태와 일치 — 별도 조치 불요**
  - `3-error-handling.md:80` 의 "`RERUN_` prefix 를 붙이지 않는 것은 의도" 인용, §R17 "닫는 조건" 표의
    볼드 비대칭, `12-webhook.md`/`3-error-handling.md` 의 `[error-codes 규약 §4] 패턴` 참조가
    Code 노드 전용 표로만 착지한다는 지적, `rerun-modal.tsx` `ERROR_CODE_TO_KEY` 4종 한정 매핑,
    `INVALID_INPUT` grep 결과(frontend/위젯 코드 0건·가이드 mdx 2건, backend 발행 1곳+Swagger+테스트 1파일)
    — 전부 저장소 원문·`git grep` 실측과 정확히 일치했다. target 이 지어낸 이력은 없다.

## 요약

target 은 `spec/5-system/3-error-handling.md:80` 의 기존 Rationale("`RERUN_` prefix 를 붙이지 않는 것은
의도 — §2 rename-stability 상 유지")을 정면으로 인식하고, 그 결정이 실제로 무엇을 기각했는지("prefix
rename")와 무엇을 결정하지 않았는지("두 경로 통일 여부")를 구분한 뒤 함께 개정하겠다고 명시한다 — 결정
번복을 새 Rationale 없이 조용히 하는 패턴이 아니다. `error-codes.md §2`(rename=breaking)·§5(Retired
codes, 판단 기준="client 코드 분기 존재 여부")의 실제 조문과도 대조했을 때 target 의 실측(코드 소비처
grep)은 전부 정확했고, §5 로 흡수하는 구조적 선택도 §3(유지 예외) 대신 §5(교체)를 쓰는 기존 구분과
합치한다. 유일한 흠은 "§5 선례 3건도 같은 한계에서 같은 판단을 내렸다" 는 문장이 실제 커밋·표 비고에
없는 "제3자 잔여위험 인수" 를 과거 결정에 소급 부여해 정합성 근거를 부풀리는 것 — 결론(예외 승인)이
아니라 그 결론을 뒷받침하는 역사적 인용의 정확성 문제다. Rationale 연속성 관점에서 이 plan 은 과거
결정과 직접 충돌하는 지점을 스스로 찾아내 처리하는 모범 사례에 가깝고, CRITICAL 급 기각-대안 재도입이나
invariant 우회는 발견되지 않았다.

## 위험도

LOW
