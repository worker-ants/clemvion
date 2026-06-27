# Cross-Spec 일관성 검토 결과

검토 대상: `spec/conventions/error-codes.md`
검토 기준: 데이터 모델 충돌 / API 계약 충돌 / 요구사항 ID 충돌 / 상태 전이 충돌 / 권한·RBAC 모델 충돌 / 계층 책임 충돌

---

## 발견사항

### 1. **[INFO]** `WORKSPACE_TYPE_MISMATCH` UPPER 변형이 spec 미등록

- **target 위치**: `error-codes.md §3` historical-artifact 레지스트리 — `workspace_type_mismatch` (lowercase) 행의 근거 설명 중 "직접 추가 경로(§1.9)가 발행하는 UPPER_SNAKE `WORKSPACE_TYPE_MISMATCH`와 별개 코드"라고 언급
- **충돌 대상**: `spec/data-flow/12-workspace.md` 전체, `spec/5-system/3-error-handling.md §1.3`
- **상세**: target §3 의 설명에 따르면 `workspaces.service.ts` 가 발행하는 `WORKSPACE_TYPE_MISMATCH` (UPPER) 코드가 존재한다. 실제로 `codebase/backend/src/modules/workspaces/workspaces.service.ts:673` 에서 해당 코드가 확인된다. 그러나 이 UPPER 변형은 어떤 spec 파일에도 정의·등재되어 있지 않다. `12-workspace.md` 에는 lowercase `workspace_type_mismatch` 만 등장하고, `3-error-handling.md §1.3` 유효성 검증 에러 표에도 없다. target §3 은 두 코드의 분리를 선언하지만 UPPER 변형의 SoT spec 이 없다.
- **제안**: `spec/data-flow/12-workspace.md §1.9` 또는 `spec/5-system/3-error-handling.md §1.3` 에 `WORKSPACE_TYPE_MISMATCH`(UPPER, `workspaces.service.ts` 발행, team 전용 경로 보호용) 를 등재하거나, target §3 에 "UPPER 변형의 SoT 위치" 링크를 명시한다.

---

### 2. **[INFO]** `already_a_member` lowercase / `ALREADY_A_MEMBER` UPPER 이중 정의 — spec 내 표기 혼용

