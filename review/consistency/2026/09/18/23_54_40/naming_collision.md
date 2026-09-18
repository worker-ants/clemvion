# 신규 식별자 충돌 검토 — `spec-draft-webhook-endpoint-path-global-unique.md` (2차, 1차 Critical 2·WARNING 1 해소 반영본)

## 발견사항

- **[INFO]** 마이그레이션 V131·V132, 인덱스명 `idx_trigger_endpoint_path` — 전수 미사용 재확인
  - target 신규 식별자: `V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`(+`.conf`), 인덱스 `idx_trigger_endpoint_path`
  - 기존 사용처: `codebase/backend/migrations/` 최신 파일은 `V130__model_config_workspace_kind_index.sql`(V131·V132 비어 있음, 실측). `grep -rn "idx_trigger_endpoint_path" codebase spec plan`는 target 문서 자신에서만 나온다. 다른 `plan/in-progress/*.md` 어디에도 V131·V132 를 선점한 문서 없음(전수 grep) — 병렬 세션과의 버전 번호 충돌 없음.
  - 상세: `V102__trigger_endpoint_path_uuid_check.sql` / `V103__trigger_endpoint_path_uuid_validate.sql` 이 같은 `trigger_endpoint_path_` 접두어를 쓰지만 접미어(`uuid_check`/`uuid_validate` vs `dedupe`/`global_unique`)로 명확히 구분돼 실제 혼동 위험은 낮다(1차 검토와 동일 결론, 재확인 완료).
  - 제안: 없음 — 충돌 없음.

