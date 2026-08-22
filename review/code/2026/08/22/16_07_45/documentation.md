# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[INFO]** egress 마스킹 규약(마커 3종·깊이 상한 SoT·소비처별 경계 연산자)이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 흩어져 있는 기존 갭
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:825` (`- [ ] **egress 마스킹 규약이 정식 spec/conventions/** 문서 없이...**`)
  - 상세: 이번 PR 이 새로 만든 문제가 아니라 `--impl-prep` consistency 라운드(`15_35_56`)가 낸 WARNING을 그대로 트래커에 등재만 한 것이다. `spec/conventions/egress-masking.md`(가칭) 신설 여부는 developer 권한 밖(project-planner 판단)이라 이 PR 에서는 정당하게 보류됐다 — 등재 방식(별도 planner 턴 필요 명시, `spec-impl-evidence` 패턴 언급)도 적절하다.
  - 제안: 조치 불필요. 다음 planner 턴에서 신설 여부만 확인하면 된다.

- **[INFO]** 신규 테스트 설명 블록이 헤더(`##`/`###`)·표를 포함한 긴 Markdown 을 TS `/** */` 블록 코멘트 안에 담고 있어, 일반 JSDoc/TSDoc 툴링(IDE hover 등)에서는 표가 정상 렌더링되지 않음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:240-273` (`describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` 앞의 블록 코멘트)
  - 상세: 다만 이 파일 자체에 이미 같은 스타일(파일 상단 `MASKED_MARKERS` 불변성 설명, 전체 파일 컨텍스트 4-27행)이 존재하고, 프로덕션 코드(`sanitize-error-message.ts`)의 여러 JSDoc 도 동일한 한국어 산문+표 스타일을 쓴다. 저장소 관례와 일치하므로 결함이 아니라 참고용 관찰.
  - 제안: 조치 불필요.

## 검증 상세 (참고)

문서화 관점에서 특히 정확성이 중요한 다음 항목들을 소스와 대조 검증했고, 전부 일치했다:

- 신규 테스트 블록 코멘트의 "깊이 상한 셋" 표(`MAX_REDACT_DEPTH`=`>=`/`VALUE_MASK_MARKER`, `MAX_SANITIZE_DEPTH`=`>`/`DEPTH_MASK_MARKER`, `stripExternalOnlyFields`=`>`/서브트리 보존) — `sanitize-error-message.ts:128,270`, `websocket.service.ts:80,119`, `strip-external-only-fields.ts:106` 실측과 정확히 일치.
- "`deepRedactCore` 는 ①문자열 ②원시값 ③깊이 순으로 본다" — 실제 함수(`sanitize-error-message.ts:259-272`) 분기 순서와 일치.
- "`redactSecretsInJsonString` 은 `depth + 1` 로 다시 태운다" — `sanitize-error-message.ts:333` 코드와 일치.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 편집분의 정밀 라인 인용(`1-manual-trigger.md:180-181`, `13-replay-rerun.md:246`, `3-error-handling.md:80`, `executions.service.ts:506`, `workflows.controller.ts:324`, `executions.controller.ts:274`)이 전부 실제 소스 라인과 정확히 일치.
- "`isMaskedMarker` non-string 5종(`number`/`null`/`undefined`/`object`/`array`) 캐너리가 `masked-markers/src/__tests__/index.spec.ts` 에 이미 존재해 이 항목을 부수적으로 닫았다" — 실제 `it.each` 목록과 정확히 일치.
- "`grep 'EIA-AU-09'` 는 0건, 문서엔 `EIA-AU-08/09` 로 결합 표기" — `spec/data-flow/15-external-interaction.md:119` 실측과 일치.
- `redact-stored-error.spec.ts` 에 깊이 경계 테스트를 중복 추가하지 않았음을 확인(consistency INFO #2 준수).

이처럼 이번 PR 은 코드 자체 변경 없이 (1) 백엔드 테스트 파일 하나에 깊이 경계 회귀 스위트 추가, (2) plan 문서 갱신(체크박스 정정 + 신규 결정 노트 + 재판정 표), (3) 이미 병합된 선행 PR 산출물의 워크트리 반영으로 구성된다. README/API 문서/CHANGELOG 갱신이 필요한 신규 기능·엔드포인트·환경변수는 없다.

## 요약

이번 diff 는 프로덕션 코드 변경이 없는 순수 테스트+plan 문서 변경이며, 문서화 품질이 이례적으로 높다. 신규 테스트에 붙은 한국어 설명 블록은 세 개의 서로 다른 깊이 상한 불변식(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields.maxDepth`)을 정확히 구분해 캐너리로 고정했고, 표에 적힌 비교 연산자·마커 반환값이 실제 구현과 전부 일치했다(소스 대조 검증 완료). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 신규 결정 노트(`INVALID_TRIGGER_PARAMETERS` 통일 결정)도 인용한 파일·라인 번호가 전부 실측과 정확히 일치해 신뢰도가 높다. 발견된 두 항목은 모두 INFO 수준으로, 하나는 이미 정당하게 planner 턴으로 이연된 기존 갭이고 다른 하나는 저장소 기존 스타일과 일치하는 관찰일 뿐 조치가 필요하지 않다. README/API 문서/CHANGELOG/설정 문서 갱신이 필요한 항목은 없다.

## 위험도
NONE
