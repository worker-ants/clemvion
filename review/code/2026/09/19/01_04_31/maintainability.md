# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** e2e 테스트 `B5` 가 한 `it` 블록에 세 개의 독립적 시나리오를 담고 있어 실패 시 원인 범위가 넓다
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:215` (`it('B5. 다른 워크스페이스가 같은 endpointPath 로 생성 · 수정 → 409, 수신 웹훅은 원래 주인에게 (V132)'` ~ 301행)
  - 상세: (1) 생성 시 충돌 409, (2) PATCH 시 충돌 409 + 미반영 확인, (3) 수신 웹훅이 원래 주인에게 라우팅되는지, 세 가지 독립 검증이 87줄짜리 단일 테스트에 몰려 있다. 셋 다 "다른 워크스페이스가 같은 endpointPath 를 알 때" 라는 공통 전제를 공유하지만, 실패 시 assertion 로그만으로 어느 단계(생성/수정/라우팅)가 깨졌는지 스택트레이스를 더 읽어야 한다. 다만 워크스페이스·워크플로 생성 등 비싼 setup 을 공유하는 e2e 특성상 분리가 항상 이득은 아니다.
  - 제안: 최소한 각 단계 앞에 `// (1)/(2)/(3)` 처럼 이미 달려 있는 주석을 유지하되, 새로 늘어날 여지가 있다면 `it.each` 나 별도 `describe` 블록으로 분리해 실패 지점을 좁히는 것을 고려.

- **[INFO]** 같은 값의 반복 캐스팅 — 변수 추출 누락
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:275`, `codebase/backend/test/webhook-trigger.e2e-spec.ts:283`
  - 상세: `(own.body.data as { id: string }).id` 표현식이 8줄 간격으로 두 번 반복된다(PATCH URL 조립, DB 조회 파라미터). 같은 파일의 다른 곳(`otherWfId` 등)은 이미 한 번 캐스팅한 값을 변수에 담아 재사용하는 패턴을 쓰고 있어, 이 두 자리만 그 패턴에서 벗어난다.
  - 제안: `const ownId = (own.body.data as { id: string }).id;` 로 한 번만 캐스팅해 재사용.

- **[INFO]** 신규 `it('B5…')`/`it('B6…')` 가 기존 `B4`·`B3` 사이에 삽입되어 번호 순서가 어긋난다(선재 문제 연장)
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:215`, `codebase/backend/test/webhook-trigger.e2e-spec.ts:302` (원래 `B3` 은 326행으로 이동)
  - 상세: `git show origin/main:.../webhook-trigger.e2e-spec.ts` 대조 결과 이 PR 이전에도 이미 `B, B2, B4, B3` 순서였다(사전에 어긋나 있던 번호 체계) — 이번 PR 은 그 사이에 `B5`/`B6` 을 끼워 넣어 순서 혼동을 한 단계 더 키운다. 새로 만든 결함은 아니지만, 다음 사람이 번호만 보고 실행 순서·의도된 그룹을 추측하기 더 어려워진다.
  - 제안: 필수는 아니나, 후속 PR 에서 `B, B2, B3(구 B4), B4(구 B3), B5, B6` 처럼 실제 파일 순서와 번호를 맞추는 정리를 고려(이번 PR 스코프는 아님).

- **[INFO]** V131 마이그레이션 파일의 헤더 주석이 실행 코드보다 훨씬 길다(주석 24줄 vs 코드 26줄)
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:1`~`25` (헤더), `:26`~`50` (`DO $$` 블록)
  - 상세: 보안 배경·정책 근거·운영 절차·프로브 실측까지 헤더에 모두 담아 코드 대비 주석 비율이 매우 높다. 다만 이는 이 저장소의 기존 컨벤션(`migrations/README.md`, V121~V130 등 최근 마이그레이션)과 정확히 일치하는 패턴이고, 되돌릴 수 없는 데이터 변경(경로 재발급, 로그 미기록)이라는 위험도를 고려하면 정당화된다 — 감점 요소로 보지 않는다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수 추출은 모범적인 DRY 리팩터링
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (신규 상수, `create`/`update` 두 `@ApiConflictResponse`)
  - 상세: 이전에는 동일한 409 설명 문자열이 `create`·`update` 두 데코레이터에 리터럴로 중복돼 있었는데(한쪽만 고치면 문서가 어긋나는 구조), 이번 변경이 이를 모듈 최상단 상수로 뽑아 SoT 화했다. `integrations.controller.ts` 의 `OAUTH_BEGIN_RESULT_DESCRIPTION` 과 배치·명명 패턴이 정확히 일치해 코드베이스 일관성도 지킨다. 긍정적 발견이라 감점 없음, 참고로 남긴다.
  - 제안: 없음.

## 요약

이번 변경 세트(V131/V132 마이그레이션, `triggers.controller/service/spec.ts`, e2e 스펙 2건, 문서 4건)는 전반적으로 유지보수성이 양호하다. 가장 눈에 띄는 개선은 중복돼 있던 409 Swagger 설명 문자열을 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수로 뽑아 기존 `OAUTH_BEGIN_RESULT_DESCRIPTION` 패턴과 일관되게 SoT 화한 것이다. 마이그레이션 SQL 은 짧고 단일 책임(중복 정리/인덱스 교체)을 유지하며 중첩·분기도 최소화돼 있고, 서비스·컨트롤러 변경은 값·문서 갱신 수준이라 새로운 복잡도를 추가하지 않는다. 유일하게 언급할 만한 지점은 신규 e2e 테스트 `B5`(`webhook-trigger.e2e-spec.ts`) 가 생성/수정/라우팅 세 검증을 한 블록에 담고 있어 실패 진단 범위가 넓다는 점과, 같은 값(`own.body.data` 의 `id`)을 두 번 캐스팅해 재사용한 사소한 중복이다. 둘 다 병합을 막을 수준은 아니며, 기존 테스트가 이미 상당 부분 이 패턴(캐스팅 재사용, 순서 어긋난 `B` 번호)을 갖고 있어 이번 PR 이 새로 만든 결함이라기보다 기존 스타일을 연장한 것에 가깝다.

## 위험도

LOW
