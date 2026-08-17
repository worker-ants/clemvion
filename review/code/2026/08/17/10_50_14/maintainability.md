# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위에 대한 메모

`git diff origin/main...HEAD` 기준 실질 프로덕션/테스트 코드 변경은 12개 TS 파일
(`executions.service.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`,
`sanitize-error-message.ts`/`.spec.ts`, `redact-stored-error.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`, DTO 2개)에 집중돼 있고, 이미 5차례의
`/ai-review` 라운드(각 라운드 maintainability 포함, `23_08_19`→`23_50_03`→`00_23_57`→
`00_47_01`→`10_26_58`)를 거치며 CRITICAL·WARNING 이 전부 해소된 상태다. 이번 라운드가
보는 마지막 커밋(`09286d542`)은 **코드 로직 변경 없이** Swagger `description`/JSDoc/
CHANGELOG/유저가이드/plan 트래커 5곳에 "카브아웃은 `Execution` 레벨 한정" 캐비엇을
전파하고 `NodeExecutionSummaryDto.inputData` 필드 선언 하나를 추가한 문서-only 변경이다.
그 앞 커밋(`83436ed45`)이 실제 로직 변경(node-level `inputData` 마스킹으로 카브아웃 축소)
이었고, 그 diff 도 함께 검토했다.

나머지 대다수 파일(`review/code/**`, `review/consistency/**`, `plan/**`)은 과거 라운드
산출물·추적 문서로 실제 코드가 아니다. 이미 이전 라운드가 다루고 "조치 불요"로 명시
처분한 항목은 새 발견으로 재기재하지 않고 상태 변화 유무만 확인해 참고로만 남긴다.

## 발견사항

- **[INFO]** (기존 라운드에서 이미 확인·"조치 불요"로 두 차례 처분됨, 상태 변화 없음)
  마커-계층 설명 JSDoc 이 실제 심볼(`VALUE_MASK_MARKER`)에 귀속되지 않는다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95`-`122`
    (95~116 의 대형 설명 블록과 118 의 `export const VALUE_MASK_MARKER = '***';` 사이에
    117 의 개별 한 줄 JSDoc `/** 값-패턴 마스커가 남기는 마커. */` 이 끼어 있다)
  - 상세: `review/code/2026/08/17/00_23_57/maintainability.md`(INFO)·
    `documentation.md`(WARNING)가 지적했고, `00_47_01` RESOLUTION 이 "이 저장소의 수렴
    규율상 이번 라운드에서 고치지 않는다"(발견 성격이 이미 두 라운드 연속 문서 층,
    typedoc 미도입이라 실사용 영향 0, 주석 한 글자도 리뷰를 stale 하게 만드는 비용)로
    **의도적으로 이연**하며 트래커(`spec-sync-external-interaction-api-gaps.md`)에
    등재했다. 코드를 직접 열어 재확인한 결과 지금도 그 배치 그대로다.
  - 제안: 추가 조치 불요(기존 처분·트래커 등재 유지). 새로 등재하거나 등급을 올리지
    말 것 — 팀이 이미 명시적으로 "이 라운드에서 고치지 않는다"고 결정한 항목이다.

- **[INFO]** (기존 라운드에서 이미 확인·의도로 처분됨, 상태 변화 없음) 런타임 미참조
  상수를 `void` 로 앵커링.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` —
    `MASKED_INPUT_DATA_REASON` 선언과 바로 아래 `void MASKED_INPUT_DATA_REASON;`
  - 상세: 여러 파일(`background-run-response.dto.ts`, `execution-response.dto.ts`,
    `background-runs.service.ts`, 두 `.spec.ts`)이 `{@link}`/평문으로만 이름을 인용하는
    "문서 앵커"용 상수라 unused-var 경고를 피하려 `void` 로 살려뒀다. 이 저장소에 흔치
    않은 관용구라 향후 편집자가 죽은 코드로 오인해 삭제할 위험은 바로 위 주석
    (`// 이 상수는 JSDoc 앵커 전용이다 — 런타임 참조가 없어도 제거하지 않는다.`)이
    완화한다.
  - 제안: 추가 조치 불요(기존 처분 유지).

