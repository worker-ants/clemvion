# Rationale 연속성 검토 — doclink-guard-scope

대상: `spec/conventions/` (impl-done, diff-base `origin/main`). 실제 diff 는
`spec/conventions/spec-impl-evidence.md` 1건(§4.2 `spec-link-integrity.test.ts` 표 셀 확장)이며,
동반 코드 변경(`spec-link-integrity.test.ts`/`spec-links.ts`/`spec-link-checks.yml`/
`scripts/check-doc-links.py` 삭제)과 plan 트래커(`spec-sync-external-interaction-api-gaps.md`)를
함께 대조했다.

## 발견사항

- **[INFO]** R-9 의 §4.2 family 도메인 서술이 신규 scope(3) 를 포함하지 않음
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4.2 표의 `spec-link-integrity.test.ts` 행
    (신규 "**및 (3) 거버넌스 문서**(2026-08-27 추가)" 절)
  - 과거 결정 출처: 같은 문서 `## Rationale` → `R-9. §4.2 지식저장소·plan 무결성 가드 — 별도 family 신설 근거`
    ("링크 무결성·영역 index·plan frontmatter·plan 완료(Gate C) 가드는 … 검증 대상 도메인이 다르다
    **(spec/plan 문서 자체의 구조·연결 무결성)**")
  - 상세: R-9 은 §4.2 family 를 "spec/plan 문서 자체의 구조·연결 무결성"으로 명시적으로 한정해
    §4(frontmatter-evidence)와 구분한다. 이번 PR 은 `spec-link-integrity.test.ts` 의 스코프를
    루트 `*.md`(`CLAUDE.md`/`PROJECT.md` 등)와 `.claude/**.md` 까지 넓혔는데, 이 대상들은 spec 문서도
    plan 문서도 아니다(거버넌스 문서). §4.2 도입부의 "지식저장소(링크·index)"라는 상위 표현과는
    여전히 정합하므로 **모순은 아니지만**, R-9 의 괄호 서술만 읽으면 이 family 의 범위가 spec/plan
    으로 한정된 것처럼 오독될 수 있다. 결정 자체(대체 스크립트 삭제·스코프 확장)의 근거는 표 셀
    안에 충분히 기술돼 있어 "무근거 번복"은 아니다 — 상위 요약 문장 하나가 새 범위를 반영하지
    못한 정도다.
  - 제안: R-9 괄호 문구를 "spec/plan **및 거버넌스** 문서 자체의 구조·연결 무결성"처럼 한 구절만
    보강하거나, §4.2 도입부 "지식저장소(링크·index)" 뒤에 "(spec/plan/거버넌스 문서 포함)" 을
    덧붙여 표와 Rationale 요약 문장을 동기화. 병합 차단 사유는 아님.

- **[INFO]** 신규 결정(2026-08-27) 이 번호 있는 `R-N` 항목이 아니라 §4 표 셀 안에 인라인으로만 기술됨
  - target 위치: `spec/conventions/spec-impl-evidence.md` §4 표 `spec-link-integrity.test.ts` 행
    ("**및 (3) 거버넌스 문서**(2026-08-27 추가) — … 종전 `scripts/check-doc-links.py` 가 표방하던
    역할을 이 스코프가 대체하고 그 스크립트는 삭제됐다 — …")
  - 과거 결정 출처: 같은 문서 `## Rationale`(R-1~R-10) 의 기존 패턴 — 이 문서는 새 설계 결정마다
    번호 있는 `R-N` 절을 만들어 대안 비교·근거를 남겨 왔다(R-7·R-8·R-9 가 최근 사례).
  - 상세: 이번 결정("거버넌스 문서로 스코프 확장 + 열등 중복 스크립트 삭제")도 대안 비교
    (배선 안 된 파이썬 스크립트 vs 배선된 vitest 가드로 통합)와 실측 근거(4건 실제 깨짐, 오탐 2건)를
    갖춘 정식 설계 결정이라 R-1~R-10 과 성격이 같다. 그런데 `## Rationale` 절에 R-11 로 승격되지
    않고 §4 표 셀 안 문장으로만 남아 있어, 이 문서 자체의 서술 관례(결정 근거는 `## Rationale`)와
    미세하게 어긋난다. CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규약과도
    같은 결이다. 기능적 결함은 아니며, 근거 자체는 plan 트래커(`spec-sync-external-interaction-api-gaps.md`)
    에도 상세히 남아 있다.
  - 제안: (선택, 비차단) `## Rationale` 에 `R-11. spec-link-integrity 거버넌스 문서 스코프 확장 +
    check-doc-links.py 폐기` 절을 신설해 표 셀의 서술을 요약 인용하고, 다음 사람이 R-N 인덱스만
    보고도 이 결정을 찾을 수 있게 한다.

## 요약

이번 PR 의 유일한 `spec/` 변경(`spec/conventions/spec-impl-evidence.md` §4.2 표 셀 확장)은 기각된
대안의 재도입도, 합의된 원칙(§4 vs §4.2 도메인 분리, plan-coherence vs spec-link-integrity 책임
분리, Gate C/R-8 의 grandfather 패턴 등) 위반도 아니었다. `scripts/check-doc-links.py` 삭제는 과거
`## Rationale` 어디에도 그 스크립트를 SoT 로 지정한 결정이 없어 "기각된 대안 재도입"에 해당하지
않고, 오히려 결정 근거(배선 안 됨·기존 exit 1·오탐 2건 뮤테이션 확인)가 표 셀과 plan 트래커 양쪽에
상세히 남아 "무근거 번복"도 아니다. `spec-link-checks.yml` 의 `:(glob)*.md`/`.claude/**` pathspec
추가는 이 저장소가 반복 경험한 "CI 트리거 갭"(harness-checks 12주 미실행, #1189~#1191 경로 게이팅
사고) 원칙과 정합하는 방향으로, 오히려 그 교훈을 재확인·강화한다. 발견된 두 건은 모두 INFO —
R-9 요약 문구가 신규 scope(3) 를 안 담고 있는 점, 그리고 신규 결정이 이 문서의 자체 관례인
번호 있는 `R-N` 절 대신 표 셀 인라인 서술로만 남아 있는 점 — 이며 둘 다 정합 보완 제안이지 결함이
아니다.

## 위험도

LOW
