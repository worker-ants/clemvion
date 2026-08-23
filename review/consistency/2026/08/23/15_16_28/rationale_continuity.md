# Rationale 연속성 검토 — masking-gate-consolidation

## 검토 대상 요약

실제 diff(`origin/main...HEAD`)의 실질 변경은 spec/5-system/ 문서 자체가 아니라:
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — 신규 헬퍼 `redactStoredFieldsForResponse` · `redactNodeExecutionRow` 추가
- `codebase/backend/src/modules/executions/executions.service.ts` / `background-runs.service.ts` — 4개 호출부를 두 헬퍼로 교체(동작 무변경)
- `spec/conventions/egress-masking.md §3` — "알려진 stale 트리거" 예고를 실측으로 반증해 취소선 + 정정 각주로 수정
- `plan/complete/masking-gate-consolidation.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 트래커 갱신

target 스코프(`spec/5-system/`)로 지정된 문서들 본문은 이번 PR 에서 **변경되지 않았다**(diff 확인). 따라서 검토는 (a) 이 코드 리팩터가 `spec/5-system/14-external-interaction-api.md §R17`·`egress-masking.md`(관련 convention)에 이미 박혀 있는 Rationale/invariant 를 위반하는지, (b) `egress-masking.md` 자체의 문서 편집이 그 문서의 `## Rationale` 과 정합한지를 중심으로 수행했다.

## 발견사항

### [INFO] 신규 `redactNodeExecutionRow` 의 generic 사용이 인접 "제네릭을 쓰지 않는다" 원칙과 병치되어 오독 소지

- target 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` — `redactNodeExecutionRow<T extends {...}>(row: T): T` (신설, 옛 `executions.service.ts` 인라인 로직을 이관)
- 과거 결정 출처: 같은 파일 바로 위 `maskIfPresent` 의 JSDoc(구 `executions.service.ts` 주석을 그대로 이관) — *"**제네릭을 쓰지 않는다** — `<T>` 로 두면 TS 가 `T` 를 값이 아니라 `mask` 의 파라미터 타입에서 추론해 반환 타입에 `undefined` 가 섞이고 … 두 컬럼이 모두 같은 구체 타입이라 제네릭의 이득도 없다."
- 상세: `maskIfPresent` 는 "제네릭을 쓰지 않는다"는 명시적 원칙을 지키는데(비-제네릭 시그니처 그대로 이관, 확인함), 같은 파일에서 6줄 아래 `redactNodeExecutionRow` 는 `<T extends {...}>` 제네릭을 쓴다. 실질적으로는 문제가 없다 — 이 제네릭은 `mask` 콜백의 파라미터 타입에서 추론되는 것이 아니라 `row: T` 인자 자체에서 추론되며, 엔티티의 부가 필드(`id`·`nodeId`·`status` 등)를 보존하기 위해 identity-preserving 패턴으로 반드시 필요하다(옛 `maskIfPresent` 오용 사례와는 다른 종류의 제네릭). `tsc --noEmit` 신규 오류 0(플랜 기록)으로 실제 회귀도 없다. 다만 "제네릭을 쓰지 않는다"는 원칙을 처음 읽는 사람이 바로 아래 함수의 제네릭과 충돌한다고 오독할 여지가 있다 — 두 제네릭 사용이 다른 실패 모드를 겨냥한다는 구분이 문서화돼 있지 않다.
- 제안: `redactNodeExecutionRow` 독스트링에 한 줄("이 제네릭은 `mask` 파라미터가 아니라 `row` 인자 자체에서 추론되므로 위 `maskIfPresent` 의 회피 사유와 다른 경로다")을 추가하면 다음 사람이 재조사 없이 안전성을 확인할 수 있다. 차단 사유는 아니다.

### [정합 확인 — 위반 없음] "합치지 않고 나란히 둔다" 설계가 신규/구 Rationale 양쪽과 일치

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 항목은 원래 **단일** 헬퍼(`redactExecutionFields(row)`)를 제안했으나(구 텍스트), 이번 PR 은 그 제안을 **명시적으로 기각**하고 두 헬퍼(`redactStoredFieldsForResponse` / `redactNodeExecutionRow`)로 구현했다. 트래커 diff 에 "등재 시 제안한 `redactExecutionFields(row)` 단일 헬퍼는 그 이유로 기각"이라는 새 Rationale 이 함께 기록됐다 — 이는 "결정의 무근거 번복"이 아니라 **번복 + 근거 기재**의 정상 사례다.
- `spec/5-system/14-external-interaction-api.md §R17` 이 정본으로 못박은 "표면 6개 · 컬럼 2개(+2026-08-20 `inputData` 추가)" 목록(1 findById · 2 getChain · 3 stop · 4 toExecutionDto · 5 nodeExecutions[] · 6 BackgroundRunsService.toNodeExecutionDto)과, `executions.service.ts` 의 새 JSDoc 표가 번호·범위 모두 정확히 일치함을 실측 확인(코드 grep). 스코프 확장(새 표면 추가)도 축소(표면 누락)도 없다.
- `spec/conventions/egress-masking.md` §1 좌표계 표(마스커 좌표계: `MAX_MASK_DEPTH`/`MAX_SANITIZE_DEPTH`/`stripExternalOnlyFields` 상한 3계열)는 이번 PR 이 건드리지 않는다 — 신규 헬퍼는 기존 `redactStoredDataForResponse`/`redactStoredErrorForResponse`(이미 `deepRedactSecrets` 경유)를 그대로 감쌀 뿐 상한·연산자·마커를 바꾸지 않는다. 따라서 그 문서의 `## Rationale` "기각한 대안" 항목 — *"세 상한을 하나로 합쳐 좌표계를 없앤다 — 이미 기각된 결정"* — 을 재도입하지 않는다. 두 좌표계(마스커 vs 호출부)가 다른 층이라는 PR 자신의 판단도 실측(호출 체인 추적)과 일치한다.
- `egress-masking.md §3` 의 취소선 처리("알려진 stale 트리거" 예고 철회)는 삭제가 아니라 **취소선 + 반증 근거 각주**로 남겼다 — 이 저장소가 결정 번복 시 요구하는 "왜 틀렸는지 남긴다" 관행과 일치한다.

