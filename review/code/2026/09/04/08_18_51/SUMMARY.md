# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 순수 테스트 추가(대조군 2건) + plan 문서 갱신이며, 지적사항은 전부 완결성·표현 정밀도 수준의 INFO. router 가 강제한(`router_safety`) 7개 reviewer 전원 결과가 확보되어 화이트리스트 미이행 없음(누락으로 인한 거짓 낮은 위험도 아님).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing, requirement | 신규 docstring 은 `WIDENED_DECL` 이 `@Column`·`@ManyToOne`·`@OneToOne` 을 모두 구분 없이 잡는다고 명시하는데, 새 대조군 2건은 둘 다 `@ManyToOne` 만 쓰고 `@OneToOne` 은 파일 전체에 한 번도 등장하지 않아 그 분기가 검증되지 않음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:373-376, 387, 417` | 저장소에 `@OneToOne` 실충돌 사례가 없으므로 필수는 아니지만, 향후 `it.each` 로 `@OneToOne` 변형을 추가하면 docstring 의 "대칭" 주장을 실제로 닫을 수 있음 |
| 2 | maintainability, testing, documentation | 두 번째 신규 대조군(`@Column`+관계 혼재)이 자매 테스트들과 달리 `findStaleSpecCasts` 단계 검증을 생략하고 `widenedEntityFields(...).has('mixed')` 만 단언 — docstring 의 "위 대조군과 대칭" 표현과 실제 검증 깊이가 정확히 대칭은 아님 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:417-444` (비교: `:387-415`, `:344-370`) | 기능적 위험은 낮음(`findStaleSpecCasts` 가 `widened.has()` 로 순수 파생). 필요 시 `b.spec.ts` fixture + `findStaleSpecCasts` 단언을 추가해 검증 깊이를 맞추거나, docstring 에 "widenedEntityFields 단계만 확인" 이라는 한 줄을 보강 |
| 3 | scope | plan 원문이 예고한 구현 형태(`it.each`)와 실제 구현(개별 `it()` 2건)이 다름 — 다만 두 신규 케이스의 fixture 구조가 서로 달라(순수 관계 페어 vs 관계+Column 혼합) 이 선택은 합리적. 검증 범위(무엇을 테스트하는가) 자체는 예고와 일치 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387, 417` | 조치 불요 — 참고용 기록 |
| 4 | maintainability | 신규 대조군 2건이 기존 대조군 테스트(`userId` 충돌)와 거의 동일한 인라인 fixture 골격을 반복 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387, 417` (비교: `:344`) | 조치 불요 — 파일 전체가 이미 이 인라인-픽스처 컨벤션을 일관 채택 중이며 대조군 테스트 성격상 독립적으로 읽히는 편이 낫다. 동일 패턴이 네 번째로 반복되면 `it.each` 파라미터화 고려 |
| 5 | testing | 뮤테이션 재검증 시도 중 병렬 실행 중인 다른 리뷰어가 같은 파일(`nullable-type-lie-cast-guard.ts`)을 동시 편집해 자신의 뮤테이션이 덮어써지는 것을 관측 — plan 이 주장한 "충돌 배제 제거 시 3건 RED / 관계 데코레이터만 빼면 2건 RED" 를 이 리뷰어는 독립 재현하지 못했음(반증 아님, 절차상 충돌로 중단). 단, **requirement reviewer 는 동일 뮤테이션을 별도로 시도해 두 결과(3건/2건 RED) 를 실제로 재현·확인**했으므로 plan 의 정량 주장 자체는 requirement 리뷰로 뒷받침됨 | N/A — 리뷰 인프라 관측 (대상 파일은 diff 밖) | 후속 검증이 필요하면 병렬 fan-out 종료 후 단독 실행 권장. 이번 diff 의 결함은 아님 |
| 6 | side_effect | 신규 테스트 2건은 기존 `withFiles` tmpdir 픽스처 헬퍼를 그대로 재사용 — 새로운 부작용 표면(전역 상태·네트워크·환경변수 등) 없음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387, 417` | 조치 불요 — 확인 완료로 기록 |
| 7 | side_effect | `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 체크박스(`[ ]`→`[x]`) + 서술 갱신뿐, 코드 실행 경로에 영향 없음 | `plan/in-progress/entity-nullable-column-type-mismatch.md` | 조치 불요 |
| 8 | documentation | 인용된 실재 관계 충돌 3건(`integration`/`trigger`/`user`) 중 2건(`integration`, `trigger`)을 소스와 대조해 정확함을 확인. requirement reviewer 는 3건 전부(`user` 포함) 대조해 정확함을 확인 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:379-381` | 조치 불요 — 정확성 확인 완료로 기록 |
| 9 | requirement | 이 가드(`nullable-type-lie-cast`)를 정의하는 spec 문서가 `spec/` 에 없음 — plan 이 스스로 "코드 전용, spec 미변경" 이라 명시한 것과 일치, 예상된 상태 | N/A | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 실행 경로 무관, 인젝션/시크릿/인증 표면 없음 |
| requirement | NONE | 대조군 검증·저장소 실재 충돌 3건·뮤테이션 3건/2건 RED 전부 독립 재현 확인. INFO: `@OneToOne` 미커버 |
| scope | NONE | 스코프 이탈 없음(diff 2파일만). INFO: `it.each` 예고 대비 개별 `it()` 구현 |
| side_effect | NONE | 순수 첨가, 기존 헬퍼 재사용, 새 부작용 표면 없음 |
| maintainability | LOW | 픽스처 중복 + 두 신규 테스트 간 검증 깊이 비대칭 |
| testing | LOW | `@OneToOne` 미검증, `findStaleSpecCasts` 생략, 뮤테이션 재검증이 병렬 충돌로 미완주(반증 아님) |
| documentation | NONE | "대칭" 표현이 검증 깊이와 미세하게 어긋남. 실재 충돌 2/3건 대조 확인 |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원 최소 1건 이상의 INFO 를 보고했으나 Critical/Warning 은 전무.

## 권장 조치사항

1. (선택) 두 번째 신규 대조군(`@Column`+관계 혼재)에 `b.spec.ts` fixture 와 `findStaleSpecCasts` 단언을 추가해 자매 테스트와 검증 깊이를 맞추거나, docstring 에 생략 사유를 한 줄 보강한다 (#2).
2. (선택, 저비용) 저장소에 `@OneToOne` 실충돌 사례가 생기면 그때 `it.each` 로 캐너리를 추가한다 — 현재는 대상 부재로 긴급하지 않다 (#1).
3. 조치 불요 항목(#3~#9)은 기록으로만 남기고 별도 후속 없이 종결한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — **7명 전원 결과 확보됨** (강제 화이트리스트 미이행 없음)
  - **제외**: 7명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(테스트/문서 전용)에 성능 영향 표면 없음 |
  | architecture | router 판단 — 아키텍처 변경 없음 |
  | dependency | router 판단 — 신규 의존성 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 대상 문서 영향 없음(내부 개발 가드 전용) |