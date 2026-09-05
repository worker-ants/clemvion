# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록 A" 코드펜스가 중첩되어, 의도한 내용의 뒷부분과 "부록 B" 전체가 잘못 렌더링된다
  - 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md:199,204,208,234,238,303` (부록 A는 197~234줄, 부록 B는 236~303줄)
  - 상세: 부록 A는 ` ```markdown ` (199줄) 로 열어 234줄에서 닫으려 했는데, 그 안에 3-backtick SQL 예제 펜스(204줄 열기 / 208줄 닫기)가 **같은 backtick 개수(3개)로 중첩**되어 있다. CommonMark/GFM 은 backtick 펜스에 실제 중첩을 지원하지 않으므로 — 닫는 펜스 판정은 "backtick 뒤에 공백만 있는가"만 본다 — 208줄의 ` ``` ` 가 **바깥 markdown 펜스를 조기 종료**시킨다. 그 결과 209~233줄("0) 이 없으면 재실행이 인덱스를 0개로 만든다" 이하 전체 설명·`indisvalid` 팁·선례 문단)이 코드블록이 아니라 **일반 마크다운으로 렌더링**되고, 234줄의 ` ``` `(원래 부록 A를 닫으려던 것)는 반대로 **새 펜스를 연다**. 이 새 펜스는 236줄의 "## 부록 B" 제목과 238~303줄의 `review-citations.md` 전문을 통째로 삼켜 303줄에서야 닫힌다 — 즉 "## 부록 B" 헤더는 헤더로 렌더링되지 않고, 그 안의 모든 볼드·표·헤딩이 날것의 텍스트로 뭉개진다.
    실측: `python3 -c "import markdown; ..."` (fenced_code 확장)로 197~303줄을 직접 렌더링해 확인 — 부록 A 코드블록이 SQL 예제 직후 조기 종료되고, "## 부록 B" 이하가 하나의 `<pre><code>` 블록으로 뭉쳐 나온다. 같은 구조적 결함이 리뷰 산출물 스냅샷 `review/consistency/2026/09/05/09_13_39/_target/spec-draft-migration-rerun-and-citations.md:168,173,177,203,207,272` 에도 그대로 있다(자동 consistency-checker 는 마크다운 구문 자체는 검사 대상이 아니라서 못 잡았다).
    이 문서는 `plan/in-progress/spec-draft-nullable-notation-followups.md:402,438,462` 세 곳에서 "상세·실측은 여기" 라며 가리키는 대상이라, 앞으로 이 링크를 따라가는 독자는 부록 B 부분이 깨진 채로 보게 된다. 내용 손실은 없지만(텍스트 자체는 다 남아있음) 구조·가독성이 훼손된다.
  - 제안: 바깥 펜스를 4-backtick(` ```` `)으로 올리거나, 부록 A 안의 SQL 예제를 4-space 들여쓰기 코드블록으로 바꿔 backtick 개수 충돌을 없앤다. `plan/complete/` 는 이미 `status: complete` 로 봉인된 산출물이지만, 링크로 계속 참조되는 문서이므로 소급 정정 가치가 있다(정정 시 `git log -S` 로 이 세션이 작성자임을 확인한 뒤 plan 관례에 맞게 처리).

- **[INFO]** 섹션 자기참조 표기가 실제 헤딩과 다르다 — `§3` vs `## ③`
  - 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md:103` (참조하는 쪽) → `plan/complete/spec-draft-migration-rerun-and-citations.md:187` (실제 헤딩)
  - 상세: 103줄 "**별도 결정 항목으로 등재**한다(§3)." 는 187줄 "## ③ 이 draft 가 등재하는 후속" 을 가리키려는 의도로 보이는데, 이 문서의 다른 모든 교차참조는 `§1.2`, `§2.2` 처럼 아라비아 숫자를 쓰는 반면 최상위 섹션 자체는 `①·②·③`(circled digit)로 번호가 매겨져 있어 "§3" 이라는 표기와 실제 헤딩 문자열이 문자 그대로는 매칭되지 않는다. 읽는 사람은 문맥으로 유추 가능하지만, 문서 안에 두 가지 넘버링 스타일(`§N.M` 아라비아 vs `①②③` circled)이 섞여 있다는 신호이기도 하다.
  - 제안: "(§3)" 을 "(③ 이 draft 가 등재하는 후속 참고)" 처럼 실제 헤딩 문자와 맞추거나, 최상위 섹션도 `§1`/`§2`/`§3` 표기로 통일한다.

- **[INFO]** 신설 규약 `spec/conventions/review-citations.md` 는 스코프를 "코드·테스트 주석"으로 명시하는데, 같은 PR 이 `plan/**` 안에는 여전히 날짜 없는 bare `hh_mm_ss` 인용을 계속 추가하고 있다
  - 위치: `spec/conventions/review-citations.md:13` (Overview: "이 저장소의 코드·테스트 주석은...") vs `plan/in-progress/spec-draft-nullable-notation-followups.md:401,403,422,439` ("`23_02_51` W1", "`23_26_09` W3", "`00_06_38` W2" 등 날짜 없는 인용)
  - 상세: 규약의 §2("bare `hh_mm_ss` 는 쓰지 않는다")가 방지하려는 위험 — 같은 시각이 서로 다른 날짜에 존재해 해소 불가능해지는 문제(실측 46건 충돌·8건 해소 불가) — 는 `plan/**` 문서의 인용에도 원리적으로 동일하게 적용된다. 이번 규약은 프론트매터 `code:` 필드와 Overview 문구로 스스로를 `codebase/` 코드/테스트 주석에만 한정했으므로 `plan/**` 인용은 규약 위반이 **아니다** — 다만 그 스코프 결정이 의도적인지, 아니면 단순히 논의 범위 밖이었는지가 문서에 명시돼 있지 않다.
  - 제안: 의도적 스코프 제한이면 `review-citations.md` 에 "`plan/**` 문서 내 인용은 이 규약 대상이 아니다(사유: N)" 한 줄을 추가해 다음 사람이 "빠뜨렸나?" 로 재론하지 않게 한다. 그게 아니라면 후속 검토 대상으로 별도 등재를 고려한다.

## 요약

이번 변경은 마이그레이션 `CREATE INDEX CONCURRENTLY` 재실행 안전성 패턴과 리뷰 산출물 인용 규약, 두 건을 성문화하는 순수 프로세스/스펙 문서 변경이다. 실측(psql/Flyway 재현, `git check-ignore`, 세션 디렉터리 카운트 등)이 각 결정 뒤에 충실히 붙어 있고, 이미 자동 `consistency-check` 라운드(2026-09-05 09:13:39)가 지적한 WARNING·INFO 들(§5 스코프 문구, 원인 레이어 서술, plan 체크박스 동기화)은 실제 커밋된 `README.md`·`migrations.md`·`spec-draft-nullable-notation-followups.md` 에 이미 반영되어 있어 중복 지적할 거리는 없었다. 이번 리뷰에서 새로 발견한 것은 자동 검토가 다루지 않는 순수 마크다운 구문 문제 — `plan/complete/` 신설 문서의 중첩 코드펜스가 부록 B 전체를 뭉갠다 — 가 핵심이며, 나머지는 표기 일관성 수준의 INFO다. CRITICAL 급 발견은 없다.

## 위험도
LOW
