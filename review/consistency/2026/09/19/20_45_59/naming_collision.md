# 신규 식별자 충돌 검토 — `spec-draft-spec-fact-orm-defaults`

## 검토 범위 요약

target 은 두 곳의 **순수 사실 정정**이다:

- A. `spec/0-overview.md` `## Rationale` «DB 마이그레이션 도구로 Flyway 채택 (§2.8)» — 본문의 ORM 표기를 `Prisma` → `TypeORM` 으로 정정하고 절 끝에 `> **정정 (2026-09-19)**: …` 블록을 추가.
- B. `spec/1-data-model.md` — §2.16 ModelConfig `kind` 행, §2.20 AssistantSession `last_interaction_at` 행에 기존 컬럼의 DB 기본값(`default=`…``)을 덧붙이고, `## Rationale` 의 기존 문장 한 줄(`entity-schema-declarations` 괄호 설명)을 보강.

새 엔티티·DTO·endpoint·이벤트·ENV var·요구사항 ID·신규 spec 파일은 **하나도 도입되지 않는다** — 기존 절·기존 표 행·기존 Rationale 문장을 고쳐 쓰는 것뿐이다. 아래는 각 관점별 확인 결과다.

## 관점별 확인

1. **요구사항 ID 충돌** — 해당 없음. target 이 새로 붙이는 ID(`EIA-*`, `CCH-*`, `NAV-*`, `R-*` 류)가 없다.
2. **엔티티/타입명 충돌** — 해당 없음. `ModelConfig`(§2.16)·`AssistantSession`(§2.20) 모두 기존 엔티티이며 (`spec/1-data-model.md:631`, `:788`), target 은 이미 있는 표 행에 `default=` 설명만 덧붙인다. `TypeORM` 이라는 용어도 신규가 아니라 이미 저장소 전역에서 쓰이는 이름이다 — `spec/data-flow/0-overview.md:71,76,83,99,107`, `spec/conventions/swagger.md:175`, `spec/conventions/secret-store.md:156`, `spec/conventions/raw-query-results.md:65`, `spec/1-data-model.md:927` 등. 정정은 오히려 이 기존 용법과 **일치**시키는 방향이라 충돌이 아니라 정합화다.
3. **API endpoint 충돌** — 해당 없음. target 은 endpoint 를 하나도 추가하지 않는다.
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — 해당 없음. `default=` 표기는 코드 실행 시 참조하는 config key 가 아니라 spec 표 안의 서술 문구이며, 이미 같은 문서 §2.8 `notification_health`/`chat_channel_health` 행(`spec/1-data-model.md:255,259`)에 선례가 있는 표기법을 그대로 재사용한다(신규 표기 도입 아님).
6. **파일 경로 충돌** — 새 spec 파일은 생성되지 않는다(둘 다 기존 파일 수정). draft 파일 자체 `plan/in-progress/spec-draft-spec-fact-orm-defaults.md` 도 `find plan/in-progress -iname "*spec-draft*"` 로 확인한 결과 기존 3개(`spec-draft-nullable-notation-followups.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)와 이름이 겹치지 않고 동일 명명 컨벤션(`spec-draft-<slug>.md`)을 따른다 — 충돌 없음.

## 발견사항

- **[WARNING]** 신규 삽입 링크가 자기 문서 기준 상대경로 깊이를 잘못 잡았다 (기존 컨벤션 위반 · 사실상 깨진 참조)
  - target 신규 식별자: target 변경 A `trade-off` 문단에 새로 삽입되는 링크 `[데이터 모델 Rationale «code: 에 전용 e2e 가드 셋»](../../spec/1-data-model.md)` (draft 54~66행, `spec/0-overview.md` §Rationale «DB 마이그레이션 도구로 Flyway 채택» 절에 삽입 예정)
  - 기존 사용처: `../../spec/<file>.md` 패턴은 이 저장소에서 **`spec/` 하위 한 단계 더 들어간 디렉토리**(예 `spec/conventions/`, `spec/5-system/`)의 문서가 `spec/` 최상위 파일을 가리킬 때 쓰는 형태다 — 예: `spec/conventions/node-cancellation.md:181` → `[데이터 모델 §2.14](../../spec/1-data-model.md#214-nodeexecution)`, `spec/conventions/node-output.md:352` → `../../spec/5-system/4-execution-engine.md`. 반면 `spec/0-overview.md` 는 `spec/` **최상위** 파일이고, 이 파일 안에서 형제 파일을 가리킬 때의 기존 컨벤션은 한 단계 짧은 `./1-data-model.md` 다(`spec/0-overview.md:3` `[데이터 모델](./1-data-model.md)`, 그 외 `:15,:75,:338` 등 전부 `./` 형).
  - 상세: target 이 새로 넣는 링크는 `spec/0-overview.md` 소재인데 `spec/conventions/**`·`spec/5-system/**` 전용 깊이(`../../spec/…`)를 그대로 가져다 썼다. `spec/0-overview.md` 위치 기준으로 `../..` 는 저장소 루트를 벗어난 조상 디렉토리이므로, 이 링크는 존재하지 않는 경로로 resolve 된다 — 같은 파일·같은 절에서 바로 위(§2.8 표)와 다른 Rationale 항목들이 전부 `./` 를 쓰는 것과 대비된다. 다른 관점(엔티티/ID/endpoint)과는 무관하지만, 리뷰 관점 6 「파일 경로 충돌 — 새 spec 파일 경로/이름이 기존 명명 컨벤션을 깨는가」에 정확히 해당하는 결함이다.
  - 제안: `../../spec/1-data-model.md` → `./1-data-model.md` 로 수정. (앵커 없이 파일 전체를 가리키는 링크라 앵커 유효성은 별도 문제 없음.)

## 요약

target 은 새 요구사항 ID·엔티티·DTO·API endpoint·이벤트·ENV var·spec 파일을 전혀 도입하지 않는 순수 사실 정정(ORM 명칭 Prisma→TypeORM, 누락된 DB 기본값 둘 추가)이라 신규 식별자 충돌 표면 자체가 거의 없다. `TypeORM` 용어도 저장소 전역에서 이미 쓰이는 이름과 일치시키는 방향이고, `default=` 표기도 같은 문서(§2.8)의 기존 선례를 재사용한다. 유일하게 발견된 문제는 새로 삽입되는 크로스 링크 하나가 `spec/conventions/`·`spec/5-system/` 전용 상대경로 깊이(`../../spec/…`)를 최상위 파일인 `spec/0-overview.md` 에 잘못 가져다 써서 존재하지 않는 경로로 resolve 되는 것 — 명명 "충돌"이라기보다 경로 컨벤션 위반/깨진 링크지만 카테고리 6 관점에 해당해 WARNING 으로 적었다.

## 위험도
LOW
