---
worktree: spec-port-id-slug-drift
started: 2026-06-20
owner: project-planner
spec_area: spec/4-nodes
---

# spec draft — 동적 포트 ID 모델 명확화 (slug-regex 혼합 생성)

## 배경 + 방향 정정 (consistency-check --spec 16_23_44 + 코드 검증)

당초 "UUID v4 → slug 정정"으로 출발했으나, **코드 검증 결과 방향이 반대**임이 확인됨:

- `nodes/core/port-id.util.ts` 의 `resolveStablePortId` 는 id 를 **생성이 아니라 검증**한다 — slug-regex(`^[a-zA-Z0-9_-]{1,64}$`) 통과 시 그대로 포트 ID, 아니면 인덱스 fallback(`case_0`).
- **UUID v4 문자열은 그 slug-regex 를 통과**한다(hex+hyphen, ≤36자). frontend 는 동적 항목 id 를 `crypto.randomUUID()` 로 생성(`workflow-canvas`·`logic-configs`·`presentation-configs`·auto-form `widgets`). `ButtonDef.id` = UUID v4(`backfillButtonUuids`), `ConditionDef.id` = `z.string()`+UUID(docs `"uuid-1"`).
- 즉 **UUID v4 는 폐기된 게 아니라 condition·button 의 현행 생성 방식**(slug-regex 유효). 의미있는 slug 는 Switch case(사용자 입력, schema `^[a-zA-Z0-9_-]+$` 강제)·Filter 등.

⇒ **진짜 부정확한 서술은 `0-overview.md §1.3` 의 "(UUID v4 는 사용하지 않는다.)"** — 게다가 §1.3 은 "presentation button"을 slug 예시로 들면서 UUID 라 자기모순. 정정은 §1.3 을 **slug-regex 혼합 생성 모델**로 교정하고, 잔존 문서를 거기 일원화하는 것. (사용자 결정 2026-06-20: 코드 정합 방향 채택.)

## 변경안 (코드 정합)

| # | 파일 | 조치 |
|---|---|---|
| 1 | `4-nodes/0-overview.md §1.3`(line 123) | "(UUID v4 는 사용하지 않는다.)" **삭제** → 모델 교정: "동적 포트 ID 는 `^[a-zA-Z0-9_-]{1,64}$`(slug-regex) 만족 안정 문자열. **생성은 노드별** — Switch case·Filter 등은 사용자 입력 의미 slug(`approve`), AI Agent ConditionDef·Presentation ButtonDef 등은 frontend `crypto.randomUUID()` UUID v4(또한 slug-regex 통과). 형식 위반·부재 시 인덱스 fallback. 포트 ID 는 slug-regex 만족이면 생성 출처(slug/UUID)를 가리지 않는다. 검증·해석 SoT: `port-id.util.ts resolveStablePortId`." |
| 2 | `4-nodes/1-logic/0-common.md §7`(line 140) | "생성 시 UUID v4 를 할당" → "**slug-regex 만족 stable id** 를 포트 ID 로 사용 — Switch case 는 사용자 입력 의미 slug, AI Agent 조건 등은 `crypto.randomUUID()` UUID v4(slug-regex 통과). 편집에도 불변. SoT 노드 §1.3 / `port-id.util.ts`" |
| 3 | `3-workflow-editor/1-node-common.md §1.5`(line 97 표) | "UUID v4를 할당한다" → "slug-regex 유효 stable id 부여 — 에디터 기본 `crypto.randomUUID()`(UUID v4, slug-regex 통과), Switch case 등은 사용자 입력 의미 slug. SoT 노드 §1.3" |
| 4 | `3-ai/_product-overview.md ND-AG-20`(line 80) | "UUID v4로 할당" **유지** + "(slug-regex 유효 포트 ID — 노드 §1.3)" 명료화만 |
| 5 | `3-ai/1-ai-agent.md §2 ConditionDef.id`(line 79) | "UUID v4 할당" **유지** + "(UUID v4 는 slug-regex `^[a-zA-Z0-9_-]{1,64}$` 통과 유효 포트 ID — 노드 §1.3)" 명료화만 |
| 6 | `4-nodes/0-overview.md` | **`## Rationale` 신설** — 아래 Rationale 등재 |

**carousel.md:429("UUID v4 자동 할당")은 정상 — 무수정**(ButtonDef.id SoT `6-presentation/0-common.md §1` `String(UUID v4)`·§10.5 `backfillButtonUuids` 와 정합). (당초 변경안 #4 폐기 — 16_23_44 C4.)

## 제외 (포트 ID 아님)

- `3-ai/_product-overview.md ND-AG-17` "정제된 UUID" — LLM **도구명**(`cond_` 접두사). 포트 ID 아님.
- `1-logic/12-background.md meta.backgroundRunId`(UUID) — run 식별자.

## Rationale (`0-overview.md ## Rationale` 등재 내용)

### 동적 포트 ID 모델 — slug-regex, 혼합 생성

동적 포트 ID 는 `^[a-zA-Z0-9_-]{1,64}$`(slug-regex) 만족 안정 문자열이다. **검증·해석은 단일**(`port-id.util.ts resolveStablePortId` — 유효하면 그대로, 아니면 인덱스 fallback `case_0`), **생성 출처는 노드별**:

- **의미있는 slug** — Switch case·Filter: 사용자 편집 가능 의미 id(`approve`), schema 가 slug-regex 강제.
- **UUID v4** — AI Agent ConditionDef·Presentation ButtonDef: frontend `crypto.randomUUID()` 자동 발급. UUID v4 도 slug-regex 를 통과하므로 별도 모델이 아니라 같은 slug-id 공간의 한 생성 방식.

근거: (1) **엣지 보존** — id 가 config 항목과 1:1·불변이라 이름변경·재정렬·삭제 편집 후에도 연결 엣지 유지. (2) **통일 검증** — 생성 출처 무관 slug-regex 단일 게이트(주입·라우팅 키 인젝션 차단). (3) **직렬화 안정성** — 워크플로 JSON export/import·재로드 결정적.

**옛 서술 정정**: §1.3 의 "(UUID v4 는 사용하지 않는다)" 는 부정확 — UUID v4 는 condition·button 의 현행 생성 방식이며 slug-regex 유효. 본 정정으로 §1.3·§7·workflow-editor §1.5·ND-AG-20·ConditionDef·carousel 서술을 단일 모델로 일원화. (제외: ND-AG-17 도구명·`meta.backgroundRunId` — 포트 ID 아님.)

## 영향·side-effect

- 구현 변경 **없음**(코드가 이미 본 모델). 동반 코드/테스트 무관.
- cross-spec(16_23_44 C1~C4)·§1.3 자기모순 해소 — 모든 서술이 slug-regex 혼합 모델로 수렴.
- carousel.md 는 `spec-sync-carousel-gaps.md` 와 동일 파일이나 본 draft 는 carousel 무수정이라 hunk 경합 없음.
