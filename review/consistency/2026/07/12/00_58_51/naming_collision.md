# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위에 대한 선행 확인 (중요)

본 세션의 `prompt_file` 이 지목한 target(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 전문)을 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/happy-tesla-906461`, branch `claude/kb-websocket-emit-typing-17bf14`)에서 `git diff origin/main -- spec/5-system/1-auth.md spec/5-system/10-graph-rag.md` 로 재확인한 결과 **diff 가 0 라인**이었다 — 두 파일은 `origin/main` 과 완전히 동일(byte-identical)하며, 둘 다 `status: implemented`(또는 `partial`)로 이미 병합·구현 완료된 기존 내용이다.

실제로 이 워킹트리가 `origin/main` 대비 갖는 diff 는 다음 셋뿐이다:

```
codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts   | 14 +++++++-------
codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts| 14 +++++++-------
codebase/backend/src/modules/websocket/websocket.service.ts                 |  4 ++
plan/in-progress/kb-websocket-emit-compile-guard.md                         | 54 ++++
```

이는 KB WebSocket emit 경로를 `event: string` → `event: KbEventType` 로 컴파일타임 강제하는 순수 타입 좁히기 리팩터다. `KbEventType` 은 `websocket.service.ts` 에 **이미 origin/main 시점부터 export 되어 있던 타입**이며(`git show origin/main:.../websocket.service.ts` 확인), 이번 diff 는 그 타입의 신규 선언이 아니라 두 소비처의 파라미터 타입을 `string`→기존 union 으로 좁히기만 한다. 즉 **이번 diff 는 신규 요구사항 ID·엔티티/타입명·endpoint·이벤트명·ENV 변수·spec 파일 경로 중 어느 것도 새로 도입하지 않는다.**

→ 결론: `prompt_file` 에 번들된 target 컨텐츠(1-auth.md, 10-graph-rag.md 전문)는 이번 브랜치의 실제 변경분과 무관한 **stale/mismatch 번들**로 판단된다(과거 다른 PR — 예: 이미 병합된 #919 그래프-RAG 정직화 — 검토 시점에 생성된 세션이 재사용됐을 가능성). 아래는 그럼에도 불구하고 (a) 실제 diff 자체에 대한 신규 식별자 충돌 판정과, (b) 번들된 target 문서 내용을 액면 그대로 놓고 기존 코퍼스(spec/1-data-model.md, spec/2-navigation/, spec/data-flow/, 실제 codebase)와 대조한 보조 점검 결과다.

---

## (a) 실제 diff (KB WebSocket emit 타입 강제) 판정

- 신규 식별자 없음. `KbEventType` 은 기존 export 재사용. `emitEvent` 시그니처 변경은 로컬 private 메서드 파라미터 타입일 뿐 신규 공개 API/이벤트명이 아니다.
- **위험도: NONE** (충돌 대상 자체가 존재하지 않음)

## (b) 번들 target(1-auth.md·10-graph-rag.md) 보조 점검 — 참고용, 이미 구현·병합된 내용

### 발견사항

- **[INFO]** graph-rag 데이터모델 명칭(spec) vs 실제 TypeORM 클래스명 불일치
  - target 신규 식별자(spec 표기): `spec/5-system/10-graph-rag.md` §2.3~2.5 및 `spec/1-data-model.md` §2.12.2~2.12.4 의 `Entity` / `Relation` / `ChunkEntity`
  - 기존 사용처: `codebase/backend/src/modules/knowledge-base/entities/entity.entity.ts` → `export class GraphEntity` (`@Entity('entity')`), `relation.entity.ts` → `export class GraphRelation` (`@Entity('relation')`), `chunk-entity.entity.ts` → `export class GraphChunkEntity` (`@Entity('chunk_entity')`)
  - 상세: 코드는 이미 `Graph` 접두사를 붙여 TypeORM 의 `@Entity()` 데코레이터·범용 "entity" 용어와의 충돌을 회피했다(정확히 본 체크리스트가 우려하는 유형의 충돌을 코드 레벨에서 이미 해소한 사례). 그런데 spec 문서(§2.3~2.5 표 제목, data-model §2.12.2~2.12.4)는 여전히 접두사 없는 `Entity`/`Relation`/`ChunkEntity` 로만 표기해 spec↔코드 명칭이 어긋난다. 이는 이번 diff 가 새로 만든 문제는 아니며(이미 `origin/main`에 존재), 신규 충돌도 아니다 — 다만 "TypeORM 환경에서 `Entity` 라는 이름을 bare 로 쓰는 것 자체가 향후 다른 도메인에서 실제 collision(예: 새 모듈이 `Entity` 라는 이름의 별도 개념 도입)을 유발할 수 있는 여지"라는 관점에서 참고용으로 남긴다.
  - 제안: (신규 작업 아님, 액션 불필요) 후속 spec 정리 시 §2.3~2.5 헤더를 `GraphEntity`/`GraphRelation`/`GraphChunkEntity` 로 코드와 정렬하면 spec↔코드 명명 일관성이 개선된다. 이번 diff 범위 밖이라 지금 처리할 필요는 없음.

- **[INFO]** `KB-GR-*` / `NF-GR-*` 요구사항 ID 네임스페이스 유일성 확인 — 충돌 없음
  - `spec/` 전체에서 `KB-GR-` / `NF-GR-` 접두사를 `spec/5-system/10-graph-rag.md` 외 다른 문서가 재사용하는 사례 없음(grep 확인). endpoint(`POST /knowledge-bases/:id/retry-failed`, `POST .../re-extract`, `GET /:id/graph/stats`)와 이벤트명(`document:graph_started/_progress/_completed/_retry/_failed`)도 `spec/2-navigation/5-knowledge-base.md`, `spec/data-flow/6-knowledge-base.md`, `spec/5-system/8-embedding-pipeline.md` 등 형제 문서와 정확히 동일한 의미로만 재참조되고 있어 충돌이 아니라 정당한 cross-reference다.
  - 감사 액션 `user.email_changed`, 에러코드 `REAUTH_NOT_AVAILABLE`/`VALIDATION_ERROR`/`RESOURCE_CONFLICT` 도 `spec/2-navigation/9-user-profile.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/2-auth.md` 전반에서 의도적으로 "동일 코드 재사용"임을 문서 스스로 명시(§1.1.B, §2.3, §4.1.A)하고 있어 의미 충돌 없음.

### 요약

이번 세션에 제공된 target 번들(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)은 현재 브랜치의 실제 diff(`origin/main` 대비)와 무관하다 — 두 파일 모두 `origin/main` 과 100% 동일한 기존 구현완료 문서다. 이 브랜치가 실제로 도입한 유일한 변경(KB WebSocket emit 경로의 `KbEventType` 컴파일타임 강제)은 이미 존재하던 타입을 재사용할 뿐 어떤 신규 요구사항 ID·엔티티/타입명·endpoint·이벤트명·ENV 변수·spec 파일 경로도 새로 도입하지 않아 신규 식별자 충돌 관점에서 점검할 대상이 없다. 번들된 target 문서 자체를 액면 그대로 놓고 보조 점검한 결과도 실질적 충돌은 없었고(요구사항 ID 네임스페이스·endpoint·이벤트명·에러코드 모두 기존 문서와 일관), 유일하게 눈에 띈 것은 이미 코드에서 `Graph` 접두사로 해소된 "Entity/Relation/ChunkEntity" spec↔코드 명명 불일치(사전 존재, 이번 작업과 무관)뿐이다. 오케스트레이터는 이 세션의 target/diff 스코프가 실제 변경분과 매칭되는지 재확인을 권장한다(과거 세션 재사용/stale 번들 가능성).

### 위험도

NONE
