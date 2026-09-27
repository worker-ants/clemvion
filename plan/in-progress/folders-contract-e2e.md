---
title: "§5.4 스윕 2차 — 폴더 모듈: e2e 신설 · 계약 대조 · 루트 폴더 생성 응답에서 `parentId` 가 빠지는 이격 수정"
status: in-progress
owner: developer
worktree: folders-contract-e2e
spec_impact: none
started: 2026-09-27
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
- **그 선언 뒤에 실제 이격이 있다 — 루트 폴더의 POST 응답에 `parentId` 키가 없다.**
  - `create()` 는 `folderRepository.create({ ...data, workspaceId })` 로 만든다. 루트 폴더면 `data` 에 `parentId` 가 없다.
  - TypeORM 은 INSERT 뒤 `getInsertionReturningColumns()` — `default` · generated · create/update date · version 컬럼 — 만 되읽는다
    (`node_modules/typeorm/metadata/EntityMetadata.js`). `parent_id` 는 default 가 없는 nullable 컬럼이라 되읽지 않는다 → 저장된
    엔티티의 `parentId` 는 `undefined` 로 남고 JSON 에서 키가 빠진다. `sortOrder`(default 0)는 되읽힌다.
  - 같은 폴더를 `GET` 으로 읽으면 `parentId: null` 이다. **같은 리소스가 응답마다 부재 표현이 다르다**(POST 는 키 생략, GET 은
    `null`) — optional + nullable 선언이 그 둘을 모두 받아 줘서 드러나지 않았다.
  - (위는 소스 추론이다. e2e 가 POST 응답 키를 직접 단언해 실측으로 고정한다 — 아래 뮤턴트 M1.)
- spec `spec/2-navigation/1-workflow-list.md` §3.1 은 폴더 API 의 동작만 적고 응답 필드 부재 표현은 적지 않는다. 부재 표현의 SoT 는
  `spec/5-system/2-api-convention.md` §5.4(키 상시 존재 · 값 null)다 → 이 수정은 규약을 따르는 것이라 `spec_impact: none`.
- 프런트엔드: 폴더 **관리** UI 는 없고(spec §3.1) 목록 필터가 `GET /folders` 만 쓴다. POST 응답을 읽는 소비처가 없다.

## e2e 가 드러낸 두 번째 이격 — PATCH 응답에서 보내지 않은 필드가 빠진다 (2026-09-27)

첫 e2e 에서 C(이름 · 루트로 이동)가 `sortOrder [missing]` 으로 실패했다(`_test_logs/e2e-20260927-110251.log`, 1 failed / 417).

- 원인: `update()` 의 `Object.assign(folder, data)`. DTO 인스턴스는 값이 없는 optional 필드도 `undefined` own property 로 갖는다
  (`tsconfig.json` `target: ES2023` → `useDefineForClassFields` 기본 켜짐). 그 `undefined` 가 로드한 값을 덮어쓴다 — DB 는 TypeORM 이
  undefined 를 건너뛰어 무사하지만 응답에서 키가 사라진다.
- 선례: `triggers.service.ts` `update()` 가 2026-09-05 에 **같은 원인**(`PATCH /triggers/:id` 응답의 `name`)을 `defined` 필터로
  고쳤다. 폴더도 같은 관용구로 고친다 + 단위 회귀 테스트.
- 같은 형태가 남은 세 곳(`workflows` · `nodes` · `auth-configs` 의 `update()`)은 이 PR 의 축(폴더 모듈)이 아니라 트래커에 등재했다
  — 실측은 아직 없다.

## 방향

1. **서비스** — `create()` 가 `parentId: data.parentId ?? null` 을 명시해 저장한다. POST 응답에도 키가 늘 실린다(값 null).
   `update()` 는 `undefined` 필드를 걸러 `Object.assign` 한다(위 절).
2. **DTO** — `FolderDto.parentId` → `@ApiProperty({ type: String, format: 'uuid', nullable: true })` + `parentId: string | null`
   (§5.4 기본형. `type` 명시는 `string | null` 이 테스트 쪽 스키마에서 `type: object` 가 되는 것을 막는다 — #1412 실측).
3. **래칫** — `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에서 `folder-response.dto.ts:FolderDto.parentId` 1행 제거.
4. **e2e 신설** `folder-crud.e2e-spec.ts`(형제 `workflow-crud.e2e-spec.ts` 의 `<도메인>-<시나리오>` 명명) — 한 워크스페이스에서 루트 생성 → 하위 생성 → 목록 → 단건 → 수정(이름 · 루트로 이동) → 삭제.
   각 응답을 `FolderDto` 와 대조하고, **POST 루트 응답의 `parentId` 키가 있고 null 인지**를 양성으로 단언한다(대조는 required
   선언이 된 뒤에야 부재를 잡으므로, 선언 전 상태를 재현하는 뮤턴트로 그 단언이 실제로 무는지 본다).
5. **단위** — `folders.service.spec.ts` 의 루트 생성 케이스가 `create` 에 `parentId: null` 을 넘기는지. 선언 캐너리
   `folder-response.dto.spec.ts`(신규, DTO 옆 관례): `parentId` 가 required 이고 `{ type: 'string', format: 'uuid', nullable: true }`
   인지 — 래칫은 «optional + nullable» 로의 회귀만, e2e 대조는 선언이 넓어지는 회귀를 못 잡는다(#1413 과 같은 이유).
6. **CHANGELOG** — 항목 1(API 응답): 루트 폴더 생성 응답에 `parentId: null` 이 실린다(종전 키 생략) · OpenAPI 가 `parentId` 를
   항상 실리는 필드로 광고한다.
7. **트래커** — 스윕 2차 항목을 좁힌다(닫지 않음). 이미 닫힌 넷(`WorkflowVersion*Dto` · `NodeDto` · `EdgeDto`)도 함께 지운다.

## 뮤턴트 (예측 — 실측은 구현 뒤 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | 서비스 수정을 되돌림(`parentId: data.parentId ?? null` 제거) | e2e 루트 생성 케이스 RED(키 부재 — 양성 단언 · required 대조) · 단위 RED | |
| M2 | `FolderDto.parentId` 를 optional + nullable 로 되돌림 | 래칫 RED · 캐너리 RED | |
| M3 | `FolderDto.parentId` 의 `type: String` 제거 | 캐너리 RED | |
| M4 | `FolderDto.parentId` 를 `@ApiPropertyOptional({ format: 'uuid' })`(nullable 없이)로 | 캐너리 RED · 래칫 GREEN | |
| M5 | `update()` 의 `defined` 필터를 되돌림(`Object.assign(folder, data)`) | 단위 «undefined 로 덮지 않는다» RED · e2e C RED | |

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
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
