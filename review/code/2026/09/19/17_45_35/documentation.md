# 문서화(Documentation) 리뷰

대상: 엔티티 8개 파일의 `@Column` 데코레이터 정정(`type: 'uuid'` · `enumName` · `default`) + 이를 회귀시키는
`entity-schema-declarations.e2e-spec.ts` 컬럼 층 가드 확장, 관련 plan 문서 2건.

## 발견사항

- **[WARNING]** `describe()` 타이틀이 이번 PR 이 추가한 "컬럼 층은 양방향" 규칙을 반영하지 못한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:197` (`describe('엔티티 스키마 선언 ↔ 실제 DB (선언이 있으면 DB 에도 그대로 있다)', ...)`) — 이 줄은 이번 diff 에 포함되지 않은 기존 문자열이라 프롬프트 게이트가 없어 `Read` 로 직접 확인(실제 파일 197번째 줄, 직접 대조됨).
  - 상세: 파일 머리말 JSDoc(11~30행)은 이번 PR 에서 "인덱스 · 제약 층은 한쪽 방향" vs "컬럼 층은 양방향"을 정확히 분리해 잘 정정했다. 그런데 `describe()` 블록 타이틀은 여전히 "선언이 있으면 DB 에도 그대로 있다"라는 **한쪽 방향** 문구만 말한다. 이번 PR 이 그 안에 추가한 컬럼 층 테스트(`컬럼 — TypeORM 스키마 비교기가 컬럼 정의 변경을 내지 않는다`)는 **DB 에만 있는 컬럼**(`DROP COLUMN`)도 실패로 잡는 반대 방향 검사다. CI 결과나 `jest --listTests` 출력처럼 describe 타이틀만 보고 실패를 진단하는 사람은 "선언 쪽만 본다"고 오해한 채 "DB 에만 있는 컬럼이 왜 실패로 잡히지?"라며 헤맬 수 있다. 파일 상단 JSDoc까지 읽으면 바로 풀리는 문제라 영향은 크지 않지만, 이번 PR 이 정확히 그 JSDoc 을 고친 김에 타이틀도 함께 고치지 않은 것은 "변경된 코드와 기존 문구의 불일치"에 해당한다.
  - 제안: 타이틀을 예를 들어 `'엔티티 스키마 선언 ↔ 실제 DB (인덱스 · 제약은 선언→DB 단방향, 컬럼 정의는 양방향)'` 처럼 갱신하거나, 최소한 "(컬럼 정의는 예외)" 같은 짧은 단서를 덧붙인다.

- **[INFO]** `SqlInMemory` deep import 에 이유 주석이 없다 — 이 파일의 다른 모든 비직관적 선택에는 설명이 붙어 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:6` (`import type { SqlInMemory } from 'typeorm/driver/SqlInMemory';`)
  - 상세: 실측 확인 결과 `SqlInMemory` 타입은 `typeorm` 패키지 루트 export(`index.d.ts`)에 없고 `typeorm/driver/SqlInMemory` 서브패스로만 노출된다. 이 파일은 `ROOT_ENTITIES` 스프레드 이유(191행), `attname::text` 캐스트가 없으면 왜 크게 실패해야 하는지(320행), 식을 이스케이프 없이 SQL 에 잇는 이유(272행) 등 비직관적인 선택마다 예외 없이 인라인 주석을 남기는 관례를 갖고 있다. 이 deep import 만 그 관례에서 빠져 있어, 나중에 "정리하자"며 `import type { SqlInMemory } from 'typeorm'` 로 "고치면" 빌드가 깨진다.
  - 제안: import 옆에 `// SqlInMemory 는 typeorm 루트 export 에 없어 서브패스 import` 한 줄만 추가하면 이 파일의 기존 문서화 밀도와 맞아떨어진다.

## 확인했으나 문제 없음 (오탐 방지 기록)

- 엔티티 8개 파일(`alert-rule` · `edges` · `integration-usage-log` · `llm-usage-log` · `model-config` · `nodes` · `workflow-assistant-session` · `workspace-invitation`)의 `@Column` 옵션 추가는 `synchronize: false`(런타임 무영향)이고 기존 인접 주석과 모순을 만들지 않는다. 새 pubic 함수·클래스가 아니라 메타데이터 옵션 추가뿐이라 별도 JSDoc 이 필요한 대상도 아니다.
- `dataSourceOptions()` · `isColumnLevel()` (같은 e2e 파일에 신규 추가)는 이 파일의 기존 관례(자명한 1줄 헬퍼는 JSDoc 없이, 비직관적 로직만 JSDoc)와 일치한다 — `COLUMN_LEVEL` 상수 바로 위 JSDoc 이 `isColumnLevel` 의 의도를 이미 설명한다.
- `plan/in-progress/entity-column-declaration-drift.md` 는 실측·뮤테이션 표·근거·Rationale·체크리스트를 빠짐없이 갖췄고, 선행 consistency-check(`review/consistency/2026/09/19/16_54_09`) 가 남긴 plan_coherence INFO 6·7 제안(가드 절에 "이게 그 기준이다" 명시, 체크리스트에 `spec/1-data-model.md` 첨부 사실 인라인화)을 문구 그대로 반영해 자기완결적이다.
- `spec/1-data-model.md` §2 필드 표는 이미 전부 "UUID" 로 서술돼 있어 `type: 'uuid'` 정정과 어긋나지 않고, §Rationale(990~1000행)의 `entity-schema-declarations` 서술도 "인덱스·제약 층만" 이라고 못박지 않아 이번 컬럼 층 확장이 spec 텍스트 갱신을 요구하지 않는다.
- CHANGELOG.md 미갱신 — 선행 자매 PR(`4157bc557`, 인덱스·제약 층 드리프트 수정)도 CHANGELOG 를 건드리지 않았고, 이번 변경도 `synchronize: false` 로 사용자 관측 가능한 동작 변화가 없는 내부 메타데이터 정정이라 그 전례와 일치한다 — 지적 대상 아님.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 항목(Prisma→TypeORM 사실 정정 필요)은 developer 가 spec 을 직접 고치지 않고 planner 백로그로 올바르게 위임한 사례다.

## 요약

이번 변경의 핵심 산출물(엔티티 컬럼 데코레이터 8건 + e2e 가드 확장)은 문서화 수준이 이례적으로 높다 — 헤더 JSDoc 이 인덱스/제약 층과 컬럼 층의 방향성 차이를 정확히 구분해 다시 썼고, 신규 상수·함수마다 의도와 근거(뮤테이션 실측 포함)를 남겼으며, plan 문서는 선행 consistency-check 제안까지 문구 그대로 반영했다. 실질적 갭은 두 가지뿐이다 — ① `describe()` 타이틀이 새로 추가된 컬럼 층의 양방향 검사를 반영하지 못해 헤더 JSDoc 과 어긋나는 인상을 줄 수 있고(WARNING), ② `SqlInMemory` deep import 에만 이 파일의 관례인 "비직관적 선택 설명 주석"이 빠져 있다(INFO). README·API 문서·CHANGELOG·설정 문서는 이번 변경의 성격(내부 메타데이터 정정, `synchronize:false`, 관측 가능한 동작 변화 없음)상 갱신이 필요하지 않고, 선행 자매 PR 의 전례와도 일치한다.

## 위험도

LOW
