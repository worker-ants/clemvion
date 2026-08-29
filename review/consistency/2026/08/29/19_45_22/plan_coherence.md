# Plan 정합성 검토 — spec/data-flow/ (impl-done, eia-failopen-observability-18dc47)

## 점검 방법

- `git diff --stat origin/main...HEAD` 로 실제 변경 파일을 재확인 — `spec/data-flow/` 는 이번
  브랜치에서 **변경 없음**. 실질 변경은 (1) `GlobalExceptionFilter` 의 `cause` 비노출 회귀
  테스트, (2) 신규 `redis-fail-open-catalog-guard.ts`/`.spec.ts` (유니온↔spec 카탈로그↔실배선
  3자 정합 가드), (3) 3개 spec 파일의 주석 정본화, (4) `plan/in-progress/
  backend-lint-gate-broken-on-main.md` 체크리스트 갱신, (5) `plan/in-progress/
  deps-peer-gating-and-eslint10.md` → `plan/complete/` 이동.
- `plan/in-progress/**` 전수(파일명 목록, 63개 절단분 포함)를 확인하고 `redis-fail-open`·
  `RedisFailOpenComponent`·`clemvion.redis.fail_open` 을 언급하는 plan 파일을 저장소 전체에서
  grep — `backend-lint-gate-broken-on-main.md` 단 하나.
- target 문서(`spec/data-flow/9-observability.md` §Rationale "`component` 를 실제 배선된 값만
  열거하는 이유")와 신규 가드의 설계 의도를 대조.
- 가드가 읽는 실제 spec 카탈로그 행(`spec/5-system/_product-overview.md:88`)과 코드의
  `RedisFailOpenComponent` 유니온(`business-metrics.service.ts:38`)을 직접 열어 가드의 전제
  (`component (idempotency)` 1:1)가 현재 저장소 상태와 실제로 일치하는지 실측 확인.
- `plan/complete/deps-peer-gating-and-eslint10.md` 로의 이동이 최상위 체크박스 전 항목
  완료 후에 이뤄졌는지, `backend-lint-gate-broken-on-main.md` 의 상대링크 갱신이 정확한지
  확인.
- 이번 PR 자체의 `review/code/2026/08/29/19_17_28/{SUMMARY,RESOLUTION}.md` 를 열어 그 세션이
  이미 지적한 scope/INFO 항목(특히 두 plan 트래커 동시 갱신·`worktree:` 필드 drift)이 실제로
  해소됐는지 diff 로 재확인.

## 발견사항

없음.

- **미해결 결정과의 충돌** — 이번 브랜치는 `spec/data-flow/` 를 전혀 수정하지 않았고, 코드
  변경(신규 가드)도 `spec/data-flow/9-observability.md` 의 기존 Rationale("`component` 라벨은
  실제 배선된 값만 — 새 소비자 배선 시 유니온·NF-OB-07 카탈로그를 **동시** 갱신")과 정확히
  같은 방향이다. plan 이 "결정 필요" 로 열어 둔 항목(예: `--frozen-lockfile` required check
  승격 — 사용자 결정 대기, `window` DTO 검증 별도 plan)에 대해 이번 diff 는 아무 결정도
  내리지 않는다.
- **선행 plan 미해소** — 신규 가드가 전제하는 "배선된 component 는 `idempotency` 하나뿐" 은
  `spec/5-system/_product-overview.md:88` 실측과 `business-metrics.service.ts:38` 실측 둘 다와
  일치한다. 가드가 assume 하는 사전 조건이 실제로 성립한다.
- **후속 항목 누락** — 신규 가드는 "19개 미배선 소비자를 이 카운터에 배선" 작업 자체를
  대신하지 않으며, `backend-lint-gate-broken-on-main.md` 의 해당 체크박스는 **여전히 미체크
  (`[ ]`)** 로 남아 있다(가드는 그 하위의 "빠뜨림 방지 계측"만 완료 처리). 다른 in-progress
  plan 중 이 배선 백로그를 별도로 추적하거나 무효화해야 할 곳은 없음(`redis-fail-open`/
  `RedisFailOpenComponent` grep 결과 단일 파일).
- `plan/in-progress/deps-peer-gating-and-eslint10.md` → `plan/complete/` 이동은 최상위 체크박스
  전 항목이 이번 PR 로 닫힌 뒤 수행됐고(§2 후속 3건 전부 `[x]` + 뮤테이션 실측 동반),
  frontmatter `status: complete`·인입 참조(`backend-lint-gate-broken-on-main.md` 의 상대링크)
  갱신도 함께 이뤄졌다. 이전 코드리뷰(`19_17_28`)가 지적한 "`worktree:` 필드는 바뀌었는데
  17행 산문은 안 바뀜" (INFO#4) 은 이번 diff 에서 해당 문단에 이력 설명을 추가해 해소됐다.

## 요약

target 인 `spec/data-flow/` 는 이번 브랜치에서 실제로 수정되지 않았고, 실질 코드 변경(재발
방지용 3자 정합 가드 + `cause` 비노출 테스트 하드닝)은 `plan/in-progress/
backend-lint-gate-broken-on-main.md` 의 기존 체크리스트 항목("idempotency fail-open 구간의
관측·중복 억제" 하위 "다른 Redis fail-open 소비자 배선")을 정확히 반영해 갱신했고, 남은 19개
미배선 소비자 배선 작업은 미체크 상태로 명시적으로 열어 두었다. target 문서(9-observability.md
§Rationale)가 이미 선언한 "component 라벨은 실배선 값만" 원칙과 신규 가드의 설계·실측 전제가
정확히 맞아떨어지며, `deps-peer-gating-and-eslint10.md` 의 `complete/` 이동도 라이프사이클
규칙을 준수했다. plan 이 "결정 필요" 로 남긴 다른 항목(required check 승격 등)을 우회하거나
선점하는 서술도 없다. Plan 정합성 관점에서 문제되는 지점을 찾지 못했다.

## 위험도

NONE
