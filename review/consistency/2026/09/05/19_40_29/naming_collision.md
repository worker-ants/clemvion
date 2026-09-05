# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-notification-secret-storage.md`

## 검토 방법

target 은 신규 spec 파일이 아니라 **planner 턴 계획 문서**이며, 4개 기존 spec 파일
(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`,
`spec/5-system/2-api-convention.md`, `spec/2-navigation/4-integration.md`) 에 대한
**정정·주석 추가**만 예고한다. 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV 변수·spec
파일 경로를 새로 만드는지 6개 관점 각각을 실제 저장소 상태와 대조했다.

## 발견사항

### 1. 요구사항 ID 충돌 — 없음
target 은 새 요구사항 ID(`ND-*`, `EIA-*` 류)를 전혀 발급하지 않는다. 다루는 대상은 이미
존재하는 컬럼(`notification_secret_v2`)과 이미 등재된 ref(`notification-signing.v2`)의
**사실 기술 정정**이다.

### 2. 엔티티/타입명 충돌 — 없음
`notificationSecretV2`, `chatChannelTokenV2`, `IntegrationDto` 모두 코드베이스에 이미 존재하는
필드/타입이며 target 은 새 이름을 만들지 않는다. 다만 참고로, EIA 문서에는 **이미 기존에
등재된** 이름 충돌 경고가 하나 있다 (target 이 만든 것이 아니라 기존 서술):

```
spec/5-system/14-external-interaction-api.md:950
"이 `v2` 는 secret rotation 의 `notification_secret_v2` 컬럼(§7.1)과 **무관**하다
— 이름만 겹친다"
```

이는 서명 스킴 버전(`v1=`/`v2=` 헤더 값)과 컬럼명 접미사 `_v2` 사이의 기존 네임스페이스
충돌이며, target 의 변경 범위(§7.1 문단 정정) 밖이라 target 이 새로 만들거나 악화시키는
충돌이 아니다. target 자체는 이 두 `v2` 를 다시 섞어 쓰지 않는다.

### 3. API endpoint 충돌 — 없음
target 은 신규 endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌 — 없음
target 범위 밖.

### 5. 환경변수·설정키 충돌 — 없음
target 이 언급하는 `secret://triggers/{triggerId}/notification-signing.v2` 는 신규 ref 가
아니라 이미 `spec/conventions/secret-store.md:36` 에 등재된 기존 ref 다. target 은 그 옆에
"현행 구현은 이 ref 를 아직 쓰지 않는다" 한 줄을 붙이는 것으로, §1 예외 목록(신규 등재)은
명시적으로 건드리지 않는다고 스스로 밝히고 있다 — 확인 결과 일치한다.

### 6. 파일 경로 충돌 — 없음
target 이 만드는 신규 spec 파일은 없다. `spec/5-system/2-api-convention.md` frontmatter
`code:` 목록에 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 를
추가하는 것이 유일한 "등재" 성격 변경인데, 실측 결과:

- 이 경로는 현재 `2-api-convention.md` frontmatter 에 **없다** (중복 아님).
- 동일 경로는 이미 `spec/conventions/swagger.md:9` frontmatter 에 등재돼 있고,
  `2-api-convention.md:231` 본문 §5.4 표에서는 텍스트로만 인용되고 있다 — 즉 target 은
  기존에 서로 다른 두 문서가 나눠 갖고 있던 "본문 인용 vs frontmatter 등재" 비대칭을
  `2-api-convention.md` 쪽에도 frontmatter 항목을 추가해 맞추는 것뿐이며, 새 식별자나
  새 경로를 만들지 않는다. 하나의 code 경로를 복수 spec 문서의 `code:` 에 나란히 등재하는
  패턴은 이미 이 저장소의 기존 관례이므로(§5.4 표에 두 검증자를 나란히 적는 것과 동일 결
  — 커밋 `21182db`) 이질적이지 않다.

### 참고 — `spec/2-navigation/4-integration.md` §9.1 포인터 추가
target 이 "신규 노출이 아니라 선언이 뒤늦게 정합된 것" 이라 주장하는 필드
(`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures`) 를
`spec/1-data-model.md §2.10` 에서 직접 확인했다 — 모두 이미 DB 컬럼(`mall_id` 등 snake_case)
으로 정의돼 있고, `4-integration.md` 본문 곳곳(L940/L1423/L1614 등)에서 camelCase 로 이미
실사용 중이다. DB snake_case ↔ API camelCase 대응은 이 저장소의 표준 관례와 일치하며
target 의 주장과 실측이 부합한다. 새 필드명이 아니라 기존 필드로의 **문서 포인터 추가**다.

## 요약
target 문서는 신규 spec 파일도, 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV var 도
도입하지 않는다. 모든 변경은 기존에 이미 존재하는 식별자(`notification_secret_v2` 컬럼,
`notification-signing.v2` ref, `IntegrationDto` 파생 필드, `swagger-dto-contract-guard.ts`
검증자)에 대한 사실 정정·상호 참조 추가에 그치며, 실측 결과 어느 항목도 기존 사용처와
의미가 충돌하지 않는다. EIA §950 에 이미 존재하는 "`v2` 접미사 이름 겹침" 경고는 target
범위 밖의 기존 이슈로, target 이 유발하거나 악화시키지 않는다.

## 위험도
NONE
