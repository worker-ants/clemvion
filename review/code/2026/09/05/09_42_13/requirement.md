# Requirement Review

## 검증 방법
- `codebase/backend/migrations/README.md` §5 신규 "인덱스 교체는 DROP-먼저" 패턴을 실제 마이그레이션 파일(`V056__notification_active_partial_index.sql`, `V106__schedule_trigger_id_index.sql`, `V110__schedule_workspace_next_run_index.sql`) 과 직접 대조.
- `spec/conventions/review-citations.md` / `plan/complete/spec-draft-migration-rerun-and-citations.md` 가 주장하는 수치를 `git grep`(`origin/main`, `codebase/`)으로 독립 재현.
- `spec/conventions/migrations.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 상대링크를 실제 경로로 해석해 확인.
- `codebase/backend/migrations/Dockerfile` 에 `-mixed=true` 미설정 확인(문서의 "아직 도입 안 됨" 서술과의 정합).
- 저장소 뮤테이션 없음(읽기 전용 검증만 수행, `git status --short` 변경 없음).

## 발견사항

- **[WARNING]** `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 부록 A/B 가 "붙일 전문"이라고 자칭하지만, 실제 커밋된 최종본과 더 이상 일치하지 않는다
  - 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md:197`(부록 A 제목 "README.md §5 에 붙일 전문") ~ `:234`(닫는 펜스), `:236`(부록 B 제목) ~ `:303`
  - 상세: 같은 PR 의 `review/code/2026/09/05/09_27_04/RESOLUTION.md` 가 이 세션에서 두 건을 후속 정정했다 — INFO#1(V056/V106 위험 양상을 표로 분리) · INFO#3(`review-citations.md` §3 "적용 범위" 스코프 신설). 이 정정은 실제 대상 파일(`codebase/backend/migrations/README.md:159-166`, `spec/conventions/review-citations.md:58-71`)에는 반영됐지만, 정정의 근거를 담고 있다고 자처하는 두 부록에는 반영되지 않았다.
    - 부록 A(:199-234)는 여전히 "그 이전 파일들은 0) 이 없어 **같은 위험**을 갖는다"(:231-233)로 끝난다 — README.md 의 최종 표(V056=진짜 교체/0개, V106=신규 추가/영구 invalid)가 빠져 있다.
    - 부록 B(:238-303)는 review-citations.md 의 "§3. 적용 범위" 섹션(코드/plan/review 스코프 구분 표 + 근거), "왜 소급 정리를 하지 않나"의 상세 각주, "이 수치를 처음 셀 때 거짓 0 을 냈다" 절이 통째로 빠진 초기 초안이다(`diff` 로 직접 대조 확인).
  - 이 문서가 `plan/in-progress/spec-draft-nullable-notation-followups.md:402,438,462` 세 곳에서 "상세·실측은 여기"로 링크되는 대상이라, 그 링크를 따라가는 독자는 실제 최종 규약과 다른(그리고 덜 정확한) 버전을 "원문"으로 읽게 된다. `plan/complete/` 는 봉인 관례라 사후 재편집 의무는 없지만, 부록의 자기 서술("붙일 전문")이 이제 사실과 어긋난다는 점은 남는다.
  - 제안: 코드 수정이 아니라 문서 안내 문구 추가로 처리 — 부록 A/B 상단에 "이 부록은 작성 시점 초안이며, 최종본은 각각 `codebase/backend/migrations/README.md` §5, `spec/conventions/review-citations.md` 를 참조" 한 줄을 덧붙여 독자가 구버전임을 알 수 있게 한다. (`plan/complete/` 파일이라 developer 의 자기반증형 소정정 예외 대상은 아니고, 이 정도 안내는 plan 관례상 무리 없이 추가 가능하다고 판단.)

- **[INFO]** 수치 재현 — 정확히 일치
  - 위치: `spec/conventions/review-citations.md:14`(107개 파일·514회), `:20`(전체 경로 10개 파일), `:46-48`(2,413/2,276/46/197/8)
  - 상세: `git grep -o -E "[0-9]{2}_[0-9]{2}_[0-9]{2}" origin/main -- codebase/` → **514**건, 파일 수 **107**. 전체 경로 패턴(`review/(code|consistency|merge|spec-coverage)/YYYY/MM/DD/hh_mm_ss`) → **15**회/**10**파일. `514-15=499` (bare) 일치. 세션 디렉터리 총수는 현재 워킹트리에서 2,407개/서로 다른 시각 2,281개로 문서 값(2,413/2,276)과 소폭 차이 나나, 문서 자체가 "2026-09-05 09시 측정" 시점값임을 명시하고 있고 그 이후 몇 세션이 추가된 것으로 설명 가능해 결함 아님.
  - `codebase/backend/src/common/guards/roles.guard.spec.ts:278`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts:17` (두 `code:` 예시 파일) 모두 실제로 전체 경로 인용 형태를 쓰고 있음을 확인. `review/code/2026/05/26/12_10_38` 이 워킹트리에 없다는 §1 의 주장도 확인(`test -d` → MISSING, git 이력에는 존재).