### [INFO — 프로세스, 이미 자체 처리됨] developer 턴의 `spec/conventions/egress-masking.md` 직접 편집

- target 위치: `spec/conventions/egress-masking.md §3` (diff)
- 근거: `CLAUDE.md` 권한표 — developer 는 `spec/` read-only, "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임"
- 상세: 본 편집은 spec 문서 자체의 `## Rationale` 을 위반한 것은 아니지만(내용은 사실 정정으로 5개 consistency checker + 9개 code reviewer 전원이 타당 판정), 개발자 역할 경계라는 저장소의 합의 원칙과는 형식적으로 어긋난다. 이미 이 PR 자체가 이를 자각해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 planner 판단 항목으로 등재했고(되돌리지 않고 경계 판단을 상위로 이관), 되돌릴 경우 오히려 "지금은 거짓인 지시문"이 규약 문서에 남는 부작용이 있다는 점도 트래커에 기록돼 있다. 추가 조치 불요 — 이미 적절히 처리된 상태의 재확인.

## 요약

이번 PR 은 4곳에 흩어져 있던 마스킹 호출을 헬퍼 2개로 통합하는 순수 리팩터로, `spec/5-system/14-external-interaction-api.md §R17` 이 정본으로 못박은 "6개 읽기 표면 · 컬럼 목록"을 그대로 보존하며(번호·범위 일치 실측 확인), `spec/conventions/egress-masking.md` 의 `## Rationale` 이 이미 기각한 "세 마스킹 상한을 하나로 합친다"는 대안을 재도입하지 않는다("나란히 둔다" 설계 원칙 유지). 트래커에 원래 제안됐던 "단일 헬퍼" 안은 이번 PR 이 명시적으로 기각하며 새 근거를 함께 기록했고, `egress-masking.md §3` 의 잘못된 예고 문구도 취소선+정정 각주로 반증 근거를 남기며 수정해 — 이 저장소가 요구하는 "번복에는 근거를 동반한다" 관행을 충실히 따른다. 발견된 사항은 신규 generic 사용에 대한 문서 명확화 제안(INFO) 및 이미 트래커로 상향된 developer/spec 경계 이슈(INFO, 조치 불요)뿐이며, Rationale 연속성을 깨는 CRITICAL/WARNING 급 발견은 없다.

## 위험도

LOW
