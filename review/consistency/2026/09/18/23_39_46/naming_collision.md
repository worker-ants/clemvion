# 신규 식별자 충돌 검토 — `spec-draft-webhook-endpoint-path-global-unique.md`

## 발견사항

- **[INFO]** 새 마이그레이션 번호 V131·V132, 새 인덱스명 `idx_trigger_endpoint_path` 는 전수 미사용 확인
  - target 신규 식별자: `V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`(+`.conf`), 인덱스명 `idx_trigger_endpoint_path`
  - 기존 사용처: `codebase/backend/migrations/` 최신 파일은 `V130__model_config_workspace_kind_index.sql` — V131·V132 는 비어 있다. `grep -rn "idx_trigger_endpoint_path"` 는 target 문서 자신(및 그 사본)에서만 나온다.
  - 상세: 다른 in-progress plan(`plan/in-progress/*.md`) 어디에도 V131·V132 를 선점한 문서가 없어 병렬 작업과의 번호 충돌 위험도 없다. `V102__trigger_endpoint_path_uuid_check.sql` / `V103__trigger_endpoint_path_uuid_validate.sql` 과 이름이 겹치는 접두어(`trigger_endpoint_path_`)를 쓰지만 접미어(`uuid_check`/`uuid_validate` vs `dedupe`/`global_unique`)로 명확히 구분돼 혼동 위험은 낮다.
  - 제안: 없음 — 충돌 없음, 그대로 진행 가능.

- **[INFO]** 삭제 대상 인덱스명 `idx_trigger_workspace_endpoint` 는 기존 정의를 정확히 가리킴 (신규 식별자 아님)
  - target 신규 식별자: 해당 없음 — target 은 이 이름을 "새로 도입"하지 않고 V002 가 만든 기존 인덱스를 "삭제 대상"으로만 참조한다.
  - 기존 사용처: `codebase/backend/migrations/V002__indexes.sql`, `triggers.service.ts:224`(`const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'`), `triggers.service.spec.ts` fixture.
  - 상세: target 구현 절은 이 상수의 **값**을 `'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'` 로 바꾸라고 명시했고, 상수 이름(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`) 자체는 그대로 유지한다 — 새 상수를 만드는 것이 아니라 기존 상수의 값 재배선이라 "새 식별자"가 아니다. 코드·spec·target 세 곳의 서술이 일치한다.
  - 제안: 없음.

- **[INFO]** 에러 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 새 식별자가 아니라 기존 코드의 의미 확장 — 충돌 판정 대상 밖
  - target 신규 식별자: 해당 없음 — target 구현 절(§구현 3번째 불릿)은 이 코드를 "새로 만든다"고 하지 않고 e2e 테스트 항목에서 그대로 재사용한다.
  - 기존 사용처: `spec/5-system/3-error-handling.md:238`(`동일 워크스페이스에 같은 endpointPath 를 쓰는 트리거가 이미 존재`), `spec/2-navigation/2-trigger-list.md:126,197`.
  - 상세: 이 코드는 "같은 endpoint_path 유일성 위반"이라는 동일한 물리적 사건(UNIQUE violation)을 가리키던 채로, 유일성 범위만 워크스페이스 단위 → 전역으로 넓어진다 — 코드가 가리키는 *제약 자체*가 넓어지는 것이지 코드가 **다른 의미로 이미 쓰이던 자리에 재도입**되는 것이 아니므로 본 checker 의 "새 식별자 vs 기존 다른 의미" 충돌 정의에는 해당하지 않는다. 다만 S5 의 치환 지시(`(workspace_id, endpoint_path) UNIQUE` → `(endpoint_path) UNIQUE(전역)`)는 `2-trigger-list.md` 두 곳에는 리터럴로 존재하는 패턴이지만, `3-error-handling.md:238` 행은 이 리터럴 패턴이 아니라 산문(`동일 워크스페이스에 같은 endpointPath 를 쓰는 트리거가 이미 존재`)이라 기계적 치환 지시가 그 행에 그대로 적용되지 않는다 — 이는 신규 식별자 충돌이 아니라 S5 실행 정확성 문제이므로 다른 관점(cross-spec/실행 정확성) 리뷰의 소관으로 남긴다.
  - 제안: 없음(본 checker 범위 밖). 참고로만 병기.

- **[INFO]** 새 Rationale 절 제목이 기존 제목과 겹치지 않음
  - target 신규 식별자: `spec/1-data-model.md` `## Rationale` 신설 절 제목 `Webhook endpoint_path 전역 유일 (2026-09-18)`
  - 기존 사용처: 같은 파일의 기존 Rationale 하위 제목 15개(`쓸 인덱스가 없는 FK 서른하나의 처분`, `그래프 RAG 삭제 연쇄의 FK 인덱스 넷`, `Trigger (workflow_id) 인덱스` 등) 어디와도 문자열이 겹치지 않는다.
  - 상세: 충돌 없음.
  - 제안: 없음.

- **[INFO]** 트래커 신규 항목 문구 · 새 spec 파일 미생성 확인
  - target 신규 식별자: 트래커 신규 항목 «지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다(묘비 부재)»
  - 기존 사용처: `묘비/tombstone` 용어는 `plan/in-progress/spec-sync-auth-gaps.md` 등 다른 도메인(리프레시 토큰 폐기 등)에서도 쓰이지만 일반 설계 패턴명이라 항목 식별자 충돌이 아니다. target 은 새 spec 파일을 만들지 않고 기존 5개 파일(`spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/2-navigation/2-trigger-list.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md`)만 수정하므로 파일 경로 충돌 관점(§6)은 해당 사항 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

## 요약

target 이 새로 도입하는 식별자는 마이그레이션 번호 V131·V132, 인덱스명 `idx_trigger_endpoint_path`, 데이터 모델 Rationale 절 제목, 트래커 신규 항목뿐이며 전수 grep 결과 기존 사용처와 겹치지 않는다. 삭제 대상 `idx_trigger_workspace_endpoint` 와 재사용되는 상수·에러 코드(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `TRIGGER_ENDPOINT_PATH_CONFLICT`)는 신규 식별자가 아니라 기존 식별자의 값·의미 재배선이므로 본 checker 의 "새 식별자 vs 기존 다른 의미" 충돌 정의 밖이다 — 다만 `TRIGGER_ENDPOINT_PATH_CONFLICT` 의 산문 설명(`3-error-handling.md:238`)이 S5 의 리터럴 치환 패턴 밖에 있어 실제 편집 시 누락될 수 있다는 점은 참고로 병기했다(신규 식별자 충돌은 아님). 새 spec 파일도 생성하지 않으므로 파일 경로 충돌도 없다.

## 위험도

NONE
