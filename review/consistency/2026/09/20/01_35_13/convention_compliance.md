# 정식 규약 준수 검토 — 컬럼 층 가드 빈칸 (column-guard-gaps)

## 검토 범위 정정

번들이 지정한 target(`spec/2-navigation/`)은 이 구현과 무관하다. 프롬프트 말미의 orchestrator
보정에 따라, 실제 대상은 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/column-guard-gaps-5e2c8a`)
기준 다음 두 가지다:

- `spec/1-data-model.md` — frontmatter `code:`, §2.16 ModelConfig `kind`, §2.20 AssistantSession
  `last_interaction_at`, `## Rationale` "`code:` 에 전용 e2e 가드 셋 (2026-09-19)" (이번 diff로 변경되지
  않음 — 기존 내용을 규약 대조용 컨텍스트로 확인)
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 이번 diff 의 유일한 변경 파일
  (테스트 106줄 추가/12줄 변경, 106+/12-)

`spec/2-navigation/**` 는 이 브랜치에서 델타 0(정상)이라 별도로 다루지 않았다.

## 발견사항

검토한 5개 관점(명명 규약·출력 포맷 규약·문서 구조 규약·API 문서 규약·금지 항목) 전부에서
**규약 위반을 발견하지 못했다.** 아래는 확인 과정에서 실측한 근거다.

- **명명 규약**: 신규 테스트 파일은 없다(기존 `entity-schema-declarations.e2e-spec.ts` 확장). 신규
  `describe`/`it` 제목("비교기 연결은 읽기 전용이다 — DDL 을 거부한다", "선언한 DB 기본값은 값을
  생략한 insert 뒤 엔티티로 돌아온다 — …")은 같은 파일의 기존 제목 스타일(한국어 서술문 + `—` 구분)과
  일치한다. 신규 helper 함수명 `readOnlyDataSourceOptions()` 도 기존 `dataSourceOptions()` 명명
  패턴을 그대로 따른다.
- **출력 포맷 규약** (`spec/conventions/raw-query-results.md`): 신규 테스트가 쓰는 raw SQL은 전부
  `INSERT … RETURNING`(`user`/`workspace`/`workflow` 삽입)과 `SELECT now() AS now` 뿐이다. 이 규약의
  튜플-언랩 불변식(a)은 `UPDATE`/`DELETE … RETURNING` 에만 적용되고 `INSERT … RETURNING` 은 명시적
  비대상(행 배열)이라, `const [user] = (await qr.query(...))` 형태의 배열 구조분해는 규약과 정합한다.
  컬럼명도 `id`/`now`처럼 이미 snake_case(대소문자 차이 없음)라 (b) 위반도 없다. `updateReturningRows`
  헬퍼를 거치지 않은 것은 대상 쿼리가 애초에 그 헬퍼의 적용 범위 밖이므로 정당하다.
- **문서 구조 규약**: 이번 diff는 `spec/**` 파일을 전혀 건드리지 않는다. `spec/1-data-model.md` 는
  `spec/conventions/spec-impl-evidence.md §1` 의 `EXCLUDE_BASENAMES`(`1-data-model.md` 명시 등재)에
  따라 frontmatter-evidence 빌드 가드 대상이 아니다 — 즉 그 문서의 `code:`/`status`/`pending_plans`
  는 이 규약상 강제 검증 대상이 아니며, 이는 기존 설계이지 이번 변경이 만든 상태가 아니다. 참고로
  `spec/1-data-model.md` frontmatter 는 `code:` 리스트 중간에 YAML 인라인 주석(`# 이 문서의 사실을
  지키는 전용 e2e …`)을 두고 있는데, 이는 `spec-impl-evidence.md §2.1`(2026-09-06 정정: 파서가 빈
  줄·`#` 을 건너뛰도록 고쳐 "주석 뒤 항목 유실" 회귀가 해소됨)이 명시적으로 안전하다고 선언한 형태와
  일치한다 — 위반 아님.
- **API 문서 규약** (`spec/conventions/swagger.md`): 이번 diff에 컨트롤러·DTO·Swagger 데코레이터
  변경이 없다(`ModelConfig`/`WorkflowAssistantSession` 엔티티는 import 만 추가돼 테스트에서 읽기
  용도로만 쓰인다). 해당 규약이 다루는 표면과 diff가 겹치지 않는다.
- **금지 항목**: `spec/conventions/review-citations.md` 관점에서 diff 내 신규 주석의 인용 형태를
  확인했다 — "`컬럼 층 정정(#1358)`"(GitHub 이슈 번호, 이 규약이 규제하는 `review/**` 세션 경로
  bare-시각 표기가 아님)와 "`plan/complete/column-guard-gaps.md`"(계획 경로 인용, 규약 §3 표의
  "codebase/** 코드 주석 인용" 대상은 리뷰 세션 경로의 날짜 누락 여부이지 plan 경로 자체의 존재
  시점이 아니다) 둘 다 이 규약이 금지하는 "bare `hh_mm_ss`" 패턴이 아니다. `plan/complete/…` 경로가
  현재 워크트리에 아직 존재하지 않는 점(= 완료 커밋에서 `git mv` 로 생성 예정)은 이 검토가 참조한
  orchestrator 보정 노트에 "정상이며 2라운드 리뷰에서 이미 처분됨"으로 명시돼 있어 재-flag 하지
  않는다. `spec/conventions/migrations.md`(V번호·append-only)와 `secret-store.md`/`egress-masking.md`
  (시크릿 노출) 관점도 확인했으나 diff에 마이그레이션·시크릿·egress 관련 코드가 없어 해당 없음.
- **plan 거버넌스 참고** (`spec/conventions/spec-impl-evidence.md` Gate C, 참고용): `plan/in-progress/column-guard-gaps.md`
  frontmatter 의 `spec_impact: none` 은 bare scalar sentinel 형태로, Gate C 가 요구하는 "실재 spec
  경로 리스트 또는 bare no-op sentinel(`none`/`없음`/`n/a`/`na`)" 중 후자와 정확히 일치한다(리스트
  원소로서의 `- none` 오형이 아니다). 이번 diff가 `spec/**` 를 건드리지 않는다는 사실과도 부합해
  선언 내용이 실측과 맞다.

## 요약

이번 변경은 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 단일 파일의 테스트
추가/리팩터(읽기 전용 비교기 세션의 회귀 방지 테스트, 선언한 두 DB 기본값의 RETURNING 왕복
테스트, 변수명 정리)로 스펙·API·DTO·마이그레이션·시크릿 표면을 전혀 건드리지 않는다. 명명·raw SQL
결과 처리·문서 frontmatter 예외 처리·리뷰 인용 형식·plan Gate C 선언 등 점검 가능한 모든
`spec/conventions/**` 축에서 기존 규약과 정합했고, 새로 도입된 패턴(헬퍼 통합, 인라인 주석형
`code:` 항목)도 이미 규약이 안전하다고 선언한 형태와 일치한다. CRITICAL/WARNING 급 위반은
발견되지 않았다.

## 위험도

NONE
