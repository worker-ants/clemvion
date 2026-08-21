STATUS=success documentation review complete — 0 CRITICAL, 1 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, `boolean` 우회 수정 후)

## 검토 방법

이번 라운드(`00_39_27`)는 직전 라운드(`00_03_57`)가 낸 CRITICAL 1(`boolean` 타입 우회) +
WARNING 9 를 처리한 수정 커밋(`50f799efd`)까지 포함한 브랜치 전체(origin/main 대비)를
대상으로 한다. 프롬프트의 게이트 번호를 실제 소스(`Read`/`grep`)와 대조했고, 특히
직전 라운드 documentation 리뷰(`00_03_57/documentation.md`)가 낸 WARNING 2건 + INFO 1건이
이번 수정에서 실제로 해소됐는지, 그리고 같은 수정이 만든 새 표현이 다른 spec 문서와
모순되지 않는지를 중점적으로 확인했다.

## 전회 WARNING 처리 확인 (참고 — 재등재 아님)

- **§R17 "닫는 조건" 표 행 라벨** (`spec/5-system/14-external-interaction-api.md:1573`) —
  `서버 (재제출 API)` → `서버 (Manual 실행 경로)` + "재제출만이 아니라 fresh 입력도 대상"
  문구로 정정 완료. 표와 바로 아래 캐비엇이 이제 같은 그림을 그린다. **해소됨.**
- **CHANGELOG 항목 부재** — `CHANGELOG.md` 최상단에 `## Unreleased — 마커 재제출을 서버가
  거부한다 (가드를 UI 밖으로)` 항목이 추가됐고, 범위·검사 시점 버그·선존 버그 수정까지
  근거와 함께 서술한다. **해소됨.**

## 발견사항

- **[WARNING]** "재제출 경로 한정" 이라는 **정정 이전 프레이밍**이 sibling 문서 두 곳에 그대로 남아, 이번 수정이 다른 곳에서 명시적으로 바로잡은 범위 서술과 모순된다
  - 위치: `spec/5-system/3-error-handling.md:193` (`> **`MASKED_VALUE_RESUBMITTED` 는 재제출
    경로 한정이다** — webhook ingestion·schedule 은 대상이 아니다...`),
    `spec/5-system/12-webhook.md:312` (`...후자는 **재제출 경로 한정**이라 webhook 수신은
    대상이 아니다...`)
  - 상세: 이번 changeset 은 바로 이 시리즈 안에서 "재제출(resubmission)" 프레이밍이 부정확함을
    세 곳에서 명시적으로 정정한다 — (1) `spec/5-system/14-external-interaction-api.md:1573-1596`
    §R17 표 행 + 캐비엇("가드의 범위 — Manual 실행 경로 전체다 (재제출만이 아니다)... **판정
    기준은 '출처' 가 아니라 페이로드의 저작 주체다**"), (2) `CHANGELOG.md` 최상단 항목("범위는
    재제출이 아니라 Manual 실행 경로 전체다... **직접 입력한 마커도 거부된다**"), (3)
    `reject-masked-resubmission.ts` 함수 docstring("판정 기준은 '출처' 가 아니라 **페이로드의
    저작 주체**다"). `workflows.controller.spec.ts` 의 캐너리("[캐너리] parameterValues 에
    마스킹 마커가 실리면... 이 엔드포인트는 재제출 전용이 아니라 Manual 실행 전체의 진입점")도
    같은 사실을 실측으로 고정한다. 그런데 정확히 같은 계열의 두 sibling 문서
    (`3-error-handling.md` §1.7, `12-webhook.md` §5.2)는 여전히 "MASKED_VALUE_RESUBMITTED 는
    **재제출 경로 한정**"이라는 옛 프레이밍을 그대로 쓴다. 이 문구만 읽으면 "히스토리에서
    불러온 값을 그대로 다시 보낼 때만 거부되고, 사용자가 폼에 직접 `***` 를 타이핑하면
    통과한다"로 오독하기 쉽다 — 실제로는 반대다(직접 타이핑도 거부됨은 위 세 소스와
    `workflows.controller.spec.ts` 캐너리로 이미 확정됨). 두 문서 모두 웹훅/스케줄이 대상이
    아닌 **진짜 이유**("그쪽 body 는 외부 시스템이 저작하는 임의 페이로드")를 §R17 은 정확히
    서술하는데, 이 두 sibling 문서는 그 이유 대신 "재제출 한정"이라는, 이번 PR 이 스스로 폐기한
    프레이밍을 이유로 든다. 같은 파일(`spec/4-nodes/7-trigger/1-manual-trigger.md:170`)의
    reason 표 행은 "Manual 실행경로·Manual re-run **한정**"이라고 정확한 축(어느 호출부가
    쓰는가)으로 적어 대조된다 — 이번 changeset 안에서도 정정이 전파된 곳과 안 된 곳이 갈린다.
    이는 직전 라운드가 §R17 표 행에서 이미 지적·수정한 "정정의 출발점은 고쳤는데 미러 자리는
    빠졌다" 패턴이 이번엔 다른 두 미러 자리에서 재발한 것이다.
  - 제안: 두 위치의 "재제출 경로 한정" 문구를 §R17 이 쓰는 표현("webhook ingestion·schedule
    은 그쪽 body 가 외부 시스템이 저작하는 임의 페이로드라 대상이 아니다" 또는 최소
    "Manual 실행 경로(재제출·fresh 입력 모두) 한정")으로 교체해 세 문서가 같은 그림을
    그리게 한다.

- **[INFO]** `toTriggerParameterErrorDetails` 상단 JSDoc 이 `reason` 값 예시로 여전히 두
  개만 나열 — 유니온은 이미 4개
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:68`
    (`* The lowercase \`reason\` values (\`missing_required\`/\`coerce_failed\`) are internal
    classification strings;` — 이번 diff 의 변경 hunk 밖, 직접 `Read` 로 확인한 실제 줄 번호)
  - 상세: 이번 changeset 으로 `TriggerParameterValidationError['reason']` 유니온은
    `missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted` 네 값이
    됐지만, 이 함수의 JSDoc 예시는 여전히 처음 두 값만 든다(`invalid_schema` 는 이미 그 전부터
    빠져 있었다). 직전 라운드(`00_03_57/documentation.md`)가 같은 자리를 INFO·"필수 아님"으로
    이미 지적했고 이번 수정에서도 손대지 않았다 — 기능에 영향 없는 사소한 staleness라 이번에도
    비차단으로 재등재만 한다.
  - 제안: 필수 아님. 예시를 지우고 일반화하거나 네 값을 모두 나열.

