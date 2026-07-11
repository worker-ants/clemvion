# 신규 식별자 충돌 검토 — `spec/5-system/` (1-auth.md, 10-graph-rag.md)

### 발견사항

- **[WARNING] `LlmUsageLog` 엔티티명 casing 불일치**
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` §3.7 `KB-GR-OB-01`("추출에 사용된 LLM 토큰을 **LLMUsageLog** 에 기록")과 §5 `NF-GR-05`("추출 토큰을 **LLMUsageLog** 에 기록")의 표기 `LLMUsageLog`(전체 대문자 LLM)
  - 기존 사용처: 동일 target 문서 §3.2 `KB-GR-EX-07`은 같은 엔티티를 `LlmUsageLog`(Llm PascalCase)로 표기. `spec/1-data-model.md` L1711(`LlmUsageLog (1:N) # chat 사용량 로그 (§2.24)`)·L2281(`§2.24 LlmUsageLog`)도 `LlmUsageLog`로 통일. 실제 구현 클래스도 `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts`의 `export class LlmUsageLog`로 canonical 표기가 `LlmUsageLog`임을 확정한다.
  - 상세: 동일 대상(chat 사용량 로그 엔티티)을 가리키는 두 표기(`LlmUsageLog` / `LLMUsageLog`)가 같은 target 문서 안에서조차 혼재한다. 의미 차이는 없으나(같은 엔티티), `LLMUsageLog`로 코드·문서를 검색하면 매칭되지 않아 리뷰어·구현자가 실체를 찾지 못하는 실무적 혼선을 유발한다.
  - 제안: `10-graph-rag.md` §3.7 KB-GR-OB-01·NF-GR-05 의 `LLMUsageLog` 를 corpus/코드 canonical 표기인 `LlmUsageLog` 로 통일.

- **[WARNING] `Entity`/`Relation`/`ChunkEntity` 스펙 식별자가 TypeORM `@Entity` 데코레이터 심볼과 충돌 — 코드의 `Graph` 접두 우회가 spec 에 미반영**
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` §2.3~2.5 (`### 2.3 Entity (신규)`, `### 2.4 Relation (신규)`, `### 2.5 ChunkEntity (신규)`) 및 `spec/1-data-model.md` §2.12.2~2.12.4(동일 명명, corpus 미러) — 세 신규 엔티티를 `Entity`/`Relation`/`ChunkEntity` 로 명명
  - 기존 사용처: `codebase/backend/src/modules/knowledge-base/entities/entity.entity.ts`(`export class GraphEntity`), `relation.entity.ts`(`export class GraphRelation`), `chunk-entity.entity.ts`(`export class GraphChunkEntity`) — 세 파일 모두 코드 주석에 "클래스명에 `Graph` 접두를 둔 이유는 TypeORM `@Entity` 데코레이터/심볼과 도메인 단어(엔티티) 사이의 키워드 충돌을 피하기 위함" 이라고 명시. `dto/responses/knowledge-base-response.dto.ts` 도 `GraphEntityDto`/`GraphEntityDetailDto`/`GraphRelationDto`로 동일 접두를 사용.
  - 상세: spec 이 SoT 로 선언한 식별자(`Entity`/`Relation`/`ChunkEntity`)는 TypeScript/NestJS 코드베이스 전역에서 통용되는 예약어급 심볼(`import { Entity } from 'typeorm'` 데코레이터)과 정면 충돌한다. 실제 구현은 이를 이미 인지하고 `Graph` 접두(`GraphEntity`/`GraphRelation`/`GraphChunkEntity`)로 해소했지만, 이 명명 결정(및 그 근거)이 두 spec 문서(`10-graph-rag.md`, `1-data-model.md`) 어디에도 기록돼 있지 않다. 향후 spec 만 보고 구현/리뷰하는 사람은 클래스명이 문자 그대로 `Entity`일 것으로 오인할 수 있고, "spec-code 네이밍 drift"로 오탐될 위험도 있다.
  - 제안: `10-graph-rag.md` §2.3~2.5(또는 `1-data-model.md` §2.12.2~2.12.4) 표 상단에 "TS 클래스명은 TypeORM `@Entity` 데코레이터와의 충돌을 피하기 위해 `Graph` 접두(`GraphEntity`/`GraphRelation`/`GraphChunkEntity`)를 쓴다. 테이블명(`entity`/`relation`/`chunk_entity`)·spec 표기(`Entity`/`Relation`/`ChunkEntity`)는 변경 없음" 을 한 줄 각주로 추가(또는 `## Rationale` 신규 항목). 코드 주석에 이미 존재하는 근거를 spec 으로 승격하면 된다.

