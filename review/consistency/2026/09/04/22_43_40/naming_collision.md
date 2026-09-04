# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 검토 개요

target 은 `spec/1-data-model.md` §2.9 · `spec/5-system/2-api-convention.md` §2.2/§5.4 ·
`spec/conventions/swagger.md` §1-4 의 **nullable 표기 정정**을 다루는 planner draft다.
실측 결과 이 draft 가 서술하는 변경안 ①②③은 **이미 실제 spec 파일에 전부 반영돼 있다**
(형제 plan `entity-nullable-column-type-mismatch.md` 가 커밋 `cce8a188b` 로 적용, 본 draft
자신도 그렇게 기록함). 따라서 "신규 식별자 도입" 관점에서 새로 검토할 대상은 사실상
**후속(`## 후속`) 항목 몇 개**로 좁혀지며, 그마저도 새 ID/엔티티/endpoint/이벤트/ENV 를
만들지 않는다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — target 은 새 요구사항 ID를 부여하지 않는다. 해당 없음.

2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스명 없음. 언급되는 `ExecutionStatusDto`,
   `AlertRuleDto`, `IntegrationDto`, `DocumentDto`, `QueryExecutionDto` 등은 모두 기존
   타입이며 draft 는 이들의 **선언 형태**(optional 여부)만 다룬다.

3. **API endpoint 충돌** — 새 endpoint 없음. `/api/auth/{action}` 예외 조항은 **이미 존재하는
   22개 경로**를 규칙에 성문화하는 것이지 새 경로를 만들지 않는다.

   신규로 도입되는 것은 엔드포인트가 아니라 **명명된 예외 조항 "예외 — 인증 상태 전이·
   capability 액션"**(`spec/5-system/2-api-convention.md:56`) 하나다. 이 이름이 §2.2 의
   기존 예외 "예외 — 인증 family 전용 네임스페이스"(`:54`, `/api/external/*` 대상)와
   충돌할 수 있었는데, draft 자체가 이전 라운드(`--spec` W7)에서 겹치는 접두("인증
   family")를 제거해 disambiguate 했다고 기록하고 있고, 실측(`grep -rn "인증 상태 전이"
   spec/`)으로도 해당 문구가 저장소 전체에서 **1곳만** 쓰임을 확인했다 — 충돌 없음, 이미
   해소됨.

4. **이벤트/메시지명 충돌** — 새 webhook/queue/SSE 이벤트명 없음. 해당 없음.

5. **환경변수·설정키 충돌** — 새 ENV var/config key 없음. 해당 없음.

   다만 인접 축으로 **DB 인덱스명** `idx_schedule_next_run` → `(workspace_id, next_run_at)`
   전환과 **마이그레이션 번호 `V110`** 이 후속 항목에 등장한다. 실측:
   - `codebase/backend/migrations/` 최신 파일은 `V109__workspace_personal_owner_unique.sql`
     — `V110` 은 다음 사용 가능 번호이며 기존 마이그레이션과 충돌하지 않는다.
   - `plan/in-progress/` 전체에서 `V110` 을 참조하는 문서는 이 target 자신과 형제 draft
     `spec-draft-schedule-index.md` 뿐이고, 둘 다 **같은 인덱스 변경**을 가리켜 서로
     다른 두 작업이 같은 번호를 다투는 상황이 아니다. 충돌 없음.

6. **파일 경로 충돌** — target 의 `spec_impact` 는 기존 파일 4개(`spec/1-data-model.md`,
   `spec/data-flow/10-triggers.md`, `spec/5-system/2-api-convention.md`,
   `spec/conventions/swagger.md`)뿐이고 새 spec 파일 경로를 만들지 않는다. plan 파일명
   `spec-draft-nullable-notation-followups.md` 도 저장소의 기존 `spec-draft-*` 명명
   컨벤션(`spec-draft-schedule-index.md`, `spec-draft-eia-62-waiting-payload.md` 등)을
   따르며 기존 파일과 겹치지 않는다.

## 부수 관찰 (naming-collision 범위 밖, 참고용)

target 이 서술하는 변경안 ①②③이 실측상 **이미 `spec/` 본문에 적용돼 있다**
(`spec/1-data-model.md:260`, `spec/5-system/2-api-convention.md:56,176-198`,
`spec/conventions/swagger.md:90-108` 전부 draft 의 "변경안" 문구와 일치). 이는 신규
식별자 충돌 사안이 아니라 plan 라이프사이클(중복/stale draft 여부) 사안이므로 본 리뷰의
등급 대상으로 올리지 않는다 — 다만 통합 SUMMARY 작성자가 다른 checker(consistency/구조)
결과와 대조할 때 참고할 만해 기록만 남긴다.

## 요약

target 은 새 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수를 전혀 도입하지
않는다. 유일하게 "이름이 붙는" 신규 산출물인 API 규약 §2.2 의 새 예외 조항명("인증 상태
전이·capability 액션")은 인접한 기존 예외("인증 family 전용 네임스페이스")와 겹칠 뻔했으나
draft 자신이 이전 검토 라운드에서 이미 접두어를 제거해 disambiguate 했고, 현재 spec 본문
실측으로도 유일한 용례임을 확인했다. DB 인덱스명/마이그레이션 번호(`V110`) 축에서도 다른
in-progress 작업과의 충돌은 없다. 신규 식별자 충돌 관점에서 CRITICAL/WARNING 사유를 찾지
못했다.

## 위험도

NONE
