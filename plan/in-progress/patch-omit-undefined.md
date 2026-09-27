---
title: "PATCH 부분 본문 결함 — 남은 세 곳(워크플로 · 노드 · 인증 설정)을 omitUndefined 로 · 워크플로 settings 의 DB 키 소실"
status: in-progress
owner: developer
worktree: patch-omit-undefined
spec_impact: none
started: 2026-09-27
---

# PATCH 부분 본문 결함 — 남은 세 곳

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «`Object.assign(엔티티, DTO)` 가 보내지 않은 필드로 로드한
값을 덮는다 — 남은 세 곳» 을 닫는다. 폴더 PR(#1415)이 공용 헬퍼 `src/common/utils/omit-undefined.ts` 를 만들었다 — 남은 셋을 그
헬퍼로 고친다. 같은 항목이 헬퍼에 적어 둔 비차단 손질 셋(INFO 8 · 10 · 11)도 함께 닫는다.

## 전수 (2026-09-27, origin/main `b55e14f77`)

코드 형태(`Object.assign(`)가 아니라 **«PATCH 가 부분 본문을 로드한 엔티티에 합치는 곳»** 을 축으로 셌다 — PATCH 라우트 21개
(`@Patch(` 전수) → 각 라우트가 부르는 서비스 메서드 → 부분 본문 적용 방식.

- **통째 병합(결함 형태) — 셋**: `workflows.service.ts` `update()`(`const { settings, ...rest } = dto; Object.assign(workflow, rest)`) ·
  `nodes.service.ts` `update()`(`Object.assign(node, dto)`) · `auth-configs.service.ts` `update()`(`Object.assign(config, rest)`).
  트래커가 적은 셋과 같다.
- **필드별 `!== undefined` 가드(안전)**: alerts · knowledge-base · model-config · workflow-assistant session · workflow-test-datasets ·
  workspaces settings · notifications settings(키별 `!== undefined`) · schedules(`dto.name &&` · `!== undefined`).
- **`repository.update()` 뒤 재조회(안전 — `update` 는 undefined 를 건너뛴다)**: users · integrations.
- 이미 고친 둘: folders · triggers(`omitUndefined`).
- **넷째 표면 — 워크플로 `settings` 병합**: `workflow.settings = { ...(workflow.settings ?? {}), ...settings }`. `settings` 는 중첩 DTO
  (`@Type(() => WorkflowSettingsDto)`) 인스턴스라 보내지 않은 필드가 `undefined` own property 다. 필드는 `maxConcurrentExecutions`
  하나뿐이라 `settings: {}` 를 보내면 그 키가 `undefined` 로 덮인다.

## 실측 — 무수정 코드에서 e2e 프로브 (`_test_logs/e2e-20260927-130629.log`, 4 failed / 422)

신설 `test/patch-partial-body.e2e-spec.ts` 를 고치기 **전** 코드로 돌렸다. 각 케이스는 저장값(GET) → 응답 **값** → 응답 계약 순으로
단언한다 — 앞 단언이 통과하고 뒤에서 실패하면 그 앞까지는 확인된 것이다.

| 케이스 | 보낸 것 | 결과 |
|---|---|---|
| A 워크플로 | `{ name }` | GET 통과(저장값 무사) → 응답 `description: null` · `folderId: null`(**거짓 null**, 저장값 `'before'` · 폴더 UUID) · `isActive` · `tags` **키 없음** |
| B 워크플로 settings | `{ settings: {} }` (앞서 `maxConcurrentExecutions: 5`) | **GET 에서 실패** — 저장된 `settings` 가 `{}`. 응답만이 아니라 **DB 에서 키가 지워졌다** |
| C 노드 | `{ label }` | GET 통과 → 응답 `description: null` · `containerId: null`(거짓 null) · `positionX` · `positionY` · `isDisabled` · `config` 키 없음 |
| D 인증 설정 | `{ name }` | GET 통과 → 응답 `ipWhitelist: null`(거짓 null) · `isActive` 키 없음 |

- B 가 가장 나쁘다 — JSONB 직렬화가 `undefined` 값을 버리므로 병합 결과에서 키 자체가 사라진 채 저장된다. 코드 주석이 적은 의도
  («전체 교체 대신 병합 — DB 잔여 키를 보존한다»)를 스스로 어긴다.
- A · C · D 는 폴더 · 트리거와 같은 증상이다 — DB 는 무사하고 응답만 틀린다.
- **소비처**: 앱 화면은 셋 다 PATCH 뒤 목록을 다시 읽는다(`invalidateQueries`) — 워크플로 활성 토글(`workflows/page.tsx`) ·
  인증 설정 편집/토글(`authentication/page.tsx`). 노드 `updateNode` 는 API 클라이언트에 정의만 있고 호출처가 없다. 프런트엔드는
  워크플로 `settings` 를 PATCH 하지 않는다. → 틀린 응답을 받은 것은 **API 를 직접 부르는 클라이언트**다.
- 계약 대조로는 A · C · D 를 못 잡는다 — 이 필드들의 선언이 optional + nullable(§5.4 래칫 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 동결:
  `WorkflowDto.description` · `folderId`, `NodeDto.description` · `containerId` · `toolOwnerId`, `AuthConfigDto.ipWhitelist`)이라 키가
  빠져도, 거짓 null 이어도 통과한다. 그래서 프로브가 **값**을 단언한다. 선언 정정은 이 PR 의 축이 아니다 — 그 DTO 를 내는 다른
  경로(노드는 캔버스 저장 · 복원 등)마다 키 상시 존재를 e2e 로 보여야 하는 «§5.4 drift 배치» 몫이다.

## 방향

1. **서비스 셋** — `Object.assign(<엔티티>, omitUndefined(<부분 본문>))`. 워크플로는 `settings` 병합도
   `{ ...(workflow.settings ?? {}), ...omitUndefined(settings) }`. 주석은 자리 고유 사실만(이유는 헬퍼 JSDoc).
2. **e2e** — 위 프로브를 그대로 회귀 테스트로 둔다(`patch-partial-body.e2e-spec.ts`, 형제 명명 `<도메인>-<시나리오>` 대신 결함 클래스
   이름 — 세 도메인에 걸친다).
3. **단위** — 세 서비스 spec 에 «보내지 않은 필드로 로드한 값을 덮지 않는다» + 워크플로 «빈 settings 가 저장된 키를 지우지 않는다».
4. **헬퍼 손질**(트래커 항목이 함께 적은 비차단 셋):
   - (10) `omit-undefined.spec.ts` 에 빈 객체 · 전 필드 `undefined` 입력 캐너리.
   - (11) 타입 제약을 배열을 받지 않게 좁힌다(구현이 배열을 인덱스 키 객체로 무너뜨린다).
   - (8) `folders.service.spec.ts` 주석의 e2e 케이스 문자(«C · E») 인용 → 파일명.
5. **CHANGELOG** — 항목 1(API 응답): 세 PATCH 응답 정정 + 워크플로 `settings: {}` 가 저장된 설정을 지우던 결함.
6. **트래커** — 항목을 닫는다. 가드(`Object.assign(<엔티티>, <DTO>)` 형태 금지) 판단은 아래 절.

## 가드를 둘까 — 판단

(작성 예정 — 구현 뒤 전수 결과로 판단한다.)

## 뮤턴트 (예측 — 실측은 구현 뒤 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| P1 | 워크플로 `update()` 가 헬퍼를 거치지 않음 | 단위 RED · e2e A RED | |
| P2 | 워크플로 `settings` 병합이 헬퍼를 거치지 않음 | 단위 RED · e2e B RED(GET) | |
| P3 | 노드 `update()` 가 헬퍼를 거치지 않음 | 단위 RED · e2e C RED | |
| P4 | 인증 설정 `update()` 가 헬퍼를 거치지 않음 | 단위 RED · e2e D RED | |

## 체크리스트

- [ ] `--impl-prep`
- [ ] 서비스 셋 · e2e · 단위 · 헬퍼 손질 · CHANGELOG · 트래커
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
