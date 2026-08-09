# Rationale 연속성 검토 — spec-draft-canary-count-relation

## 검토 대상

- target: `plan/in-progress/spec-draft-canary-count-relation.md`
- 관련 spec Rationale: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증", `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서"
- 관련 이력: `plan/in-progress/auth-guard-reflection-hardening.md` §후속 (미체크 항목 "73건(subset) / 142건(superset) 관계를 spec Rationale 에도 미러링")

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 정합 확인 근거 (참고용, non-blocking)

- **관계 서술의 정확성**: target 이 주장하는 포함관계("캐너리는 `@Roles()` 유무와 무관하게 `@WorkspaceId()` 소비 라우트 전체를 세고, 73건은 그중 `@Roles()` 가 없는 부분집합")는 `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서" 의 실측 서술("HTTP 라우트 222건 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 것 73건")과 정확히 부합한다. 날조된 관계가 아니다.
- **삽입 위치**: `spec/5-system/1-auth.md` §부트 캐너리의 실제 문단 순서는 "...단언 대상은 라우트 목록이 아니라 '0건이 아님' 이다..." 문단 → **알려진 한계** 문단 → (b) opt-in 마커 재기각 → (c) 순이다. target 이 지정한 삽입 지점("0건이 아님" 문단 뒤, 알려진 한계 앞)은 이 실제 구조와 정확히 일치한다.
- **선행 결정과의 정합**: 이 작업은 새 결정이 아니라 `auth-guard-reflection-hardening.md` §후속의 미체크 항목을 그대로 집행하는 것이다. 그 항목이 이미 제시한 권고 문구("캐너리가 세는 것은 `@Roles()` 유무와 무관한 `@WorkspaceId()` 소비 라우트 전체라 73건의 상위집합이다", "숫자 자체는 미러링하지 말 것")를 target 의 삽입 문단이 그대로 따른다 — 과거 결정을 뒤집는 것이 아니라 이미 합의된 방향을 실행에 옮기는 case다.
- **"기각된 대안 재도입" 없음**: `spec/5-system/1-auth.md` Rationale 은 "라우트별 opt-in 마커"(`SetMetadata`+`Reflector`)를 명시적으로 재기각했는데, target 은 이 대안을 다시 채택하지 않는다. 오히려 그 재기각 결정을 그대로 인용·존중한다.
- **숫자 하드코딩 회피 원칙과 정합**: target 의 Rationale("왜 숫자를 안 적는가")은 "73건" 이 처음 정착된 이유(스냅샷 값을 spec 에 박으면 조용히 낡는다)와 동일한 논리를 캐너리 카운트(142)에도 적용해, 관계만 적고 절대값은 코드 주석 SoT 에 남긴다. 이는 기존 spec 전반에 흩어진 "실측값은 코드/부팅 로그 SoT, spec 은 구조적 관계만" 패턴(예: V109 마이그레이션 주석 vs Rationale 서술 분리)과 궤를 같이한다.
- **중복 문서화 회피**: target 의 Rationale("왜 `1-auth.md` 한 곳인가")은 `#1112`(한 문서 두 곳 중 한 곳만 갱신되고 다른 한 곳이 stale 로 남음)와 `#1113`(nil-UUID 정정 문단이 소스 3곳+plan 1곳에 복제됨)을 실제 이력으로 인용한다. `auth-guard-reflection-hardening.md` 302행("nil-UUID 캐너리 정정 문단을 SoT 한 곳으로 모으기")과 94행("`#1112` 가 이 문서의 한 곳만 고쳤다")이 이 인용을 뒷받침한다 — 지어낸 이력이 아니다. 두 후보 문서(`1-auth.md`/`12-workspace.md`) 중 한 곳에만 적겠다는 선택 자체가 과거에 이미 겪은 복제-drift 실패를 피하는 방향이라 원칙과 정합한다.
- **암묵적 invariant 우회 없음**: 캐너리가 "0건이 아님" 만 단언한다는 기존 invariant(라우트 목록 하드코딩 금지)를 target 은 그대로 유지한다. 삽입 문단도 구체 라우트 목록이나 숫자를 spec 에 박지 않아 이 invariant 를 우회하지 않는다.

## 요약

target 은 `spec/5-system/1-auth.md` §부트 캐너리 Rationale 과 `spec/data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서" Rationale 양쪽의 기존 서술과 정확히 부합하는 포함관계를 추가하며, 새 결정이 아니라 `auth-guard-reflection-hardening.md` §후속에 이미 명시된 미체크 항목(정확히 같은 문구까지)을 집행하는 것이다. 과거에 기각된 대안(라우트별 opt-in 마커)을 재도입하지 않고, "실측값은 spec 에 하드코딩하지 않는다"는 이 저장소가 이미 한 번 실패로 학습한 원칙을 스스로 재확인하며 준수한다. 중복 문서화를 피하기 위해 단일 위치("1-auth.md" 한 곳)만 선택한 근거도 `#1112`·`#1113` 의 실제 이력으로 뒷받침된다. Rationale 연속성 관점에서 위반·번복·충돌 사항이 발견되지 않았다.

## 위험도

NONE