- **[INFO]** 삭제 대상 `idx_trigger_workspace_endpoint` 는 신규 식별자가 아니라 기존(V002) 정의를 정확히 가리킴
  - target 신규 식별자: 해당 없음 — target 은 이 이름을 새로 도입하지 않고 V002 가 만든 기존 인덱스를 "교체(삭제) 대상"으로만 참조한다.
  - 기존 사용처: `codebase/backend/migrations/V002__indexes.sql:26`, `triggers.service.ts:224`(`const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'`), `triggers.service.spec.ts:3056,3119` fixture.
  - 상세: 구현 절은 이 상수의 **값**만 `'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'` 로 재배선하라고 명시하고, 상수 이름(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`) 자체는 유지한다 — 새 식별자가 아니라 기존 상수 값의 재배선. 코드·spec·target 세 곳 서술 일치.
  - 제안: 없음.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` — 신규 식별자 아님, 기존 코드의 유일성 범위 확장(재확인: 1차 WARNING 1 해소됨)
  - target 신규 식별자: 해당 없음 — S5(구 버전 대비 확장됨)가 `spec/5-system/3-error-handling.md` 카탈로그 표의 산문 설명(`동일 워크스페이스에 같은 endpointPath 를 쓰는 트리거가 이미 존재`)까지 명시적으로 치환 대상에 포함시켰다(1차 검토가 지적한 「S5 가 `2-trigger-list.md` 의 리터럴 패턴만 잡고 `3-error-handling.md:238` 산문 행은 놓친다」는 WARNING 1이 이번 개정판에서 해소됨 — 직접 실측: 개정 S5 본문에 `3-error-handling.md` 카탈로그 표 행 설명 치환 지시가 명문화되어 있음, `spec/5-system/3-error-handling.md:238`).
  - 기존 사용처: `spec/5-system/3-error-handling.md:238`, `spec/2-navigation/2-trigger-list.md:126,197`, `spec/5-system/2-api-convention.md:205,216,231`, `triggers.controller.ts:102,139`, `triggers.service.ts:1641,1670`, `webhook-trigger.e2e-spec.ts:209`.
  - 상세: 코드가 가리키는 물리적 사건(UNIQUE violation)은 그대로이고 유일성 **범위**만 워크스페이스 단위 → 전역으로 넓어진다 — "다른 의미로 이미 쓰이던 자리에 재도입"이 아니므로 본 checker 의 충돌 정의 밖.
  - 제안: 없음(범위 밖, 참고 병기).

- **[INFO]** 새 Rationale 절 제목 — 기존 제목과 무충돌 재확인
  - target 신규 식별자: `spec/1-data-model.md` `## Rationale` 신설 절 제목 `Webhook endpoint_path 전역 유일 (2026-09-18)`
  - 기존 사용처: 같은 파일의 기존 `### ` 하위 제목 34개(§2.1~§2.25 엔티티 절 + `쓸 인덱스가 없는 FK 서른하나의 처분` · `그래프 RAG 삭제 연쇄의 FK 인덱스 넷` · `Trigger (workflow_id) 인덱스` 등 기존 Rationale 9개) 전수 확인, 문자열 겹침 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

- **[INFO]** S7 신설 절(`data-flow/10-triggers.md`)의 "정정(날짜)" 블록 형식 — 기존 컨벤션 재사용, 새 식별자 아님
  - target 신규 식별자: 해당 없음 — S7 은 `spec/2-navigation/2-trigger-list.md` R-2 의 "정정 (날짜)" 블록 형식을 그대로 재사용하겠다고 명시한다.
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md:338` `> **정정 (2026-09-08)**: 본 절의 설계는 R-14 로 대체됐다...` — 원문 취소선 보존 + 정정 블록 병기 관례의 선례가 실재함을 확인.
  - 상세: 충돌 없음 — 다만 draft 본문 예시 문구는 `**정정(2026-09-18)**`(괄호 앞 공백 없음)로 적혀 있어 선례의 `정정 (2026-09-08)`(공백 있음)과 표기가 미세하게 다르다. 이는 식별자 충돌이 아니라 서식 일관성 문제라 본 checker 범위 밖(convention_compliance 소관)이며 별도 조치 불요.
  - 제안: 없음.

- **[INFO]** 트래커 신규 항목 문구 — 중복 없음, 새 spec 파일 미생성
  - target 신규 식별자: 트래커 신규 항목 「지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다(묘비 부재)」
  - 기존 사용처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 전체에 "묘비"·"tombstone"·"다시 등록" 문자열 0건(grep 확인) — 동일/유사 트래커 항목 없음. "묘비" 용어 자체는 리프레시 토큰 폐기 등 다른 도메인에서도 쓰이는 일반 설계 패턴명이라 항목 식별자 충돌 아님.
  - 상세: target 은 새 spec 파일을 만들지 않고 frontmatter `spec_impact` 5개 파일(`spec/1-data-model.md` · `spec/5-system/12-webhook.md` · `spec/2-navigation/2-trigger-list.md` · `spec/5-system/3-error-handling.md` · `spec/data-flow/10-triggers.md`)만 수정하며, 본문 S1~S7 변경 대상도 이 5개와 정확히 일치한다(전수 대조 완료) — 파일 경로 충돌(§6) 해당 없음. plan 파일 경로 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 도 기존 plan 파일과 겹치지 않는다(`ls plan/in-progress | grep -i "webhook\|endpoint"` 결과 자기 자신 1건).
  - 제안: 없음.

- **[INFO]** 1차 처분 Critical 1 보강분(채팅 채널 트리거 처리)이 도입한 값·NOTICE 필드 — 기존 자원 재사용, 새 식별자 없음
  - target 신규 식별자: 해당 없음 — V131 NOTICE 의 `chat_channel=true` 표시, `chat_channel_health = 'degraded'`, `chat_channel_last_error` 값
  - 기존 사용처: `spec/5-system/15-chat-channel.md:297-298`(`chat_channel_health` / `chat_channel_last_error` 컬럼 정의), CCH-SE-01(:97) · CCH-NF-03(:123) · R-CC-19(:786) · R-CC-21(:806) · CCH-AD-02(:65) — 전부 기존 식별자·기존 컬럼.
  - 상세: `config ? 'chatChannel'` 의 JSONB 키 `chatChannel` 도 `spec/5-system/15-chat-channel.md` 전역에서 쓰는 camelCase 키(`Trigger.config.chatChannel`, §4.1)와 정확히 일치 — 새 키가 아니다. `chat_channel=true` 는 NOTICE 로그의 임시 표시자일 뿐 DB 컬럼·spec 식별자가 아니다.
  - 제안: 없음.

## 요약

target 이 이번 개정(1차 `--spec` BLOCK:YES → Critical 2·WARNING 1 반영본)에서 새로 도입하는 식별자는 마이그레이션 번호 V131·V132, 인덱스명 `idx_trigger_endpoint_path`, 데이터 모델 Rationale 신설 절 제목, `data-flow/10-triggers.md` 의 정정 블록(S7, 기존 형식 재사용), 트래커 신규 항목뿐이며 전수 grep 결과 기존 사용처와 겹치지 않는다. 1차 검토에서 나왔던 5가지 INFO 항목을 전부 재실측했고 결론은 변하지 않았다. 이번 개정판의 실질 추가분(Critical 1 채팅 채널 처리, Critical 2 S7 신설, WARNING 1 확장 S5)은 전부 기존 식별자(`chat_channel_health`·`chat_channel_last_error`·`config.chatChannel`·`R-CC-21`·`CCH-AD-02`·`CCH-SE-01`·트리거리스트 R-2 정정 블록 형식)를 재사용할 뿐 새 식별자를 만들지 않는다. `idx_trigger_workspace_endpoint`(삭제 대상)와 `TRIGGER_ENDPOINT_PATH_CONFLICT`/`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(재배선 대상)는 신규 식별자가 아니라 기존 식별자의 값·의미 재배선이므로 본 checker 의 "새 식별자 vs 기존 다른 의미" 충돌 정의 밖이다. 새 spec 파일도 생성하지 않으므로 파일 경로 충돌도 없다.

## 위험도

NONE
