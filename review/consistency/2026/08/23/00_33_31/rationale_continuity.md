# Rationale 연속성 검토 결과

## 검토 범위 확인

- `--impl-done` 스코프 `spec/5-system/` 은 `origin/main` 대비 **본문 diff 0** (`git diff origin/main --stat -- spec/5-system/` 무출력). 이번 작업(`execute-body-dto`)은 `spec_impact: none` — spec 텍스트는 바뀌지 않았다.
- 실제 변경은 코드 3파일(`execute-workflow.dto.ts` 신설, `workflows.controller.ts` `@ApiBody` 추가, `workflows-execute-body.spec.ts` 캐너리) + `plan/complete/execute-body-openapi.md`(신설) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(항목 종결 1건 + 신규 이연 항목 2건 등재).
- 따라서 본 checker 의 1차 임무("target 문서가 기존 Rationale 에서 기각된 결정을 재도입하는가")는 대상 spec 텍스트 자체에는 적용할 신규 서술이 없다. 대신 코드/plan 변경이 `spec/5-system/*.md` 및 관련 spec(`manual-trigger.md`, `1-workflow-list.md` 등)의 기존 `## Rationale` 이 세운 원칙·invariant 를 우회하는지를 점검했다.

## 대조한 기존 Rationale 항목

1. `spec/4-nodes/7-trigger/1-manual-trigger.md` Rationale — "`masked_value_resubmitted` 검사 시점: raw 우선 + resolve 후 재검사". `resolveTriggerParametersRejectingMasked` 를 **한 번** 호출하는 현재 배선은 이 절차를 바꾸지 않는다. `ExecuteWorkflowDto` 는 `@Body()` 파라미터 타입이 아니라 `@ApiBody({ type })` 스키마 전용으로만 쓰여 런타임 파이프라인에 개입하지 않는다 — docstring 이 이를 명시하고, 코드(`workflows.controller.ts` diff)도 `@Body()` 인라인 타입을 그대로 유지함을 확인했다. **재도입/우회 없음.**
2. `spec/2-navigation/1-workflow-list.md` Rationale §2 "Import 의 permissive config 정책" — 노드 `config`(임의 스키마, 사용자 hand-edit 가능)는 soft, 구조적 admission-gate 필드(`settings.maxConcurrentExecutions` 등)는 hard-fail 이라는 원칙. `execute` body 의 `parameterValues`/`input`(Manual Trigger 파라미터 봉투)은 트리거 스키마에 종속된 임의 형태 데이터로 `config` 부류에 가깝고 admission-gate 성격이 아니므로, DTO 를 whitelist 검증에 태우지 않기로 한 이번 결정은 이 기존 원칙과 **정합**하며 반례가 아니다.
3. `spec/5-system/12-webhook.md` Rationale "inline auth path 폐지 — AuthConfig 단일 진입" — "복수 경로 공존이 vault 일관성을 깬다"는 원칙이 있으나, 이는 인증 자격증명 저장 경로에 국한된 결정이고 `parameterValues`/`input` 두 필드(레거시 봉투 병존)는 이미 기존에 존재하던 구조를 문서화한 것뿐이며 컨트롤러가 `parameterValues ?? input.parameters` 로 **단일 지점에서 합류**시킨다는 사실도 새 DTO docstring 이 명시한다 — "복수 진입점 분산" 패턴이 아니다.
4. `spec/5-system/13-replay-rerun.md` §8.1 — `INVALID_TRIGGER_PARAMETERS` 가 execute·save·re-run 세 경로 공용이라는 기술은 `resolveTriggerParameters` 계층의 의미 검증이며, 이번 변경(OpenAPI 문서화만)이 이 계층에 손대지 않았음을 diff 로 확인했다(코드 diff 는 순수 추가 — 기존 로직 삭제/변경 없음).
5. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 자체 — "여분 top-level 키를 400 으로 거부할 것인가"는 **과거에 결정된 적이 없는 질문**(트래커 문면이 "DTO 승격 또는 @ApiBody 부착 중 택1"만 열어 두고 있었음)이므로, 이번에 `@ApiBody` 를 택하며 검증 활성화를 별도 항목으로 이연한 것은 "결정의 번복"이 아니라 **최초 확정**이다. 새 Rationale(플랜 항목 + DTO docstring)도 함께 기록됐다 — "결정의 무근거 번복" 기준에 해당하지 않는다.
6. `CustomValidationPipe.toValidate()`(`codebase/backend/src/common/pipes/validation.pipe.ts`)를 직접 열어 `whitelist: true, forbidNonWhitelisted: true` 설정을 확인 — DTO docstring 의 기술적 주장("데코레이터 없이 타입만 바꾸면 모든 요청이 거부된다", "데코레이터를 달면 여분 키가 400")이 실제 구현과 일치함을 검증했다(과대 서술 없음).

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

- **[INFO]** 이연 항목의 최종 정착지 명시
  - target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 이연 항목("`execute` 본문의 여분 키를 400 으로 거부할 것인가")
  - 과거 결정 출처: 해당 없음(신규 이연 — 과거 결정을 뒤집는 항목 아님)
  - 상세: 이 항목이 향후 결정되면(여분 키 거부 채택 시) `spec/5-system/2-api-convention.md` 에는 아직 이 엔드포인트에 대한 본문 서술이 전혀 없다(webhook 수신만 문서화됨). 결정이 나면 이 spec 문서 본문 + Rationale 양쪽에 반영할 자리를 미리 정해 두면 다음 세션이 "어디에 적을지"로 재조사하는 비용을 줄인다.
  - 제안: 필수 조치 아님. 해당 트래커 항목 실행 시점에 `2-api-convention.md §11` 또는 신규 절 배치를 함께 결정하도록 메모 추가 고려.

## 요약

이번 변경은 `spec/5-system/` 문서 본문을 전혀 수정하지 않았고(diff 0), 코드·plan 변경도 기존에 확립된 Rationale 원칙(마커 재검사 2단계 절차, config-soft/structure-hard 구분, `INVALID_TRIGGER_PARAMETERS` 3경로 공용, AuthConfig 단일 진입과 무관한 스코프)을 우회하거나 재도입하지 않는다. 오히려 "DTO 를 `@Body()` 타입으로 올리면 계약이 좁아진다"는 실측을 근거로 새로운 결정을 내리고 그 결정을 plan 트래커와 코드 docstring 양쪽에 명시적 Rationale 로 남겨, "결정의 무근거 번복" 방지 원칙을 오히려 준수하는 사례로 평가된다. DTO 의 기술적 주장(`CustomValidationPipe` 동작)도 실제 코드와 대조해 정확함을 확인했다.

## 위험도
NONE
