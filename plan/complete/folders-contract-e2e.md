---
title: "§5.4 스윕 2차 — 폴더 모듈: e2e 신설 · 계약 대조 · PATCH 부분 본문 응답 결함 수정"
status: complete
owner: developer
worktree: folders-contract-e2e
spec_impact: none
started: 2026-09-27
completed: 2026-09-27
---

# §5.4 스윕 2차 — 폴더 모듈

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «§5.4 스윕 2차 — 엔드포인트인데 e2e 미도달인 DTO» 의
**폴더 모듈** 몫을 닫는다. 그 항목은 «새 e2e 시나리오가 선행이므로 모듈 단위로 끊는다» 고 적었다 — 이 PR 은 `FolderDto` 하나다.
항목 자체는 남은 모듈(대시보드 · 통계 · 지식 베이스)이 있어 **닫지 않고 좁힌다**.

## 실측 (2026-09-27, origin/main `5cad49294`)

- **후보 현황**: 항목의 후보 중 `WorkflowVersionDto` · `WorkflowVersionListItemDto`(#1413) · `NodeDto` · `EdgeDto`(#1411 의
  `CanvasSaveResultDto` 경유)는 이미 e2e 계약 대조에 닿았다. `DashboardSummaryDto` · `StatisticsSummaryDto` · `LlmUsageSummaryDto` ·
  `GraphEntityDto` · `FolderDto` · `DocumentDto` 는 `contractForDto(…)` 호출이 0건이다. 폴더 · 대시보드 · 통계는 e2e 스펙 자체가 없고
  지식 베이스만 있다(`knowledge-base.e2e-spec.ts`).
- **폴더 라우트 5개**(`folders.controller.ts`): `GET /folders`(배열) · `GET /folders/:id` · `POST /folders`(editor) ·
  `PATCH /folders/:id`(editor) · `DELETE /folders/:id`(editor, 204). 응답 DTO 는 전부 `FolderDto`. 서비스는 엔티티를 그대로 돌려주고
  관계를 싣지 않는다(`find` · `findOne` 에 `relations` 없음, `eager` 없음).
- **`FolderDto.parentId` 는 §5.4 금지 조합**(`@ApiPropertyOptional({ nullable: true })`) — `swagger-dto-contract.spec.ts` 래칫
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 동결돼 있다.
- ~~**그 선언 뒤에 실제 이격이 있다 — 루트 폴더의 POST 응답에 `parentId` 키가 없다.**~~ → **반증됨 (2026-09-27, e2e 뮤턴트 M1)**.
  - 착수 때의 추론: TypeORM 은 INSERT 뒤 `getInsertionReturningColumns()`(default · generated · date · version 컬럼)만 되읽으니,
    default 가 없는 `parent_id` 는 루트 폴더에서 `undefined` 로 남아 JSON 에서 키가 빠진다. 이것을 고치려고 `create()` 에
    `parentId: data.parentId ?? null` 을 넣고 e2e A 로 고정했다.
  - 실측: 그 한 줄을 뺀 뮤턴트에서 e2e 가 **PASS 417**(`_test_logs/e2e-20260927-112051.log`) — POST 루트 응답엔 원래
    `parentId: null` 이 실렸다.
  - 놓친 경로: 같은 저장 흐름의 `SubjectExecutor.updateSpecialColumnsInInsertedAndUpdatedEntities`(typeorm 0.3.31)가 INSERT · UPDATE
    뒤 **nullable 컬럼의 `undefined` 를 `null` 로 채운다**. 되읽기 목록만 보고 결론을 냈다.
  - 처분: 고칠 결함이 없던 `create()` 변경과 그것을 고정하던 단위 테스트를 되돌렸다(`bf56ee982`). 남은 사실은 **선언이 넓었다**는
    것뿐이다 — 키는 모든 응답에 실렸다. e2e A 는 그 형태를 고정하는 단언으로 남긴다(저장 경로가 바뀌어 채움을 잃으면 RED).
- spec `spec/2-navigation/1-workflow-list.md` §3.1 은 폴더 API 의 동작만 적고 응답 필드 부재 표현은 적지 않는다. 부재 표현의 SoT 는
  `spec/5-system/2-api-convention.md` §5.4(키 상시 존재 · 값 null)다 → 이 수정은 규약을 따르는 것이라 `spec_impact: none`.
- 프런트엔드: 폴더 **관리** UI 는 없고(spec §3.1) 목록 필터가 `GET /folders` 만 쓴다. POST · PATCH 응답을 읽는 소비처가 없다.

## e2e 가 드러낸 이격 — PATCH 응답에서 보내지 않은 필드가 틀린다 (2026-09-27)

첫 e2e 에서 C(이름 · 루트로 이동)가 `sortOrder [missing]` 으로 실패했다(`_test_logs/e2e-20260927-110251.log`, 1 failed / 417).

