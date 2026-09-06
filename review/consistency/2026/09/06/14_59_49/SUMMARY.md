# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 모두 Critical 없음. 전문 확보 못 한 checker 없음(5/5 인라인 전문 authoritative 확보, 디스크에도 이미 기존 존재 확인).

## 전체 위험도
**MEDIUM** — Critical/차단 사유는 없으나, 신규 구현한 트리거 endpoint-path 충돌 코드가 저장소 전역 에러 코드 관례(2가지 축)에서 벗어난 표현을 도입했고 에러 카탈로그에도 미등재라 다음 소비자가 선례와 다른 자리를 찾아야 하는 잠재 충돌이 있음 (cross_spec MEDIUM, convention_compliance LOW가 견인).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드가 신규 키 `details.subCode`(저장소 전역 유일 용례)에 담김. 저장소가 이미 지키는 두 확립 관례 중 어느 쪽과도 다름 — ① 도메인 특화 409/403 충돌은 top-level `code` 값 자체를 특화 코드로 교체한다(`DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`·`ALREADY_A_MEMBER`·`KB_REEXTRACT_IN_PROGRESS`·`KB_REEMBED_IN_PROGRESS`·`CANNOT_ASSIGN_OWNER`·`WORKSPACE_TYPE_MISMATCH` 7개 선례), ② 도메인별 세부 사유는 `details[].code` 키를 쓴다(Manual/Webhook 트리거 파라미터 검증, placeholder 검증, `error-codes.md §4.2`). 구현 주석은 "top-level 새 필드는 GlobalExceptionFilter가 버린다"는 근거만 대는데 이는 ①(값 교체, 새 키 아님)과 무관한 논거다. `3-error-handling.md` §1 카탈로그에도 미등재, 자동 완결성 가드 없음. 현재 프런트 소비자는 없어 즉시 파손은 아님(잠재적) | `spec/2-navigation/2-trigger-list.md:94,164` (문서) / `codebase/backend/src/modules/triggers/triggers.service.ts:1602-1619` `rethrowEndpointPathConflict` (구현) | `spec/5-system/3-error-handling.md:87-90,193-230`(§1.1 표 + §1.7~1.9, 7선례) / `spec/conventions/error-codes.md:47-48`(§4.2, "코드의 의미로 분기") / `spec/5-system/2-api-convention.md §5.3` | 택1을 명시적으로 결정하고 양쪽 문서 동시 갱신: (A·권장) top-level `code`를 `TRIGGER_ENDPOINT_PATH_CONFLICT`로 교체 + `details:{field:'endpoint_path'}`만 남기고 `3-error-handling.md`에 `DUPLICATE_NODE_LABEL`과 같은 형식으로 등재, `2-trigger-list.md` 문구를 "409 `TRIGGER_ENDPOINT_PATH_CONFLICT`"로 정정. (B) 신규 패턴을 유지한다면 `details.subCode`→`details.code`로 최소 개명해 §4.2 관례에 정렬하고, `api-convention.md §5.3`에 "도메인 세부 코드는 `details.code`로 표현 가능"을 정식 등재 + `2-trigger-list.md` Rationale에 근거 기록 |
| 2 | convention_compliance | Chat Channel `botToken` 행이 한 문장 안에서 "응답에는 `hasBotToken: boolean`만 노출"과 "마스킹 placeholder ('•••• <last4>')"를 동시 서술 — 자기모순. boolean만 노출한다면 서버가 last4를 보낼 방법이 없음. §5.4.2 SoT(ref·plaintext 모두 응답 절대 미포함)와도, 실제 구현(rotate 입력 모달 placeholder는 i18n 형식 예시 `"123456789:ABCdef..."`일 뿐 last4 아님)과도 불일치. AuthConfig의 `***<last4>` 마스킹 규약을 성격이 다른 write-only 필드에 잘못 차용한 것으로 보임 | `spec/2-navigation/2-trigger-list.md:106` (Chat Channel │ botToken 행) | `spec/5-system/15-chat-channel.md §5.4.2` / `spec/conventions/swagger.md §1-5` (writeOnly 자동 제외) / 구현 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:469-471` + i18n dict | "마스킹 placeholder ('•••• <last4>')" 문구를 삭제하거나 "rotate 입력창 placeholder는 형식 예시(`123456789:ABCdef...`)이며 기존 값의 일부를 보여주지 않는다"로 정정. 방치 시 다음 구현자가 실제 last4 노출 필드를 신설해 secret-store.md §1.1을 위반할 소지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WorkflowVersionDetail.findOne()` 응답의 `creator` 투영 축소(보안 수정, 정당함)가 `5-version-history.md §7.2`에 미반영. target(`spec/2-navigation/`) 범위 밖, 참고용 | `spec/3-workflow-editor/5-version-history.md:96-101` | 다음에 해당 문서를 손댈 때 §7.2에 "creator: id/name/email 투영(전체 User 아님)" 한 줄 추가 |
| 2 | cross_spec, naming_collision | `WorkspaceMemberDto.joinedAt` 신규 필드가 `9-user-profile.md`에 미기술. 이전 라운드(14_26_32)가 이미 INFO로 기록·조치 불요 처분, 이번 라운드도 상태 변화 없음 | `spec/2-navigation/9-user-profile.md §4.1/§4.2` | 향후 UI 노출 시 §4.1 표에 "가입일" 열 추가. 지금은 조치 불요 |
| 3 | rationale_continuity | endpoint_path 충돌 구현의 비자명한 설계 판단(세부 코드를 `details`에 둔 이유, 인덱스명 기반 술어 좁힘)이 코드 주석/CHANGELOG에만 있고 spec Rationale에는 미반영 — 결정 번복은 아니므로 Critical/Warning 아님 | `codebase/backend/src/modules/triggers/triggers.service.ts`(`isEndpointPathUniqueViolation`, `rethrowEndpointPathConflict`) / `spec/2-navigation/2-trigger-list.md §3` | 후속 spec 정비 턴에서 §3 note 또는 신규 Rationale 항목(R-17)에 1~2문장 추가 |
| 4 | convention_compliance | `error.details`의 object(단일 도메인 예외)/array(ValidationPipe 다중 필드) 이중 형태가 `api-convention.md §5.3`에 명문화되지 않음 — 이번 PR이 만든 문제 아니고 선재 패턴 | `spec/5-system/2-api-convention.md §5.3` | "ValidationPipe발 다중 필드 오류는 배열, ad-hoc 도메인 예외는 단일 object"로 구분 기준 명문화 권장 |
| 5 | naming_collision | 백엔드 `workflow-versions.service.ts`의 `WorkflowVersionDetail`과 프론트엔드 `lib/api/workflows.ts`의 동명 `WorkflowVersionDetail`이 공유 타입 패키지 없이 독립 선언(optionality도 다름). 여러 라운드 전부터 알려졌고 JSDoc 상호 참조로 이미 처분됨, 이번 커밋도 그 처분 유지 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` vs `codebase/frontend/src/lib/api/workflows.ts:109` | 추가 조치 불요 — 다음에 둘 중 하나를 만질 때 JSDoc 교차 참조 생존 여부만 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `TRIGGER_ENDPOINT_PATH_CONFLICT`가 `details.subCode`라는 저장소 유일 신규 자리에 담겨 7개 선례(top-level `code` 교체 방식)와 어긋남 + 에러 카탈로그 미등재(WARNING). `2-trigger-list.md §3` 계약 자체는 이번 diff로 실현되어 직전 라운드 CRITICAL 해소됨 |
| rationale_continuity | NONE | scope 델타 0, 유일 교집합(`triggers.service.ts`)은 기존 spec 계약의 뒤늦은 구현이지 결정 번복 아님. 설계판단 미문서화는 INFO |
| convention_compliance | LOW | `details.subCode` 키 표현(WARNING, cross_spec과 동일 사안) + `botToken` "마스킹 placeholder" 자기모순 서술(WARNING) + `details` object/array 이중형태 미명문화(INFO) |
| plan_coherence | NONE | scope 델타 0, 교차 plan(`spec-draft-nullable-notation-followups.md`)은 이미 diff 내용을 완료 반영, 남은 후속항목은 전부 target 범위 밖 |
| naming_collision | NONE | 신규 식별자(가드/함수/타입/필드/상수) CRITICAL·WARNING 충돌 0건. 유일 동명 사례(`WorkflowVersionDetail`)는 기존 처분 유지(INFO) |

## 권장 조치사항

1. `TRIGGER_ENDPOINT_PATH_CONFLICT` 표현 방식을 (A) top-level `code` 교체 또는 (B) `details.code`로 개명 중 하나로 명시적으로 결정하고, `2-trigger-list.md` + `3-error-handling.md`(또는 `error-codes.md §4`) 양쪽을 함께 갱신한다. 지금 당장 소비자가 없어 차단 사유는 아니지만, 다음 PR이 이 자리를 그대로 복제하면 비표준 키가 저장소에 확산된다.
2. `2-trigger-list.md:106` botToken 행의 "마스킹 placeholder" 문구를 삭제하거나 실제 동작(형식 예시일 뿐 last4 아님)으로 정정해 §5.4.2 SoT·swagger.md writeOnly 규약과의 자기모순을 해소한다.
3. (선택, 낮은 우선순위) `5-version-history.md §7.2`에 creator 투영 축소 한 줄, `api-convention.md §5.3`에 details object/array 구분 기준을 다음 spec 정비 턴에 함께 반영한다.
