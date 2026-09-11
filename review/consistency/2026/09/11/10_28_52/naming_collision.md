# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-prep: `impl-details-code-wiring`)

## 검토 배경

target 은 `spec/5-system/` 전체 번들이며, 현재 워크트리에 `spec/5-system/` 대상 미커밋 diff 는
없다(마지막 반영 커밋 `94e19be8d`). 이번 --impl-prep 은 `plan/in-progress/impl-details-code-wiring.md`
(A: `details[].code` 배선 13+2곳 · B: 주석 인용 정정 · C: `botToken` `@MinLength(1)` · D: 거부
메시지 5쌍 공유 상수화, `spec_impact: none`)의 착수 전 게이트다. 새 spec 식별자는 도입되지
않으므로, 검토는 (1) 이 plan 이 재사용을 선언한 기존 식별자가 실제로 기존 의미와 일치하는지,
(2) 같은 target 이 최근 두 차례(`09_03_56`, `09_29_33`) 겪은 라벨 충돌이 병합본에 잔존하는지를
확인하는 데 집중했다.

## 확인했으나 충돌 없음 (비대상 기록)

- **`INVALID_FIELD` 재사용 (plan A)** — plan 은 `triggers.service.ts` 13곳(`details: { field: … }`,
  `type`·`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`×4·
  `chatChannel`·`provider`·`authConfigId` — 실측 전수 확인, `grep -n "details: *{ *field"` 13건
  일치)와 `password.util.ts` 2곳에 `code: 'INVALID_FIELD'` 를 추가한다. 이 코드는
  `common/pipes/validation.pipe.ts:58`·`nodes/core/error-codes.ts:116`·
  `spec/5-system/3-error-handling.md:257,262,270`·`spec/5-system/2-api-convention.md:185,194,229`
  에 **이미 등재된 동일 의미의 generic 코드**다. 신규 식별자가 아니라 기존 식별자의 정합한
  재사용 — 충돌 없음.
- **§5.4.1.2 `chatChannel`/`provider` 사이트의 "code 없음" 서술과의 정합성** — 이전 라운드
  (`review/consistency/2026/09/11/09_03_56/naming_collision.md`)가 지적한 CRITICAL(§5.4.1.2 의
  "확정 설계 — code 를 싣지 않는다" 문장과 신규 §5.3 규칙의 충돌)은 이미 `94e19be8d` 에서
  해소되어 있다 — `spec/5-system/15-chat-channel.md:375,414,426` 이 "위 「code 없음」은
  **배선 전 관측값**이다 … 계약값은 `INVALID_FIELD` 다 … 배선 뒤에는 두 갈래 모두 `code` 를
  싣는다" 로 실측 시점과 계약값을 병기하도록 정정됐다. plan A 의 실측(13곳, `chatChannel`·
  `provider` 포함)이 이 문구가 예고한 "배선" 그 자체와 정확히 일치한다 — 재발 없음.
- **결정 라벨 `D-1`/`D-2`/`CV-*` 재점유** — 두 이전 라운드가 각각 CRITICAL(`D-1`/`D-2` 가
  `15-chat-channel.md:797-798` 의 기존 R-CC-21 하위 결정 라벨과 충돌)과 WARNING(`CV-*` 가
  `CCH-CV-0N`/`ED-CV-0N` 요구사항 ID 계열과 토큰을 공유)을 발견했다. 최종 커밋 메시지가
  "최종 `DEC-*` 는 `spec/`·`plan/in-progress/`·`.claude/` 전역 0건을 확인하고 골랐다" 고
  기록하며, 실측(`grep -rln "DEC-[0-9]" spec/ plan/in-progress/` 0건)으로 그 라벨이 spec 본문에
  전혀 삽입되지 않았음을 재확인 — 잔존 충돌 없음.
- **`R-CC-21` 및 인접 `R-CC-10..20`** — `spec/5-system/15-chat-channel.md` 의 `### R-CC-N.`
  헤딩을 전수 확인, 중복 번호 없음(14 는 의도적 결번, 과거 폐기 이력 명시). 새 결정 아님.
- **`TRIGGER_ENDPOINT_PATH_CONFLICT`** — `rethrowEndpointPathConflict`(`triggers.service.ts:1820`)
  가 쓰는 기존 도메인 코드이며 plan A 는 이 자리를 "선례, 도메인 코드 보유"로 명시적으로
  제외한다 — 충돌 없음.
- **엔티티/DTO/API endpoint/이벤트명/ENV var** — 이 plan 은 신규 타입·신규 엔드포인트·신규
  webhook/queue/SSE 이벤트·신규 환경변수를 전혀 도입하지 않는다(A: 기존 필드에 값 추가, B: 주석,
  C: 기존 필드에 데코레이터 추가, D: 기존 리터럴의 내부 상수화). 해당 관점은 전부 대상 없음(N/A).
- **파일 경로** — plan 은 신규 spec 파일을 만들지 않는다. D 항목이 신설할 backend 공유 상수
  모듈의 파일명은 아직 미정이나, `codebase/backend/src/modules/triggers/` 하위에 `*message*.ts`
  류 기존 파일이 없고(`find … -iname "*message*.ts"` 0건), 저장소 전역에도 `REJECTION_MESSAGE`/
  `VALIDATION_MESSAGE`/`ERROR_MESSAGES` 이름의 기존 export 가 없어(`grep` 0건) 이름 선택 시
  충돌 위험은 낮다.

## 요약

target(`spec/5-system/`) 은 이번 developer PR 관점에서 신규 요구사항 ID·엔티티·API·이벤트·
ENV var·spec 파일 경로를 하나도 새로 도입하지 않으며, plan 이 재사용하는 유일한 공유 식별자
(`INVALID_FIELD`)는 파이프·error-codes 카탈로그·API 규약 문서 세 곳과 정확히 같은 의미로
일치한다. 같은 target 영역이 바로 전 세션(`09_03_56`→`09_29_33`)에서 두 차례 겪은 결정 라벨
충돌(`D-1`/`D-2` 재점유 CRITICAL, `CV-*` WARNING)은 `94e19be8d` 병합본에서 `DEC-*` 채택과
실측 병기(관측값 vs 계약값)로 완전히 해소된 상태이며, 재발 흔적은 없다. 유일하게 미확정인 것은
D 항목(거부 메시지 5쌍 공유 상수)의 파일/식별자명이며, 현재 후보 이름공간(`triggers/` 모듈
내 message 상수)에 선점된 이름이 없어 CRITICAL/WARNING 수준의 위험은 없다.

## 위험도

NONE
