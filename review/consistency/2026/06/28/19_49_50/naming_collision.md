# 신규 식별자 충돌 검토 — webhook-spec-pointer-cleanup

## 발견사항

검토 대상 plan(`plan/in-progress/webhook-spec-pointer-cleanup.md`)이 도입하는 변경은 다음 네 가지다:

- **P-1**: `spec/5-system/2-api-convention.md §5.3` 에 CWE-209 단방향 포인터 추가
- **P-2**: `spec/7-channel-web-chat/4-security.md §4 + R3` 에 Guard trigger DB 조회 실패 fail-open 언급 추가
- **P-3**: `spec/5-system/1-auth.md Rationale 2.3.B (m-3)` 에 `extractClientIpFromHeaders` 함수명 명시 + `spec/5-system/12-webhook.md §7e·§8b` 에 역참조 링크 추가
- **P-4**: `spec/5-system/3-error-handling.md` 에 `## Overview` 절 추가

신규 식별자 충돌 관점에서 검토한 결과:

### 요구사항 ID

P-1~P-4 는 plan 내부 작업 레이블이며, 프로젝트 전체 plan 디렉토리에서 같은 기호(`P-1`~`P-4`)가 다른 plan 파일의 독립 식별자로 사용된 인스턴스는 없다(검색 결과 0건). 이 레이블은 plan 문서 local scope 이므로 전역 요구사항 ID 충돌이 아니다.

### 엔티티/타입명

`extractClientIpFromHeaders` 는 P-3 이 새로 도입하는 이름이 아니라 이미 `spec/5-system/1-auth.md Rationale 2.3.B m-3`(라인 662)과 `spec/5-system/12-webhook.md §7e·§8b`(라인 358·365)에 실제로 등장하는 기존 구현 함수명이다. P-3 이 하려는 것은 이 이름을 새로 등록하는 것이 아니라 기존 언급에 역참조 anchor 를 추가하는 것이다. 충돌 없음.

### API endpoint

신규 endpoint 없음.

### 이벤트/메시지명

신규 이벤트명 없음.

### 환경변수·설정키

신규 ENV var 또는 config key 없음.

### 파일 경로

네 가지 변경은 모두 기존 spec 파일(`1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, `12-webhook.md`, `4-security.md`) 내부 보강이다. 신규 파일 생성 없음.

### 추가 관찰 사항

- P-2 에서 언급하는 "Guard 의 trigger DB 조회 실패 시 fail-open + `error` 레벨 로깅" 은 `spec/5-system/12-webhook.md Rationale "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅"`(라인 433~439)에 이미 정의된 내용이다. P-2 는 이를 `4-security.md §4` 에 포인터로 반영하는 것이므로, 동일 개념이 두 위치에 기술될 때 의미가 달라질 위험은 없다. 단 포인터 추가 시 SoT(`12-webhook.md §6`)와 일치하는지 확인이 필요하나 이는 semantic 충돌이지 식별자 충돌이 아니다.

- P-4 의 `## Overview` 절 추가는 `3-error-handling.md` 에 이미 없는 절(`## Overview` 검색 결과 0건)을 신설하는 것이므로 충돌 없음.

## 요약

target plan 이 도입하는 변경은 전적으로 기존 spec 파일 내 포인터·역참조·누락 절 보강이다. 진정한 신규 식별자(요구사항 ID, 엔티티명, endpoint, 이벤트명, ENV key, 파일경로)가 신설되지 않으므로 식별자 충돌은 존재하지 않는다.

## 위험도

NONE
