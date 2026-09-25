---
title: 경로 워크스페이스 가드 후속 — reflection 골격 · 403 설명 코드 보간 · 서비스 문구
status: in-progress
owner: developer
worktree: workspace-guard-followups
spec_impact: none
started: 2026-09-25
---

# 경로 워크스페이스 가드 후속

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «경로 워크스페이스 가드 후속 — reflection 골격 · 403 설명 코드
보간 · 서비스 문구» 를 닫는다. 출처: `#1399` 의 `/ai-review` 5라운드(`review/code/2026/09/25/18_19_47`)가 «수렴 예외»로 넘긴 W1 · W2 ·
INFO 4 · 6 · 8, 그리고 `--impl-done`(`review/consistency/2026/09/25/18_42_32`) naming_collision WARNING. **동작 결함은 없다** — 전부 동작
불변 정리이고 spec 변경은 없다(`spec_impact: none`).

## 요구

1. `common/decorators/workspace.decorator.ts` — `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 의 «메서드명 가드 →
   `ROUTE_ARGS_METADATA` 조회 → 팩토리 필터» 골격을 한 헬퍼로. 두 함수는 그 위에 `some` / `map` 만 얹는다.
2. `modules/workspaces/workspaces.controller.ts` — `FORBIDDEN_*_ROUTE` 설명 상수가 `common/constants/workspace-roles.ts` 의
   `NOT_A_MEMBER.code` · `ROLE_REQUIRED.*.code` 를 보간한다. `auth.controller.ts`(전환) · `executions.controller.ts`(재실행 · chain)의
   인라인 설명도 같은 코드를 보간하는지 본다.
3. `modules/workspaces/workspaces.service.ts` — `throwOwnerTransferRequired` 를 `{ ...ROLE_REQUIRED.owner, message }` 로, 서비스 고유
   문구를 unit 에서 고정.
4. 같은 파일 `transferOwnership` docstring 의 «두 멤버를 단일 IN 쿼리로 동시 락» 을 실제(순차 개별 락 · 워크스페이스 행 락이 직렬화)로.
5. `modules/integrations/integrations.service.ts` — 모듈 로컬 `ADMIN_ROLES` 를 공용 `common/constants/workspace-roles.ts` 로(값 같음).

## `--impl-prep` 경고 처리 (`review/consistency/2026/09/25/19_06_16` — BLOCK: NO, WARNING 1 · INFO 7)

- **W1**(요구 1 이 부트 캐너리의 «판별 함수를 그대로 호출» 불변식과 닿는다): `handlerConsumesWorkspaceId` · `workspaceParamNamesOf` 를
  top-level export 로 **그대로** 두고 내부만 공용 헬퍼를 부른다 — 캐너리의 import · 호출 대상은 바뀌지 않는다. 헬퍼 자체에 뮤턴트(팩토리
  비교 착오 · 메서드명 가드 제거 · 메타데이터 부재 처리)를 건다. 기존 «두 판별은 서로의 팩토리를 세지 않는다» 는 그대로 GREEN 이어야 한다.
- **INFO 2**(헬퍼 이름이 `extract*` 와 겹치지 않게): 조회 의미 이름으로.
- **INFO 3**(`workspace-roles.ts` docstring 이 «두 서비스» 로 적힘): 요구 5 로 세 번째 소비처가 생기므로 함께 고친다.
- **INFO 4**(`workspace-roles.ts` 가 `1-auth.md` `code:` 에 없다): spec 쓰기라 이 plan(`spec_impact: none`) 범위 밖 — 선택 사항이라 등재하지
  않는다. 가드(`spec-code-paths`)는 이미 통과한다.
- 나머지 INFO 는 확인 기록(`redis-keys` · `3-schedule` 연결 실측 일치 등).

## 체크리스트

- [x] `--impl-prep` — `19_06_16` BLOCK: NO, 처리 위
- [x] 테스트 선작성(요구 1 · 3 · 5 에 동작 고정이 없으면) → 구현 — 요구 1 · 5 는 기존 테스트가 동작을 고정한다(아래 뮤턴트로 확인).
      요구 3 의 서비스 고유 문구는 unit 에 새로 고정했다. 구현 `097411779`
- [x] 뮤턴트(새 헬퍼 · 보간) — 커밋 뒤 · cp 원복:

  | # | 뮤턴트 | 예측 | 실측 |
  | --- | --- | --- | --- |
  | H1 | 헬퍼의 팩토리 비교 무력화 | RED | RED 5 — «평범한 @Param 은 인식하지 않는다» 등 |
  | H2 | 헬퍼의 메서드명 가드 제거 | **등가(생존)** | 생존 — 빈 키로 조회해도 `undefined` → 빈 배열이라 관측 차이가 없다. 가드는 의도 표시로 둔다 |
  | H3 | 헬퍼의 메타데이터 부재 처리 제거 | RED | 처음 쓴 뮤턴트(`?? {}`)는 **원본과 등가인 무효 뮤턴트**였다 → 가드를 실제로 뺀 형태로 다시: RED 32 |
  | H4 | 헬퍼가 인자 대신 `extractWorkspaceId` 고정 | RED | RED 31 |
  | U1 | 이양 거부 문구를 가드 문구로 | RED | RED 3 |
  | I1 | 통합 `isAdmin` 이 역할 무시 | RED | RED 4 — 공용 `ADMIN_ROLES` 로 옮긴 뒤에도 통합 스펙이 판정을 지킨다 |

  요구 2(403 설명 보간)는 뮤턴트를 걸지 않았다 — 보간 결과 문자열이 종전 리터럴과 같아(코드 값 동일) OpenAPI 출력이 바뀌지 않고, 설명
  문자열을 단언하는 테스트도 없다. drift 를 구조로 막는 변경이다.
- [x] CHANGELOG 판정 — **항목 없음.** 기준 블록 «동작이 그대로인 리팩터» 에 해당한다: 응답 · 에러 코드 · OpenAPI 문자열이 바이트 단위로
      같고(보간 값 = 종전 리터럴), 가드 · CI 검사를 세우거나 조이지 않는다.
- [ ] TEST WORKFLOW — lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`(spec 연결: `1-auth` · `9-user-profile` · `3-schedule` · `2-navigation/4-integration` · `redis-keys`)
- [ ] 트래커 항목 닫기
