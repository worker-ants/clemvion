# 문서화(Documentation) 리뷰 — 마커 재제출 서버측 거부 (EIA §R17)

## 발견사항

- **[INFO]** `ExecutionsService.reRun` 상단 JSDoc 이 신규 마스킹 재제출 거부 동작을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:415` (`/**` 시작, 메서드 정의는 `:420`)
  - 상세: 메서드 요약 주석은 spec §8.1 참조 + 권한 검증(워크스페이스 격리·owner/admin) 두 가지만
    적고 있다. 이번 PR 이 `inputOverride` 검증 안에 추가한 `MASKED_VALUE_RESUBMITTED` 거부는
    본문 내부(`:496-498`)의 인라인 주석에만 설명돼 있고, 메서드 계약을 한눈에 보여줘야 할
    상단 요약에는 반영되지 않았다. 이 메서드를 부르는 쪽(컨트롤러)이나 다음에 이 서비스를
    확장하는 개발자가 요약만 보고는 이 400 사유를 놓칠 수 있다.
  - 제안: 요약 줄에 `(EIA §R17 마스킹 재제출 거부 포함)` 한 구절만 추가해도 상단에서 바로
    발견 가능해진다. 강제 사항은 아님 — 인라인 문서가 이미 상세하다.

- **[INFO]** `toTriggerParameterErrorDetails` 상단 JSDoc 의 예시 reason 목록이 신규 값을 포함하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:65-73`
    (함수 정의는 `:74`)
  - 상세: 함수 요약이 "The lowercase `reason` values (`missing_required`/`coerce_failed`) are
    internal classification strings" 라고 두 값만 예시로 든다. 이 함수는 실제로 4개 reason
    (`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`)을 전부
    처리하므로 목록 자체는 코드(`REASON_TO_DETAIL`)가 SoT 라 틀린 서술은 아니지만, 예시가
    최신 상태를 반영하지 않아 읽는 사람이 "이 함수가 신규 reason 도 다루는가"를 다시 코드로
    확인해야 한다. 참고로 같은 파일의 `REASON_TO_DETAIL` 맵 각 항목에는 이미 개별 doc
    comment(`masked_value_resubmitted` 포함)가 잘 붙어 있어 실질적 정보 손실은 없다.
  - 제안: 예시에 `masked_value_resubmitted` 를 추가하거나 "등" 표현으로 열거가 아님을
    명시. 강제 사항 아님.

## 요약

이번 diff 는 문서화 수준이 이례적으로 높다. 핵심 구현 `reject-masked-resubmission.ts` 는
"왜 필요한가 / 범위(Manual 실행 경로 한정, 판정 기준 = 저작 주체) / 왜 resolve 전후 2단계로
검사하는가(초판이 세 갈래로 뚫린 표를 그대로 재현) / 왜 raw 기준으로 대상 키를 잡는가 /
정확 일치·깊이 상한 두 경계"까지 함수마다 근거를 doc comment 로 남겨 코드만 읽어도 설계
결정을 전부 복원할 수 있다. `masked-reject-callers-guard.ts`·`production-build-devdep-guard.ts`
도 "정규식→AST 전환 이유", "타입 전용 import 를 왜 세지 않는가" 등 향후 재발할 만한 질문에
선제적으로 답한다. spec 쪽도 CHANGELOG·§R17·manual-trigger §6·webhook §5.2·replay-rerun §10.2·
error-handling §1.7·data-model 이 신규 `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`
값과 "Manual 실행 경로 전체(재제출뿐 아니라 fresh 입력도 대상)"라는 범위 정정을 모두
동기화했고, 검사 시점("전후 2단계")까지 Rationale 섹션에 명시적으로 박아 향후 회귀를
방지했다(§spec-update-masked-reject-framing.md 가 이 정정 이력을 별도로 추적). 기존 영어
docstring(`toTriggerParameterErrorDetails` 등)과 신규 한국어 docstring 이 같은 파일 안에
공존하지만 이는 이 저장소 전반의 기존 패턴이라 이번 diff 가 만든 문제는 아니다. 발견한
두 항목은 모두 이미 인라인·형제 doc comment 로 충분히 커버되는 완성도(discoverability)
수준의 사소한 보완 여지이며, README·API 문서·CHANGELOG·설정 문서 어느 축에도 누락이 없다.
새 환경변수·설정 옵션은 도입되지 않았고(프론트 변경 없음, 순수 백엔드 동작 변경), 신규
`tsconfig.build.json` exclude 항목도 그 자리에서 이유를 설명하는 인라인 주석을 달았다.

## 위험도

LOW
