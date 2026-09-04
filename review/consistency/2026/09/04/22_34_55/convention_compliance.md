# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-schedule-index.md`

## 검토 범위·방법

target 은 `plan/in-progress/spec-draft-schedule-index.md` (project-planner 가 `spec/1-data-model.md`
§3 인덱스 전략 표를 정정하기 위해 작성한 spec draft). 번들에 포함된 `spec/conventions/**` 중
`migrations.md`·`spec-impl-evidence.md` 는 **컨텍스트 예산 초과로 본문이 절단**되어 있었으므로,
저장소의 실제 파일(`spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`)을
직접 열어 대조했다. 아울러 `.claude/skills/project-planner/SKILL.md`, `.claude/docs/plan-lifecycle.md`,
실제 `codebase/backend/migrations/` 디렉토리, `spec/1-data-model.md` §3 원문, target 이 인용한
출처 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md`)를 함께 확인했다.

## 발견사항

- **[INFO]** frontmatter `started` 날짜가 시스템 현재일보다 하루 앞섬
  - target 위치: frontmatter `started: 2026-09-05`
  - 위반 규약: 직접 위반은 아님 — `plan-lifecycle.md §4` 는 "ISO 날짜(YYYY-MM-DD)" 형식만 요구하고 미래 날짜를 명시적으로 금지하지 않는다.
  - 상세: 세션의 현재일은 2026-09-04 인데 `started` 는 2026-09-05 로 하루 앞서 있다. 같은 worktree 의 형제 plan(`spec-draft-nullable-notation-followups.md`)은 `started: 2026-09-04` 로 오늘 날짜를 쓴다 — 국소적 관행과 어긋난다.
  - 제안: 오타인지 확인 후 `2026-09-04` 로 정정하거나, 의도된 값이면 그대로 두어도 규약 위반은 아니다.

- **[INFO]** §3 "답은 (c)" 단락의 배율 계산이 표 안의 다른 기준선과 어긋나 보임 (규약 밖 참고 사항)
  - target 위치: "### 답은 (c) — 선두 컬럼을 술어로 바꾼다" 문단 — "현재 상태 대비 31배, 5,000행에서도 6.6배다."
  - 위반 규약: 없음 — 이 항목은 `spec/conventions/**` 명명·포맷·구조 규약과 무관한 **수치 정합성** 문제이며, 본 검토자의 1차 스코프(정식 규약 준수) 밖일 가능성이 높다.
  - 상세: §1 표 기준 "현재"(부분 인덱스, 200,000행) 실행 시간은 7.80 ms, (c) 는 0.188 ms 다. 7.80 / 0.188 ≈ 41.5배인데 본문은 "현재 상태 대비 31배" 라고 적었다. 5.86(= (a) 인덱스 없음) / 0.188 ≈ 31.2배로, 서술된 "31배" 는 "현재" 가 아니라 (a) 기준과 더 가깝다. 즉 비교 기준선 레이블과 계산이 서로 다른 행을 가리키는 것으로 보인다.
  - 제안: 정식 규약 준수 관점의 findings 는 아니므로 이 보고서에서는 등급을 매기지 않는다. 다만 이 문서가 그대로 `spec/1-data-model.md` 서술 근거로 흡수될 예정이므로, 기술 정확성 검토(consistency-checker 의 다른 관점 또는 별도 review) 쪽에서 재확인을 권장한다.

## 규약별 점검 결과 (위반 없음 확인)

- **명명 규약**: draft 파일명 `plan/in-progress/spec-draft-schedule-index.md` 는 `project-planner/SKILL.md §작업 워크플로 3` 의 `plan/in-progress/spec-draft-<name>.md` 패턴을 그대로 따른다. §3/§4 의 표 행 포맷(`(컬럼1, 컬럼2)` 튜플 + 말미 `CONCURRENTLY, V<NNN>` 인용)은 `spec/1-data-model.md` §3 기존 행(예: V095/V048/V047/V012)의 관행과 일치한다. 신규 버전 `V110` 은 `codebase/backend/migrations/` 실측 결과 현재 max 가 `V109` 이므로 `migrations.md §2` "신규 V번호는 항상 현재 main 의 max(V)+1" 을 만족한다. `V106` 인용도 실제 존재하는 `V106__schedule_trigger_id_index.sql`(`CREATE INDEX CONCURRENTLY … idx_schedule_trigger_id`)과 내용·"CONCURRENTLY" 표기 모두 일치한다.
- **출력 포맷 규약**: 대상 없음(API 응답·이벤트 페이로드·에러 코드를 다루는 문서가 아니다) — 해당 규약 적용 범위 밖.
- **문서 구조 규약**: draft 는 body 뒤에 `## Rationale` 을 두어 `project-planner/SKILL.md §작업 워크플로 3` ("본문 끝에 `## Rationale` 로 결정 근거 명시")를 만족한다. frontmatter 는 `worktree`/`started`/`owner` 필수 3필드를 모두 포함(`plan-lifecycle.md §4`)하고, `title`/`status`/`priority`/`spec_impact` 추가 필드도 형제 plan(`spec-draft-nullable-notation-followups.md`)과 동일한 스타일이다. `spec_impact` 는 리스트(`- spec/1-data-model.md`) 형식으로 Gate C 스키마(`plan-lifecycle.md §5`, bare string/빈 배열 금지)에 맞다 — 다만 현재는 `in-progress` 단계라 Gate C 자체는 아직 발동 대상이 아니다(완료 이동 시 재확인 필요).
- **API 문서 규약**: 대상 없음(OpenAPI/Swagger 데코레이터·DTO 가 등장하지 않는다) — 해당 규약 적용 범위 밖.
- **금지 항목**: `migrations.md §3` "append-only 원칙"(이미 main 에 들어간 V<N> 수정 금지)을 이 draft 는 위반하지 않는다 — V106 은 실제 SQL 을 고치는 것이 아니라 spec 표에 **누락된 행을 추가**할 뿐이고, V110 은 아직 파일이 존재하지 않는 신규 번호를 spec 상에서 예고하는 것뿐이다(§5 에서 실제 마이그레이션 작성은 developer 트랙으로 명시적으로 분리). `migrations.md §1` 의 alphanumeric suffix 금지 등 다른 금지 항목도 해당 사항 없음.
- **역할 경계 (CLAUDE.md)**: `spec/` 변경은 project-planner 담당이라는 원칙에 맞게 `owner: planner`, 변경 대상도 `spec/1-data-model.md` 하나뿐이다. §5 에서 "인덱스 교체는 마이그레이션이라 developer 트랙" 이라고 명시해 실제 DDL 작성을 developer 에게 넘기는 것도 CLAUDE.md 의 `spec/` vs `codebase/` 담당 분리 원칙과 일치한다.

## 요약

target 은 이 저장소의 정식 규약(`spec/conventions/migrations.md`, plan/spec-draft 명명·frontmatter 관행)을 위반하는 지점을 찾지 못했다 — 파일 경로, frontmatter 스키마, `## Rationale` 섹션 배치, 마이그레이션 버전 번호(단조 증가 V109→V110, 기존 V106 과의 내용 일치), append-only 원칙, spec/codebase 역할 분리가 모두 관행과 일치한다. 발견한 두 항목은 모두 INFO 수준이며 그중 하나(“31배” 배율 서술)는 정식 규약이 아니라 수치 정합성 문제로, 정확성 검토(다른 관점)에서 재확인을 권한다.

## 위험도

NONE
