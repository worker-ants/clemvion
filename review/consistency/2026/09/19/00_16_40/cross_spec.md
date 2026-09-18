# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep, webhook endpoint_path 전역 유일 착수 전)

## 검토 범위

target 은 `spec/2-navigation/` (주로 `2-trigger-list.md`, planner 커밋 `eb5332b57` 로 이미 갱신됨).
"main 추가" 노트가 지목한 착수 대상 변경 — `Trigger.endpoint_path` UNIQUE 범위를
`(workspace_id, endpoint_path)` → `(endpoint_path)` 전역으로 바꾸는 V131/V132 마이그레이션 + 서비스/컨트롤러
문구 수정 — 이 다른 spec 영역과 충돌하는지를 위주로 확인했다. 판정 대상 문서를 전부 직접 `Read`/`grep` 했다
(번들에서 잘린 파일 포함): `spec/1-data-model.md`, `spec/5-system/12-webhook.md`,
`spec/5-system/3-error-handling.md` §1.10, `spec/5-system/2-api-convention.md` §12.2,
`spec/data-flow/10-triggers.md`, `spec/5-system/15-chat-channel.md` (R-CC-19/21, CCH-SE-01),
`spec/7-channel-web-chat/5-admin-console.md`, `spec/4-nodes/7-trigger/providers/*.md`,
`spec/7-channel-web-chat/{0-architecture,3-auth-session,4-security}.md`,
`spec/conventions/migrations.md` + `codebase/backend/migrations/README.md` §4/§5, 및 실제 코드
(`triggers.service.ts`, `triggers.controller.ts`, `V002__indexes.sql`, 기존 `migrations/` 디렉터리 전체).

## 발견사항

이번 스코프에서 CRITICAL/WARNING 급 cross-spec 충돌을 찾지 못했다. 확인한 항목은 다음과 같다 (전부 INFO 수준의 "정합 확인" 이지 결함이 아니다):

- **[INFO] 데이터 모델 — `Trigger.endpoint_path` 유일성 범위 표현이 8개 문서에서 모두 일치**
  - target 위치: `2-trigger-list.md` §2.3.1 (`endpointPath` 행) · §3 (`(endpoint_path) UNIQUE(전역…)`) · §3 하단 註
  - 대조 대상: `spec/1-data-model.md` §2.8(L245)·§3(L927)·Rationale(L978-1017), `spec/5-system/12-webhook.md`
    WH-SC-01(L65)·필드표(L148)·"endpointPath 가변성"(L506-517), `spec/5-system/2-api-convention.md`
    §12.2(L568-572), `spec/data-flow/10-triggers.md` §"UNIQUE 범위"(L245-260)·L173,
    `spec/7-channel-web-chat/5-admin-console.md`(L112)
  - 상세: 모든 문서가 "V002 는 `(workspace_id, endpoint_path)` 였고 V132 부터 `(endpoint_path)` 전역"이라는
    동일 서사를 공유하며, 과거 서술은 취소선(`~~...~~`) 또는 "2026-09-18 이전에는" 문구로 명시적으로
    구버전임을 표시하고 있다. 옛 인덱스 이름(`idx_trigger_workspace_endpoint`, `V002__indexes.sql:26`)과
    새 인덱스 이름(`idx_trigger_endpoint_path`)도 실제 코드/마이그레이션과 일치하며 리포지토리 전체에서
    `idx_trigger_endpoint_path` 이름 충돌은 없다(신규 이름).
  - 제안: 없음 — 그대로 진행 가능.

