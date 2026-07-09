# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 항목 제목과 본문 SoT 의 spec 섹션 범위가 불일치
  - 위치: `CHANGELOG.md` L9 (`## Unreleased — ... (4-nodes/7-trigger §4/§5.1)`) vs L13 (`SoT: spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1/§6`)
  - 상세: 항목 제목의 괄호 태그는 `§4/§5.1` 만 가리키지만, 본문 (c) 저장 검증 서술과 마지막 SoT 각주는 `§6`(에러 코드)까지 포함한다. 이 파일의 다른 항목들(예: 워크스페이스 슬러그 라우팅 항목, 캔버스 UX 항목)은 제목 태그와 본문 SoT 범위가 일치하는 관례를 따르는데, 이번 항목만 제목이 본문보다 좁다.
  - 제안: 제목 태그를 `(4-nodes/7-trigger §4/§5.1/§6)` 으로 맞추거나, 제목이 core-bug(§4/§5.1)만 대표하려는 의도라면 그 의도를 명시.

- **[WARNING]** "handler.validate (저장 시점)" 표현이 실제 구현(우회)과 불일치할 소지 — 후속 spec 정리 항목에 누락
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` 신규 주석(다이프 L541-548, "spec ... §6 places these structural checks at '저장 시점' (handler.validate)"), 대응 spec `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 표의 "처리 위치" 열("handler.validate (저장 시점)")
  - 상세: 실측 결과 이번에 추가된 저장 시점 게이트는 `NodeHandler.validate()`/`ManualTriggerHandler.validate()` 를 호출하지 않는다 — `WorkflowsService.validateManualTrigger()` 가 `validateTriggerParameterSchema()` 를 직접 호출해 `INVALID_TRIGGER_PARAMETERS` 봉투를 구성한다(이는 이전 라운드 ai-review W3 에서 "공식 에러봉투 보존을 위한 의도적 우회"로 수용됨, `review/code/2026/07/09/11_08_21/RESOLUTION.md` W3 참조). 그런데 코드 주석과 spec 표 둘 다 이 체크포인트를 문자 그대로 "handler.validate" 라고 부르므로, 향후 독자가 "저장 시점에 실제 노드 핸들러의 validate 메서드가 호출된다"고 오해할 수 있다. 이번 세션에서 만든 후속 spec 정리 plan(`plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`)의 5개 TODO 에는 이 "handler.validate 네이밍이 실제로는 우회된 병렬 구현임" 을 명확히 하는 항목이 없다.
  - 제안: `spec-update-manual-trigger-save-time-error-code.md` 에 "§6 '처리 위치' 열의 'handler.validate' 표현이 실제로는 `WorkflowsService.validateManualTrigger`→`validateTriggerParameterSchema` 직접 호출(핸들러 인터페이스 미경유)임을 각주로 명시" 항목을 추가하거나, 최소한 코드 주석에서 "spec 이 명명한 체크포인트 개념" 과 "실제 호출 경로(핸들러 우회)" 를 구분해 서술.

- **[INFO]** plan 테스트 체크리스트에 되돌려진(reverted) 기능을 가리키는 미체크 항목이 그대로 남음
  - 위치: `plan/in-progress/manual-trigger-default-param.md` "## 테스트" 섹션 4번째 불릿 — `- [ ] frontend: node-settings-panel config 편집 → store 커밋 + isDirty (해당 테스트 있으면 보강)`
  - 상세: 이 항목은 CRIT-1로 되돌려진 "즉시 store 커밋" 변경(스펙 위반으로 revert, `review/code/2026/07/09/11_08_21/RESOLUTION.md` CRIT-1 참조)에 대응하는 항목인데, 되돌림 이후에도 미체크 상태로 plan 에 남아 있다. plan 자체는 결정 이력을 보존하는 문서이므로 삭제가 필수는 아니지만, 이 상태로는 "아직 처리할 작업이 남아 있다"로 오독될 수 있다.
  - 제안: 해당 불릿에 "(CRIT-1 되돌림으로 해당 없음 — 로컬 state 로 복원됨)" 같은 각주를 덧붙여 최종 상태를 명확히 한다.