- **[INFO]** spec fidelity — README.md §5 DROP-먼저 패턴이 실제 선례와 line-level 로 일치
  - 위치: `codebase/backend/migrations/README.md:141-166` vs `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql`, `V056__notification_active_partial_index.sql`, `V106__schedule_trigger_id_index.sql`
  - 상세: V110 은 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` → `CREATE ... IF NOT EXISTS ...` → `DROP ... idx_schedule_next_run;` 순서로, 문서가 제시하는 3-statement 패턴과 정확히 일치. V056(CREATE+DROP, 진짜 교체)·V106(CREATE 만, 짝이 되는 DROP 없음)도 README §5 표(:161-164)의 구분과 실물이 정확히 일치. `codebase/backend/migrations/Dockerfile` 에 `-mixed=true` 가 설정돼 있지 않음을 확인해 "아직 도입 안 된 별도 결정 항목" 서술과 일치.

- **[INFO]** 링크 무결성
  - 위치: `spec/conventions/migrations.md:73`(`../../codebase/backend/migrations/README.md`), `plan/in-progress/spec-draft-nullable-notation-followups.md:402,438,462`(`../complete/spec-draft-migration-rerun-and-citations.md`)
  - 상세: 두 상대경로 모두 실제 파일로 정상 해석됨(파이썬 `os.path.normpath` + `exists` 로 확인). `spec-link-integrity.test.ts` 빌드 가드도 통과할 것으로 판단.

- **[INFO]** `spec/conventions/review-citations.md` 의 `code:` frontmatter 가 "이 규약을 시행하는 코드"가 아니라 "처방하는 인용 형태를 실제로 쓰는 예시 파일 2개"를 가리킴 — 다른 컨벤션 문서(`audit-actions.md`, `cafe24-api-metadata.md` 등)는 보통 시행 코드/const 파일을 가리키는 것과 다른 용법이지만, 문서 스스로 이 선택을 명시적으로 정당화하고 있고(§Overview 각주), `spec-code-paths.test.ts` 가드 요구사항(status=implemented 시 code: ≥1 매치)도 충족하므로 결함 아님.

- TODO/FIXME/HACK/XXX 주석: 신규·변경 범위(`README.md`, `migrations.md`, `review-citations.md`, 두 plan 문서) 전체에서 grep 0건.

## 요약

이번 PR 은 애플리케이션 코드 변경 없이 (1) `CREATE INDEX CONCURRENTLY` 인덱스 교체의 재실행 안전성 패턴(DROP-먼저 3-statement)을 `codebase/backend/migrations/README.md` §5 에 성문화하고 `spec/conventions/migrations.md` 에서 포인터로 연결했으며, (2) 리뷰 산출물 코드 주석 인용 규약을 `spec/conventions/review-citations.md` 신설로 성문화한 순수 문서/spec PR 이다. 핵심 기술 주장(DROP-먼저 패턴, V056/V106/V110 실물 대조, 인용 수치)을 독립적으로 재현·대조한 결과 전부 정확했고 CRITICAL 급 spec-코드 불일치는 없었다. 유일한 흠은 새로 추가된 `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 부록 두 개가 같은 세션의 후속 리뷰 정정(V056/V106 표 분리, `review-citations.md` §3 스코프 신설)을 반영하지 못한 채 "붙일 전문"이라 자칭하는 점 — 다른 문서들이 "상세는 여기"로 링크하는 대상인 만큼 초안 표시 문구를 덧붙이는 정도의 조치를 권한다. 전반적으로 요구사항 충족도는 높다.

## 위험도
LOW
