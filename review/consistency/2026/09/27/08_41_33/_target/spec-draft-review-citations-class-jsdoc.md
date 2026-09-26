---
title: "review-citations §3 — 응답 DTO 의 필드 JSDoc 과 클래스 JSDoc 을 가르고, 둘 다 리뷰 인용을 쓰지 않는다고 적는다"
status: in-progress
owner: planner
worktree: dto-class-jsdoc-citation
spec_impact:
  - spec/conventions/review-citations.md
started: 2026-09-27
---

# review-citations §3 — 클래스 JSDoc 을 필드 JSDoc 과 가른다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «`Ref` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다»
가 선행 질문으로 남긴 것을 정한다: *"클래스 JSDoc 도 대상인가를 `review-citations.md §3` 표가 명시하지 않는다 — 고치기 전에 그
문장부터 갈라야 같은 질문이 또 안 생긴다(planner 몫)."*

## 실측 (2026-09-27, origin/main `1824594c6` 빌드 산출물 `codebase/backend/dist`)

- §3 표의 DTO 행 근거는 *"그 JSDoc 은 공개 OpenAPI `description` 으로 나간다"* 다. 이 문장은 **필드에는 맞고 클래스에는 맞지 않는다**.
  - 필드 JSDoc: swagger CLI 플러그인(`nest-cli.json` `introspectComments: true`)이 클래스마다 `_OPENAPI_METADATA_FACTORY` 를 만들고,
    그 안에 **프로퍼티별** `description` 으로 JSDoc 을 싣는다. `TriggerWorkflowRefDto.id` 의 «워크플로우 UUID» 가
    `dist/modules/triggers/dto/responses/trigger-response.dto.js` 의 그 팩토리에 있다.
  - 클래스 JSDoc: 그 팩토리는 프로퍼티 메타데이터만 만든다. `TriggerWorkflowRefDto` 의 클래스 JSDoc 문구(«트리거에 연결된
    워크플로우의 참조…»)는 `dist/modules/triggers/**` 어디에도 없다. 클래스 수준 설명은 `@ApiSchema({ description })` 를 명시하면
    스키마에 실린다(`@nestjs/swagger` 의 `ApiSchemaOptions.description`). 이 두 클래스에는 그 데코레이터가 없다.
- 즉 두 자리의 인용은 **지금은 공개되지 않는다.** 그래도 이 draft 는 클래스 JSDoc 을 **필드와 같이 «쓰지 않는다»** 로 정한다
  (아래 Rationale).
- 가드 `dto-jsdoc-citation-guard.ts` 는 이미 `dto/responses/**` 의 **클래스 · 프로퍼티 JSDoc** 을 함께 센다. 두 자리는
  `EXPECTED_DTO_JSDOC_CITATIONS` 로 동결돼 있다 → 이 규칙을 적으면 가드는 그대로 두고 두 자리를 `//` 로 옮기면 된다(developer).

## 변경안 (`spec/conventions/review-citations.md`)

### §3 표 — DTO 행을 둘로 가른다

현재 행:

> | **DTO·컨트롤러의 `/** */` JSDoc** | **대상 아님** | 그 JSDoc 은 **공개 OpenAPI `description` 으로 나간다.** 리뷰 인용은 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다 — [`swagger.md` §3](./swagger.md) 이 정한 대로 **바로 위 `//` 주석**에 적고, 그 `//` 주석은 위 첫 행에 따라 이 규약을 따른다 |

바꾼 두 행:

> | **DTO 필드 · 컨트롤러의 `/** */` JSDoc** | **대상 아님** | 그 JSDoc 은 **공개 OpenAPI `description` 으로 나간다**(DTO 필드: swagger CLI 플러그인이 프로퍼티별 `description` 으로 싣는다). 리뷰 인용은 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다 — [`swagger.md` §3](./swagger.md) 이 정한 대로 **바로 위 `//` 주석**에 적고, 그 `//` 주석은 위 첫 행에 따라 이 규약을 따른다 |
> | **응답 DTO 클래스의 `/** */` JSDoc** | **대상 아님 — 필드와 같이 쓰지 않는다** | 지금 플러그인은 클래스 JSDoc 을 스키마에 싣지 않는다(프로퍼티 메타데이터만 만든다 — [Rationale](#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27)). 그래도 필드 행과 같은 규칙을 둔다: 응답 DTO 파일의 `/** */` 를 **공개 문서 채널 하나**로 다룬다. 회피처도 같다 — 바로 위 `//` 주석 |

### `## Rationale` — 절 하나 추가

> ### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)
>
> §3 표는 원래 «DTO·컨트롤러의 JSDoc» 한 행이었고 근거를 *"공개 OpenAPI `description` 으로 나간다"* 로 적었다. 빌드 산출물로
> 재 보니 이 근거는 **필드 JSDoc 에만 맞는다** — 플러그인의 `_OPENAPI_METADATA_FACTORY` 는 프로퍼티 메타데이터만 만들고,
> `TriggerWorkflowRefDto` 의 클래스 JSDoc 문구는 산출물 어디에도 없었다(`codebase/backend/dist`, 2026-09-27).
>
> 그래서 클래스 JSDoc 에 대해 두 방향을 검토했다(이번 결정에서 처음 나온 선택지다):
>
> | 방향 | 무엇 | 비용 |
> |---|---|---|
> | (A) 클래스 JSDoc 을 `//` 와 같게 본다 | 인용 허용(§2 형식만 지키면 된다). 가드는 프로퍼티 JSDoc 만 세도록 좁힌다 | 가드를 **느슨하게** 한다. 쓰는 사람이 «이 `/** */` 는 나가는가» 를 플러그인 구현으로 판정해야 한다 |
> | (B) 필드와 같이 «쓰지 않는다» | 가드는 그대로(클래스 · 프로퍼티를 함께 센다). 기존 두 자리를 `//` 로 옮긴다 | 두 자리 편집 |
>
> **(B) 를 택한다.** 규칙의 경계가 «응답 DTO 파일의 `/** */`» 하나면 쓰는 사람이 플러그인의 어느 메타데이터가 스키마에 실리는지를
> 알 필요가 없다. (A) 는 그 판단을 규칙 안으로 끌어들이고, 이미 두 축을 함께 세는 가드를 느슨하게 만든다. 클래스 수준 설명이
> 필요해지면 `@ApiSchema({ description })` 로 명시하게 되는데, 그 설명을 JSDoc 에서 옮겨 적는 순간 인용도 함께 딸려 나간다 —
> 처음부터 `/** */` 에 인용을 두지 않는 편이 그 경로를 막는다.
>
> 표의 «실제 위반 사례는 없지만»(위 «DTO JSDoc 행이 왜 필요한가» 인용문, 2026-09-05)은 쓰인 시점에 맞았다. 그 다음 날 두 클래스
> JSDoc 인용이 들어왔고(`#1291`), 가드가 그 둘을 동결했다가 이번 결정으로 갚는다.

## 구현 위임 (developer, 같은 PR)

`plan/in-progress/dto-class-jsdoc-citation.md` — 두 클래스 JSDoc 의 인용을 바로 위 `//` 로 옮기고 `EXPECTED_DTO_JSDOC_CITATIONS` 를
비운다. 가드 spec 머리 주석의 «DTO 의 JSDoc 은 공개 OpenAPI `description` 이 된다» 도 필드/클래스를 갈라 바로잡는다.
