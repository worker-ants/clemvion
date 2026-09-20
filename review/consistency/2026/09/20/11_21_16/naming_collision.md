# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 대상 요약

이번 `--impl-prep` 는 `plan/in-progress/schedule-cron-flake.md` 착수 전 검토다. 해당 plan 은
`spec_impact: none` 이며, 실제 변경 범위는 `codebase/backend/test/schedule-trigger.e2e-spec.ts`
의 "D. PATCH cron → nextRunAt 재계산" 케이스가 쓰는 **cron 리터럴 값**을 바꾸고 단언을 하나
추가하는 것뿐이다 (생성 cron 을 `0 10 * * *` → 같은 파일 E 케이스가 이미 쓰는 `0 0 1 1 *` 로,
PATCH 응답 `nextRunAt` 이 호출 시점부터 약 1분 안인지 확인하는 단언 추가). 서비스 코드
(`schedules.service.ts` 재계산 로직)는 비대상으로 명시되어 있다.

번들에 포함된 `spec/2-navigation/*.md` (workflow-list · trigger-list · schedule 등) 는 이 작업이
새로 도입하는 문서가 아니라 기존 spec 그대로다 — 새 요구사항 ID, 새 엔티티/DTO/인터페이스, 새
API endpoint, 새 이벤트/메시지명, 새 ENV var/설정키, 새 spec 파일 경로 중 어느 것도 이번 plan 이
신설하지 않는다.

## 발견사항

없음 — 이번 target 은 신규 식별자를 하나도 도입하지 않는다. 점검 관점별로 확인한 결과는 다음과
같다.

- **요구사항 ID 충돌**: 새 ID 부여 없음. plan 은 기존 트래커
  (`plan/in-progress/spec-draft-nullable-notation-followups.md`) 산하 항목의 실행일 뿐, `NAV-*` /
  `WH-*` / `R-*` 등 신규 ID 를 만들지 않는다.
- **엔티티/타입명 충돌**: 새 엔티티·DTO·인터페이스 없음. 변경은 e2e 테스트 파일 내부의 cron
  문자열 리터럴과 단언 한 줄이다.
- **API endpoint 충돌**: 없음. `PATCH /api/schedules/:id` 는 기존에 이미 `spec/2-navigation/3-schedule.md
  §4` 에 정의된 endpoint 이고 이번 작업은 그 API 자체를 바꾸지 않는다.
- **이벤트/메시지명 충돌**: 해당 없음.
- **환경변수·설정키 충돌**: 해당 없음.
- **파일 경로 충돌**: 새 spec 파일이나 새 소스 파일을 만들지 않는다 (`plan/in-progress/schedule-cron-flake.md`
  은 plan 문서이며 명명 컨벤션·경로 충돌 없음 — 기존 `plan/in-progress/` 디렉터리, 동일 slug
  파일 부재 확인함). 재사용하는 cron 값 `0 0 1 1 *` 도 새 식별자가 아니라 **같은 테스트 파일의
  기존 E 케이스가 이미 쓰는 값**을 재사용하는 것이라 "새 식별자" 범주에 들지 않는다 (값 재사용은
  오히려 의도된 것 — plan 본문 참고).

## 요약

이번 target 은 spec 변경이 없는(`spec_impact: none`) 순수 테스트 버그 수정이며, 요구사항
ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로 등 어떤 축으로도 새 식별자를
도입하지 않는다. 번들된 `spec/2-navigation/*.md` 는 기존 spec 그대로이고 이번 작업과 무관하게
변경되지 않는다. 신규 식별자 충돌 관점에서 우려할 사항이 없다.

## 위험도

NONE
