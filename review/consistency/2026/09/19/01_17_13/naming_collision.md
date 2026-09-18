# 신규 식별자 충돌 검토 — 웹훅 endpoint_path 전역 유일 (V131·V132)

## 검토 범위

- scope 델타: `spec/2-navigation/2-trigger-list.md` (§3 `endpoint_path` UNIQUE 서술 수정)
- 구현 diff (절대경로 워킹트리 실측, `git diff origin/main...HEAD`): 마이그레이션 `V131__trigger_endpoint_path_dedupe.sql` / `V132__trigger_endpoint_path_global_unique.{sql,conf}`, `triggers.service.ts` / `triggers.controller.ts` / 두 e2e-spec, `CHANGELOG.md`, 그리고 scope 밖 관련 spec (`1-data-model.md`, `12-webhook.md`, `3-error-handling.md`, `2-api-convention.md`, `data-flow/10-triggers.md`, `7-channel-web-chat/5-admin-console.md`).
- 이 변경은 **기존 워크스페이스 단위 유일성을 전역 유일성으로 확장**하는 것이라, 대부분의 "신규 식별자"는 실제로는 **기존 식별자의 의미 확장**(collision 후보 아님)이다. 아래는 실제 신규 도입분만 추린 것이다.

## 발견사항

검토한 6개 관점 모두에서 **CRITICAL/WARNING 급 충돌 없음**.

- **요구사항 ID** — 이번 diff 가 새로 부여한 요구사항 ID 없음. `WH-SC-01` 은 기존 ID 텍스트를 확장 편집한 것(전역 유일 문구 추가)이며 다른 의미로 재사용된 바 없음(`git diff` 확인).
- **엔티티/타입명** — 새 엔티티·DTO·인터페이스 도입 없음. `Trigger`/`TriggerDto`/`UpdateTriggerDto` 등 기존 타입만 재사용.
- **API endpoint** — 신규 endpoint 없음. 기존 `POST /api/triggers` · `PATCH /api/triggers/:id` 의 충돌 판정 범위만 확장.
- **이벤트/메시지명** — `TRIGGER_ENDPOINT_PATH_CONFLICT` (`details.code`) 는 이 PR 이전부터 존재하던 코드다(`git diff` 로 확인 — 설명 문구만 수정, 코드 값 자체는 그대로). `spec/5-system/3-error-handling.md` §1.10 은 §1.9/§1.11/§1.12 와 헤딩 텍스트가 모두 달라 anchor 충돌 없음. 전체 `TRIGGER_*` 코드 계열(`TRIGGER_NOT_FOUND`, `TRIGGER_INACTIVE`, `TRIGGER_RESOURCE_RELEASER`, `TRIGGER_RESPONSE_STRIP_COLUMNS`, `TRIGGER_SECRET_COLUMNS`) 전수 grep 결과 신규 값과 겹치는 이름 없음.
- **환경변수·설정키** — diff 전체에 `process.env`/`NEXT_PUBLIC_*` 변경 없음(신규 env var 없음).
- **파일 경로**
  - 마이그레이션 `V131__trigger_endpoint_path_dedupe.sql` / `V132__trigger_endpoint_path_global_unique.{sql,conf}` — `codebase/backend/migrations/` 목록 확인 결과 `V130` 다음 순번으로 정합, 기존 파일과 겹치지 않음.
  - 신규 인덱스명 `idx_trigger_endpoint_path` — 전체 `migrations/*.sql` grep 결과 V132 에서만 등장, 기존 인덱스명과 겹치지 않음(대체 대상인 구 인덱스는 별개 이름 `idx_trigger_workspace_endpoint`, V002).
  - 신규 e2e 파일 `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts` 및 그 안의 `describe('V131 endpoint_path 중복 정리 (e2e)', …)` — 기존 테스트 파일·describe 문자열과 겹치지 않음.
  - 신규 상수 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`(`triggers.controller.ts`) — 코드베이스 전수 grep 결과 이 파일에만 존재, 인용한 선례 `OAUTH_BEGIN_RESULT_DESCRIPTION`(`integrations.controller.ts`)과는 다른 파일·다른 이름이라 충돌 없음.
  - `spec/1-data-model.md` 의 신규 Rationale 헤딩 `### Webhook \`endpoint_path\` 전역 유일 (2026-09-18)` — 같은 날짜의 다른 헤딩(FK 인덱스 관련 4건)과 텍스트가 모두 달라 anchor 충돌 없음.

## 요약

이번 변경은 신규 식별자를 거의 도입하지 않고 기존 계약(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `PATCH/POST /api/triggers`, `Trigger.endpoint_path`)의 스코프를 워크스페이스 단위에서 전역으로 넓히는 수정이다. 유일하게 새로 생기는 이름은 마이그레이션 파일명(V131/V132), 새 인덱스명(`idx_trigger_endpoint_path`), 신규 e2e 파일/describe, 컨트롤러 로컬 상수(`TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`)인데, 전수 grep 으로 기존 사용처와 대조한 결과 어느 것도 다른 의미로 이미 쓰이고 있지 않았다. 신규 식별자 충돌 관점에서는 안전하다.

## 위험도

NONE
