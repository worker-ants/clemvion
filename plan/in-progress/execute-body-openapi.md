---
title: "`POST /workflows/:id/execute` 본문을 OpenAPI 에 싣는다 — 계약은 건드리지 않고"
status: in-progress
worktree: execute-body-dto-c37965
started: 2026-08-22
owner: developer
spec_impact: none
---

# `execute()` 요청 본문 OpenAPI 문서화

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 마커 시리즈 이월 항목 중 **마지막 남은 1건**. 형제 `re-run` 은 `ReRunRequestDto` 가 있어
#1195 에서 마커 예약어 제약을 `description` 에 넣었는데, `execute` 는 **인라인 타입 +
`@ApiBody` 부재**라 넣을 자리가 없다. 두 경로는 같은 거부 규칙
(`resolveTriggerParametersRejectingMasked`)을 쓰므로 **문서만 비대칭**이다.

## 핵심 판단 — DTO 를 `@Body()` 타입으로 쓰면 계약이 바뀐다

트래커 문면은 *"`execute()` body 를 DTO 로 **올리거나** `@ApiBody` 를 다는 기회에"* 로 둘 다
열어 뒀다. **둘은 동등하지 않다** — 실측으로 갈렸다.

| | 지금 | `@Body() body?: ExecuteWorkflowDto` 로 바꾸면 |
| --- | --- | --- |
| ValidationPipe 진입 | **skip** — 인라인 객체 타입의 metatype 은 `Object` 이고 `CustomValidationPipe.toValidate()` 가 `Object` 를 제외 목록에 둔다 | 진입 |
| 여분 top-level 키 | 무시하고 통과 | **400 `VALIDATION_ERROR`** (`forbidNonWhitelisted: true`) |

즉 DTO 를 body 타입으로 올리는 순간 **외부 계약이 좁아진다**. 이 엔드포인트는 유저 가이드
(`02-nodes/triggers.mdx`)에도 실린 공개 API 라, 지금까지 여분 키를 함께 보내던 클라이언트가
있으면 깨진다.

**그래서 `@ApiBody({ type })` 만 단다** — DTO 클래스는 **OpenAPI 스키마 보유자**로만 쓰고
`@Body()` 파라미터의 인라인 타입은 그대로 둔다. 문서는 형제와 대칭이 되고 런타임은 한 줄도
안 바뀐다.

> **1st-party 는 이미 호환**이다(실측): `codebase/frontend/src/lib/api/workflows.ts:182` 가
> 정확히 `{ input, parameterValues }` 만 보낸다. 그럼에도 비파괴 쪽을 택하는 이유는 **깨질
> 수 있는 쪽이 우리가 못 세는 외부 클라이언트**이기 때문이다.

## 검증을 켜는 것은 별개 결정 — 트래커에 등재

*"여분 키를 400 으로 거부할 것인가"* 는 **의도적으로 이 PR 밖**이다. 그건 문서화가 아니라
**API 계약 강화**라 사용자 판단이 필요하다. 실측(1st-party 호환 · 공개 API 노출)과 함께
트래커에 신규 항목으로 등재한다.

## 작업

- [ ] `/consistency-check --impl-prep`
- [ ] `ExecuteWorkflowDto` 신설 (`@ApiPropertyOptional` 만, class-validator 데코레이터 없음)
- [ ] `@ApiBody({ type: ExecuteWorkflowDto })` 추가 — `@Body()` 인라인 타입은 유지
- [ ] 트래커 항목 종결 + "검증 켜기" 신규 등재
- [ ] TEST WORKFLOW 4단계 + 타입체크 ratchet
- [ ] `/ai-review`

## 검증 기준

- **동작 무변경 증명**: 여분 키를 실은 요청이 **여전히 통과**해야 한다. `@Body()` 타입을
  실수로 DTO 로 바꾸면 400 이 되므로, 그 실수를 잡는 **캐너리 테스트**를 함께 넣는다 —
  없으면 다음 사람이 *"타입을 맞춰 주자"* 며 조용히 계약을 좁힐 수 있다.
- **뮤테이션**: `@Body()` 를 `ExecuteWorkflowDto` 로 바꾸는 뮤턴트에서 그 캐너리가 **RED**
  여야 한다. GREEN 이면 캐너리가 아무것도 안 지키는 것이다.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
- 마커 예약어 문구는 `re-run.dto.ts` 와 **같은 사실**을 말하되 그 파일의 SoT 링크 방식을
  따른다(마커 리터럴을 다시 적지 않는다 — `egress-masking.md §3`).
