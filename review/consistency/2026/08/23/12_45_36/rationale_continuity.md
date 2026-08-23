STATUS=success rationale_continuity 완료 — CRITICAL 0 / WARNING 0 / INFO 1
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `deprecated`-만-표기 대안이 인접 컨벤션에서 이미 기각된 전례를 인용하지 않음
  - target 위치: `spec/conventions/swagger.md` `## Rationale` → `### §3 DTO 길이는 왜 강제가 아닌가` 마지막 문단
    ("**`deprecated` 패턴은 아직 §1 로 일반화하지 않는다** … **사례가 하나뿐**이다. rule of
    three 를 채우기 전에 규칙으로 올리면 …") 및 `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`
    의 `input?: Record<string, unknown>` 데코레이터(`deprecated: true`) + `plan/in-progress/swagger-decisions.md`
    `## ② deprecated 표시`
  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md` `## Rationale` → `### backend
    label 필드 제거 — frontend i18n dict 단일 SoT` —
    > *"`label` 을 deprecated 로만 표기하고 점진 이주하는 안은 기각 — 한국어 hardcoded 잔존
    > 기간 동안 사용자 영향이 계속되고, 옛 label 과 신규 labelKey 가 동시 존재하면 frontend
    > 분기 추가가 필요해 drift 가 생긴다."*
  - 상세: 이번 PR 은 `ExecuteWorkflowDto.input` 을 리네임/제거하지 않고 `deprecated: true` 로만
    표시해 `parameterValues ?? input.parameters` 형태로 신·구 필드가 무기한 공존하게 두기로
    했다. 같은 저장소의 다른 컨벤션 문서(`cafe24-api-metadata.md`)는 구조적으로 유사한 상황
    (신·구 필드 동시 존재로 인한 drift·분기 우려)에서 **바로 그 "deprecated 로만 표기" 대안을
    명시적으로 기각**한 전례를 갖고 있다. 두 사례는 도메인이 다르다 — cafe24 쪽은 내부
    메타데이터 필드(소비처가 명확한 1st-party, wire 파괴 비용이 작음)라 "완전 제거"가
    실제로 가능한 대안이었던 반면, `ExecuteWorkflowDto.input` 은 공개 실행 API 의 wire 필드라
    리네임·제거가 계약 파괴다(target 문서가 이미 이 구분을 스스로 논증함). 따라서 이는
    **"기각된 대안의 재도입"(CRITICAL)에 해당하지 않으며**, target 의 결정 자체를 뒤집을
    필요도 없다. 다만 target 의 "`deprecated` 패턴은 아직 규칙으로 일반화하지 않는다 · 사례가
    하나뿐" 서술은 **이 저장소 안에 이미 한 번 검토·기각된 유사 패턴이 있었다는 사실을
    인지하지 못한 채 "최초 사례"로 취급**하고 있어, 다음에 세 번째 유사 사례가 나와 "rule of
    three" 를 채우는 시점에 cafe24 사례를 빠뜨리고 카운트할 위험이 있다.
  - 제안: `### §3 DTO 길이는 왜 강제가 아닌가` 또는 `execute-workflow.dto.ts` 의 docstring에
    한 문장 추가 — *"`cafe24-api-metadata.md` 의 `label` 필드는 같은 '`deprecated`-만 표기'
    대안을 기각하고 완전 제거를 택했으나, 그건 내부 메타데이터라 breaking 비용이 작았기
    때문이다. `ExecuteWorkflowDto.input` 은 공개 wire 필드라 그 대안(제거)이 애초에 없다."*
    수준의 한 줄이면 향후 "왜 여기선 deprecated 로 남기고 저기선 제거했나"라는 재조사를
    막는다.

### 요약
검토 대상 diff(`execute-workflow.dto.ts` 의 `input` `deprecated: true` 표시, `spec/conventions/swagger.md`
§3 DTO 길이 규칙의 "예외"→"지향/지시" 재정의, 관련 `plan/in-progress/swagger-decisions.md` ·
`spec-sync-external-interaction-api-gaps.md` 트래커 갱신)는 기존 spec `## Rationale` 에서 명시적으로
기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하지 않는다. 오히려 이전 두 라운드의
consistency-check(`11_59_11`)·code-review(`12_22_08`) 가 지적한 WARNING(①의 `execute-body-dto`
재확인 누락은 트래커에서 해소, ②의 `deprecated` 패턴 일반화 보류 판단 명시, ③의 "별개 판단이라
건드리지 않는다" 유보 문구 인용·해제 명시, "예외"→"지시" 프레이밍 자기모순 해소)가 모두 실제
문서 본문에 반영돼 있어 "defer 해제"·"결정 번복 시 새 Rationale 동반" 패턴을 충실히 따른다.
`spec/5-system/2-api-convention.md`·`3-error-handling.md` 등 target 영역의 기존 Rationale(비-페이징
`{data:{items}}` 유지, `conversationThread` null 미정규화, 413 코드 공존 등)과도 직접적 충돌이
없다. 유일한 보완 지점은 인접 컨벤션(`cafe24-api-metadata.md`)에 존재하는, 구조적으로 유사하나
도메인이 다른 "deprecated-만 표기" 기각 전례를 새 Rationale 이 인용하지 않는다는 점으로, 방향을
뒤집을 필요는 없는 INFO 수준의 완결성 보완이다.

### 위험도
LOW