- **[INFO]** (기존 라운드에서 이미 확인·"조치 불요"로 처분됨) `MASKED_INPUT_DATA_REASON`
  상수명이 "왜 마스킹 안 하는가"(카브아웃 근거)를 담고 있는데 이름은 "왜 마스킹 하는가"
  처럼 읽힌다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`
    (`MASKED_INPUT_DATA_REASON` 선언부)
  - 상세: `10_26_58` maintainability 가 처음 지적했고 값(`'inputData 는 ... 마스킹 대상이
    아니다'`)과 이름이 어긋난다. 자매 파일 4곳(`background-run-response.dto.ts`,
    `execution-response.dto.ts` 2개소, `background-runs.service.ts`)이 그대로 이름을
    인용하므로 오독이 함께 번진다. 이번 라운드에서 이름은 변경되지 않았다.
  - 제안: 여전히 조치 불요(기능 영향 없음, 급하지 않음). 리네임한다면
    `INPUT_DATA_MASK_CARVEOUT_REASON` 류가 의도를 더 명확히 드러낸다.

- **[INFO]** `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수 본문이
  여전히 완전히 동일하다(의도적 미통합, 재확인).
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28`-`35`(error),
    `:66`-`71`(data)
  - 상세: 두 함수 모두 `if (x === null || x === undefined) return null; return
    deepRedactSecrets(x) as Record<string, unknown>;` 로 동일하다. `23_50_03`/`00_23_57`
    라운드가 이미 지적했고 "§R17 이 컬럼별 관문을 열거로 못박았으므로 강제 통합은 그
    계약을 흐린다"는 근거로 JSDoc·RESOLUTION.md 에 의도적 비통합이 기록돼 있다.
  - 제안: 조치 불요(기존 결정 재확인). 세 번째 컬럼이 다른 마스킹 규칙을 요구하게 될
    때 재검토.

## 이번 라운드에서 새로 관찰한 점 (긍정적)

- **캐너리 주석을 "개수·목록" → "방향별 표"로 재작성**해 세 번째 재발을 구조적으로
  막았다. `executions.service.spec.ts` 의 `inputData` 캐너리 JSDoc 이 두 차례
  (`00_23_57` W1: "네 표면"인데 다섯 나열, `10_26_58` W5: 두 캐너리를 반대 방향으로
  오분류) 같은 클래스의 실수를 냈는데, 이번 커밋(`09286d542`)이 "개수·목록으로 적으면
  또 갈린다"는 근거로 표 형태(`Execution.inputData` 는 원문 → ①②⑧⑧-b / 노드 레벨은
  마스킹 → ⑤⑥-b+background-runs)로 바꾸고 그 실패 이력까지 주석에 남겼다. 실수의 근본
  원인(서술 형태)을 짚어 재발 방지 장치를 코드에 남긴 좋은 사례다.
- `NodeExecutionSummaryDto.inputData` 신규 선언(`execution-response.dto.ts`)이 자매
  `BackgroundRunNodeExecutionDto`(`background-run-response.dto.ts`)와 JSDoc 구조·용어를
  대칭으로 유지한다 — "정책이 반대"(상위 `ExecutionDto.inputData` 는 비마스킹, 이쪽은
  마스킹)라는 까다로운 지점을 양쪽 JSDoc 이 서로를 가리키며 명시해 다음 편집자가 둘을
  혼동하지 않게 했다.

## 요약

이번 changeset 은 이미 5차례의 리뷰 라운드를 거치며 CRITICAL·WARNING 급 유지보수성
결함이 모두 해소된 상태이고, 이번 라운드의 실질 델타는 로직 변경 0(직전 라운드가 이미
`maskIfPresent`/`toResponseExecution` 표/`deepRedactCore`/마커 상수 공유 등으로 구조적
개선을 마쳤다)에 문서(Swagger/JSDoc/CHANGELOG/유저가이드/plan) 5곳 캐비엇 전파와 DTO
필드 선언 1건뿐이다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 양호하고, 자매
표면 누락이라는 이 저장소의 반복 결함 클래스를 SoT 표·공유 헬퍼·공유 마커 상수·
방향별 캐너리 표로 구조적으로 막으려는 설계가 일관되게 유지된다. 남은 지적은 전부
이전 라운드가 이미 평가하고 명시적으로(수렴 규율에 따라) 이연·수용한 INFO 4건이며,
이번 라운드에서 상태 변화나 새로운 CRITICAL/WARNING 급 결함은 발견하지 못했다.

## 위험도
LOW
