# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 diff 는 애플리케이션 코드·SQL 마이그레이션 변경 없이 순수 문서/spec PR(마이그레이션 재실행 안전성 패턴 성문화 + 리뷰 인용 규약 신설)이며, CRITICAL 은 없다. 다만 신설된 `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 부록 A/B 가 "붙일 전문"이라 자칭하면서도 같은 세션의 후속 정정(README.md §5 V056/V106 표 분리, `review-citations.md` §3 신설)을 반영하지 못해 최종본과 어긋난 상태로 남아 있다 — 두 reviewer(requirement, documentation)가 독립적으로 동일 결함을 지적했다. router forced 대상(database, documentation, requirement) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | `plan/complete/spec-draft-migration-rerun-and-citations.md` 부록 A("README.md §5 에 붙일 전문")가 실제 반영된 README.md §5 본문과 어긋난다 — 부록은 여전히 "V056·V106 은 같은 위험을 갖는다"로 뭉뚱그리는데, 같은 세션 후속 정정(`review/code/2026/09/05/09_27_04` INFO#1)으로 README.md 본문은 V056(진짜 교체/0개)·V106(신규 추가/영구 invalid)을 표로 분리했다. 부록만 구버전인 상태 | `plan/complete/spec-draft-migration-rerun-and-citations.md:197-234`(특히 :231-233) vs `codebase/backend/migrations/README.md:159-166` | 부록 A 말미를 README.md 표 형태로 동기화하거나, 부록 상단에 "작성 시점 초안, 최종본은 README.md §5 참조" 각주 추가 |
| 2 | 문서 정합성 | 같은 문서의 부록 B(`spec/conventions/review-citations.md` 전문이라 명시)가 실제 커밋된 파일과 상당히 다르다 — 특히 **§3 "적용 범위" 섹션 전체**(코드/plan/review 스코프 구분 표 + `09_27_04` INFO#3 대응 각주)가 부록에는 없음. 이 §3 는 직전 라운드가 "스코프가 의도적인지 불명"이라 지적한 것에 대한 응답으로 신설된 섹션인데, 그 개선이 자신을 유발한 근거 문서(부록)에는 소급 반영되지 않음. 그 외 §1 삭제 이력 단락, §2 세션 수치 표, Rationale 재구성 문구도 누락/상이(diff 63줄 vs 108줄) | `plan/complete/spec-draft-migration-rerun-and-citations.md:236-303` vs `spec/conventions/review-citations.md`(전체) | 부록 B 를 최신 `review-citations.md` 전문으로 갱신하거나, 상단에 "초안 시점 스냅샷, 최종본은 실제 파일 참조" 경고 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 수치 검증 | `review-citations.md` 가 인용하는 수치(107개 파일·514회, 전체경로 10개 파일·15회, bare 499)를 `git grep` 으로 독립 재현 — 정확히 일치. 세션 디렉터리 총수는 문서 측정 시점 이후 추가 세션으로 인한 소폭 차이(2,413/2,276 vs 실측 2,407/2,281)로 설명 가능, 결함 아님 | `spec/conventions/review-citations.md:14,20,46-48` | 조치 불요 |
| 2 | Spec fidelity | README.md §5 "DROP-먼저" 3-statement 패턴이 실제 선례(V110)와 line-level 로 정확히 일치, V056/V106 구분도 실물과 일치. `Dockerfile` 에 `-mixed=true` 미설정도 "별도 결정 항목, 아직 도입 안 됨" 서술과 일치 | `codebase/backend/migrations/README.md:141-166` vs `V110/V056/V106__*.sql` | 조치 불요 |
| 3 | 링크 무결성 | `migrations.md:73`, `spec-draft-nullable-notation-followups.md:402,438,462` 의 상대링크 전부 정상 해석 확인 | 해당 파일들 | 조치 불요 |
| 4 | 컨벤션 설계 | `review-citations.md` 의 `code:` frontmatter 가 "시행 코드"가 아니라 "인용 형태 예시 파일 2개"를 가리키는 이례적 용법이나, 문서가 스스로 정당화하고 있고 가드 요구사항도 충족 — 결함 아님 | `spec/conventions/review-citations.md` frontmatter | 조치 불요 |
| 5 | 회귀 확인 | 직전 라운드(`09_27_04`) 지적 3건 — 코드펜스 중첩 렌더링 붕괴(4-backtick 승격), `§3`/`③` 표기 불일치, `plan/**` 스코프 제외 근거 불명 — 모두 최종본(부록 제외)에서 실제로 해소됨을 직접 대조 확인 | `plan/complete/spec-draft-migration-rerun-and-citations.md`(펜스·:103), `spec/conventions/review-citations.md`(§3) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | 부록 A/B 미동기화(WARNING 1건, 통합); 수치·spec fidelity·링크 전부 재현 성공(INFO 다수) |
| documentation | LOW | 부록 A(README 불일치), 부록 B(review-citations.md 불일치, 특히 §3 누락)를 각각 WARNING 으로 세분화; 직전 라운드 지적 사항 해소 여부 직접 검증 |
| database | NONE | 실행 SQL/DB 코드 변경 없음. V056/V106/V110 실물 대조로 README §5 기술 서술 정확성 확인, 발견 없음 |

## 발견 없는 에이전트

- database (NONE — 실행 코드·마이그레이션 파일 변경 없음, 문서 서술의 기술적 정확성만 검증)

## 권장 조치사항

1. `plan/complete/spec-draft-migration-rerun-and-citations.md` 부록 A(:197-234) 상단에 "작성 시점 초안이며 최종본은 `codebase/backend/migrations/README.md` §5 참조" 각주를 추가하거나, V056/V106 표 형태로 동기화한다.
2. 같은 문서 부록 B(:236-303) 를 최신 `spec/conventions/review-citations.md` 전문으로 갱신하거나(권장), 최소한 "§3 적용 범위" 섹션 누락을 포함해 초안 스냅샷임을 명시하는 경고를 상단에 붙인다. 이 문서는 `plan/in-progress/spec-draft-nullable-notation-followups.md:402,438,462` 세 곳에서 "상세·실측은 여기"로 링크되므로 방치 시 다음 사람이 구버전을 최종본으로 오인할 위험이 있다.
3. 위 1·2 는 `plan/complete/` 봉인 관례상 의무는 아니나, 내용 손실·애플리케이션 영향이 없는 순수 문서 정합성 이슈이므로 다음 관련 편집 시 함께 처리해도 무방하다.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: `requirement, documentation, database` (3명)
  - **제외**: 아래 표 (11명)
  - **강제 포함(router_safety)**: `database, documentation, requirement` (전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router 판단상 이번 diff(순수 문서/spec) 무관 |
  | performance | router 판단상 이번 diff 무관 |
  | architecture | router 판단상 이번 diff 무관 |
  | scope | router 판단상 이번 diff 무관 |
  | side_effect | router 판단상 이번 diff 무관 |
  | maintainability | router 판단상 이번 diff 무관 |
  | testing | router 판단상 이번 diff 무관 |
  | dependency | router 판단상 이번 diff 무관 |
  | concurrency | router 판단상 이번 diff 무관 |
  | api_contract | router 판단상 이번 diff 무관 |
  | user_guide_sync | router 판단상 이번 diff 무관 |
