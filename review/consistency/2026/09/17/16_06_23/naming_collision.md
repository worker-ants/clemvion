# 신규 식별자 충돌 검토 — spec-draft-window1-measured

## 검토 방법

`plan/in-progress/spec-draft-window1-measured.md` 의 변경안(A1~A3, B)이 실제로 새로
도입하는 식별자가 있는지 먼저 추출하고, 각각을 기존 사용처와 대조했다. 번들이 대상 spec
본문을 거의 신지 않아 다음 파일을 직접 Read 로 열어 확인했다:

- `spec/2-navigation/2-trigger-list.md` (frontmatter `code:`, §3 전체, Rationale)
- `spec/5-system/15-chat-channel.md` §5.4 (404 행 포함 에러 표)
- `spec/5-system/14-external-interaction-api.md` (EIA-AU-07 원문)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (인용된 메서드·심볼 실재 확인)
- `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`,
  `trigger-config-lost-update.e2e-spec.ts` (파일 실재·경계 서술 확인)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` ("developer 항목 7" 참조 일치 확인)

## 신규 식별자 추출 결과

이 draft 는 성격상 **관찰·서술 정정**이며, 점검 관점 1~6 에 해당하는 신규 식별자를
사실상 도입하지 않는다:

| 관점 | 신규 도입 여부 | 근거 |
|---|---|---|
| 1. 요구사항 ID | 없음 | 새 `R-*`/`WH-*`/`CCH-*`/`EIA-*` ID 미신설. `EIA-AU-07` 은 기존 ID 를 참조만 함(`14-external-interaction-api.md:111` 원본과 일치) |
| 2. 엔티티/타입명 | 없음 | 새 DTO·인터페이스·엔티티명 없음. 언급되는 `rewriteTriggerConfigLocked`·`throwTriggerNotFound`·`findById`·`rotateBotToken`·`revokePerTriggerToken` 은 전부 `triggers.service.ts` 에 이미 존재(각각 24/401/408/1232/1163행에서 확인) — 새로 지어낸 심볼 아님 |
| 3. API endpoint | 없음 | `rotate-bot-token`·`interaction/revoke-token` 둘 다 §3 API 표(2-trigger-list.md:174,176)에 기존 등재된 endpoint. A2 는 괄호 안에 두 번째 endpoint 를 **추가로 나열**할 뿐 새 endpoint 를 정의하지 않음 |
| 4. 이벤트/메시지명 | 없음 | 새 webhook/queue/sse 이벤트명 없음. `500 INTERNAL_ERROR` 는 error-handling 공용 기본값이며 새 코드 아님(§Rationale 도 "계약이 아니라 현재 동작"으로 명시) |
| 5. ENV var/config key | 없음 | 새 환경변수·config key 없음 |
| 6. 파일 경로 | 신규 spec 파일 없음. frontmatter `code:` 에 기존 파일 1건 추가 참조 | `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 는 이미 존재하는 파일(#1343 산출물, `ls` 로 실재 확인)이며 `trigger-*.e2e-spec.ts` 명명 컨벤션을 따른다. 인접 파일 `trigger-config-lost-update.e2e-spec.ts` 와 주제가 인접(둘 다 트리거 동시 쓰기)하지만, **두 파일 모두 자신의 JSDoc 서두에서 서로를 인용하며 경계를 명시**("이 파일은 `config` 밖 컬럼과 FK CASCADE" vs "`config` JSONB 병합의 경합") — 혼동 소지가 이미 파일 자체에서 해소됨 |

## 발견사항

없음. 이 draft 가 §3 ⚠️ 문단을 교체하고 §5.4 404 행에 문장을 덧붙이는 것은 모두
**기존에 이미 정의된 endpoint·에러 코드·심볼**을 정확히 재서술하는 것이며, 새 이름·새 ID·
새 경로를 만들지 않는다. anchor 링크로 새로 추가되는 `[트리거 목록 §3 «동시 쓰기
직렬화»](../2-navigation/2-trigger-list.md#3-api)` 도 `#3-api` 라는 기존 앵커(이미 문서
전역에서 다수 참조 중)를 가리킬 뿐 새 앵커를 만들지 않는다.

## 요약

target draft 는 신규 식별자를 도입하지 않는 순수 서술 정정(⚠️ 문단 교체, 404 행 보강,
frontmatter `code:` 참조 1건 추가)이다. 언급된 모든 메서드명·endpoint·에러 코드·파일
경로를 코드베이스·spec 원문과 대조한 결과 전부 기존 정의와 일치했고, 새로 만들어진
요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·config key·spec 파일이 없어
충돌 가능성 자체가 발생하지 않는다. 유일하게 "신규"로 볼 수 있는 항목(frontmatter 에
`trigger-update-save-window.e2e-spec.ts` 참조 추가)도 이미 존재하는 파일이고 인접
e2e 파일과의 주제 경계를 파일 자체가 명시적으로 서술하고 있어 혼동 위험이 없다.

## 위험도

NONE
