# 변경 범위(Scope) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 변경 42개 파일을 확인하고, `codebase/**` 8개 파일의 unified diff 전문(프롬프트 게이트 번호 대조)과 프롬프트에서 생략된 e2e 스펙 2개(`webhook-endpoint-reservation.e2e-spec.ts` 신규 213행, `webhook-trigger.e2e-spec.ts` +174/-4)를 `git diff`로 직접 열어 확인했다. 임포트·공백 전용 라인·삭제된 임포트를 grep 으로 별도 대조했다.

## 발견사항

- **[INFO]** 테스트 케이스 삽입 위치가 기존 번호 순서를 따르지 않음(선재 조건, 이번 diff 원인 아님)
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 신규 `B7`·`B8`·`B9` (394~494행)가 `B6`(304행) 뒤, `B3`(496행) 앞에 삽입됨
  - 상세: `git show origin/main:...` 대조 결과 `B3`이 `B6` 뒤에 오는 비순차 배치는 이번 PR 이전부터 존재했다. 새 테스트는 그 기존 비순차 구조를 그대로 유지한 채 관련 내용(B4·B5·B6 웹훅 경로 충돌 계열) 옆에 삽입됐을 뿐, 이번 변경이 새로 순서를 어긴 것은 아니다.
  - 제안: 조치 불요 — 기록용.

## 스코프 검증 결과 (문제 없음)

- **codebase/** 8개 파일 전부가 "지우거나 바꾼 웹훅 경로의 영구 예약" 기능 하나로 수렴한다: 신규 마이그레이션(`V133__webhook_endpoint_reservation.sql`) · 신규 엔티티(`webhook-endpoint-reservation.entity.ts`) · 그 엔티티를 등록하는 두 파일(`app.module.spec.ts`, `root-entities.ts`, 기존 `Trigger`/`Schedule` 사이에 삽입하는 기존 패턴 그대로) · 서비스의 충돌-판정 상수/함수 확장(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 단일 문자열 → `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` `ReadonlySet`, `isEndpointPathUniqueViolation` 로직 확장) · 컨트롤러의 Swagger 설명 문자열 1곳 · 그 확장에 대응하는 unit 테스트(it.each 매트릭스 확장 + 신규 "두 이름의 응답이 같다" 테스트) · e2e 인덱스 가드에 신규 FK 인덱스 1개 추가 · 신규 전용 e2e(V133 SQL 자체를 임시 스키마에서 실행) · 기존 webhook e2e 에 B7/B8/B9 세 케이스 추가. 기능과 무관한 파일·영역은 손대지 않았다.
- **임포트**: 추가된 임포트 8개 전부 새로 쓰는 식별자(`WebhookEndpointReservation`, `Workspace`, TypeORM 데코레이터, Jest 유틸, `pg`/`node:fs`/`node:path`)에 대응하며, 삭제되거나 미사용으로 남는 임포트는 없다.
- **포맷팅/공백**: `git diff` 전체에서 공백 전용 라인 추가/삭제 0건 — 실질 변경과 섞인 재포맷팅 없음.
- **주석**: JSDoc 재작성(`triggers.service.ts` 213~232행)은 상수가 문자열 하나에서 Set 둘로 바뀐 사실을 그대로 반영한 것으로, 범위를 벗어난 주석 첨삭이 아니다.
- **설정 변경**: 없음 — `.env`/CI/lint 설정 등 변경 파일 목록에 없음.
- **spec/plan/review 산출물**: `spec/1-data-model.md` 등 5개 spec 파일, `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`, `review/consistency/2026/09/19/{18_56_41,19_11_16,19_21_39}/**` 18개 파일은 모두 이 프로젝트의 SDD 워크플로(“--spec 필수 consistency-check”, “--impl-prep 필수 consistency-check”)가 요구하는 정규 산출물이며, 전부 같은 기능(웹훅 경로 영구 예약)의 승인·설계 이력을 기록한다. `git log --all -- 'review/consistency/**'` 기준 853개 선행 커밋이 같은 패턴으로 이 디렉터리를 커밋해 왔다 — 이번 PR 만의 이례적 포함이 아니다. `spec-draft-nullable-notation-followups.md`(선행 트래커) 등 관련은 있으나 이번 기능이 직접 닫지 않는 다른 문서는 건드리지 않았다.
- **기능 확장(over-engineering) 없음**: “예약 해제” 운영 기능, 기간제 묘비 등은 plan `## 비대상`에서 명시적으로 제외했고 실제 diff 도 그 경계를 넘지 않는다.
- **frontend/기타 영역 무변경**: `codebase/frontend/**` 등 이 기능과 무관한 트리에는 어떤 수정도 없다(diff 42개 파일 전부 backend/spec/plan/review 뿐).

## 요약

diff 42개 파일은 "지우거나 바꾼 웹훅 경로를 예약 워크스페이스 소유로 영구 잠그는" 단일 기능으로 정확히 수렴한다. `codebase/**` 8개 파일은 마이그레이션·엔티티·엔티티 등록·서비스 판정 로직 확장·컨트롤러 문구·단위 테스트·e2e 테스트가 서로 필요·충분 관계로만 묶여 있고, 무관한 리팩토링·포맷팅·주석·임포트 잡음이나 기능 확장은 발견되지 않았다. 나머지 34개 파일(spec 5개·plan 1개·review/consistency 18개·이번 리뷰 세션 자체 산출물 제외)은 이 저장소가 상시 의무화한 SDD 게이트(consistency-check) 산출물로, 별도 목적을 갖지 않는 동일 기능의 승인 이력이다. INFO 1건은 이번 변경이 만든 문제가 아니라 선재 조건(테스트 케이스 번호 비순차 배치)을 그대로 유지했다는 기록일 뿐 조치가 필요하지 않다.

## 위험도

NONE
