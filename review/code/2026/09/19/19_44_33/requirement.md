# 요구사항(Requirement) 충족 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 방법

`plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 를 SoT 로 삼아, 실제 저장소 파일(`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`,
`webhook-endpoint-reservation.entity.ts`, `triggers.service.ts`, `triggers.controller.ts`, `triggers.service.spec.ts`,
`webhook-endpoint-reservation.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`)를 직접 `Read`/`Grep` 으로
열어 diff 뿐 아니라 전체 컨텍스트를 대조했다. spec 본문(`spec/1-data-model.md` §2.8.1·`## Rationale`·§3 인덱스 표,
`spec/5-system/3-error-handling.md` §1.10, `spec/2-navigation/2-trigger-list.md` §2·§3, `spec/5-system/12-webhook.md` «endpointPath 가변성»,
`spec/data-flow/10-triggers.md` §2.1·"정정/추가")을 line-level 로 대조했다. 리뷰 중 저장소 파일은 전혀 수정하지 않았다(`git status --short` 확인,
review 출력 디렉터리 외 변경 없음).

## 발견사항

이번 diff 범위에서 CRITICAL·WARNING 급 결함을 찾지 못했다. 이유는 아래와 같다(부정 결과의 근거로 남긴다):

- **[INFO]** DB 트리거 예외 라벨 인식 확장이 spec·구현 양쪽에서 정확히 짝을 이룬다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(233~236행) ·
    `isEndpointPathUniqueViolation`(245~249행)
  - 상세: 직전 라운드(`review/consistency/2026/09/19/18_56_41`)가 지적한 WARNING("서비스 predicate 가 이름 하나로 좁혀져 있어
    `webhook_endpoint_reservation_owner` 를 인식 못 하면 409 대신 500 이 난다")이 이번 구현에서 `Set` 기반 이중 이름 인식으로 정확히
    해소됐다. `spec/1-data-model.md` §2.8.1 "강제는 DB 가 한다" 문단, `plan/.../spec-draft-webhook-endpoint-reservation.md` "설계" 넷째
    불릿과 정확히 line-level 로 대응한다. `pgErrorConstraint` 가 `undefined` 를 돌려주는 경우(이름 없음)도 `name !== undefined` 로
    명시적으로 처리해 예전 술어의 안전한 방향(모르는 이름 → false → 전역 매핑)을 유지한다.
  - 조치 불요 — 기록 목적 INFO.

- **[INFO]** 응답 비구분(정보 노출 방지) 요구가 메시지·details 양쪽에서 정확히 구현됨
  - 위치: `triggers.service.ts` `rethrowEndpointPathConflict`(1663~1688행) — 메시지가 "쓰고 있어요"(현재형 존재 주장)에서
    "쓸 수 없어요"(존재 여부 불문 참)로 교체됨
  - 상세: `spec/1-data-model.md` Rationale "응답을 구분하지 않는 이유"("«예약됨» 을 따로 알리면 그 경로가 한때 쓰였다는 사실이 새어
    나간다")와 `triggers.service.spec.ts` 신규 테스트("두 이름의 409 응답이 같고, 메시지는 «지금 쓰고 있다» 를 말하지 않는다",
    3095~3109행)가 실제로 두 제약 이름에 대해 응답 동일성 + 메시지 정규식 부정 단언까지 검증한다. spec 문장과 코드·테스트가
    삼중으로 일치.

- **[INFO]** e2e 커버리지가 설계 문서의 다섯 갈래 시나리오(같은 워크스페이스 재사용·지운 경로·바꾼 경로·타 워크스페이스로 트리거
  이전·워크스페이스 삭제 후 고아 예약)를 전부 SQL 레벨(`webhook-endpoint-reservation.e2e-spec.ts`)과 API 레벨(`webhook-trigger.e2e-spec.ts`
  B7~B9) 양쪽에서 문는다. `BEFORE` 트리거가 전역 UNIQUE 보다 먼저 걸린다는 설계 문서의 순서 주장도 프로토타입 실측표(11개 시나리오)로
  뒷받침되고, 마이그레이션 SQL 헤더 주석·엔티티 JSDoc·서비스 JSDoc·spec 본문이 모두 같은 순서 설명("BEFORE — 인덱스 검사보다
  앞선다")을 반복해 괴리가 없다.
  - 조치 불요.

- **[INFO]** 트리거 이름·라벨의 성격 구분이 지난 라운드 INFO(#5, 실재 제약 vs 논리적 라벨 혼동 우려)에 대응해 세 군데(migration
  헤더 12~13행, entity JSDoc 16~18행, `triggers.service.ts` JSDoc 222~226행, spec §2.8.1 288~291행)에 일관되게 "실재 제약이 아니라
  트리거가 붙이는 라벨" 이라고 명시돼 있다. 문서 간 표현 불일치 없음.

- **[INFO]** plan 체크리스트 마지막 세 항목(`/ai-review`·`--impl-done`·트래커 해소/`plan/complete/` 이동)이 아직 미체크 상태다
  - 위치: `plan/in-progress/spec-draft-webhook-endpoint-reservation.md:174-176`
  - 상세: 이는 결함이 아니라 이번 `/ai-review` 호출 자체가 그 첫 항목을 채우는 단계이므로 정상적인 진행 중 상태다. 회귀
    방지용으로 기록만 한다 — 이 draft 를 최종적으로 `plan/complete/` 로 옮길 때 트래커
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 관련 체크박스도 같은 커밋에서 갱신해야 한다(draft 자신의
    "`--spec` 결과 반영" 절 156행이 이미 이 의무를 명시).

## 요약

V133 마이그레이션(테이블·부분 인덱스·DB 트리거·백필)과 그에 연동된 엔티티·서비스 predicate 확장·에러 메시지 일반화·컨트롤러 Swagger
설명·단위/통합/e2e 테스트가 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 의 설계 및 `spec/1-data-model.md` §2.8.1(및
연쇄 반영된 `12-webhook.md`·`2-trigger-list.md`·`3-error-handling.md`·`data-flow/10-triggers.md`)과 line-level 로 정확히 일치한다.
특히 직전 `--spec`/`--impl-prep` 라운드에서 지적된 유일한 WARNING(서비스 predicate 협소화로 인한 잠재적 500)이 이번 구현에서
`TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` Set 확장으로 정확히 해소됐고, 이를 검증하는 단위 테스트(이름 축 추가)·e2e(B7~B9, 전용 SQL
가드)가 함께 갖춰졌다. 동시성 강제를 DB 트리거로 옮긴 설계 근거, 응답 비구분(정보 노출 방지) 요구, 워크스페이스 삭제 후 고아
예약 처리, 같은 워크스페이스 재사용 허용 등 spec 이 명시한 모든 행위 규칙이 마이그레이션 SQL·엔티티·서비스 세 층에서 반복
검증 가능한 형태로 구현돼 있다. TODO/FIXME/HACK 류 미완성 표식은 없으며, 모든 에러 경로(다른 워크스페이스 충돌·고아 예약 충돌·
이름 불명 UNIQUE 위반의 전역 매핑 위임)가 명시적으로 처리된다. 남은 항목은 plan 체크리스트의 마무리 단계(트래커 동기화·
`plan/complete/` 이동)뿐이며 이는 코드 결함이 아니라 프로세스상 다음 단계다.

## 위험도

NONE