- 원인: `update()` 의 `Object.assign(folder, data)`. DTO 인스턴스는 값이 없는 optional 필드도 `undefined` own property 로 갖는다
  (`tsconfig.json` `target: ES2023` → `useDefineForClassFields` 기본 켜짐). 그 `undefined` 가 로드한 값을 덮어쓴다.
- 증상은 둘이다 — 위 반증 절의 null 채움이 UPDATE 뒤에도 돌기 때문이다.
  - nullable 이 아닌 컬럼은 **키가 사라진다**(`sortOrder`).
  - nullable 컬럼은 **거짓 null** 이 실린다 — 하위 폴더의 이름만 바꿔도 `parentId: null`. 이것은 추론이 아니라 실측이다: e2e E
    (하위 폴더 · `sortOrder: 2` · 이름만 PATCH)를 더하고 옛 코드(뮤턴트 M5)로 돌려 응답
    `{ parentId: null, sortOrder: undefined }`를 받았다(`_test_logs/e2e-20260927-113056.log`, C · E 2 failed / 418).
- DB 는 무사했다 — E 가 GET 단언을 응답 단언보다 앞에 두도록 고친 뒤 M5 를 다시 돌렸다(`_test_logs/e2e-20260927-113844.log`, C · E 2 failed / 418).
  E 는 GET 단언(`parentId` = 부모 UUID · `sortOrder` = 2)을 통과하고 **그 뒤의** 응답 단언(`toStrictEqual`)에서 실패했다 — 옛 코드에서도 저장된
  값은 맞았고 틀린 것은 응답뿐이다.
- 선례: `triggers.service.ts` `update()` 가 2026-09-05 에 **같은 원인**(`PATCH /triggers/:id` 응답의 `name`)을 `defined` 필터로
  고쳤다. 폴더도 같은 관용구로 고친다 + 단위 회귀 테스트.
- 같은 형태가 남은 세 곳(`workflows` · `nodes` · `auth-configs` 의 `update()`)은 이 PR 의 축(폴더 모듈)이 아니라 트래커에 등재했다
  — 실측은 아직 없다.

## 방향

1. **서비스** — `update()` 가 `undefined` 필드를 걸러 `Object.assign` 한다(위 절). 필터는 `/ai-review` 1R W1 에 따라 공용 헬퍼
   `src/common/utils/omit-undefined.ts` 로 올렸고 트리거 `update()` 의 같은 사본도 그 헬퍼로 바꿨다(아래 리뷰 절). ~~`create()` 가 `parentId: data.parentId ?? null`
   을 명시해 저장한다~~ — 전제가 반증돼 되돌렸다(위 실측 절).