- **target 위치**: `error-codes.md §3` — `already_a_member` (lowercase) 를 historical-artifact 로 등재. `workspace-invitations.service.ts` 발행, §1.2 초대 발급 경로 한정. 직접 추가 경로 §1.9 의 `ALREADY_A_MEMBER` (UPPER) 는 별개 코드라고 명시.
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.2` (시퀀스 다이어그램 line 58: `code=already_a_member`), `spec/data-flow/12-workspace.md §1.9` (line 170: `409 ALREADY_A_MEMBER`)
- **상세**: target 의 설명은 코드베이스 실제 구현과 일치한다 (`workspace-invitations.service.ts:91` = lowercase, `workspaces.service.ts:673` 의 `ALREADY_A_MEMBER` 는 코드베이스에서 직접 확인되지 않으나 spec §1.9 에 UPPER 표기로 명시). spec 내에서 두 표기가 명확히 다른 섹션·다른 모듈에 배치되어 있으므로 "모순"은 아니다. 단, target §3 의 근거 링크가 `12-workspace.md §1.2` 와 `§1.8` 만을 가리키고 `§1.9` 의 UPPER `ALREADY_A_MEMBER` 에 대한 별도 SoT 링크가 없어 조회자가 두 코드의 위상을 파악하기 어렵다.
- **제안**: target §3 의 해당 행 "근거" 칸에 `§1.9` 링크를 추가해 UPPER 변형 정의 위치를 명시. 단독 변경으로 충분하며 타 spec 수정 불필요.

---

### 3. **[INFO]** `invitation_already_accepted` 가 target §3 에 미등록

- **target 위치**: `error-codes.md §3` — `workspace_type_mismatch` · `already_a_member` · `invitation_already_pending` · `invitation_already_accepted` 4종을 동일 행에 등재
- **충돌 대상**: `spec/data-flow/12-workspace.md §1.8` (line 162–163: `409 invitation_already_accepted` 를 resend/revoke 양쪽에서 발행)
- **상세**: target §3 은 이 4종을 하나의 행으로 묶어 "초대 발급·재발송 API 한정" 으로 설명한다. `invitation_already_accepted` 는 resend·cancel(revoke) 양 endpoint 에서 발행되며, 이는 "발급·재발송 API" 보다 넓은 범위다. 프론트엔드가 이 코드로 분기하는지 여부에 따라 §3 등재 요건 충족 여부가 달라지나, `12-workspace.md` 에는 resend/revoke 엔드포인트가 별개 목적임이 명확히 기술되어 있다. 직접 모순은 아니나 "발급·재발송" 설명이 revoke 경로를 누락한 비완전성.
- **제안**: target §3 해당 행의 의미 설명에 "재발송·취소(revoke) API" 도 추가해 `spec/data-flow/12-workspace.md §1.8` 과 일치시킨다.

---

### 4. **[INFO]** `§3` `WORKER_HEARTBEAT_TIMEOUT` 행 참조 라인 넘버(`§1383`) 미확인

- **target 위치**: `error-codes.md §3` — `WORKER_HEARTBEAT_TIMEOUT` 행 근거에 `§1383` 표기
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.1`
- **상세**: target §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행에 `§7.1·§1383·§2.13` 처럼 `§1383` 이라는 비표준 섹션 번호가 등장한다. `4-execution-engine.md` 의 표준 섹션 목록에 `§1383` 은 없으며, 이는 내부 편집 아티팩트(라인 번호 또는 임시 참조)로 보인다. 기능 자체는 `§7.1` 과 `§2.13(Execution 데이터 모델)` 양쪽에서 일관되게 기술되어 있다.
- **제안**: `§1383` 을 제거하거나 올바른 섹션 앵커(`4-execution-engine.md §7.1` / `1-data-model.md §2.13`)로 교체한다. 내용 충돌은 없다.

---

### 5. **[INFO]** `§5` Rename 이력 — `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 매핑과 `3-error-handling.md §1.3` 의 설명 범위 차이

- **target 위치**: `error-codes.md §5` — `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (400), 비고: `resolveEmbedding` ws-default 부재도 `MODEL_CONFIG_NOT_FOUND(404)` 유지
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING`(400): "id 미지정 시 워크스페이스 default config 없음 — `resolveConfig` 의 ws default(chat/LLM) 경로 전용"
- **상세**: 두 spec 의 설명이 동일 코드에 대해 동일한 범위("chat/LLM `resolveConfig`" 전용)를 기술하므로 기능 충돌은 없다. 단, target §5 의 비고 설명("`resolveEmbedding` ws-default 부재도 `MODEL_CONFIG_NOT_FOUND`(404) 유지") 이 `3-error-handling.md §1.3` 의 `MODEL_CONFIG_NOT_FOUND` 항목 설명("id 지정 경로 + `resolveEmbedding` ws-default 부재")과 완전히 일치한다. 두 문서가 동일 내용을 중복 기술하는 INFO 수준 동기화.
- **제안**: 별도 수정 불필요. 두 문서는 각자의 목적(§5 = 이력 추적, `3-error-handling.md §1.3` = 현행 카탈로그)으로 동일 사실을 설명하며 모순 없음.

---

## 요약

`spec/conventions/error-codes.md` 는 에러 코드 명명 규율 SoT 로서 다른 spec 영역과의 참조 관계가 전반적으로 일관적이다. 발견된 항목은 모두 INFO 등급이며 기능적 모순은 없다. 가장 유의할 사항은 항목 1: target §3 에서 언급하는 `WORKSPACE_TYPE_MISMATCH`(UPPER, `workspaces.service.ts` 발행)가 구현 코드에는 존재하나 어떤 spec 에도 정식 등재되지 않아 추적성(traceability) 공백이 있다. 이 UPPER 변형을 `spec/data-flow/12-workspace.md §1.9` 또는 `spec/5-system/3-error-handling.md §1.3` 에 등재하거나, target §3 에 SoT 링크를 보충하면 전체 일관성이 완성된다.

## 위험도

LOW
