---
worktree: (unstarted)
owner: developer
title: "JWT 서명 secret 하드코딩 fallback 제거 — 프로덕션 부팅 시 JWT_SECRET 강제"
status: superseded
started: 2026-06-02
spec_impact:
  - spec/5-system/1-auth.md
origin: ai-review (review/code/2026/06/02/23_09_02 WARNING-1) — refactor-cron-to-bullmq PR 에서 분리
---

> **✅ SUPERSEDED (2026-06-11)**: 본 항목(production 에서 `JWT_SECRET` 강제 부팅)은
> `prod-fail-closed-guards` PR(refactor 04 C-1)의 `assertProductionConfig` 가 구현했다 —
> production 에서 `JWT_SECRET` 미설정/sentinel/예시값 부팅 거부 + `ENCRYPTION_KEY`(M-4)·
> `MCP_ALLOW_INSECURE_URL`(M-7) 단일 가드 블록. `jwt.config.ts` 의 dev fallback 은 가드가
> production 에서 sentinel 을 거부하므로 보안 동등성을 유지하며 제거하지 않았다(정제 결정).
> 아래 본문은 당시 조사 기록으로 보존.

## 배경

`/ai-review` (cron→BullMQ 이관 PR) 의 security reviewer 가 `auth.module.ts` 의
JWT secret fallback 을 WARNING 으로 지적. 조사 결과:

- `auth.module.ts`: `secret: configService.get<string>('jwt.secret') ?? 'fallback'`
  → `?? 'fallback'` 은 **도달 불가능** (아래 config 가 항상 non-null 반환).
- `src/common/config/jwt.config.ts`: `secret: process.env.JWT_SECRET || 'dev-jwt-secret'`
  → 실제 기본 서명 키는 `'dev-jwt-secret'`. JWT_SECRET 미설정 시 이 값으로 토큰 서명 →
  공격자가 키를 알면 임의 JWT 위조 가능 (CWE-798/CWE-1188).

본 사안은 cron→BullMQ 이관과 **무관한 기존 인증 부팅 정책 문제**라 해당 PR 에서 분리.

## 해야 할 일 (별도 PR)

- [ ] `auth.module.ts` 의 dead `?? 'fallback'` 제거.
- [ ] 프로덕션 부팅 정책 결정: `NODE_ENV=production` 에서 `JWT_SECRET` 미설정 시
      `getOrThrow` / Joi schema 로 **부팅 실패**시킬지, dev/test 는 기본값 허용할지.
- [ ] dev/test/e2e 의 JWT_SECRET 주입 경로 점검 (현재 e2e 통과는 `'dev-jwt-secret'` 기본값에 의존).
- [ ] 동일 패턴의 다른 secret 기본값(redis password 등) 동반 점검 여부 판단.

## 메모

이건 보안 강화 + 부팅 동작 변경이라 단독 PR + 별도 리뷰가 적절. 결정 포인트(프로덕션 부팅
거부 여부)는 운영 영향이 있어 사용자/운영 합의 필요.
