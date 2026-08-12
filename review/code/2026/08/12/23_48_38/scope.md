# Scope Review — `23_48_38`

## 대상 diff 개요

3개 커밋(`22e68459d` fix + `eb752e0e6`/`e7ad5ca1f` review-fix docs)이 만든 changeset:

- 프로덕션 코드: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- 테스트: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- 문서: `CHANGELOG.md`
- plan: `plan/in-progress/backend-lint-gate-broken-on-main.md`
- review 산출물(신규): `review/code/2026/08/12/{23_24_08,23_36_13}/*` (2회의 `/ai-review` 라운드 결과)

## 발견사항

- **[INFO]** 바깥(엔트리) JSON 손상 경로에 warn 로그가 신규로 추가됨 — plan 체크박스 제목("**캐시 엔트리 내부 `responseJson` 손상은 무방비**")이 가리키는 범위보다 한 칸 넓다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `discardCorruptEntry('엔트리', …)` 호출부(신규 `switchMap` 리팩터 내, `JSON.parse(cachedJson)` catch 분기)
  - 상세: 커밋 메시지(`22e68459d`)에서 저자 스스로 "이 클래스의 다른 세 실패 경로(GET·SET·직렬화)는 이미 warn 하는데 이 자리만 빠져 있었다"며 의도적으로 함께 고쳤다고 밝히고 있고, 두 차례의 선행 `/ai-review` 라운드(`23_24_08` INFO#9, `23_36_13` INFO#4)가 이미 이 사실을 지적한 뒤 "같은 결함 클래스(조용한 강등)이고 같은 5줄 안" 이라는 근거로 수용 처분했다. 즉 방치나 은폐가 아니라 **문서화·검토된 의도적 소폭 확장**이다.
  - 제안: 이미 두 차례 리뷰에서 수용됐고 근거도 기록돼 있어 추가 조치 불요. 다만 plan 체크박스 제목을 "손상 처리 전체"로 넓히라는 선행 권고(`23_24_08` INFO#9)는 이번 커밋(`22e68459d`)에서도 여전히 반영되지 않았다 — 제목은 그대로 "캐시 엔트리 내부 `responseJson` 손상은 무방비"이고 완료 노트만 추가됐다. 사소하며 급하지 않음.

- **[INFO]** 클래스 docstring 표 갱신 시, 이번 diff 와 무관하게 선재했던 "직렬화 실패" 경로 누락까지 함께 정합화됨.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:62-71` (표 신설 구간)
  - 상세: "세 경로"→"다섯 경로" 정정 과정에서 이번 diff 가 만들지 않은 선재 누락(직렬화 실패 항목)도 같이 채워졌다. 저자가 커밋 메시지·CHANGELOG 모두에서 "직렬화 실패는 이번 diff 이전부터 이미 빠져 있었다"고 명시해 은폐 없이 정직하게 기록했고, 표 하나를 고치는 김에 정합화하는 편이 표를 두 번 건드리는 것보다 합리적이다.
  - 제안: 없음. 정당한 동반 수정.

- **[INFO]** review 산출물 파일 22개(`review/code/2026/08/12/{23_24_08,23_36_13}/*`)가 changeset 에 포함됨.
  - 위치: `review/code/2026/08/12/23_24_08/*`, `review/code/2026/08/12/23_36_13/*`
  - 상세: 전부 `git log` 상 `/ai-review` 실행 결과로 새로 생성된 파일이며, `CLAUDE.md` 가 명시한 "코드 리뷰 산출물" 저장 경로(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 규약을 그대로 따른다. `developer` SKILL 이 구현 완료 후 `/ai-review` + WARNING fix 를 상시 승인된 강제 의무로 규정하므로, 이 파일들이 diff 에 실리는 것은 스코프 이탈이 아니라 표준 워크플로의 필연적 산출물이다.
  - 제안: 없음.

의도 이상의 변경·불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트 변경·의도치 않은 설정 변경 — 해당 사항 없음. `switchMap` 콜백 재구조화(`processFresh` 추출, `discardCorruptEntry` 헬퍼)는 "엔트리 손상"과 "payload 손상"을 한 헬퍼로 묶어 파싱을 한 곳으로 끌어올리는 목적에 정확히 복무하며, 부수적으로 `JSON.parse` 중복 제거(4라운드 연속 유예됐던 별개의 maintainability 항목)까지 닫혔다고 커밋 메시지가 명시적으로 밝히고 있어 은폐된 확장이 아니다. 테스트 파일에 추가된 4개 신규 테스트·docstring 갱신·CHANGELOG 항목·plan 체크박스 완료 표기는 모두 같은 fix 대상(`responseJson`/엔트리 손상 fail-open)에 직접 결속돼 있다.

## 요약

이번 changeset 은 단일 결함(캐시 엔트리 안쪽 `responseJson` 파싱 미방어로 인한 500 마스킹)을 고치는 fix 커밋 하나와, 그 fix 에 대해 두 차례 실행된 `/ai-review` 가 지적한 WARNING 을 반영한 docs-only 후속 커밋 두 개로 구성된다. 프로덕션 코드 변경(`switchMap` 리팩터·`discardCorruptEntry` 신설)은 전부 이 단일 결함과 그에 인접한 "엔트리 vs payload 손상"의 대칭적 처리에 직접 결속되어 있고, 바깥 엔트리 warn 추가·직렬화 경로 표 정합화 같이 표제보다 한 칸 넓은 변경은 저자가 커밋 메시지·CHANGELOG·plan 완료 노트에 모두 명시적으로 기록했으며 선행 리뷰 라운드에서 근거와 함께 수용 처분됐다. `review/code/**` 하위 22개 파일은 프로젝트가 강제하는 리뷰 워크플로의 표준 산출물 저장 경로에 정확히 안착한 것으로 스코프 이탈이 아니다. Critical·Warning 급 스코프 이탈은 발견되지 않았다.

## 위험도
NONE
