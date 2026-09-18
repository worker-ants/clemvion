# 신규 식별자 충돌 검토 — spec/2-navigation/ (impl-prep)

## 검토 범위

target(`spec/2-navigation/`, impl-prep)이 실제로 도입하는 신규 식별자는 target 문서 자체(트리거
목록·워크플로우 목록·스케줄 화면 spec)보다 이번 변경을 촉발한
`plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`(웹훅 `endpoint_path` 전역
유일화, `--spec` 3차 처분까지 BLOCK:NO 확정)에 있다. `2-trigger-list.md` 자체의 S5 변경분은 기존
문구(`(workspace_id, endpoint_path) UNIQUE` → `(endpoint_path) UNIQUE(전역)`)의 정확도 수정이라
새 식별자를 만들지 않는다. 따라서 이 draft 가 구현 단계(같은 PR, developer 턴)에서 실제로 신설하는
식별자 후보를 전수 점검했다.

## 발견사항

### 신설 식별자 후보 전수 대조 (충돌 없음 확인)

- **마이그레이션 버전 V131 / V132**
  - target 신규 식별자: `V131__trigger_endpoint_path_dedupe.sql`,
    `V132__trigger_endpoint_path_global_unique.sql`
  - 기존 사용처 대조: `codebase/backend/migrations/` 최신 파일은 `V130__model_config_workspace_kind_index.sql`
    (직전 커밋 `1cc089343`, `origin/main` 최신과 일치 확인). `find … -name "V131*" -o -name "V132*"` 0건,
    `plan/` 전체에서 `V131`/`V132` 를 언급하는 문서는 이 draft 하나뿐.
  - 상세: 번호 충돌 없음. 다만 draft 자신도 2차 처분 INFO 1 에서 "구현 착수 직전
    `check-migration-versions.py --base origin/main` 으로 확인" 을 체크리스트에 명시해 뒀다 — 이는
    이 세션의 실측(위 grep)과 별개로, **구현 착수 시점에 병렬 세션이 V131/V132 를 먼저 점유했을 수
    있다**는 표준 위험이라 이미 절차화되어 있다.
  - 등급: INFO (조치 불요 — 이미 draft 체크리스트에 재확인 절차가 있음).

- **인덱스명 `idx_trigger_endpoint_path`**
  - 기존 사용처 대조: `grep -rn "idx_trigger_endpoint_path" codebase/backend/migrations/ spec/` →
    0건(신설 전). 대체 대상인 `idx_trigger_workspace_endpoint` 는 `V002__indexes.sql:26` 에만 존재.
  - 상세: `idx_trigger_<column>` 명명 컨벤션(`idx_trigger_workflow_id`(V111),
    `idx_trigger_auth_config_id`(V126) 등)과 정확히 일치 — 컨벤션 위반 없음, 충돌 없음.
  - 등급: 해당 없음(문제 아님, 확인 완료).

- **상수/에러코드 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` / `TRIGGER_ENDPOINT_PATH_CONFLICT`**
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:224`
    (`const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'`),
    `triggers.controller.ts:102,139`, `triggers.service.spec.ts:3066`,
    `spec/5-system/2-api-convention.md:205,216,231`, `spec/5-system/3-error-handling.md:238`,
    `spec/2-navigation/2-trigger-list.md:23,126,197`.
  - 상세: 이 두 식별자는 **신설이 아니라 재사용**이다 — draft 는 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`
    상수의 **값**만 `'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'` 로 바꾸고,
    `TRIGGER_ENDPOINT_PATH_CONFLICT` 에러 코드는 이름·의미(같은 `endpointPath` 를 쓰는 트리거 충돌)를
    그대로 유지한 채 설명 문구만 "동일 워크스페이스" → "다른 워크스페이스 포함 전역" 으로 넓힌다
    (S5·S7). 코드 문자열 자체가 바뀌는 게 아니므로 클라이언트·문서 소비자 입장에서 새 코드가
    생기는 것이 아니다 — 의미가 넓어지는 additive 변경이며 다른 도메인의 동명 코드와 충돌하지 않는다
    (`grep -n "TRIGGER_ENDPOINT_PATH" spec/conventions/error-codes.md` 0건).
  - 등급: 해당 없음(재사용 확인, 새 충돌 아님).

### 점검했으나 해당 사항 없음

- **요구사항 ID**: 이 draft/target 이 새 WH-\*, R-\*, CCH-\* 등 ID 를 신설하지 않는다 — 기존 ID
  (WH-SC-01, WH-MG-02, R-14, R-CC-10, R-CC-19, R-CC-21, CCH-SE-01, CCH-NF-03 등)를 참조만 한다.
  `2-trigger-list.md` 는 이미 R-1~R-17 을 다 쓰고 있고, 이번 변경은 그 어느 것도 재번호하지 않는다.
- **엔티티/DTO/인터페이스명**: 신규 엔티티·DTO 없음. `Trigger.endpoint_path` 컬럼·의미 동일, 제약
  범위만 변경.
- **API endpoint**: 신규 endpoint 없음(`POST/GET/PATCH/DELETE /api/triggers*` 그대로, 409 응답의
  트리거 조건만 워크스페이스 무관으로 확장).
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음. V131 NOTICE 로그의 `chat_channel=true`
  는 마이그레이션 실행 로그 텍스트일 뿐 시스템 이벤트/메시지 채널이 아니다.
- **환경변수·설정키**: 신규 ENV var·config key 없음.
- **파일 경로(spec)**: `spec/2-navigation/` 아래 새 spec 파일 생성 없음 — 기존 파일(`1-data-model.md`,
  `5-system/12-webhook.md`, `2-navigation/2-trigger-list.md`, `5-system/3-error-handling.md`,
  `data-flow/10-triggers.md`, `5-system/2-api-convention.md`,
  `7-channel-web-chat/5-admin-console.md`) 본문 수정만 있다.

## 요약

target(`spec/2-navigation/`)과 이를 촉발한 웹훅 `endpoint_path` 전역 유일화 draft 가 구현 단계에서
신설하는 식별자는 마이그레이션 버전 V131/V132 와 인덱스명 `idx_trigger_endpoint_path` 뿐이며, 둘
다 현재 코드베이스·spec 전수 대조 결과 충돌이 없고 기존 명명 컨벤션(`idx_trigger_<column>`,
`V<n>__<snake_case>.sql`)과 일치한다. `TRIGGER_ENDPOINT_PATH_CONFLICT`/
`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 는 신설이 아니라 기존 식별자의 의미 확장(워크스페이스 단위 →
전역)이며 다른 도메인과 이름이 겹치지 않는다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·
spec 파일 경로 어느 축에서도 신규 식별자 충돌은 발견되지 않았다. 유일한 잔여 위험은 "구현 착수
시점의 병렬 세션이 V131/V132 를 먼저 점유"하는 표준적 마이그레이션 버전 경합인데, draft 자체가
이미 착수 직전 `check-migration-versions.py` 재확인을 체크리스트로 못박아 두었다.

## 위험도
NONE
