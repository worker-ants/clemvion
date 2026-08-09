# Rationale 연속성 검토 — `spec/5-system/` (--impl-prep)

## 검토 방법

target 은 `spec/5-system/{1-auth,2-api-convention,3-error-handling}.md` 전문이며, 대부분의
내용은 직전 커밋(`602f677cd`, "auth 불변식 5곳 spec 동기화")이 방금 신설한 것이다(부트 캐너리
Rationale, `X-Workspace-Id` `VALIDATION_ERROR` 3분기, frontmatter code glob 확장). 이 커밋은
그 자체로 `/consistency-check --spec` (`review/consistency/2026/08/09/20_07_08`, Critical 0 ·
WARNING 3 · INFO 4, 전원 LOW)을 거쳤고, 당시 `rationale_continuity` checker 는 이미 이 신설
Rationale 을 "기각을 되돌리지 않는 모범 사례"로 판정했다(해당 세션 §요약). 이번 세션은 같은
target 을 **다른 작업**(`uuid-canary-docstring-fix` — `codebase/backend/src/common/utils/uuid.ts`
docstring 이 잘못 지목한 회귀 캐너리를 정정하는 developer 작업) 착수 전 재검토이므로, 직전
검토를 신뢰하되 독립적으로 재검증했다. 번들에는 `spec/data-flow/12-workspace.md`·
`spec/conventions/secret-store.md`·`spec/conventions/error-codes.md` 의 Rationale/원칙이
포함돼 있지 않아(§제안 참고), 이 세 문서는 저장소 실물을 직접 열어 인용 정확성을 대조했다.

## 발견사항

없음 (CRITICAL/WARNING 0건).

검증한 핵심 포인트 3가지 — 전부 정합 확인:

1. **부트 캐너리 Rationale 의 "opt-in 마커 재기각" 인용 정확성** (`1-auth.md` §"부트 캐너리" (b))
   - target 이 인용한 과거 결정: `spec/data-flow/12-workspace.md ## Rationale` §"멤버십 검증은
     가드 1곳에서"(2026-08-08)의 "**기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착**:
     opt-in 모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생)"
   - 실물 대조 결과: 인용이 정확하다. 다만 원 기각 대상은 "RBAC `@Roles()` 부착"이고 target 이
     새로 기각하는 대안은 "캐너리용 `SetMetadata`+`Reflector` opt-in 마커"로, 리터럴 메커니즘은
     다르지만 "라우트별 수동 마킹은 다음 신규 라우트에서 누락이 재발한다"는 동일 원칙의 정당한
     확장 적용이다. target 문구("라우트별 opt-in 마커 패턴")도 이 메커니즘 차이를 뭉뚱그리지
     않고 일반화된 패턴 이름으로만 지칭해 과장이 없다. → 문제 없음.
2. **`X-Workspace-Id` 검증 강도 비대칭 결정의 신규 Rationale 유무** (`1-auth.md §3.3` 포인터 +
   `3-error-handling.md §1.3` 3분기 각주)
   - "결정의 무근거 번복" 여부 관점에서, 이 항목은 **신규 결정**(기존에 코드화되지 않았던
     헤더/경로 검증 강도 차이를 문서화)이며 번복이 아니다. `data-flow/12-workspace.md` 에 전용
     `## Rationale` subsection 이 동반 신설되어 있음을 실물로 확인했다(§"`X-Workspace-Id` 헤더
     vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭"). "일관성 명목으로 헤더를 조이는 것은
     회귀"라는 선제적 anti-pattern 경고까지 포함해, 향후 무근거 번복을 구조적으로 막아 둔 상태.
3. **에러 코드 카탈로그 원칙 준수** (`3-error-handling.md §1.3` 신규 `VALIDATION_ERROR` 행)
   - `spec/conventions/error-codes.md:37` "클라이언트는 **코드의 의미로 분기**하며 이름 토큰
     부분을…" 원칙과 대조 — 신규 행의 코드 셀은 순수 `VALIDATION_ERROR` 만 담고, 한정자
     ("`X-Workspace-Id` 형식 오류")는 설명 셀 prose 로만 배치되어 원칙을 지킨다(직전 세션
     WARNING #1 반영분 재확인).
4. **위치 근거 일반화 정정 여부** (`1-auth.md` §"부트 캐너리" 하단 "위치 근거" 각주)
   - 직전 세션이 지적한 INFO("부트 fail-closed 가드마다 `1-auth.md` 에 동반 기록" 이라는
     과잉 일반화, `14-external-interaction-api.md` 의 EIA 큐 boot fail-fast 가 반례)가 실제로
     좁혀져 있음을 확인 — 현재 문구는 "auth 크로스커팅 부트 가드"로 한정하고 "도메인 고유는
     각 도메인 spec" 예외를 명시한다. 반영 완료.

## 요약

target(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)은 직전 커밋에서
막 동기화된 콘텐츠로, 신설된 두 개의 `## Rationale` subsection(부트 캐너리, UUID 검증 강도
비대칭) 모두 (a) 과거 `data-flow/12-workspace.md` Rationale 이 기각한 "라우트별 opt-in 마커"
패턴을 정확히 인용하며 그 기각을 되돌리지 않고, (b) 새 결정마다 자체 `## Rationale` 을 동반해
"무근거 번복" 위험을 남기지 않으며, (c) `conventions/error-codes.md` 의 "코드 컬럼은 순수
코드값" 원칙을 지킨다. 직전 세션이 지적했던 유일한 INFO(부트 가드 기록 위치의 과잉 일반화)도
이미 반영되어 해소됐다. 다만 이 checker 의 입력 번들에는 target 이 실제로 상호 참조하는
`data-flow/12-workspace.md`·`conventions/secret-store.md`·`conventions/error-codes.md` 의
Rationale/원칙 원문이 포함되지 않아, 인용 정확성을 저장소 실물 파일을 직접 열어 검증해야
했다 — 향후 유사 impl-prep 번들링 시 target 이 명시적으로 링크하는 타 문서의 `## Rationale`
섹션도 함께 포함하면 이 checker 가 번들만으로 자기완결적 검증을 할 수 있다(절차 제안, target
결함 아님). Rationale 연속성 관점에서 target 은 기각된 대안의 재도입·합의 원칙 위반·무근거
번복·암묵적 가정 충돌 중 어느 것도 보이지 않는다.

## 위험도

LOW