2. **DTO** — `FolderDto.parentId` → `@ApiProperty({ type: String, format: 'uuid', nullable: true })` + `parentId: string | null`
   (§5.4 기본형. `type` 명시는 `string | null` 이 테스트 쪽 스키마에서 `type: object` 가 되는 것을 막는다 — #1412 실측).
3. **래칫** — `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 `folder-response.dto.ts:FolderDto.parentId` 1행 제거.
4. **e2e 신설** `folder-crud.e2e-spec.ts`(형제 `workflow-crud.e2e-spec.ts` 의 `<도메인>-<시나리오>` 명명) — 한 워크스페이스에서 루트 생성 → 하위 생성 → 목록 → 단건 → 수정(이름 · 루트로 이동) → 삭제.
   각 응답을 `FolderDto` 와 대조하고, POST 루트 응답의 `parentId: null` 을 양성으로 단언한다(A — 원래 맞던 형태의 고정).
   E: 하위 폴더의 이름만 PATCH → 저장된 값(GET)을 먼저, 응답의 `parentId` · `sortOrder` 를 다음에 단언한다.
5. **단위** — `folders.service.spec.ts` 의 `update()` 가 `undefined` 필드(`parentId` · `sortOrder`)로 로드한 값을 덮지 않는지. 선언 캐너리
   `folder-response.dto.spec.ts`(신규, DTO 옆 관례): `parentId` 가 required 이고 `{ type: 'string', format: 'uuid', nullable: true }`
   인지 — 래칫은 «optional + nullable» 로의 회귀만, e2e 대조는 선언이 넓어지는 회귀를 못 잡는다(#1413 과 같은 이유).
6. **CHANGELOG** — 항목 1(API 응답): PATCH 부분 본문 응답이 보내지 않은 필드를 빠뜨리거나 거짓 null 로 싣지 않는다 · OpenAPI 가
   `parentId` 를 항상 실리는 필드로 광고한다(응답은 원래 키를 실었다).
7. **트래커** — 스윕 2차 항목을 좁힌다(닫지 않음). 이미 닫힌 넷(`WorkflowVersion*Dto` · `NodeDto` · `EdgeDto`)도 함께 지운다.

## 뮤턴트 — 예측 / 실측

단위는 `jest src/modules/folders src/repo-guards`(baseline 336 전부 GREEN, `ad844a779`). 제자리 치환 → 실행 → `shutil.copy` 복원.

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| M1 | `create()` 의 `parentId: data.parentId ?? null` 제거 | e2e A RED(키 부재) · 단위 RED | 단위 KILLED(되돌린 테스트 «루트 폴더는 parentId 를 null 로 명시해 만든다» 하나) · **e2e SURVIVED — PASS 417**(`e2e-20260927-112051.log`). **전제 반증** → 변경을 되돌려 이 행은 더 이상 뮤턴트가 아니다 |
| M2 | `FolderDto.parentId` 를 optional + nullable 로 되돌림 | 래칫 RED · 캐너리 RED | KILLED 2 — 캐너리 · `swagger-dto-contract` «§5.4 금지 조합 래칫» |
| M3 | `FolderDto.parentId` 의 `type: String` 제거 | 캐너리 RED | KILLED 1 — 캐너리 |
| M4 | `FolderDto.parentId` 를 `@ApiPropertyOptional({ format: 'uuid' })`(nullable 없이)로 | 캐너리 RED · 래칫 GREEN | KILLED 2 — 캐너리 · `swagger-dto-contract` «OpenAPI 선언과 TS 타입이 어긋난 필드가 없다»(래칫은 예측대로 GREEN, 같은 파일의 다른 테스트가 죽였다 — 예측이 못 본 그물) |
| M5 | `update()` 의 `defined` 필터를 되돌림(`Object.assign(folder, data)`) — 헬퍼 추출 전 형태 | 단위 RED · e2e C RED · (E 추가 뒤) e2e E RED — `parentId` null | 단위 KILLED 1 — «보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다» · e2e C · E RED(`e2e-20260927-113056.log`, E 응답 `{ parentId: null, sortOrder: undefined }`) · 재실행(`e2e-20260927-113844.log`)에서 E 가 GET 단언을 통과한 뒤 응답 단언에서 실패 — DB 무사 실측 |

헬퍼 추출(`692f1e8fd`) 뒤 단위 뮤턴트 — `jest src/common/utils/omit-undefined src/modules/folders src/modules/triggers`(baseline 389 GREEN):

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| H1 | 헬퍼 필터를 `v != null` 로(null 까지 거름) | 헬퍼 스펙 RED · 폴더 «루트로 이동» RED | KILLED 2 — 헬퍼 «falsy 값은 남긴다» · 폴더 «allows moving to root»(리뷰 INFO 8 로 `toBeNull()` 을 단언하게 한 테스트) |
| H2 | 헬퍼가 입력을 그대로 돌려줌 | 헬퍼 스펙 RED · 폴더 · 트리거 부분 PATCH 테스트 RED | KILLED 5 — 헬퍼 셋 · 폴더 «보내지 않은 필드로 덮지 않는다» · 트리거 «PATCH 에서 생략된 필드는 로드된 값을 유지한다» |
| H3 | 폴더가 헬퍼를 거치지 않음(`Object.assign(folder, data)`) | 폴더 단위 RED | KILLED 1 — 폴더 «보내지 않은 필드로 덮지 않는다» |
| H4 | 트리거가 헬퍼를 거치지 않음(`const defined = rest`) | 트리거 단위 RED | KILLED 1 — 트리거 «PATCH 에서 생략된 필드는 로드된 값을 유지한다» |

폴더 «빈 본문이면 로드한 값을 그대로 저장한다»(리뷰 INFO 9)는 위 어느 뮤턴트도 **단독으로 가르지 않는다** — 경계를 문서화하는
테스트이지 회귀 그물이 아니다.

## `/ai-review` 1R (`review/code/2026/09/27/11_53_51` — Critical 0 · Warning 2)

- **W1** (maintainability) 필터 관용구 + 장문 근거가 트리거 → 폴더로 통째 복제, 트래커가 세 곳을 더 예고 → `omitUndefined` 헬퍼로
  추출하고 근거를 JSDoc 한 곳에 모았다. 두 호출부는 헬퍼 한 줄 + 자리 고유 사실만(`692f1e8fd`). 정보 추출기
  (`information-extractor.handler.ts`)의 로컬 `defined()` 는 같은 모양이지만 목적이 다르다(스냅샷 정리, PATCH 병합 아님) — 건드리지 않았다.
- **W2** (documentation) 트래커가 아직 옮기지 않은 `plan/complete/folders-contract-e2e.md` 를 인용 → 이 PR 의 마무리 커밋이
  `git mv` 로 그 경로를 만든다. push 전 `git show HEAD:plan/complete/folders-contract-e2e.md` 로 확인한다.
- INFO 8 · 9 → 단위 테스트 강화 · 추가(위). INFO 7(서비스 주석의 e2e 케이스 문자 인용) → 헬퍼 추출로 주석을 줄이며 파일명만 남겼다.
  INFO 1 · 2 · 3 · 4 · 5 · 6 — 조치 불요(1 은 후속 세 곳 착수 때 트래커 항목이 본다 · 2 · 3 은 기존 추적 · 4 는 선언 정정 ·
  5 는 관례 · 6 은 형제 유틸 스펙 `with-timeout.spec.ts` 처럼 저장소의 신규 테스트가 한국어 서술을 쓴다 — 이 파일에 한국어
  이름이 처음 들어간 것은 맞다).

## `--impl-done` 처분 (`review/consistency/2026/09/27/12_27_18` BLOCK: NO — scope `spec/2-navigation/`)

`triggers.service.ts` 는 `spec/5-system/12-webhook.md` 도 `code:` 에 두므로 Read 블록에 그 문서를 함께 실었다(동작 불변 리팩터라는 설명과).

- **W1** (plan_coherence) 신설 헬퍼 `omit-undefined.ts` 가 어느 spec 의 `code:` 에도 없다 → spec 쓰기라 트래커의 `1-workflow-list.md`
  §3.1 planner 항목에 **(6)** 으로 보강했다. 둘 곳(두 도메인 spec 양쪽 vs §5.4 를 가진 `2-api-convention.md`)은 planner 가 정한다.
- **W2** (naming_collision) `omitUndefined` 와 `triggers.service.ts` 의 모듈-로컬 `omitKeys` 가 `omit*` 접두를 공유한다(입력 정제 vs
  출력 redaction) → 조치 불요. `omitKeys` 는 제거할 키 목록을 인자로 받아 서명부터 달라 서로 바꿔 쓸 여지가 낮고, 상호 참조
  주석은 codebase 수정이라 수렴한 리뷰 라운드를 다시 연다(비강제 권고).
- INFO 1(`GET /folders` bare array 가 §5.2 비-페이징 예외에 명시 안 됨)은 트래커 planner 항목 (1)이 이미 같은 자리(§3.1 목록 응답
  형태)를 본다. INFO 2~4 조치 불요.

## `--impl-prep` 처분 (`review/consistency/2026/09/27/10_39_26` BLOCK: NO)

- **W1** `spec/5-system/1-auth.md` §3.2 권한 매트릭스에 Folder 행이 없다 · **W2** 신설 e2e 를 `1-workflow-list.md` frontmatter
  `code:` 에 올리지 않는다 · **W3** 같은 §3.1 을 겨냥한 기존 planner 항목(목록 응답 형태 · 완료된 `pending_plans`)을 인지하지
  않았다. 셋 다 spec 쓰기라 developer 가 고칠 수 없다 → W3 의 그 **기존 항목에 (4)(5)로 W1 · W2 를 보강**했다(새 항목을 만들지
  않는다). 그 항목의 편집 대상 `1-workflow-list.md` 가 트래커 `spec_impact` 에 빠져 있어 함께 올렸다.
- **INFO 4** 스윕 후보 목록의 이미 닫힌 넷 → 트래커에서 함께 지웠다. **INFO 5** 파일명 → `folder-crud.e2e-spec.ts` 로 형제 관례에 맞췄다.
- **INFO 2** 서비스가 `FolderDto` 대신 엔티티를 그대로 돌려준다 — 지금은 관계를 싣지 않아 유출이 없고, 이 PR 의 e2e 대조가 응답
  키를 고정한다. 매핑 도입은 이 PR 의 축이 아니다. INFO 1 · 3 · 6 — 조치 불요(기존 추적 · 무관).

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/27/10_39_26` BLOCK: NO(W1~W3 는 spec 쓰기 — 기존 planner 항목 보강)
- [x] 서비스 · DTO · 래칫 · e2e · 단위 · 캐너리 · CHANGELOG · 트래커
- [x] 뮤턴트 표 실측 — M1 e2e 생존으로 POST 전제 반증 · `create()` 변경 되돌림
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS, e2e 418. 마지막은 헬퍼 추출 뒤 `55aaf0e1e`(`_test_logs/e2e-20260927-121245.log`) — 그 뒤 codebase 수정 0
- [x] `/ai-review` — 1R `review/code/2026/09/27/11_53_51`(Critical 0 · Warning 2 → 헬퍼 추출 · 마무리 커밋) · 2R `review/code/2026/09/27/12_17_57`(Critical 0 · Warning 1 = 1R W2 동일, codebase 수정 0 — 수렴)
- [x] `--impl-done` — `review/consistency/2026/09/27/12_27_18` BLOCK: NO(W1 → 트래커 planner 항목 (6) · W2 조치 불요)
