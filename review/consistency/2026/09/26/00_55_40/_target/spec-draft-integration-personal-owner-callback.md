---
title: spec draft — OAuth 콜백의 커밋 직전 인가 재판정 서술 (Personal 통합 소유자 강제 보강 2)
status: in-progress
owner: planner
worktree: integration-personal-owner
spec_impact:
  - spec/data-flow/5-integration.md
  - spec/2-navigation/4-integration.md
  - spec/5-system/1-auth.md
started: 2026-09-26
---

# spec draft — OAuth 콜백의 커밋 직전 인가 재판정 서술

같은 PR 의 `plan/in-progress/spec-draft-integration-personal-owner.md`(반영 `f47069564`) · `-assistant.md`(반영 `1e7ee5123`)의 보강이다.
구현은 `/ai-review` 1라운드(`review/code/2026/09/25/22_45_37` WARNING 3)에서 OAuth 콜백이 자격 증명을 덮어쓰기 직전에 인가를 다시 보도록
바뀌었는데(`IntegrationOAuthService.assertRequesterStillAllowed`), 그 흐름을 서술하는 spec 두 곳이 모른다 — `--impl-done`
`review/consistency/2026/09/26/00_43_55` WARNING 1(cross_spec). 같은 검토 INFO 1(RBAC §3.2 의 «자기 것» 과 §8 «아직 강제되지 않는 것» 의
상호 참조 부재)도 함께 닫는다.

## 실측 — 재판정이 실패하면 무엇이 일어나나 (2026-09-26, 코드 기준)

- 판정: 사용자가 시작한 재인증 · scope 추가(`mode` = `reauthorize` · `request_scopes`)이고 행 status 가 `pending_install` 이 아니면, 행 락을
  잡은 트랜잭션 안에서 **요청자(`state.user_id`)에게 보이는가 → Organization 이면 요청자의 현재 역할이 Admin 이상인가** 를 본다. 역할은
  같은 트랜잭션 커넥션으로 읽는다.
- 실패: 트랜잭션이 롤백돼 자격 증명 · status 는 그대로다. 콜백의 공통 오류 수집(`markIntegrationCallbackError`)이 그 행의 `last_error` 에
  `RESOURCE_NOT_FOUND` · `ADMIN_REQUIRED` 를 기록한다(`connected` 행의 비-교환 실패와 같은 규칙 — status 보존).
- `pending_install` 행은 설치 흐름(App URL 의 install_token + HMAC 이 인가)이 만든 state 라 `user_id` 가 요청자가 아니라 생성자다 — 보지
  않는다.

## 변경안

### (1) `spec/data-flow/5-integration.md` §1.2 시퀀스 — 재인증 분기에 노트 한 줄

`Svc->>PG: SELECT integration FOR UPDATE (pessimistic_write — 동시 callback lost-update 차단)` 다음 줄에:

```text
      Note over Svc,PG: 커밋 직전 인가 재판정(pending_install 제외) — 요청자에게 보이는가,<br/>Organization 이면 요청자의 현재 역할이 Admin 이상인가(같은 트랜잭션 커넥션).<br/>실패하면 롤백 — 자격 증명 · status 불변
```

같은 절 다이어그램 아래 «callback 실패» 불릿 뒤에 불릿 하나:

```markdown
- 커밋 직전 인가 재판정이 실패하면(시작과 콜백 사이에 요청자가 강등됐거나 통합이 남의 personal 이 됨) 트랜잭션이 롤백되고, 같은
  오류 수집이 `last_error` 에 `RESOURCE_NOT_FOUND` · `ADMIN_REQUIRED` 를 기록한다 — status 보존. 판정 규칙은
  [navigation §8](../2-navigation/4-integration.md#8-권한-규칙).
```

### (2) `spec/2-navigation/4-integration.md` §10.4 에러 매핑 — 행 하나

`토큰 발급 후 row 조회 실패` 행 다음에:

```markdown
| 커밋 직전 인가 재판정 실패 (mode=`reauthorize` · `request_scopes`, status≠`pending_install` — 시작과 콜백 사이에 요청자가 강등됐거나 통합이 남의 personal 이 됨) | 거부 사유(`RESOURCE_NOT_FOUND` · `ADMIN_REQUIRED`) | 자격 증명 불변(롤백) · status 보존 · `last_error` 에 그 코드 기록. 판정은 [§8 판정 규칙](#8-권한-규칙) |
```

### (3) `spec/5-system/1-auth.md` §3.2 — 표 아래 상호 참조 한 줄

`> ※ **System Status**` 노트 앞에:

```markdown
> ※ **Integration (Personal) 의 «자기 것»**: «본인» 의 정의(`created_by`) · 남의 personal 을 없는 통합과 같이 다루는 규칙 · 아직
> 강제되지 않는 부분(Viewer 의 생성 · 수정 · 삭제, 노드 실행 시점)은 [통합 관리 §8](../2-navigation/4-integration.md#8-권한-규칙) 이
> SoT 다.
```

## Rationale

- **왜 코드는 그대로인가** — 이 draft 는 이미 구현된 동작의 서술이다. «요청자가 더는 볼 수 없는 행에 `last_error` 를 남기는 것이 맞는가»
  는 코드 판단이라 트래커(«통합 소유자 강제의 테스트 · 구조 잔여»)에 질문으로 등재한다 — 지금 동작은 `connected` 행의 다른 비-교환
  실패와 같은 규칙이다.
- **왜 §3.2 에 한 줄인가** — RBAC 표는 역할 × 리소스 요약이고 «자기 것» 의 세부 · 미강제 경계는 §8 이 가진다. 표를 쪼개지 않고 §8 을
  가리킨다(원 draft 의 Rationale «왜 §8 표를 고치지 않고…» 와 같은 이유).
