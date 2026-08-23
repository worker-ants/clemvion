STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `plan/in-progress/spec-text-fixes.md`

## 검토 방법

target 이 명시한 3개 작업 항목을 각각 실제 spec 원문과 대조해, 그 처분이 **새 식별자를 도입하는지**
여부를 점검 관점 6가지(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 /
환경변수·설정키 / 파일 경로) 기준으로 확인했다.

| # | 처분 | 실제 원문 대조 | 신규 식별자 도입 여부 |
| --- | --- | --- | --- |
| ① | `15-chat-channel.md` §5.1(319행)·§8(507행) 의 `InteractionRequestContext` 서술을 EIA §3.3.1 포인터로 대체 | 두 행 모두 확인 — `InteractionRequestContext` 를 "단일 인터페이스 + optional `scope`" 로 서술 중. EIA §3.3.1(113~149행)은 이미 `ExternalInteractionRequestContext`/`InternalInteractionRequestContext` union + `isInternalCtx()` 로 "v1 구현 완료" 표기 | **없음** — 기존에 이미 정의된 EIA 타입명을 가리키기만 함. 새 타입/DTO 명 신설 없음 |
| ② | EIA §5.1(331행) 의 "webhook §5.2 는 legacy `statusCode/errors` shape" 대비 문구를 취소선+현재 사실로 정정 | `12-webhook.md` §5.2("400 응답 형식", 270~300행)는 이미 `{error:{code,message,requestId,details?}}` — EIA 와 동일 봉투. 처분은 문구 삭제/취소선일 뿐 새 필드·타입 도입 없음 | **없음** |
| ③ | `data-flow/15-external-interaction.md:119` 의 `EIA-AU-08/09` 결합 표기에서 `09` 제거 | EIA 의 `EIA-AU-*` 는 `01`~`08` 만 정의(전수 grep 확인, 331~1809행대 전 grep 결과 08 까지만 존재). `EIA-AU-09` 는 어떤 문서에서도 실체를 가진 요구사항으로 정의된 적 없음(트래커 `spec-sync-external-interaction-api-gaps.md:1322` 도 동일 결론) | **없음** — 존재한 적 없는 참조를 **삭제**하는 처분이라 애초에 "충돌 검토 대상 신규 ID" 자체가 없다 |

## 발견사항

없음. target 은 신규 엔티티·DTO·endpoint·이벤트·ENV var·spec 파일을 전혀 도입하지 않는다.
세 항목 모두 **기존에 이미 정의된 식별자를 가리키거나(①), 대비 서술을 취소선으로 무효화하거나(②),
존재한 적 없는 참조를 삭제하는(③)** 순수 텍스트 정정이다. `spec_impact` 3개 파일도 전부 기존
spec 파일이며 신규 파일 경로 생성이 없다(frontmatter 확인).

## 요약

target `plan/in-progress/spec-text-fixes.md` 는 stale 서술 제거 + 포인터 대체 + 무효 ID 참조
삭제로 구성된 문서 정정 작업이며, 어느 항목도 새 요구사항 ID·엔티티/타입명·API endpoint·
이벤트명·환경변수·설정키·spec 파일 경로를 신설하지 않는다. 신규 식별자 충돌 관점에서는
검토할 표면 자체가 없다.

## 위험도
NONE
