# 신규 식별자 충돌 검토 — spec-draft-eia-r8-alignment

## 발견사항

없음.

target 문서(`plan/in-progress/spec-draft-eia-r8-alignment.md`)를 4개 변경 지점(변경 1~4) 전부
확인한 결과, **새로 도입되는 식별자가 하나도 없다**. 이 draft 는 성격상 신규 개념 도입이 아니라
**기존 서술의 정합화(wording fix)** — data-flow 문서가 SoT(`5-system/14 §R8`)와 반대로 요약한
자리를 SoT 에 맞춰 되돌리는 작업이다.

점검 관점별 확인 내역:

1. **요구사항 ID 충돌** — target 이 참조하는 `R8`·`EIA-RL-02`·`VALIDATION_ERROR` 는 전부
   `spec/5-system/14-external-interaction-api.md` 에 기존 정의된 ID 다(각각 L1053, L140, L322
   등에서 확인). 새 ID 를 부여하지 않는다 — 변경 4 는 기존 R8 **채택**/**근거** 문단에 문장을
   추가하는 것이지 R8a 같은 신규 항목을 만들지 않는다.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스명 도입 없음.
3. **API endpoint 충돌** — 새 endpoint 없음. 기존 `interaction:idempotency:<key>` 캐시 키
   (`spec/data-flow/15-external-interaction.md` L93/98/258)도 이름은 그대로 두고 캐시 대상
   범위 서술(어떤 status code 가 캐시되는가)만 고친다.
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트명 신규 도입 없음.
5. **환경변수·설정키 충돌** — 없음.
6. **파일 경로 충돌** — target 은 기존 파일 2개(`spec/data-flow/15-external-interaction.md`,
   `spec/5-system/14-external-interaction-api.md`)만 수정하며 새 spec 파일을 만들지 않는다.
   plan 파일명 `spec-draft-eia-r8-alignment.md` 도 `plan/in-progress/` 내 기존 30여개 파일과
   겹치지 않는다(같은 영역의 `spec-sync-external-interaction-api-gaps.md` 는 "구현 미완 항목
   추적" 트래커로 성격이 다르고 스코프도 겹치지 않는다 — 후자는 코드 gap, 전자는 문서 내부
   불일치 정정).

부가 확인: 변경 4 가 추가하는 "5xx 는 캐시하지 않는다" 문장은 두 spec 파일 어디에도 기존
"5xx" 서술이 없어(`grep -n "5xx"` 결과 0건) 새로 쓰는 내용이지만, 이는 **새 식별자가 아니라
기존 R8 규범의 명확화(닫힌 목록에 5xx 가 없음을 명시)** 이며 기존 서술과 상충하지 않는다.

## 요약

target 문서는 새 요구사항 ID·엔티티·API·이벤트·환경변수·파일을 전혀 도입하지 않는다.
모든 변경은 기존에 이미 정의된 식별자(§R8, `EIA-RL-02`, `VALIDATION_ERROR`,
`interaction:idempotency:<key>`)를 그대로 참조하면서 그 의미를 SoT 에 맞춰 재서술하는
정합화 작업이다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도
NONE
