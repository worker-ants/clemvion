# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-notification-secret-storage.md`

## 검토 요약

이 target 문서는 (실측으로 확인 가능하듯) 이미 `spec/5-system/14-external-interaction-api.md` §7.1,
`spec/conventions/secret-store.md` §1, `spec/5-system/2-api-convention.md` frontmatter `code:`
세 파일에 실제로 반영되어 있다(`git diff origin/main...HEAD` 로 확인). 세 diff 를 직접 대조한
결과, 이 draft 가 **새로 도입하는 식별자는 없다** — 전부 기존에 이미 존재하는 이름을 재사용한다.

## 관점별 확인

1. **요구사항 ID 충돌** — 새 ID 없음. `EIA-NX-12` 는 `origin/main` 시점부터 이미 존재하는
   요구사항 ID(§3.1 secret rotation API)이고, 이 draft 는 그 ID 를 **재정의하지 않고**
   "1회 평문 반환(rotate 응답) vs 컬럼 자체가 평문(DB 상태)" 을 구분하는 참조 문장만
   추가했다 (`spec/5-system/14-external-interaction-api.md` 정정 문단 마지막 줄). 충돌 없음.

2. **엔티티/타입명 충돌** — `Trigger.notification_secret_v2`, `chat_channel_token_v2` 모두
   기존 컬럼(§7.1 DDL, `15-chat-channel.md`)이며 이 draft 가 새로 명명한 것이 아니다.
   `R-K`(`chat-channel.md` §"`chat_channel_token_v2` 컬럼 명명의 semantic 비대칭") 도
   기존 Rationale ID — `grep -rn "^### R-K" spec/` 결과 `15-chat-channel.md` 단 한 곳에만
   존재해 다른 의미로 중복 사용되지 않는다. draft 는 이를 인용만 한다.

3. **API endpoint 충돌** — 새 endpoint 없음. `POST /api/triggers/:id/notification/rotate-secret`
   은 기존 EIA-NX-12 소유 endpoint 그대로이며 draft 가 새 endpoint 를 추가하지 않는다.

4. **이벤트/메시지명 충돌** — 새 이벤트·큐·webhook·SSE 이름 없음.

5. **환경변수·설정키 충돌** — 새 ENV var, config key 없음. `wsk_` prefix 도 기존 rotate 구현의
   기존 값 포맷이며 draft 가 새로 정의하지 않는다.

6. **파일 경로 충돌** — 새 spec 파일 생성 없음(기존 3개 파일만 편집). `2-api-convention.md`
   frontmatter 에 추가된 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`
   glob 을 실제 파일시스템(`find codebase/backend/src/repo-guards -iname "swagger-dto-contract*"`)
   과 대조 — `swagger-dto-contract-guard.ts` / `swagger-dto-contract.spec.ts` 두 실제 파일에
   정확히 매치되고, 같은 glob 이 이미 `spec/conventions/swagger.md` frontmatter `code:` 에도
   등재돼 있어(§5.4 "검증 층" 표가 같은 정적 가드를 두 문서에서 나란히 참조하는 것과 일치)
   **의도된 이중 등록**이지 충돌이 아니다. `spec_impact` 6개 경로(`4-integration.md`,
   `15-external-interaction.md` 포함)도 모두 실존 파일임을 `ls` 로 확인했다.

## 부가 확인 — `secret-store.md §1` 비대상(예외) 목록 순번

새로 추가된 문단이 "아래 비대상 **3번째** 항목 참조" 라고 스스로를 지칭하는데, 실제 파일의
`> **비대상 —`  단락 순서(`AuthConfig.config` → `Trigger.config.interaction.triggerToken`(itk_*)
→ `Trigger.notification_secret_v2`)와 일치해 순번 충돌·오프바이원 없음.

## 발견사항

없음 — 신규 식별자 충돌 관점에서 발견된 CRITICAL/WARNING/INFO 항목 없음. 이 draft 는 새 이름
공간을 여는 문서가 아니라, 기존에 이미 부여된 이름(`notification_secret_v2` 컬럼,
`EIA-NX-12`, `R-K`, 정적 가드 파일 경로)에 대한 **서술 오류 정정**과 **누락된 예외 등재**로
한정된다.

## 요약

target 문서는 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 중
어느 것도 새로 도입하지 않는다. 손댄 세 파일의 실제 diff 를 직접 대조한 결과 모든 참조
식별자(`notification_secret_v2`, `chat_channel_token_v2`, `EIA-NX-12`, `R-K`,
`swagger-dto-contract*.ts`)가 이미 정확히 하나의 의미로 존재하고 있었고, draft 는 그 의미를
바꾸지 않은 채 정정·참조·이중 등록(의도된 것)만 수행한다. 신규 식별자 충돌 표면 자체가
없는 문서다.

## 위험도

NONE
