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

## 가드를 둘까 — 판단: **두지 않는다**

트래커가 남긴 판단(«`Object.assign(<엔티티>, <DTO>)` 형태 금지 가드가 맞는지»). 고친 뒤 전수(`src/**/*.ts`, spec · 테스트 유틸
제외)에서 `Object.assign(` 의 두 번째 인자가 객체 리터럴도 `omitUndefined(…)` 도 아닌 자리는 **4곳**이고 넷 다 이 결함 형태가
아니다 — AI 에이전트 에코(`ai-turn-executor.ts`) · 실행 컨텍스트 변수(`execution-context.service.ts`) · 트리거의 이미 거른
`patch`(`triggers.service.ts`) · 스트립 사본(같은 파일).

- **정규식 가드**는 첫날부터 허용 목록 4개로 시작하고, 같은 결함의 다른 형태(`{ ...엔티티, ...dto }` spread · `repository.merge` ·
  필드 루프)는 못 본다. 결함은 문법이 아니라 «두 번째 인자가 DTO 인스턴스인가» 라는 **타입**의 문제다.
- **타입을 보는 가드**(AST + 타입 체커)는 표면이 넓다 — 정밀 파서로 옮겼다 철회한 선례(#970)가 있다. 이 결함 클래스가 다섯 자리를
  다 닫은 지금 그 비용을 치를 근거가 약하다.
- 대신 남기는 것: 헬퍼 JSDoc 이 두 증상(응답 · JSONB 저장값)을 적고, 세 도메인의 e2e 가 **값**을 단언한다. 새 PATCH 가 같은
  형태로 생기면 그 PATCH 의 e2e 가 보내지 않은 필드의 값을 단언해야 잡힌다 — 가드가 아니라 테스트 관행이다.
- 검토만 한 대안(이번에 처음 검토): `tsconfig` `useDefineForClassFields: false` 로 뿌리를 없앨 수 있다(optional 필드가 own property 가
  되지 않는다). 그러나 저장소의 모든 클래스 필드 의미가 바뀐다(엔티티 · 필드 이니셜라이저 · 데코레이터) — 이 PR 의 크기가 아니다.

## 뮤턴트 — 예측 / 실측

단위는 `jest` omit-undefined · workflows · nodes · auth-configs · folders · triggers 서비스(baseline 360 GREEN, `fd21691c9`). 타입 뮤턴트는
`tsc --noEmit -p tsconfig.json` 의 `omit-undefined` 오류 수(baseline 0) — build 단계 ratchet 이 보는 것과 같은 입력이다.
e2e 는 **네 자리를 모두 되돌린 상태 = 고치기 전 코드** 1회(위 §실측, `e2e-20260927-130629.log`)다. 케이스마다 한 자리만 부르므로
(A=`update()` rest, B=`settings` 병합, C=노드, D=인증 설정) 케이스별로 귀속된다.

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| P1 | 워크플로 `update()` 가 헬퍼를 거치지 않음(`Object.assign(workflow, rest)`) | 단위 RED · e2e A RED | 단위 KILLED 1 — workflows «보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다» · e2e A RED(응답 값) |
| P2 | 워크플로 `settings` 병합이 헬퍼를 거치지 않음(`...settings`) | 단위 RED · e2e B RED(GET) | 단위 KILLED 1 — workflows «빈 settings 는 저장된 설정 키를 지우지 않는다» · e2e B RED(**GET** — 저장값) |
| P3 | 노드 `update()` 가 헬퍼를 거치지 않음 | 단위 RED · e2e C RED | 단위 KILLED 1 — nodes «보내지 않은 필드(undefined)로…» · e2e C RED(응답 값) |
| P4 | 인증 설정 `update()` 가 헬퍼를 거치지 않음 | 단위 RED · e2e D RED | 단위 KILLED 1 — auth-configs «보내지 않은 필드(undefined)로…» · e2e D RED(응답 값) |
| T1 | 헬퍼 타입 제약에서 `NotArray` 제거(`obj: T`) | TS2578 1 | KILLED — `omit-undefined.spec.ts` «배열은 받지 않는다» 의 `@ts-expect-error` 가 TS2578 |

헬퍼 스펙의 «빈 객체 · 전 필드 undefined» 캐너리(INFO 10)는 표의 어느 뮤턴트도 단독으로 가르지 않는다 — 경계를 문서화하는 테스트다.

## `--impl-prep` 처분 (`review/consistency/2026/09/27/13_11_33` BLOCK: NO)

- **W4** (plan_coherence) 헬퍼의 `code:` 등재처를 묻는 트래커 planner 항목 (6)이 호출부 둘(폴더 · 트리거)을 전제하는데 이 PR 로
  다섯이 되고 그중 노드는 `spec/3-workflow-editor/1-node-common.md` 소관이다 → 트래커 (6)에 반영했다(plan 쓰기).
- **W2** (cross_spec) PATCH 의 «키 생략 = 값 불변» 이 `2-trigger-list.md` 에만 적혀 있고 `1-workflow-list.md` §3.2 · `6-config.md` 에는
  없다 → spec 쓰기라 같은 planner 항목에 **(7)** 로 보강했다. 이 PR 이 그 동작을 코드로 맞춘다.
- **W3** (rationale_continuity) `1-workflow-list.md` §2.3 «상태» 행이 이미 해소된 불일치를 진행 중으로 적는다 → 같은 항목 **(8)**.
- **W1** (cross_spec) `1-data-model.md` §2.2 가 Schedule 타임존 최종 fallback 을 AI 노드와 같은 체인으로 적는다(실제는 도메인
  전용 `'Asia/Seoul'`) → 이 PR 과 무관한 기존 drift. 트래커에 planner 항목을 새로 등재했다.
- INFO 1~3(폴더 API 응답 형태 · 에러 details · export DTO 명칭)은 기존 planner 항목 (1)~(3)과 같은 자리 · INFO 4 조치 불요 ·
  INFO 5(e2e 파일명이 결함 클래스 축) 는 파일 docblock 이 이유를 적는다.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/27/13_11_33` BLOCK: NO(W2 · W3 · W4 → 트래커, W1 → 새 planner 항목)
- [x] 서비스 셋 · e2e · 단위 · 헬퍼 손질 · CHANGELOG · 트래커
- [x] 뮤턴트 표 실측 — P1~P4 · T1 전부 KILLED
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
