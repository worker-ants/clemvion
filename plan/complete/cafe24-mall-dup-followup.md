---
worktree: cafe24-mall-dup-followup-9b3c5a
started: 2026-05-16
owner: developer
---

# Cafe24 mall_id 중복 감지 UX — Quick bundle follow-up

PR #107 (`cafe24-mall-dup-ux-a7f2c8`) 의 ai-review RESOLUTION.md 에서 deferred 한
7건 중 작은 항목 4건을 하나의 PR 로 묶어 처리한다. 큰 리팩토링 (W9 / W11 / W19)
은 별도 worktree.

## 대상 항목

- **W20** — `buildFakeIntegration(overrides)` 테스트 factory 추출. 현재
  `integration-oauth.service.cafe24.spec.ts` 의 인라인 mock 객체 (것의 반복 선언)
  를 단일 helper 로 통일.
- **W21** — `cafe24/precheck` controller 의 `@ApiOperation.description` 에
  라우트 순서 주의 한 줄 추가 (Swagger 문서에 회귀 안전망).
- **W23** — `IntegrationsService.create` 의 트랜잭션 경계 확인. audit log
  기록과 `throwIfUniqueViolation` 발사 사이에 중간 부작용 커밋 위험이 있는지
  점검 후 필요 시 트랜잭션 적용 / 또는 의도 명시 주석.
- **INFO 6** — `page.tsx` 의 precheck debounce 에 `AbortController` 도입.
  현재 `cancelled` flag 로 효과 무시는 가능하나, backend 호출 자체는 완료된
  뒤 응답이 버려진다. AbortController 로 실제 요청을 cancel.

## 범위 외 (별도 PR)

- W9 — `useCafe24MallIdPrecheck` 커스텀 훅 추출 — page.tsx 전반의 훅 추출
  리팩토링과 함께 일괄 처리.
- W11 — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 — 다른 에러 코드도
  함께 동일 패턴 적용 시 일관성 보장.
- W19 — status 유니온 타입 중앙화 — `packages/integration-shared` 신설 검토와
  함께.

## consistency-check 생략 사유

- PR #107 에서 `spec/2-navigation/4-integration.md` §9.2/§9.4/Rationale 가 이미
  정합화 완료된 상태.
- 본 follow-up 은 spec 변경 없는 **순수 내부 코드 리팩토링·safety 보강**.
- RESOLUTION.md 의 deferred 명단에 명시된 항목으로 ai-review 가 이미 사전
  approval 한 변경.

## 진행 상태

- [x] W20 test factory (`buildFakeCafe24Integration`)
- [x] W21 Swagger note — 1차 추가 후 ai-review W3 피드백 (드리프트 위험) 에 따라
  description 에서 제거, 코드 주석 + e2e 테스트로 단일 진실 유지
- [x] W23 transaction check (분석 후 의도 주석 추가, 실제 트랜잭션 미적용)
- [x] INFO 6 AbortController (api client + page.tsx + 신규 abort 검증 테스트)
- [x] TEST WORKFLOW — backend 3731 / frontend 1425 / e2e 79 통과
- [x] AI-REVIEW — Critical 0, Warning 4 (모두 처리: W1/W2/W3/W4) + INFO 11 같이 처리
- [ ] PR
