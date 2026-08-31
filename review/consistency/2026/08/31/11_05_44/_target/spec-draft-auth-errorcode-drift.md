---
title: spec draft — `ACCOUNT_LOCKED` 상태 코드 정정 + `ALERT_RULE_NOT_FOUND` 카탈로그 등재
worktree: raw-update-guard-scope-0e154c
started: 2026-08-31
owner: project-planner
spec_impact:
  - spec/5-system/3-error-handling.md
---

# spec draft — 에러 카탈로그 불일치 2건

`#1247` 작업 중 `--spec`(`10_46_44`) cross_spec 이 인접해서 찾아 **범위 밖으로 등재**해 둔
두 건이다(`spec-sync-auth-gaps.md`). 둘 다 같은 문서(`3-error-handling.md`)라 한 턴에 묶는다.

---

## ① `ACCOUNT_LOCKED` — 카탈로그가 **423**, 구현은 **401**

### 실측

| 무엇 | 값 |
| --- | --- |
| `3-error-handling.md:48` | **423** |
| `data-flow/2-auth.md:70` (시퀀스) | **401** |
| `data-flow/2-auth.md:331` (상태 전이 표) | **401** (`UnauthorizedException`) |
| `auth.service.ts:302` | `throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', … })` → **401** |

`UnauthorizedException` 은 NestJS 에서 401 이다. **카탈로그 하나만 다르다.**

### 낡은 게 아니라 처음부터 틀렸다

"한때 423 이었다가 코드가 바뀐 것" 인지 확인했다:

- `git log -S "LockedException"` (backend auth) → **0건.** 이 저장소는 423을 던지는 예외를
  **한 번도 쓴 적이 없다.**
- 그 423 행은 최초 spec 초안 `05089d5a6`(제품 PRD·Spec 일괄 작성)부터 들어와 지금까지 남았다.

즉 **구현이 spec 을 따라간 적이 없는 게 아니라, spec 이 처음부터 구현과 달랐다.**

> 이 구분이 중요한 이유: "문서화됐는데 미구현" 이면 **폐기 이력을 확인**하고 되살릴지
> 판단해야 한다(이 저장소의 기록된 교훈). 여기서는 그 분기가 아니다 — 구현 의도가 423이었던
> 흔적이 전혀 없다.

### 처방

`3-error-handling.md:48` 의 `423` → `401`. 절 이동은 없다 — §1.2 는 401/403/423 을 담는
절이라 401 도 제자리다.

**423 으로 바꾸자는 대안은 기각한다.** 상태 코드 변경은 API 계약 변경이고 클라이언트가
분기할 수 있다. 이 draft 는 **문서를 구현에 맞추는 것**이지 동작을 바꾸지 않는다. 423 이
의미상 더 낫다는 주장은 별개 제품 결정이다.

---

## ② `ALERT_RULE_NOT_FOUND` — 중앙 카탈로그 미등재

### 실측

| 무엇 | 결과 |
| --- | --- |
| `3-error-handling.md` 안의 출현 | **0건** |
| `alerts.service.ts:49,66` | `throw new NotFoundException({ code: 'ALERT_RULE_NOT_FOUND', … })` → **404** |
| 현재 문서화 위치 | `2-navigation/9-user-profile.md` §6.3 (기능 spec) 뿐 |

### 처방

§1.3(유효성 검증 에러)에 404 로 등재한다 — 그 절이 `RESOURCE_NOT_FOUND`(404) ·
`MODEL_CONFIG_NOT_FOUND` 등 `*_NOT_FOUND` 계열의 자리다.

행 내용: 워크스페이스 스코프 안에서 규칙 id 를 못 찾을 때. `alerts.service.ts` 는
`where: { id, workspaceId }` 로 조회하므로 **타 워크스페이스 규칙 접근도 같은 404** 다
(존재 누설 방지 — `MODEL_CONFIG_NOT_FOUND` 의 cross-kind 차단과 같은 패턴).

기능 spec 쪽(`9-user-profile.md` §6.3)은 그대로 두고 **카탈로그를 SoT 로 추가**한다.

---

## Rationale

### 왜 두 건을 묶나

같은 문서(`3-error-handling.md`)의 같은 결함 클래스 — **카탈로그가 구현과 어긋남**이다.
한 건은 값이 틀렸고 한 건은 없다. 나눠 내면 같은 문서를 두 번 열고 같은 맥락을 두 번
세운다. (커밋은 주제별로 가른다.)

### 기각한 대안 — `ACCOUNT_LOCKED` 를 423 으로 구현 변경

상태 코드는 **API 계약**이다. 클라이언트가 401 로 분기해 재로그인 유도를 하고 있을 수 있고,
그 확인 없이 바꾸면 계약 회귀다. 문서가 틀렸다는 근거는 실측으로 확정됐으므로(위 표 +
`LockedException` 0건), **문서를 고치는 쪽이 위험이 없다.**
