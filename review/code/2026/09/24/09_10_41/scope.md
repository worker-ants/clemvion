# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `VACUITY_GUARD_MS` export 로 인해 owner-TOCTOU 와 무관한 `integration-rotate-concurrency.e2e-spec.ts` 파일도 수정됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31`(export 전환), `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:9,121`(import + 하드코딩 `1_500` → 상수 치환)
  - 상세: 이번 PR 의 본 목적은 `removeMember()` owner 승격 TOCTOU 수정이며, `integration-rotate-concurrency.e2e-spec.ts` 는 별개 결함(rotate lost-update)을 다루는 파일이다. 다만 이 수정은 임의 추가가 아니라 직전 리뷰 라운드(`review/code/2026/09/24/08_09_57` W5)가 "공허성 가드 대기 시간이 두 파일에 리터럴로 중복되면 `assertGuardBelowKnownTimeouts` 의 검사 범위 밖으로 새는 안전 마진이 생긴다"고 지적한 데 대한 대응이며, `plan/in-progress/member-owner-toctou.md`·백로그(`spec-draft-nullable-notation-followups.md`)에 근거와 함께 명시적으로 기록돼 있다. 실질 동작 변경(로직·조건)은 없고 리터럴 `1_500` → 공유 상수 치환뿐이다.
  - 제안: 이미 plan/백로그에 근거가 남아 있어 추가 조치 불요. 스코프 판단 시 "같은 PR 의 반복 리뷰 루프에서 나온 요구사항"으로 인정 가능.

- **[INFO]** `review/code/**`, `review/consistency/**` 하위 다수 파일(43개 파일 중 34개)이 diff 에 포함
  - 위치: `review/code/2026/09/24/08_09_57/*`, `review/code/2026/09/24/08_46_47/*`, `review/consistency/2026/09/24/07_29_15/*`
  - 상세: 이 PR 의 반복 `/ai-review`·`/consistency-check` 라운드 산출물이며, `CLAUDE.md` 의 "코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, 일관성 검토 산출물은 `review/consistency/...`" 규약에 정확히 부합한다. 스코프 이탈이 아니라 프로세스 상 정상적으로 커밋되는 부산물이다.
  - 제안: 조치 불요(정보 제공 목적).

## 검증한 항목 (이상 없음)

- 핵심 로직 변경은 `workspaces.service.ts` 의 `removeMember()` 경로(owner 가드를 DELETE 술어로 이동 + 0-행 재조회 분기 + `throwCannotRemoveOwner()` 헬퍼 추출)에 국한. import 추가(`Not`)는 즉시 사용됨, 미사용 임포트 없음.
  `git diff origin/main...HEAD -w`(공백 무시) 결과가 일반 diff 대비 3415→3414줄로 사실상 동일해, 포맷팅 변경이 실질 변경과 섞여 있지 않음을 확인.
- 테스트 변경(`workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`)은 모두 이번 TOCTOU 수정과 직접 관련된 새 케이스(owner 승격 재현, 강등 후 재조회, `Not` 술어 검증) 및 리뷰 라운드가 지적한 중복 테스트 제거(`24f7a1ddf`)로, 전부 추적 가능한 근거(plan 파일 §E, RESOLUTION.md)를 가짐.
- `CHANGELOG.md` 변경은 신규 항목 추가 + 기존 "owner 승격 TOCTOU" 관련 예고 문장을 취소선으로 정정(`~~owner 승격 TOCTOU(실측 재현)~~`)한 것으로, 프로젝트 관례("전방 참조 취소선 + 틀린 예고는 CHANGELOG 에서도 정정")를 따름. 무관한 CHANGELOG 섹션은 건드리지 않음.
- `plan/in-progress/member-owner-toctou.md`(신규)와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 항목들은 모두 이번 작업 중 발견된 리뷰/일관성 검토 지적(등재 근거·라운드 ID 명시)을 지금 처리하지 않고 백로그로 미루는 정상적 defer 패턴이며, 임의의 기능 확장이 아님.
- 설정 파일(`package.json`, tsconfig, lint 설정 등) 변경 없음. `codebase/frontend` 등 무관 영역 변경 없음.
- 불필요한 리팩토링·주석 정리·드라이브바이 포맷팅은 발견되지 않음. 추가된 주석/JSDoc(`throwCannotRemoveOwner` 헬퍼 설명, DELETE 위 JSDoc 갱신)은 모두 이번에 바뀐 동시성 계약을 설명하는 데 국한.

## 요약

이번 diff 는 "removeMember() owner 보호 가드의 TOCTOU 수정"이라는 단일 목적에 강하게 결속돼 있다. 핵심 서비스 로직 변경은 최소 범위(술어 이동 + 재조회 분기 + 헬퍼 추출)이고, 테스트·CHANGELOG·plan 변경은 전부 그 수정과 그에 대한 반복 리뷰 라운드(2회)의 직접적 산물이다. 유일하게 눈에 띄는 것은 무관해 보이는 `integration-rotate-concurrency.e2e-spec.ts` 의 상수 치환인데, 이는 같은 PR 의 리뷰 라운드가 명시적으로 요구한 것이고 plan/백로그에 근거가 남아 있어 은닉된 스코프 확장이 아니다. `review/**` 산출물 다수는 프로젝트 규약상 정상 커밋 대상이다. 기능 확장, 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 혼입, 설정 변경은 발견되지 않았다.

## 위험도
LOW