- **[INFO]** CHANGELOG 와 plan 문서가 같은 근본 원인 집합에 서로 다른 (a)/(b)/(c) 문자를 사용
  - 위치: `CHANGELOG.md` L13 (a=엔진 재진입, b=트리거 조회, c=저장 검증) vs `plan/in-progress/manual-trigger-default-param.md` "## 수정" 섹션 (a=프론트 영속·되돌림, b=조회 by type, c=엔진 재진입 input)
  - 상세: 동일 작업을 다루는 두 문서가 같은 알파벳 라벨을 다른 항목에 매핑해, 두 문서를 교차 참조하는 독자가 혼동할 수 있다(예: plan 의 "(c) 엔진 재진입"이 CHANGELOG 에서는 "(a)"로 재라벨링됨).
  - 제안: 필수 수정은 아니나, 향후 유사 작업에서는 plan 의 원인 라벨을 그대로 CHANGELOG 에 승계하거나 라벨 대신 짧은 태그(예: "[재진입]", "[조회]", "[저장검증]")를 쓰면 교차 참조가 쉬워진다.

## 참고 (양호한 문서화 — 발견사항 아님)

- `ExecutionEngineService.reentryWorkflowInput()` 신규 JSDoc(`execution-engine.service.ts` L1451-1470 부근)이 왜 durable `inputData` 를 재사용해야 하는지, AI multi-turn retry 경로가 왜 의도적으로 예외인지까지 정확하고 상세히 기술 — 검증 결과 spec 5-system/4-execution-engine.md "재진입 시 config expression 재평가" 절의 `$input.*` 미해소 서술과도 부합한다.
- `load-trigger-parameter-schema.ts` 독스트링이 `category` → `type` 조회 변경의 근거(`is-trigger.ts` 의 실제 폴백 로직)를 정확히 인용 — 코드 대조 결과 일치 확인됨.
- 신규 e2e 스펙 `manual-trigger-default-param.e2e-spec.ts` 상단에 spec 섹션·재현 시나리오 2가지를 설명하는 docstring 포함 — 좋은 관례.
- `retry-turn.service.ts` 의 교차 주석이 "의도적으로 다른 경로를 따르지 않음"을 명시해 향후 리뷰어가 동일 패턴 미적용을 버그로 오인할 가능성을 낮춤.
- CHANGELOG, plan(`manual-trigger-default-param.md`), 후속 plan(`spec-update-manual-trigger-save-time-error-code.md`), `RESOLUTION.md` 가 서로 정합적으로 이번 변경·잔여 스펙 격차(저장 시점 에러코드 문서화, restoreVersion 예외, 유저 가이드 stale Callout)를 추적 — 라이프사이클 규약을 잘 따름.
- i18n 신규 키(`errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`) 는 en/ko 동시 추가되어 있고, 프론트 정규식과 백엔드 정규식(`resolve-trigger-parameters.ts` L77)이 실제로 동일함을 확인함(주석의 "Mirror of the backend identifier rule" 주장이 정확).

## 요약

이번 변경은 버그의 근본 원인 3가지(엔진 재진입 input 소실, 트리거 조회 category→type, 저장 시점 파라미터 스키마 검증)에 대해 코드 주석·JSDoc·CHANGELOG·plan·후속 spec-update plan 이 모두 유기적으로 연결되어 있어 문서화 수준이 전반적으로 높다. 검증 결과 핵심 주석(엔진 재진입 이유, 트리거 조회 근거, 정규식 일치)은 모두 실제 코드와 정확히 부합했다. 발견된 문제는 전부 사소한 교차 문서 정합성 이슈다 — CHANGELOG 제목/본문 섹션 범위 불일치, "handler.validate" 표현이 실제 우회 구현을 정확히 반영하지 못할 소지(이미 계획된 후속 spec 정리 항목에서 다뤄지지 않음), 되돌려진 기능을 가리키는 plan 의 stale 체크박스. 모두 병합을 막을 사안은 아니며 후속 spec-update plan 작업 시 함께 정리하면 충분하다.

## 위험도

LOW
