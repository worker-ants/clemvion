# 신규 식별자 충돌 검토 — `spec/2-navigation` (--impl-prep, rotate-lost-update)

## 배경 확인

이번 --impl-prep 검토의 실행 대상은 `plan/in-progress/rotate-lost-update.md` (developer, `spec_impact: none`)다. 이
plan 은 `IntegrationsService.rotate()` 의 lost-update 결함을 **코드 레벨** 처방(외부 호출은 락 밖, 락 안에서 재읽기 +
재머지, 부분 `update` 유지, 권한 재확인 한 줄 추가)으로 닫는다. `spec/2-navigation/4-integration.md` 를 포함해 어떤
spec 문서도 새로 쓰거나 고치지 않는다 — 계약(응답 코드·엔드포인트·필드)은 그대로다.

이 plan 은 애초 `INTEGRATION_ROTATE_CONFLICT` (409) 신규 에러 코드를 spec 에 추가하는 방향(§C, `plan/complete/spec-draft-rotate-conflict.md`)으로 시작했으나, `/consistency-check --spec` (`review/consistency/2026/09/20/16_43_05`, BLOCK: YES)이 그 방향을 반증해 **철회**했다. 그 세션의 `naming_collision.md` 는 `INTEGRATION_ROTATE_CONFLICT` 자체가 저장소 전체 grep 0건(진짜 신규 식별자였고 충돌 없음, LOW 판정)임을 이미 실측했다 — 그러나 그 식별자는 지금 폐기된 안에만 존재하고, 현재 진행 중인 코드 처방에는 등장하지 않는다. 아래는 **현재 plan(코드 전용)** 기준 재검토다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 이 plan 은 새 요구사항 ID 를 부여하지 않는다. `4-integration.md` frontmatter `id: integration` 은 불변.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스가 없다. plan 이 언급하는 `merged`, `baseCreds` 는 기존 `rotate()` 함수 내부의 지역 변수 이름이며 신규 공개 식별자가 아니다.
3. **API endpoint 충돌** — `POST /api/integrations/:id/rotate` 는 기존 endpoint(§9.2, §4.3)이고 method+path 변경 없음. 새 endpoint 도입 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트 신설 없음. `scope_changed` 는 plan §D 에서 언급되지만 이는 `spec/conventions/audit-actions.md`·`spec/2-navigation/4-integration.md:1145`·`spec/5-system/1-auth.md:423` 에 이미 존재하는 기존 audit action(`integration.scope_changed`)을 그대로 지시하는 것이지 새 이벤트명이 아니다 — 충돌 아님, 재사용 확인됨.
5. **환경변수·설정키 충돌** — 새 ENV var, config key 없음.
6. **파일 경로 충돌** — 새 spec 파일을 만들지 않는다. `spec/2-navigation/4-integration.md` 기존 경로 그대로.

같은 모듈의 선례로 인용하는 `CONC H-3`(`integration-oauth.service.ts` 재인증 콜백, 2026-05-16)은 코드 리뷰 주석 라벨이며 spec 식별자가 아니다 — grep 결과 이 plan 문서 자신과 `plan/complete/spec-draft-rotate-conflict.md`(같은 사건을 가리키는 동일 인용)에서만 나타나 다른 의미로 쓰인 곳은 없다.

## 발견사항

없음. 이번 plan 은 신규 spec 식별자를 하나도 도입하지 않으므로 6개 관점 전부에서 충돌 후보가 없다.

## 요약

`rotate-lost-update` plan 은 `spec_impact: none` 을 실제로 지키는 순수 코드 처방(락 안 재읽기·재머지, 부분 update, 권한 재확인)이며, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 어느 축으로도 새 식별자를 신설하지 않는다. 앞서 검토됐던 `INTEGRATION_ROTATE_CONFLICT` 신규 코드안은 이미 철회되어 이번 구현 스코프 밖이다. 신규 식별자 충돌 관점에서는 차단 사유가 없다.

## 위험도
NONE