- **[INFO] `PASSWORD_INVALID` vs `INVALID_PASSWORD` — 어순만 다른 유사 에러 코드**
  - target 신규 식별자: `spec/5-system/1-auth.md` §5 하단 note("**비밀번호 변경 실패 코드**")의 `INVALID_PASSWORD`(401, `users.service.changePassword`)
  - 기존 사용처: 동일 문서 §2.3 하단 note("**재인증 에러 코드**")의 `PASSWORD_INVALID`(401, `verifyReauth` 공용)
  - 상세: 두 코드는 의도적으로 별개(재인증 실패 vs 비밀번호 변경 시 현재 비밀번호 재확인 실패)이며, target 문서 자체가 "별개 wire 코드다" 라고 명시적으로 disambiguate 하고 있어 실질 위험은 낮다. 다만 토큰 어순만 뒤바뀐 두 문자열(`PASSWORD_INVALID`/`INVALID_PASSWORD`)은 로그 grep·클라이언트 switch-case 작성 시 오타로 서로 바뀌어 쓰일 위험이 남는다.
  - 제안: 즉시 변경은 불요(이미 wire 코드로 고정·클라이언트 의존 가능성 있음, rename 은 breaking change). 신규 에러 코드 추가 시 이런 어순 반전 네이밍을 반복하지 않도록 `error-codes.md` 컨벤션에 "동일 도메인 내 토큰 어순 반전 금지" 가이드를 검토할 만하다는 정도의 참고 사항.

### 확인했으나 충돌 없음 (참고)

- `Entity`/`Relation` 용어는 `spec/0-overview.md` §7 용어 정의에 Graph RAG 전용 의미로 이미 등재돼 있고, `spec/conventions/cafe24-api-catalog/_overview.md` 의 "entity"(하위 리소스 파일 단위를 가리키는 일반명사)는 완전히 다른 문맥·소문자 표기라 실질적 혼동 위험은 낮음(INFO 수준에도 못 미쳐 별도 항목화하지 않음).
- 감사 액션(`user.password_changed`/`user.2fa_enabled`/`user.2fa_disabled`/`user.email_changed`)은 `spec/conventions/audit-actions.md` §3 레지스트리와 정확히 일치 — 신규 충돌 없음.
- WebSocket 이벤트 `document:graph_started/_progress/_completed/_retry/_failed` 는 기존 `document:embedding_started/_progress/_completed/_retry/_failed` 네임스페이스 패턴과 정합적으로 병행 — 충돌 없음(그래프에는 의도적으로 `_error` 이벤트가 없음도 본문에 명시돼 있음).
- WebAuthn 관련 신규 환경변수(`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK`)·`TRUST_CF_CONNECTING_IP`·`COOKIE_SAMESITE` 는 corpus(`spec/1-data-model.md`) 참조와 값·의미가 일치, 다른 의미로 쓰이는 기존 사용처 없음.
- API endpoint(`/api/auth/2fa/webauthn/*`, `/api/knowledge-bases/:id/re-extract` 등)는 corpus 전역에서 재정의된 곳이 없어 method+path 충돌 없음.
- graph 관련 마이그레이션 번호(V025~V027, V037)는 auth.md 가 참조하는 V040/V058/V067/V068/V082/V084/V085/V087~V096/V104 대역과 겹치지 않음.

### 요약

`spec/5-system/1-auth.md`·`10-graph-rag.md` 는 이미 여러 차례의 정합화(Rationale 섹션·audit-actions.md 분리·data-model.md 미러링)를 거쳐 corpus 전반과 대체로 잘 정렬돼 있다. 요구사항 ID(`KB-GR-*`)·API endpoint·이벤트명·ENV 키·감사 액션 등 핵심 축에서는 새로운 충돌이 발견되지 않았다. 다만 두 가지 구체적 명명 결함을 확인했다: (1) `10-graph-rag.md` 내부에서 `LlmUsageLog`/`LLMUsageLog` casing 이 혼재해 동일 엔티티를 다르게 표기하고, (2) spec 이 SoT 로 선언한 `Entity`/`Relation`/`ChunkEntity` 가 TypeORM `@Entity` 데코레이터 심볼과 충돌해 실제 구현이 이미 `GraphEntity`/`GraphRelation`/`GraphChunkEntity` 로 우회했음에도 그 결정이 spec 어디에도 문서화돼 있지 않다. 둘 다 기능적 결함이 아니라 문서 정합성 갭이지만, 후자는 코드 리뷰·향후 리팩터링 시 "spec-code 네이밍 drift" 오탐을 유발할 수 있어 spec 에 각주로 명시해 두는 편이 안전하다.

### 위험도
LOW
