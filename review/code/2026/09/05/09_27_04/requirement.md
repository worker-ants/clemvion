# 요구사항(Requirement) 리뷰

## 개요

이번 diff 는 애플리케이션 코드가 아니라 **문서/스펙/plan 산출물**로 구성된다 — `codebase/backend/migrations/README.md`(컨벤션 개정), `spec/conventions/migrations.md`(포인터 추가), `spec/conventions/review-citations.md`(신설), `plan/complete/spec-draft-migration-rerun-and-citations.md`(신규 완료 draft), `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크박스 클로징 + 신규 백로그 2건), 그리고 `review/consistency/2026/09/05/09_13_39/**`(해당 draft 에 대한 consistency-check 산출물). 두 개의 백로그 항목("`CREATE INDEX CONCURRENTLY` 재실행 위험 규약화", "리뷰 세션 ID 인용 규약화")을 닫는 것이 이번 변경의 "요구사항"이다.

검증 방법: 문서가 주장하는 실측치·선례·인용을 저장소에서 직접 재현/대조했다 (`git grep`, 마이그레이션 파일 원문, `git log`). 저장소 파일은 전혀 수정하지 않았으며 (read-only 검증만 수행), 작업 종료 시점 `git status --short` 로 확인 — 세션 산출 디렉터리(`review/code/2026/09/05/09_27_04/`) untracked 외 잔여물 없음.

## 발견사항

- **[INFO]** 실측 수치 전수 재현 — 모두 일치
  - 위치: `spec/conventions/review-citations.md:14` (및 `plan/complete/spec-draft-migration-rerun-and-citations.md` §2.1 표)
  - 상세: 문서가 주장하는 핵심 수치를 `origin/main`(`codebase/`) 대상으로 직접 재계산했다 — `git grep -oE '[0-9]{2}_[0-9]{2}_[0-9]{2}' … -- 'codebase/*'` → **107 파일 / 514 회** (문서 주장과 정확히 일치), 전체 경로 형태(`review/<type>/YYYY/MM/DD/hh_mm_ss`) → **10 파일 / 15 회** (문서의 "10개"·"15회" 둘 다 일치), bare = 514-15 = **499** (일치). `review/code/2026/05/26/12_10_38` 이 워킹트리에 없고 `git log -- <path>` 이력에는 `f7c56bf0a`(삭제 커밋)로 남아있다는 주장도 그대로 재현됨. `roles.guard.spec.ts`/`sanitize-loader-error.ts` 의 `code:` frontmatter 인용도 실제 파일에서 전체 경로 형태로 확인됨.
  - 제안: 없음 (정보성 — 신뢰도 근거로 기록).

- **[INFO]** 마이그레이션 파일 선례 서술과 실제 파일 내용 일치
  - 위치: `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 절 (전체 파일 컨텍스트 141~159행)
  - 상세: V110(`V110__schedule_workspace_next_run_index.sql`)이 실제로 `DROP … IF EXISTS` → `CREATE … CONCURRENTLY IF NOT EXISTS` → `DROP … IF EXISTS` 3-statement 순서를 취하고 있음을 확인했다. V056·V106 원문도 확인 — V056 은 CREATE→DROP 2-statement(0-단계 DROP 없음)로 문서 주장과 일치.
  - 제안: 없음.

- **[INFO]** `V106` 을 V056 과 동일 위험군으로 서술한 것은 약간의 과일반화
  - 위치: `codebase/backend/migrations/README.md:159` ("선례: `V110`… 그 이전의 `V056`·`V106` 은 0) 이 없어 같은 위험을 갖습니다") — 동일 문구가 `plan/complete/spec-draft-migration-rerun-and-citations.md` 부록 A 말미에도 있음
  - 상세: 이 절은 명시적으로 "**인덱스 교체**" 패턴을 다루는데, `V106__schedule_trigger_id_index.sql` 은 옛 인덱스를 대체하는 것이 아니라 **신규 인덱스를 처음 추가**하는 단일 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 문 하나뿐이다(원문 확인 완료 — 짝이 되는 `DROP` 자체가 없음). `IF NOT EXISTS` 가 유효성을 안 본다는 근본 결함은 V106 에도 있지만, 그 결과는 "인덱스 0개로 회귀"가 아니라 "애초에 없었던 것과 같은 상태(invalid 인덱스가 이름만 점유)"로, V056/V110 이 겪는 "**있던** 인덱스가 사라지는" 시나리오와는 성격이 다르다. "같은 위험을 갖습니다" 라는 한 문장으로 뭉뚱그리면 독자가 V106 도 인덱스 **교체** 사례로 오해할 소지가 있다.
  - 제안: (문서 성격상 CRITICAL/WARNING 은 아님 — 순수 서술 정밀도 문제) "V106 은 교체가 아니라 신규 추가라 옛 인덱스 상실 위험은 없으나, `IF NOT EXISTS` 가 유효성을 보지 않는 동일 결함으로 invalid 인덱스가 방치될 수 있다" 정도로 각주를 분리하면 더 정확함. 급하지 않음.

- **[INFO]** consistency-check 가 지적한 WARNING 2건 모두 최종본에서 해소 확인
  - 위치: `review/consistency/2026/09/05/09_13_39/SUMMARY.md:20-21` (WARNING #1, #2) vs 최종 `codebase/backend/migrations/README.md:127`, `plan/in-progress/spec-draft-nullable-notation-followups.md:400,436`
  - 상세: WARNING #1("§5 CREATE 단일 제한과 부록 A 3-statement 패턴의 스코프 모호")은 최종 README.md 127행에 "제한 대상은 **CREATE 의 개수**입니다 — … DROP … 은 이 제한 밖" 문구가 추가되어 해소됨. WARNING #2(출처 plan 체크박스 미클로징)는 `spec-draft-nullable-notation-followups.md` 의 두 항목이 `- [x]` + 포인터로 닫혀 해소됨. INFO #1(원인 레이어: PostgreSQL vs Flyway mixed)도 README.md §5 문구가 "Flyway 의 mixed 판정" 으로 정정되어 반영됨. INFO #3(넘버링 스타일 `5-1.` 충돌)도 실제로는 새 서브섹션 헤더를 만들지 않고 §5 본문에 접어 넣는 방식으로 우회되어 해소됨. INFO #6(§3 후속 항목 산문→체크박스)도 최종본에서 `- [ ]` 로 전환됨.
  - 제안: 없음 — 이미 반영된 개선사항이므로 후속 조치 불필요.

- **[INFO]** `spec/conventions/swagger.md` §1-4·§3 "소급 정리 안 함" 선례 인용 정확
  - 위치: `spec/conventions/review-citations.md:62` / `plan/complete/spec-draft-migration-rerun-and-citations.md` §2.3 근방
  - 상세: `swagger.md:127`("적용 범위 — 신규 변경 한정: 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다")과 §3 말미("기존 DTO 는 소급 정리 대상이 아니다 — §1-4 신설 때와 같은 원칙이다")를 직접 확인 — 인용이 실제 문서 내용과 정확히 부합.
  - 제안: 없음.

## 요약

애플리케이션 코드 변경은 없고, 실측 기반으로 두 개의 마이그레이션/리뷰 컨벤션 백로그 항목(CONCURRENTLY 재실행 안전성 패턴, 리뷰 세션 인용 규약)을 성문화하는 순수 문서/spec PR 이다. 문서가 제시하는 정량적 근거(107파일·514회, 전체경로 10파일·15회, bare 499회, 삭제된 세션 경로 1건 등)를 저장소에서 직접 재현한 결과 전부 일치했고, 참조된 마이그레이션 파일(V056/V106/V110) 원문도 서술과 부합했다. 선행 consistency-check(WARNING 2건 + INFO 다수)가 지적한 사항은 모두 최종본에 반영되어 해소된 상태이며, plan 체크박스 클로징·신규 백로그 등재(mixed=true 결정, bare 인용 8건)도 빠짐없이 이뤄졌다. 유일하게 남는 것은 V106 을 "인덱스 교체"군 선례로 뭉뚱그린 서술의 정밀도 문제로, 기능적 결함이 아닌 표현 개선 여지(INFO)에 그친다.

## 위험도
NONE
