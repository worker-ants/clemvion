# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 무관 트래커(`cafe24-backlog-residual.md`)에 신규 섹션이 이 PR 커밋에 함께 실림
  - 위치: `plan/in-progress/cafe24-backlog-residual.md:269`~`280` (새 섹션 `## 카탈로그 문서 위생 셋 — 무관한 --impl-prep 이 지나가다 본 것 (2026-09-18 발견)`)
  - 상세: 이번 PR 의 본체는 삭제 연쇄 FK 인덱스 다섯(V112~V116)이다. 그런데 `--impl-prep spec/conventions/` 실행 중 번들에 우연히 딸려온 Cafe24 API 카탈로그 문서(frontmatter 누락·restricted 각주 불일치·Overview 헤딩 누락)에 대한 발견사항 3건을 이 PR 이 `cafe24-backlog-residual.md` 에 등재했다. 내용 자체는 코드/인덱스 작업과 무관하다. 다만 이 처리 방식(발견했지만 이 PR 에서 고치지 않고 별도 트래커에 defer)은 이 저장소가 반복적으로 채택해 온 정석 패턴이며, PR 자신의 체크리스트(`plan/in-progress/spec-draft-deletion-cascade-indexes.md` 의 `--impl-prep` 처분 항목)에도 "무관한 cafe24 카탈로그 위생 → `cafe24-backlog-residual.md` 에 등재" 라고 명시적으로 밝혀 두었다. 즉 스코프를 확장(그 자리에서 고침)한 것이 아니라 스코프 밖임을 인지하고 별도 문서에 기록만 한 것 — 의도 이상의 "구현" 변경은 없다.
  - 제안: 조치 불필요. PR 설명·plan 체크리스트가 이미 이 편입을 설명하고 있어 리뷰어 판단에 참고만 하면 된다.

- **[INFO]** consistency-check 산출물 2세트(`review/consistency/2026/09/18/13_44_08/**`, `.../13_55_55/**`)가 diff 에 포함됨
  - 위치: `review/consistency/2026/09/18/13_44_08/*`, `review/consistency/2026/09/18/13_55_55/*` (SUMMARY.md·meta.json·checker 5종·`_retry_state.json`·`_target/` 스냅샷)
  - 상세: 코드 변경이 아니라 이 프로젝트 워크플로가 강제하는 `--spec`/`--impl-prep` 게이트의 산출물이다. `spec-impact` 를 가진 plan 은 이 게이트 통과 증거를 남기는 것이 규약(project-planner 필수 절차)이므로 스코프 이탈이 아니다.

- **[INFO]** 신규 e2e 검증 파일이 "리소스별 삭제 e2e 에 얹기"가 아니라 "인덱스 전용 파일"로 신설됨
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (전체 신규 파일)
  - 상세: 기존 선례(V111)는 인덱스 검증을 해당 리소스의 삭제 e2e 스펙 파일에 얹는 패턴이었는데, 이번엔 3개 테이블에 걸친 다섯 인덱스를 위해 전용 파일을 새로 두었다. 기능 확장이나 무관한 수정은 아니고(정확히 V112~V116 다섯 인덱스만 검증), 파일명·경로도 기존과 충돌 없이 컨벤션(kebab-case + `.e2e-spec.ts`)을 지킨다. 이미 이번 PR 의 `--impl-prep` naming_collision 검토에서도 "패턴 이원화, 충돌 아님"으로 INFO 처리됨 — 스코프 관점에서도 문제 삼을 사안은 아니나, 다음에 유사 인덱스 작업이 있을 때 두 패턴 중 하나로 수렴할지 검토 대상으로만 남긴다.

## 대상 파일별 스코프 적합성 요약

- `codebase/backend/migrations/V112~V116.{sql,conf}` (10개 신규 파일): 각각 정확히 인덱스 하나(`CREATE INDEX CONCURRENTLY` + 선행 `DROP INDEX CONCURRENTLY IF EXISTS`)만 담고 있고, 부수적인 리팩토링·포맷팅·주석 잡음 없음. 헤더 주석은 실측치·근거 인용으로 전부 이번 작업 직결.
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`: 신규 다섯 인덱스만 검증. `EXPECTED` 배열이 정확히 V112~V116 이름·정의와 1:1 대응, 무관한 단언·헬퍼 추가 없음.
- `spec/1-data-model.md`, `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`: 각 diff hunk 가 plan 문서의 S1~S4 항목과 문자 그대로 대응한다. 기존 문장·인접 서술을 건드리지 않고 새 행/문구만 추가 — 소급 수정이나 무관한 정리 없음.
- `plan/in-progress/spec-draft-deletion-cascade-indexes.md`: 신규 plan 문서, 이번 작업 범위 그대로.
- `plan/in-progress/cafe24-backlog-residual.md`: 위 INFO 항목 참고 — 무관하지만 defer 로만 처리, 코드/스펙 변경 없음.
- `review/consistency/**` 2세트: 게이트 산출물, 스코프 이탈 아님.

불필요한 리팩토링, 요청 밖 기능 확장, 무관한 임포트·설정 변경, 의미 없는 포맷팅 뒤섞임은 발견되지 않았다. 인덱스 개수를 트래커 원안(1개)에서 다섯으로 넓힌 것은 "기능 확장"이 아니라 실측에 근거한 스코프 재정의이며, plan 의 `## Rationale > 왜 범위를 트래커 항목보다 넓혔나` 절과 2회의 consistency-check(BLOCK: NO)로 그 근거가 명시적으로 문서화·검증되어 있다.

## 요약

변경 셋은 "삭제 연쇄 FK 인덱스 다섯(V112~V116)" 이라는 단일 목표에 정확히 수렴한다 — 마이그레이션 10개·전용 e2e 1개·spec 4개 문서의 대응 갱신·plan 문서·게이트 산출물이 전부 그 목표에 직결된다. 유일하게 눈에 띄는 "무관한" 내용(cafe24 카탈로그 위생 3건)은 이 PR 이 고치지 않고 별도 트래커에 등재만 했으며, 그 처리 자체가 이 저장소가 여러 차례 채택해 온 올바른 defer 패턴이라 스코프 위반으로 보기 어렵다. 포맷팅 뒤섞임, 불필요한 리팩토링, 사용하지 않는 임포트, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도

NONE