- **[INFO]** 같은 `try/catch` 블록 안에 신규 한국어 근거 주석과 기존 영어 주석이 공존 (전회
  maintainability 리뷰가 이미 비차단으로 지적, 이번에도 그대로)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:314-316`(신규,
    한국어) 바로 아래 `:323-325`(기존, 영어 — `// \`details\` so GlobalExceptionFilter
    surfaces the per-field breakdown ...`)
  - 상세: 이번 diff 가 만든 문제는 아니고(영어 줄은 미변경 컨텍스트), 강제할 사안도 아니다.
    최근 커밋들이 근거 주석을 한국어로 쓰는 쪽으로 수렴하는 추세라 다음에 이 블록을 편집할
    기회가 있으면 통일을 고려할 만하다는 점만 참고로 남긴다.
  - 제안: 필수 아님.

## 잘 된 점 (참고)

- `reject-masked-resubmission.ts` 의 함수 상단 JSDoc 이 이번 수정으로 "왜 resolve 를
  감싸는가 — 검사 시점이 정확성을 가른다" 절을 추가해, 직전 CRITICAL 의 근본 원인(타입별
  resolve-후 우회 표)과 수정 근거를 표까지 곁들여 코드 옆에 남겼다 — 리뷰에서 실측한 증거가
  코드 문서로 승격된 좋은 사례.
- `reject-masked-resubmission.spec.ts` 의 신규 캐너리(`boolean`/`number`/JSON 문자열
  object)마다 "이게 왜 예전엔 뚫렸는가"를 JSDoc 으로 남겨(`00_03_57 CRITICAL·W1·W2` 인용)
  테스트 자체가 회귀 방지 문서 역할을 한다. 마스커↔판정기 왕복 통합 테스트(`[통합]`)도
  "왜 필요한가"(모델 vs 실제 산출물 괴리)를 먼저 설명한다.
  `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 의 신규 캐너리도 동일한
  근거-우선 서술을 따른다.
- spec 7개 파일(`14-external-interaction-api.md` §R17, `3-error-handling.md` §1.7,
  `13-replay-rerun.md` §8.1/§10.2, `1-manual-trigger.md` §6, `1-data-model.md`,
  `3-workflow-editor/3-execution.md`, `12-webhook.md` §5.2) 전부가 4번째 reason 코드
  등재·re-run 소비처 편입·서버 2층 방어 서술을 정합적으로 반영했고, 이는 두 차례의
  consistency-check(`19_34_37`·`19_48_56`)가 낸 WARNING(1-manual-trigger.md 누락·§8.1 표
  미갱신·프런트-only 서술)을 전부 처분한 결과다.
- 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) W5·W6 둘 다 실제
  종결 근거(구현 커밋·범위 정정 사유)를 남기고 체크박스를 닫아, "체크박스 ≠ 실제 상태"
  패턴을 피했다.

## 요약

이번 라운드에서 검토한 수정 커밋(`50f799efd`)은 전회 documentation 리뷰의 WARNING 2건
(§R17 표 행 프레이밍·CHANGELOG 부재)을 정확히 처분했고, 신규 핵심 유틸리티·테스트의 문서화
수준은 여전히 저장소 평균 이상이다("무엇을"이 아니라 "왜"를 근거·표·인용과 함께 남긴다).
다만 §R17 표 행에서 정정한 바로 그 프레이밍("재제출" → "Manual 실행 경로 전체")이 두
sibling 미러 문서(`3-error-handling.md §1.7`, `12-webhook.md §5.2`)에는 전파되지 않아,
같은 changeset 안에서 "표는 새 프레이밍, 각주는 옛 프레이밍"이라는 이미 한 번 지적·수정된
패턴이 다른 자리에서 재발했다 — 사용자가 직접 타이핑한 마커도 거부된다는 사실과 반대로
읽힐 수 있는 문구라 WARNING으로 등재한다. 나머지 두 건은 전회에도 INFO·비차단으로 남겨진
항목이 이번에도 손대지 않은 채 남은 것으로, 기능에 영향이 없다.

## 위험도

LOW
