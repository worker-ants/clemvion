# 테스트(Testing) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[WARNING]** V131 마이그레이션의 실제 중복-정리 로직(`DO $$` 블록)이 자동화된 테스트로 전혀 커버되지 않는다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:24`~`46` (DO 블록 전체 — `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)`, `is_chat` 카운팅, `RAISE NOTICE`)
  - 상세: 이 로직("경로 묶음마다 가장 먼저 만든 트리거만 유지·나머지는 새 UUID·채팅 채널 건수 집계·멱등")의 유일한 검증은 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`(§"마이그레이션 검증")에 기록된 **1회성 수동 프로브**(일회용 pg18)뿐이다. 저장소 전체에서 `DO $$` 를 쓰는 마이그레이션은 이번이 처음이라(`grep -rl "DO \$\$" codebase/backend/migrations/*.sql` → 0건 이전 선례) 이런 데이터-교정 마이그레이션을 검증하는 기존 관행 자체가 없다. e2e(B6, `webhook-trigger.e2e-spec.ts`)는 V132 가 만든 최종 인덱스 상태(valid·unique·정의)만 확인할 뿐, `trigger` 테이블이 항상 비어 있는 상태로 마이그레이션이 적용되는 CI/e2e 환경에서는 `WHERE d.rn > 1` 분기(실제 중복 정리)가 **한 번도 실행되지 않는다** — 즉 이 커밋이 고치는 "실 데이터 교정"의 핵심 분기는 CI 안전망 밖에 있다. 이 마이그레이션은 되돌릴 수 없고(파일 하단 주석: "옛 경로는 로그에 남기지 않았다"), 운영 데이터 위에서 딱 한 번 실행되는 보안 결함 교정 코드라 회귀(예: `PARTITION BY` 컬럼 실수, tie-break 오류)가 있으면 아무 자동 테스트도 못 잡고 그대로 운영에 적용되어 조용히 정상 트리거의 경로를 지워버릴 수 있다.
  - 제안: 최소한 별도 테스트 DB 스키마에 V001~V130 만 적용한 뒤 합성 중복 행을 심고 V131 SQL 을 그대로 실행해 "가장 먼저 만든 행 유지 / 나머지 새 UUID / 멱등(재실행 시 0건)" 을 assert 하는 통합 테스트를 추가한다. 최소 조치로도 안 된다면, 왜 자동화하지 않았는지(비용/이 파일 특성)를 plan 문서에 명시적으로 남겨 다음 사람이 "누락"으로 재조사하지 않게 한다.

- **[WARNING]** 동일 `created_at`(진짜 동시 삽입) tie-break 케이스가 수동 프로브에서도, 자동 테스트에서도 다뤄지지 않았다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:34` (`ORDER BY created_at, id`)
  - 상세: plan 문서의 프로브는 "w7(1분 뒤)·w8(2분 뒤)" 처럼 스태거된 타임스탬프만 심었다. `created_at` 이 완전히 같은 두 행(짧은 시간 내 동시 복사 등록)이 생기면 정렬은 `id`(UUID, 시간 순서와 무관)로 결정되므로 "가장 먼저 만든 쪽이 원본을 지킨다"는 정책 서술이 실제로는 보장되지 않을 수 있다 — 이 경계는 코드 주석·plan 어디에도 한계로 적혀 있지 않다.
  - 제안: (a) `created_at` 정밀도(마이크로초) 상 실질적으로 발생 가능성이 낮음을 확인해 명시하거나, (b) 최소한 마이그레이션 헤더 주석/plan Rationale 에 "동일 `created_at` 이면 승자가 `id` 순— 정책이 보장하는 '가장 먼저 만든 쪽'과 다를 수 있다"는 한계를 남긴다.

- **[INFO]** B5 e2e 가 실패한 PATCH(경로 충돌) 이후 대상 트리거의 최종 상태(부분 반영 없음)를 재확인하지 않는다
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — B5 "(2) 수정" 케이스, `patched` 단언 직후
  - 상세: `expectConflict(patched)` 로 409 응답만 확인하고, `own` 트리거를 다시 조회해 `endpointPath` 가 여전히 최초 생성값(랜덤 UUID)인지는 단언하지 않는다. `update()` 가 트랜잭션 경계를 잘못 잡아 다른 필드는 반영되고 `endpointPath` 만 롤백되지 않는 회귀가 생겨도 이 테스트는 통과한다.
  - 제안: PATCH 실패 후 `GET /api/triggers/:id` (또는 DB SELECT)로 `endpointPath` 가 여전히 원래 값인지 확인하는 단언을 추가한다.

- **[INFO]** `triggers.controller.ts` Swagger 설명 문구 변경은 순수 텍스트라 추가 테스트 불필요 — 확인만
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (두 `@ApiConflictResponse` description)
  - 상세: 로직 변경이 아니라 문서 문자열 교체이며, 저장소의 `swagger-dto-contract-guard`(`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`)는 DTO 스키마 형태만 검증하고 description 문자열은 검증 대상이 아니다. 위험이 낮아 테스트 추가를 요구하지 않는다.

## 긍정적으로 확인된 점 (회귀 테스트 관점)

- `triggers.service.spec.ts` — 인덱스 이름 상수 변경(`idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path`)에 대해 **양방향 대조군**을 정확히 갱신했다: 새 이름 → 좁힘(`true`), 옛 이름(V132 가 지운 인덱스) → 더 이상 좁히지 않음(`false`) 케이스를 신설해 "이름이 바뀌면 조용히 false" 라는 안전한 실패 방향을 실제로 문다. `driverError`/`top` 두 표면 모두 대칭으로 태워 기존 이중-표면 커버리지를 유지한다.
- 메시지 문구 변경("같은 워크스페이스" 제거)을 리터럴 문자열 단언 대신 **불변식**(`not.toContain('워크스페이스')`)으로 검증해 향후 문구가 다시 바뀌어도 테스트가 불필요하게 깨지지 않는다 — `triggers.service.spec.ts:3070-3075`, e2e `expectConflict` 헬퍼 동일.
- `webhook-trigger.e2e-spec.ts` B5 는 **실 DB·실 HTTP** 레벨에서 교차 워크스페이스 생성 충돌·수정 충돌·수신 라우팅(원래 주인에게 감)까지 세 시나리오를 한 번에 문어, mock 이 원리적으로 못 잡는 실제 제약 이름·SQLSTATE 형태 회귀를 잡는다(파일 상단 주석이 이 필요성을 스스로 설명).
- B6 은 `pg_index`/`pg_class` 를 직접 질의해 `indisvalid`·`indisunique`·인덱스 정의(선두 컬럼·partial 조건)까지 대조한다 — 이름만 존재 확인하는 얕은 테스트가 아니라 "CONCURRENTLY 실패로 invalid 잔재가 남는" 실패 모드까지 실질적으로 구분한다. 빈 배열일 때의 실패도 `toEqual` 단언이 먼저 걸려 이후 줄의 `res.rows[0].indisvalid` 접근이 암묵적 TypeError 로 흐려지지 않는다.
- 새 e2e 케이스들은 `crypto.randomUUID()`/`uniqueName`/`uniqueEmail` 로 매 실행 격리되어 있고 기존 파일의 유저·워크스페이스 등록 패턴(`beforeAll` 의 owner 등록)과 동일한 관례를 따른다 — 새로운 격리 리스크를 추가하지 않는다.

## 요약

핵심 애플리케이션 코드 경로(에러 매핑 술어·서비스 충돌 처리·API 계약)는 단위·e2e 양쪽에서 두텁고 정교하게(양방향 대조군, 이중 에러 표면, 실 DB 검증) 커버되어 회귀 테스트로서 유효하다. 다만 이 PR 의 실질적인 보안 교정 작업인 V131 마이그레이션의 데이터 교정 로직(`DO $$` 블록)은 되돌릴 수 없고 운영 데이터에 단 한 번 적용되는 코드임에도 자동화된 테스트가 전혀 없고, CI/e2e 환경은 항상 빈 테이블에 마이그레이션을 적용하므로 그 핵심 분기가 원리적으로 실행되지 않는다 — 검증은 plan 문서에 기록된 1회성 수동 프로브뿐이며, 그 프로브조차 `created_at` 완전 동일 tie-break 케이스는 다루지 않는다. 나머지(B5 의 PATCH 실패 후 상태 재확인 부재, 컨트롤러 문서 문자열)는 낮은 위험의 보강 항목이다.

## 위험도

MEDIUM
