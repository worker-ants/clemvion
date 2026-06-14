# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
대상 문서: `spec/2-navigation/6-config.md`

---

## 검토 개요

이 브랜치(`config-call-history-929994`)에서 `spec/2-navigation/6-config.md` 는 main 대비 변경 없다(git diff 상 차이 없음). 따라서 target 문서가 이번 브랜치에서 **새로 도입하는 식별자는 없다**. `--impl-prep` 검토는 기존 spec 의 식별자가 코퍼스 내 다른 사용처와 충돌하는지 확인하는 역할로 수행한다.

---

## 발견사항

### 발견사항 1

**[INFO]** `totalCalls` 필드명이 두 도메인에서 동일하게 사용됨 (의미 동일, 경로 분리)

- target 신규 식별자: `totalCalls` — `spec/2-navigation/6-config.md §A.3`의 auth-config usage 응답 필드 (인증 설정에 연결된 트리거의 누적 실행 수)
- 기존 사용처: `spec/2-navigation/4-integration.md:815` — `GET /api/integrations/:id/activity` 응답 `summary.totalCalls` (Integration 활동 이력의 누적 호출 수)
- 상세: 두 `totalCalls` 는 서로 다른 API 경로·응답 객체에 속하며 의미도 "누적 호출 수"로 동일하다. 혼동 가능성은 낮으나, auth-config `/usage` 응답의 top-level shape 이 spec 에 아직 명시되지 않았다. Integration 쪽은 `{ items: ActivityItem[], summary: { totalCalls, successRate, dailyCounts[] } }` shape 이 명시된 반면, auth-config 쪽은 `totalCalls` / `recentCalls` 필드명이 spec prose 에만 언급되고 응답 JSON shape 이 정의되지 않아 구현 시 양쪽이 다른 shape 으로 구현될 위험이 있다.
- 제안: 구현 착수 전 `GET /api/auth-configs/:id/usage` 의 응답 shape 을 `spec/2-navigation/6-config.md §3 API` 표에 명시한다. Integration `/activity` shape `{ items, summary }` 와 유사하게 `{ summary: { totalCalls, lastUsedAt }, recentCalls: [...] }` 형태로 정의하면 일관성이 확보된다.

---

### 발견사항 2

**[INFO]** `recentCalls` 필드명이 spec prose 에만 언급되고 DTO·응답 shape 미정의

- target 신규 식별자: `recentCalls` — `spec/2-navigation/6-config.md §A.3` prose ("현재 `recentCalls` 는 `triggerName` / `status` / `startedAt` 만 반환")
- 기존 사용처: 해당 없음 (다른 spec 에서 `recentCalls` 라는 필드명은 사용되지 않음)
- 상세: `recentCalls` 는 `GET /api/auth-configs/:id/usage` 응답의 호출 이력 배열로 추정되나 spec API 표에 응답 shape 이 없다. 충돌은 없으나, 구현자가 Integration `ActivityItem` 과 다른 필드 집합(`triggerName`/`status`/`startedAt`)으로 별도 DTO 를 만들 때 네이밍이 불일치할 수 있다.
- 제안: `6-config.md §3 API` 의 `/usage` 행에 응답 shape 과 `recentCalls` 항목 필드 목록(`triggerName`, `status`, `startedAt`)을 명시한다.

---

### 발견사항 3

**[INFO]** `auth_config.reveal` audit action 명이 `data-flow/1-audit.md` 의 카탈로그에 미등재

- target 신규 식별자: `auth_config.reveal` — `spec/2-navigation/6-config.md §A.4 Reveal 흐름` (audit_log에 기록하는 action 문자열)
- 기존 사용처: `spec/data-flow/1-audit.md:55` — `auth_config.create` 가 audit action 으로 등재됨. `auth_config.reveal` 은 해당 표에 없음.
- 상세: 충돌은 아니지만 audit action 카탈로그에 `auth_config.reveal` 이 누락되어 있다. 구현 시 action 문자열이 spec 과 어긋나게 들어갈 수 있다.
- 제안: `spec/data-flow/1-audit.md` audit action 목록에 `auth_config.reveal` 을 추가하거나, `6-config.md §A.4` 에서 해당 카탈로그로 교차 참조를 추가한다.

---

## 요약

`spec/2-navigation/6-config.md` 는 이번 브랜치에서 새로 도입되는 식별자가 없으며 요구사항 ID(NAV-CA-*, NAV-CL-*), API endpoint (`/api/auth-configs`, `/api/model-configs`), 엔티티명(`AuthConfig`, `ModelConfig`) 모두 기존 코퍼스와 충돌하지 않는다. 다만 `GET /api/auth-configs/:id/usage` 응답 shape(`totalCalls`, `recentCalls`)이 spec 에 명시되지 않아 구현 시 Integration `/activity` shape 과 불일치가 발생할 수 있다는 일관성 보완 사항이 있다. 충돌을 유발하는 식별자 중복은 발견되지 않았다.

---

## 위험도

LOW
