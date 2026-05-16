# 성능(Performance) 리뷰

리뷰 대상 커밋: `39c869c5` — docs(infra): README/CHANGELOG/Makefile follow-up + docs-consolidation 사전 결함 동반 해소

## 발견사항

- **[INFO]** Makefile `e2e-test-full` 의 `--build` 플래그로 인한 빌드 오버헤드 — 구조적 의도 확인
  - 위치: Makefile `e2e-test-full` 타겟 (변경 전부터 존재, 이번 커밋은 주석 추가만)
  - 상세: `e2e-up`, `e2e-test`, `e2e-test-full` 세 타겟 모두 `docker compose ... --build` 를 명시한다. 커밋 메시지·README·CHANGELOG 모두 "BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작다" 고 설명하며, 이 설계는 stale 이미지로 인한 사일런트 404 회귀를 방지하기 위한 의도적 트레이드오프다. 실제 레이어 캐시 적중률은 Dockerfile layer 분리 방식에 의존하므로, `package.json` / `package-lock.json` 복사 → `npm ci` → 소스 복사 순서로 layer 를 구성했는지 별도 검토 필요.
  - 제안: Dockerfile 의 dependency 설치 layer 를 소스 복사 layer 와 분리하는 multi-stage 패턴을 이미 적용 중이라면 현재 설계로 충분하다. 미적용 시 `npm ci` layer 가 소스 변경마다 무효화되어 CI 시간이 불필요하게 늘어나므로 Dockerfile layer 순서를 점검할 것.

- **[INFO]** `e2e-test-full` 의 `runner1 && runner2` short-circuit 패턴 — runner2 skip 시 playwright 결과 누락 가능성
  - 위치: Makefile `e2e-test-full` 타겟 (이번 커밋은 설명 주석 추가만, 동작 변경 없음)
  - 상세: `runner1(supertest) && runner2(playwright); STATUS=$$?` 패턴은 runner1 실패 시 playwright 를 실행하지 않는다. 성능 측면에서는 실패 조기 종료로 인프라 점유 시간을 줄이는 효과가 있어 의도적으로 타당하다. 다만 두 runner 를 독립적으로 실행하고 양쪽 결과를 모두 수집해야 하는 시나리오(예: CI 에서 전체 실패 현황 파악)가 생기면 패턴 변경이 필요하다.
  - 제안: 현재 요구사항 기준으로는 적절하다. "supertest 실패 시에도 playwright 를 돌려야 한다" 는 요구가 생기면 `runner1; R1=$$?; runner2; R2=$$?; [ $$R1 -eq 0 ] && [ $$R2 -eq 0 ]` 형태로 전환한다.

- **[INFO]** 이번 커밋의 리뷰 대상 파일 전체가 문서·plan·review 마크다운이며 실행 로직 변경 없음
  - 위치: CHANGELOG.md, README.md, plan/in-progress/e2e-makefile-followup-2026-05-16.md, review/consistency/\*\*/\*.md
  - 상세: 알고리즘 복잡도, N+1 쿼리, 메모리 할당, 캐싱, 블로킹 I/O, 불필요한 연산, 자료구조, 지연 로딩 등 8개 성능 점검 관점이 모두 해당 없다. 실질적인 실행 코드 변경은 Makefile help 문자열 수정(echo 4줄)과 주석 블록 추가뿐이며 런타임 성능에 영향 없다.
  - 제안: 해당 없음.

## 요약

이번 커밋은 문서(CHANGELOG, README), Makefile help 텍스트, plan/review 마크다운만을 수정한 순수 docs 변경이다. 실행 코드 변경이 없으므로 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O 등 핵심 성능 관점은 모두 해당 없다. 유일한 성능 관련 관찰은 `--build` 플래그의 의도적 트레이드오프(매 실행 빌드 vs. stale 이미지 회귀 방지)이며, 커밋 메시지와 README 가 그 근거를 명시적으로 기록하고 있다. Dockerfile layer 분리 설계가 잘 되어 있다면 실제 오버헤드는 미미하다. 성능 측면의 신규 위험 요소는 없다.

## 위험도

NONE
