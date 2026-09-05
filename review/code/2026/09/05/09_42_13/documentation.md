# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록 A"(README §5 에 붙일 전문이라고 스스로 명시)가 **실제로 반영된 README.md §5 본문과 어긋난다** — V056/V106 과일반화 서술이 부록에만 남아 있다
  - 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md:231-233`(부록 A 말미: `"선례: V110... 그 이전의 V056·V106 은 0) 이 없어 같은 위험을 갖는다"`) vs `codebase/backend/migrations/README.md:159-165`(실제 본문: V056/V106 을 표로 나눠 "V056 은 진짜 교체 → 인덱스 0개", "V106 은 신규 추가(짝 DROP 없음) → invalid 가 영영 유효해지지 않음" 으로 분리)
  - 상세: 같은 PR 안의 `review/code/2026/09/05/09_27_04/database.md`·`requirement.md` 가 이미 "V056·V106 을 같은 위험군으로 뭉뚱그리는 서술은 과일반화" 라고 INFO 로 지적했고, `RESOLUTION.md` INFO#1 이 "정정. 실물 대조... 표로 갈랐다" 라고 적어 README.md 는 실제로 고쳐졌다. 그런데 그 수정이 `README.md` 본문에만 적용되고, 같은 문구를 담고 있던 부록 A(플랜 문서 안, "README.md §5 에 붙일 전문" 이라는 제목 그대로)에는 반영되지 않았다. 부록 A 를 "그 시점의 붙여넣기 원문 기록"으로 신뢰하고 다시 참고하면 이미 폐기된 과일반화 서술을 되살릴 위험이 있다.
  - 제안: 부록 A 말미의 "같은 위험을 갖는다" 문단을 README.md:159-165 의 표 형태로 동기화하거나, 부록이 "당시 초안이며 최종본은 README.md 를 따른다"는 각주를 명시한다.

- **[WARNING]** `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록 B"(`spec/conventions/review-citations.md` 전문이라고 명시)가 **실제로 커밋된 `spec/conventions/review-citations.md` 와 상당히 다르다** — 특히 §3 "적용 범위" 섹션 전체가 부록에는 없다
  - 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md:238-303`(부록 B 전체, `## 부록 B` 헤딩은 236행) vs `spec/conventions/review-citations.md`(전체, 특히 §3 "적용 범위 — `codebase/**` 의 코드·테스트 주석" 섹션과 그 아래 인용 표·`review/code/2026/09/05/09_27_04 INFO#3` 각주)
  - 상세: 직접 diff 한 결과(63줄 vs 108줄) 부록 B 에는 다음이 **누락**되어 있다: (1) §1 의 `f7c56bf0a` 삭제 이력·`git check-ignore` 실측 단락, (2) §2 의 세션 디렉터리 수치 표, (3) **§3 "적용 범위" 섹션 전체**(`codebase/**`/`plan/**`/`review/**` 스코프 구분 표 + `review/code/2026/09/05/09_27_04 INFO#3` 대응 각주) — 이 §3 는 바로 이 documentation 리뷰 계열이 이전 라운드(`09_27_04`)에서 "규약 스코프가 의도적인지 불명" 이라고 지적한 것에 대한 응답으로 신설된 섹션인데, 그 신설분이 부록에는 소급 반영되지 않았다. (4) §4(구 §3)의 `swagger.md` 선례 인용 문장. Rationale 절의 문구도 다르다(부록은 "PR 번호는 나름의 손실이 있다" 별도 문단, 실제 파일은 "택하지 않은 두 이유" 로 재구성 + `review/code/2026/09/05/00_06_38 W2` 전체 경로 인용으로 자기 규약을 스스로 따름).
  - 제안: 부록 B 를 최신 `spec/conventions/review-citations.md` 전문으로 갱신하거나(가장 안전), 갱신하지 않는다면 부록 상단에 "이 부록은 초안 시점 스냅샷이며 최종본은 실제 파일을 참조하라"는 명시적 경고를 붙인다. `plan/complete/` 가 봉인 관례라도, 이 문서를 "상세·실측은 여기" 라고 3곳(`plan/in-progress/spec-draft-nullable-notation-followups.md:402,438,462`)에서 링크하고 있어 소급 정정 가치가 있다(이미 이 PR 이 코드펜스 버그를 소급 수정한 선례가 있다 — `review/code/2026/09/05/09_27_04/RESOLUTION.md`).

## 확인 사실 (참고 — 이전 라운드 지적의 해소 여부)

`review/code/2026/09/05/09_27_04` 라운드(이 PR 에 포함된 이전 라운드 산출물)가 지적한 WARNING·INFO 는 아래와 같이 대부분 실제로 해소되어 있음을 직접 확인했다:

- WARNING(부록 A/B 코드펜스 중첩으로 렌더링 붕괴) — **해소 확인**. `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 부록 A(197행)·부록 B(236행) 바깥 펜스가 4-backtick(````` ```` `````)으로 승격되어 있고, 안쪽 3-backtick SQL 펜스(204-208행)가 더 이상 바깥 펜스를 조기 종료시키지 않는다.
- INFO(`§3` 표기가 실제 헤딩 `③` 과 문자 그대로 안 맞음) — **해소 확인**. `plan/complete/spec-draft-migration-rerun-and-citations.md:103` 이 `(아래 ③ 참조)` 로 정정되어 있다.
- INFO(`review-citations.md` 의 `plan/**` 스코프 제외가 의도적인지 불명) — **해소 확인**. `spec/conventions/review-citations.md` §3 신설로 명시됨(단, 위 WARNING 에 적었듯 이 §3 신설분이 부록 B 에는 반영 안 됨).
- README.md §5 의 V056/V106 서술 정밀도(INFO) — **README.md 본문은 해소, 부록 A 는 미해소**(위 WARNING 참고).

## 요약

이번 변경은 마이그레이션 `CREATE INDEX CONCURRENTLY` 재실행 안전성 패턴과 리뷰 산출물 인용 규약을 성문화하는 순수 문서/spec PR 로, 실제 실행 코드 변경은 없다. 직전 라운드(`09_27_04`)가 지적한 코드펜스 렌더링 붕괴(WARNING)·표기 불일치(INFO)들은 이번 최종본에서 실제로 고쳐진 것을 직접 대조해 확인했다. 다만 그 수정 과정에서 **README.md 본문과 신규 `review-citations.md` 파일 쪽은 개선됐지만, 같은 내용을 담고 있다고 자처하는 `plan/complete/` 문서의 부록 A·B 는 갱신되지 않아 이제 "붙여넣을 전문" 이 실제 파일과 어긋나는 상태**가 새로 생겼다. 특히 부록 B 가 빠뜨린 §3 "적용 범위" 섹션은 이 documentation 리뷰 계열이 스스로 제기했던 지적에 대한 응답으로 신설된 것이어서, 그 개선이 자신을 유발한 근거 문서에는 반영되지 않은 채로 남았다는 점이 아이러니하다. 내용 손실이나 애플리케이션 영향은 없으므로 CRITICAL 급은 아니지만, `plan/complete/` 를 "상세·실측은 여기" 라며 3곳에서 링크하는 만큼 방치하면 다음 사람이 부록을 최종본으로 오인할 위험이 있다.

## 위험도
LOW
