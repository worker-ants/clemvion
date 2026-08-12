# 문서화(Documentation) Review — 멱등 캐시 키 execution+route 스코프 (Spec EIA §R8), 2라운드

## 배경

이번 diff 는 두 겹으로 구성된다: (1) 실제 프로덕션·테스트·spec-draft·CHANGELOG 변경, (2) 그 변경에
대한 **직전 ai-review 라운드(`21_02_30`)의 산출물 자체**(`review/code/2026/08/12/21_02_30/**`)가 새
파일로 커밋되어 diff 에 포함된 것. `21_02_30` 라운드에서 documentation reviewer 가 낸 유일한
WARNING(모듈 top-of-file 독스트링이 신규 4번째 `describe` 를 색인하지 않음)은 `RESOLUTION.md` 에 따라
조치되었고, 실제 파일을 열어 대조한 결과 그 조치가 정확히 반영되어 있다.

## 검증 확인 (문제 없음으로 판정)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-33` — 모듈
  top-of-file 독스트링에 "네 번째 describe" 문단이 추가되어 execution/route 두 축·GET+SET 양쪽 단언·
  ctx 부재 skip·이 블록의 한계(mock `getHandler()` 는 실 route 이름을 검증 못 함, e2e `IDEM-5` 가
  대신 고정)까지 명시한다. `21_02_30` WARNING #3 이 정확히 조치됨.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:49-74` 클래스
  JSDoc 에 캐시 키 스코프 문단이 추가되었고, `intercept()` 본문(91-121행)의 인라인 주석이 (a) 전역
  키 fallback 금지 이유, (b) route 축 충돌 조건(`CancelDto` optional→body `{}` 충돌), (c)
  `getHandler().name` 이 빌드 후에도 보존된다는 **전제**와 그 전제가 깨질 때 `IDEM-5` 가 RED 로
  알린다는 점까지 정확히 서술한다. 실제 코드(`req.interaction?.executionId`, `context.getHandler().name`,
  `redisKey` 조립)와 주석 내용이 라인 단위로 일치함을 직접 대조로 확인.
- `codebase/backend/test/external-interaction.e2e-spec.ts:122-135` `idempotencyCacheKey()` 헬퍼
  JSDoc 이 실제 `REDIS_KEY_PREFIX` + `<executionId>:<route>:<key>` 조합과 일치.
- `CHANGELOG.md:3-32` — `(보안)` 라벨 추가(`21_02_30` INFO #5 반영), 배포 전환기 창(구-포맷 엔트리
  고아화·TTL 자연 소멸·데이터 오염 없음) 문단 추가(`21_02_30` INFO #2 반영), execution/route 두 축·
  fallback 미허용·클라이언트 영향 없음까지 전부 서술. 실제 코드 동작과 대조해 사실 오류 없음.
- `spec/data-flow/15-external-interaction.md:93,98,258` 및 `spec/5-system/14-external-interaction-api.md:81,140,1061`
  — 키 형식(`<executionId>:<route>:<key>`), EIA-IN-11/EIA-RL-02 스코프 한정, §R8 Rationale "캐시 키
  스코프" 문단이 실제로 존재하고 코드·CHANGELOG 서술과 일치함을 `grep` 으로 직접 확인. spec 갱신은
  선행 커밋(`plan/complete/spec-draft-eia-idempotency-key-scope.md` 서술상 planner 턴)에서 이미
  완료된 상태이며 이번 diff 는 그와 정합한다.
- `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` → `plan/complete/`(rename) — plan
  lifecycle 관례(`in-progress/` ↔ `complete/`)를 따른다. `git mv` 없이 delete+add 형태지만 diff 내용이
  거의 동일(완료 노트·Rationale·체크리스트 갱신만 추가)해 침묵 유실 없음을 직접 대조로 확인. 삭제된
  `plan/in-progress/` 사본이 남아 있지 않은지 `ls` 로 재확인 완료.
- `review/code/**/21_02_30/*` — 코드 리뷰 산출물의 정식 저장 위치(`CLAUDE.md` "정보 저장 위치" 표)에
  부합. 새 문서 산출물이므로 추가 문서화 요구사항 없음.
- README 갱신 대상 없음(이 저장소 SoT 는 `spec/`), 신규 env var·설정 옵션 없음, API 계약(Swagger)
  변경 없음(클라이언트 영향 없음이라는 CHANGELOG 서술과 일치) — 모두 확인.

## 발견사항

없음. 직전 라운드에서 발견된 유일한 documentation WARNING 은 조치되었고, 그 조치 자체를 소스에서
직접 열어 재검증했다. 새로 추가된 코드(약 30줄)·테스트(약 175줄)·CHANGELOG·spec-draft 전체에서 추가
독스트링/주석 누락, spec-코드 불일치, stale 주석을 찾지 못했다.

## 요약

이번 diff 는 이미 한 차례 ai-review 를 거쳐 documentation WARNING 이 조치된 상태의 최종본이다.
클래스/함수 JSDoc, 인라인 주석, CHANGELOG, spec 문서, plan 문서 전 계층에서 "무엇이 바뀌었는가"뿐
아니라 "왜"(전역 키 fallback을 금지하는 이유, route 축이 필요한 이유, `getHandler().name` 리플렉션
전제와 붕괴 시 안전망)까지 정확하고 최신 상태로 기록되어 있다. 실제 소스를 열어 주석-코드 일치,
spec-코드 일치, plan 파일 이동 무결성을 모두 직접 대조했으며 문서화 관점에서 추가로 조치할 항목이
없다.

## 위험도

NONE
