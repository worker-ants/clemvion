# 문서화(Documentation) 리뷰

대상 커밋: `54b466def` — 가드 self-test 공유 헬퍼화 + 타이틀 실값 보간 (직전 리뷰 20_26_00 Warning 조치).

## 발견사항

- **[INFO]** PROJECT.md 신규 항목의 상호참조 방향(위/아래) 오기
  - 위치: `PROJECT.md` §자동 가드 (build-time 차단), 신규 라인(262행): `- codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts — ... 위 doc-sync 계열과 달리 invariant 홈은 §Frontend e2e 패턴(위 timeout 항목)`
  - 상세: "위 timeout 항목"이라고 지칭하지만, 실제로 이 가드의 "invariant 홈"인 §Frontend e2e 패턴 절의 `timeout` 불릿(297~301행, `가드: src/__tests__/e2e-no-sub-global-timeout.test.ts(unit, CI 차단)`)은 문서 순서상 이 신규 라인(262행)보다 **아래**에 위치한다. 262행 이전에는 "timeout" 관련 다른 언급이 전혀 없다(grep 확인). 즉 "위" → "아래"가 맞는 표현이며, 현재 문구는 독자가 반대 방향으로 찾게 만드는 사소한 오도.
  - 제안: `위 timeout 항목` → `아래 timeout 항목` 또는 `§Frontend e2e 패턴 절의 timeout 항목 참고`처럼 위치를 특정하지 않는 표현으로 수정.

- **[INFO]** 동일 가드가 PROJECT.md 두 곳(§자동 가드 목록, §Frontend e2e 패턴)에 서술되어 유지보수 시 이중 갱신 필요
  - 위치: `PROJECT.md` 262행(신규) vs 301행(기존, PR #872 도입)
  - 상세: 설계 의도(RESOLUTION INFO3 조치: "doc-sync 계열과 구분해 invariant 홈이 §Frontend e2e 패턴임을 명시")는 합리적이고, `test_doc_sync_matrix.py::test_referenced_guard_tests_exist`가 `*.test.ts` 파일명 실존만 검증하므로 빌드는 통과한다. 다만 가드 설명 문구가 두 곳에 준-중복 서술되어 향후 가드 조건이 바뀌면(예: 임계값 변경) 두 위치를 함께 갱신해야 하는 부담이 생긴다.
  - 제안: 차단 사유 아님. 참고로만 기록 — 필요 시 §자동 가드 항목을 "invariant 상세는 §Frontend e2e 패턴 참고"로 더 짧게 축약해 단일 SoT를 명확히 할 수 있음.

- **[INFO, 긍정 확인]** 이전 리뷰(20_26_00)의 W2(주석-코드 불일치) 수정이 정확함
  - 위치: `codebase/frontend/src/__tests__/e2e-no-sub-global-timeout.test.ts` 메인 `it()` 타이틀 (541~545행)
  - 상세: 기존 코드는 "표시용 — 실패 메시지에 전역값 노출" 주석과 달리 고정 문자열 `"parsed from playwright.config.ts"`만 보간하던 오도 코드였다. 이번 diff에서 `it(`... (${GLOBAL}) in e2e specs`, ...)`로 실제 값을 보간하도록 정정했고, 인접 주석("타이틀에 파싱된 전역값을 노출 — 실패 시 어느 임계값 기준인지 즉시 드러난다")도 실제 동작과 일치한다. 신규 `subGlobalTimeoutsInLine` 헬퍼에도 "self-test와 프로덕션 스캔이 이 단일 헬퍼로 판정 로직을 공유한다"는 JSDoc이 drift 방지 의도를 명확히 설명한다. 문서화 관점에서 결함 없음.

- **[INFO]** CHANGELOG.md 미갱신 — 선례와 일관되어 문제 아님
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 저장소는 사용자 가시 기능/버그 수정 단위로 `## Unreleased — ...` 항목을 추가하는 컨벤션을 쓰고 있다(예: manual-trigger defaultValue 수정, 워크스페이스 슬러그 라우팅 phase 1/2). 그러나 이 가드를 최초 도입한 선행 커밋 `b2d3087d7`(#872, e2e flakiness 안정화)도 CHANGELOG를 갱신하지 않았다 — 내부 CI 가드/테스트 인프라 변경은 CHANGELOG 대상이 아니라는 기존 패턴과 이번 순수 리팩터(self-test 공유 헬퍼화)가 일관됨. 갱신 누락으로 보지 않음.

- **[INFO]** review/ 세션 아티팩트(RESOLUTION.md·SUMMARY.md 등, 파일 3~13) 커밋은 컨벤션 준수
  - 위치: `review/code/2026/07/09/20_26_00/*`
  - 상세: `plan/complete` 라이프사이클과 마찬가지로 리뷰 산출물은 `review/`가 gitignore 대상이 아니라 커밋 대상이다(MEMORY "plan 체크박스 = 실제 상태" 항목 참고). `SUMMARY.md`가 write-isolation 위양성으로 누락된 4개 reviewer 파일(`security.md`·`scope.md`·`side_effect.md`·`testing.md`)을 journal에서 복원한 사실과 그 근거(내용 시그니처 매핑, md5 중복 0)를 SUMMARY 서두에 투명하게 밝혀둔 점은 좋은 문서화 관행이다. 추가 조치 불필요.

## 요약

이번 변경은 직전 코드 리뷰(20_26_00)가 지적한 "self-test와 프로덕션 로직 이중 구현" 및 "주석과 실제 동작이 어긋나는 오도 템플릿 리터럴"을 정확히 해소했고, 신규 공유 헬퍼(`subGlobalTimeoutsInLine`)에는 drift 방지 의도를 설명하는 JSDoc을, 매직 넘버(`toBeGreaterThan(10)`)에는 근거 주석을 추가하는 등 문서화 완결성이 높다. `PROJECT.md`의 신규 가드 목록 등록도 `test_doc_sync_matrix.py`의 실존 검증을 통과하며 적절하다. 다만 그 등록 문구 중 "위 timeout 항목"이라는 상호참조가 실제로는 문서상 아래쪽(§Frontend e2e 패턴)을 가리키고 있어 방향이 틀린 사소한 오기가 하나 있다 — 차단 사유는 아니며 후속으로 가볍게 정정하면 된다. CHANGELOG는 동일 유형의 선행 커밋(#872)과 일관되게 미갱신이며 이는 정당하다.

## 위험도

LOW