- **[INFO] API 계약 — 409 wire 형태 불변 확인**
  - target 위치: `2-trigger-list.md` §3 PATCH 註(L225), §3 하단 표
  - 대조 대상: `spec/5-system/3-error-handling.md` §1.10(L232-238), `spec/5-system/2-api-convention.md`
    §5.3 택일 기준(L205, L216, L231)
  - 상세: top-level `code=RESOURCE_CONFLICT` 유지 + `details.field='endpoint_path'` +
    `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 는 세 문서에서 동일하게 유지된다. error-handling.md
    §1.10 은 스스로 "정의·SoT 는 2-trigger-list.md §3, 본 절은 공용 카탈로그 가시성 등재"라고 명시해
    계층 책임(SoT ↔ 미러)이 문서 간에 명확히 분리돼 있다 — 계층 책임 충돌 없음. plan 이 예정한 변경(에러
    "메시지" 문구에서 "워크스페이스" 삭제, `triggers.service.ts:1655`)은 wire 계약(`code`/`details.code`/
    `details.field`)을 건드리지 않아 判定 문항("wire 형태가 바뀌면 안 된다")을 충족한다.
  - 제안: 없음.

- **[INFO] 마이그레이션 형태 — 규약·선례와 정합, 번호 충돌 없음**
  - target 위치: "main 추가" 절이 지정한 V131(트랜잭션 `DO` 블록, dedupe) / V132(`.conf
    executeInTransaction=false`, DROP-새→CREATE→DROP-옛)
  - 대조 대상: `spec/conventions/migrations.md` §2(V번호 정책)·§3(append-only),
    `codebase/backend/migrations/README.md` §4·§5("인덱스 교체는 DROP-먼저", 선례 `V110`),
    실제 `codebase/backend/migrations/` 디렉터리(현재 최댓값 `V130`)
  - 상세: 현재 main 의 최댓값이 `V130`이므로 `V131`/`V132`는 정확히 다음 단조 증가 번호이며 gap·재사용이
    없다. V132 의 "DROP(새) → CREATE CONCURRENTLY(새) → DROP(옛)" 순서는 README §5 의 "인덱스 교체는
    DROP-먼저" 규약과 선례 `V110`을 그대로 따른다. V131 이 트랜잭션 `DO` 블록이고 V132 가 별도 파일 +
    `.conf`로 `CONCURRENTLY`를 분리한 것도 README §5 "같은 파일에 transactional statement 와
    `CONCURRENTLY`를 섞지 않는다" 규약과 일치한다.
  - 제안: 없음.

- **[INFO] Chat Channel 상태 컬럼 — 마이그레이션이 건드리지 않는 것이 CCH-SE-01/R-CC-19 의 닫힌 열거와 정합**
  - target 위치: "main 추가" 절 — "채팅 채널 상태 컬럼은 쓰지 않는다"
  - 대조 대상: `spec/5-system/15-chat-channel.md` CCH-SE-01(L97), R-CC-19(L786-793)
  - 상세: `chat_channel_health=degraded` 는 두 경로(어댑터 외부 API 호출 실패, per-chat rate-limit 초과)로
    닫힌 열거로 정의돼 있다. V131 의 dedupe UPDATE 가 이 컬럼을 건드리지 않는 것은 이 닫힌 열거를
    깨지 않기 위한 의도된 설계로, chat-channel.md 의 기존 서술과 충돌하지 않는다. (재등록은 별도 운영
    절차로 위임 — SQL 이 `setupChannel()`을 부를 수 없다는 이유도 R-CC-21 의 "PATCH·SQL 은 provider
    등록 행위를 대신할 수 없다"는 기존 원칙과 일치한다.)
  - 제안: 없음.

- **[INFO] 요구사항 ID — 신규 ID 부여 없음, 충돌 여지 없음**
  - 상세: 이번 변경은 기존 WH-SC-01 을 갱신할 뿐 새 요구사항 ID 를 부여하지 않는다. `TRIGGER_ENDPOINT_PATH_CONFLICT` 에러 코드도 기존 코드 재사용이라 새 식별자 충돌 검사 대상이 없다.

- **[INFO] RBAC/권한 모델 — 영향 없음**
  - 상세: endpoint_path 유일성 범위 변경은 워크스페이스 격리·역할 기반 권한(editor+ PATCH 등)과 무관하다. `2-trigger-list.md` §4.1 삭제 권한 표, §2.3.1 권한 게이트 서술 모두 이번 변경으로 달라지지 않는다.

## 요약

`spec/2-navigation/2-trigger-list.md`(및 이를 참조하는 `1-workflow-list.md`·`3-schedule.md`)는 이미
planner 커밋(`eb5332b57`)이 `spec/1-data-model.md`·`5-system/12-webhook.md`·`5-system/3-error-handling.md`·
`5-system/2-api-convention.md`·`data-flow/10-triggers.md`·`7-channel-web-chat/5-admin-console.md`·
`5-system/15-chat-channel.md` 전반에 걸쳐 "endpoint_path 전역 유일" 서사를 동기화해 둔 상태이며, 세 차례의
`--spec` 검토(23_39_46 → 23_54_40 → 00_07_54, 최종 BLOCK:NO)를 거쳤다. 이번 `--impl-prep` 검토에서 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 여섯 관점 모두 재확인했으나 추가로 발견된 모순은
없다. "main 추가" 절이 지정한 V131/V132 마이그레이션 계획도 `spec/conventions/migrations.md` +
`migrations/README.md` 규약, 실제 최신 마이그레이션 번호(V130), 기존 인덱스 이름(`idx_trigger_workspace_endpoint`,
`V002`)과 충돌 없이 정합하며 새 인덱스 이름(`idx_trigger_endpoint_path`)도 저장소 전체에서 미사용임을
확인했다. 409 에러 계약(top-level `RESOURCE_CONFLICT` + `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`)의
wire 형태도 계획상 변경되지 않는다. 구현 착수를 막을 cross-spec 사유는 없다.

## 위험도

NONE
