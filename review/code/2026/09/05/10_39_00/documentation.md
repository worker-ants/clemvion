# 문서화(Documentation) 리뷰

## 검토 방법

이번 changeset(70개 파일)은 `codebase/backend/migrations/README.md`(§5 "인덱스 교체는
DROP-먼저" 패턴 보강) + `spec/conventions/{migrations.md,review-citations.md,
spec-impl-evidence.md}` + `spec/data-flow/8-notifications.md` 5개 실질 문서와,
`plan/complete/spec-draft-migration-rerun-and-citations.md` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 2개 plan 문서, 그리고
이미 이 PR 안에 **9라운드**(code review 5 + consistency-check 4)가 누적 커밋된 리뷰
산출물(`review/code/**`, `review/consistency/**`)로 구성된다.

이전 라운드들이 "조치 완료"라고 표시한 항목을 최종 워킹트리에서 직접 재확인했다:

- README.md §5 의 V056/V106 서술 표 분리, "정상 흐름에서는 발생하지 않는다" → 두 경로 표
  정정, 규칙 요약 불릿의 `DO $$ ... $$` 동기화 — **전부 반영 확인**.
- `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록 A/B" 전문 복제
  문제(직전 두 라운드가 지적) — **부록을 실제 파일 포인터 표로 교체해 중복 자체를 제거**했음을
  확인. 코드펜스 중첩 문제도 이 교체로 함께 해소됨(원인 자리가 사라짐).
- `spec/conventions/review-citations.md` §3(적용 범위) 신설 — DTO JSDoc 배제, `plan/**`·
  `review/**` 제외 근거 명시, `scripts/**`·`.github/**` 편입 — **본문·`swagger.md` 상호
  링크까지 반영 확인**.
- README.md 안 "이름 기반 `§` 참조"(`§checksum 보정`, `74d405b07` 가 만든 회귀) — 직전
  라운드(`10_30_38`) INFO 를 받아 최신 커밋(`88d037197`)이 구체 명령 인용으로 정정했고,
  `grep -o "§[0-9a-zA-Z.]*" README.md` 로 전수 재검한 결과 **7개 전부 숫자 전용**(이름 기반
  0개)임을 독립 재현했다.

## 발견사항

- **[INFO]** `spec/conventions/migrations.md` §3 이 가리키는 README 절 번호가 실제와 다르다 —
  **이 PR 이 만든 것은 아니지만, 이 PR 이 바로 그 옆(§5/§6 경계)을 확장하며 더 두드러졌다**
  - 위치: `spec/conventions/migrations.md` "## 3. Append-only 원칙" 블록의 마지막 불릿
    ("운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를
    사용한다 (절차는 `codebase/backend/migrations/README.md` **§5** 참고)") — 이 줄은
    `origin/main` 과 동일해 이번 diff 의 게이트가 없다(`git show origin/main:spec/conventions/migrations.md`
    로 대조해 사전 존재를 확인했다).
  - 상세: `migrate-repair` 절차(`docker compose up migrate-repair` → `migrate`)는 실제로
    README.md **"### 6. 테이블-rewrite 형 `ALTER COLUMN TYPE`"** 절 말미(204~227행)에 있다.
    README.md §5 는 "`executeInTransaction=false` 파일은 한 statement 만"(이번 PR 이 "인덱스
    교체는 DROP-먼저" 패턴을 보강한 바로 그 절)이라 repair 절차와 무관하다. 흥미롭게도 이번
    PR 이 README.md §5 안에 새로 추가한 문장(160행)은 같은 repair 절차를 정확히
    **"§6 말미"**로 인용한다 — 직전 라운드(`10_30_38`)가 "이름 기반 `§checksum` 참조"를
    지적받아 정정한 바로 그 자리다. 즉 **같은 절차를 가리키는 두 인용이 한쪽(`README.md:160`)은
    맞고 다른 쪽(`migrations.md` §3)은 틀린 채 공존**하게 됐다 — 후자는 이 PR 대상이 아니라서
    아무 라운드도 검사하지 않았다.
  - 제안: `spec/conventions/migrations.md` §3 의 "§5" 를 "§6" 으로 정정한다. 이 PR 범위 밖
    (diff 미포함)이므로 이번 PR 에서 강제할 사안은 아니지만, 같은 주제를 다루는 두 인용이
    엇갈린 채로 병존하는 상태를 인지해 두면 다음에 이 절을 손댈 때 함께 맞출 수 있다.

- **[INFO]** (확인만, 새 지적 아님) `spec/conventions/review-citations.md` §3 적용 범위가
  가리키는 `plan/**` 예외 실례로, 같은 PR 의 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  는 여전히 날짜 없는 bare `hh_mm_ss` 인용(`23_02_51 W1`, `00_06_38 W2`, `23_26_09 W3`)과
  전체 경로 인용(`review/code/2026/09/05/10_20_57 W1`)이 한 문서 안에 섞여 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (§ 규약 항목 두 개,
    "재실행 위험"·"세션 ID 인용" 서술 블록)
  - 상세: `review-citations.md` §3 표가 `plan/**` 을 규약 "대상 아님" 으로 명시했으므로 규약
    위반은 아니다(직전 라운드들이 이미 이 스코프 경계를 확인함). 다만 같은 문서 안에서도
    새로 쓰인 항목(전체 경로)과 예전 항목(bare)의 표기가 갈려 있어, 다음에 이 문서를 훑는
    사람이 "언제부터 전체 경로를 권장하게 됐는지"를 문서 자체에서 알 수 없다. 조치 불요 수준의
    가독성 참고 사항이다.
  - 제안: 없음(스코프 밖 선택 사항) — `plan/**` 문서에도 전체 경로 표기를 관례로 굳히고 싶다면
    별도 결정 항목으로 등재.

## 요약

이번 changeset 은 마이그레이션 `CREATE INDEX CONCURRENTLY` 재실행 안전성 패턴과 리뷰 산출물
인용 규약을 성문화하는 순수 문서/spec/plan PR 로, 이미 9라운드(code review 5 + consistency-check
4)에 걸쳐 반복 검토·조치돼 대부분 수렴했다. 직접 대조한 결과 과거 라운드가 "조치 완료"로 표시한
모든 항목(V056/V106 표 분리, 부록 A/B 전문 제거, `review-citations.md` §3 신설, 이름 기반
`§checksum` 참조 정정)이 실제로 반영돼 있고 회귀는 없다. 이번 라운드에서 새로 찾은 것은 이
diff 범위 밖(pre-existing)의 사소한 교차참조 오류 하나뿐이다 — `spec/conventions/migrations.md`
§3 이 `migrate-repair` 절차를 README.md "§5"로 가리키지만 실제 위치는 "§6"이다. 이 PR 이
만든 결함은 아니지만, 이 PR 이 바로 그 옆(§5/§6 경계, repair 절차 인용)을 확장하고 정확한
"§6" 인용을 새로 만들어 두어서 두 인용이 서로 다른 절을 가리키는 상태가 더 눈에 띄게 됐다.
CRITICAL/WARNING 급 발견은 없다.

## 위험도
NONE
