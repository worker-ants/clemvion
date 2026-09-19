# Rationale 연속성 검토 — `plan/in-progress/column-guard-gaps.md` (target: `spec/1-data-model.md`, --impl-done)

## 스코프 정정 확인

프롬프트 번들의 `scope=spec/2-navigation/` 는 harness 선례에 따른 우회 경로이고, 프롬프트 하단 "(main 추가)" 블록이 지시한 대로
실제 대상은 `spec/1-data-model.md` (frontmatter `code:` · §2.16 ModelConfig · §2.20 AssistantSession · `## Rationale`)다. 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/column-guard-gaps-5e2c8a`)를 절대경로로 직접 읽어 다음을 대조했다:
`spec/1-data-model.md`, `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`(`git diff origin/main...HEAD`),
`plan/in-progress/column-guard-gaps.md`, `plan/complete/entity-column-declaration-drift.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
해당 항목, 그리고 두 라운드 코드 리뷰(`review/code/2026/09/20/01_00_21`, `01_24_51`)의 SUMMARY/RESOLUTION.
`spec/2-navigation/` 자체 본문·Rationale은 이번 구현과 무관해 대조에서 제외했다(이전 `--impl-prep` 라운드(`00_34_58`)가 이미 무관성을 확인했고, 이번 diff 는 그 이후 `codebase/` 변경이 없다).

이 라운드는 코드 변경이 이미 확정(`d8fb708d5` → 리뷰 W2 조치 `a71642fe0`)되고 2라운드 `/ai-review` 가 Critical/Warning 0(코드)로 수렴한 뒤의
`--impl-done` 이다 — 대상 diff 는 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 1개 파일, 순수 테스트 추가다.

## 발견사항

없음.

검토한 세 축 모두 기존 Rationale과 정합했다:

1. **`code:` 전용 e2e 가드 셋 원칙** (`spec/1-data-model.md` `## Rationale` "`code:` 에 전용 e2e 가드 셋 (2026-09-19)") — "인덱스·제약은
   선언→DB 한쪽, 컬럼 정의는 양방향"이라는 명시된 비대칭을 diff 가 뒤집지 않는다. 신규 테스트 둘(읽기 전용 세션 방어 확인 · `default` RETURNING
   왕복)은 모두 기존 "컬럼" describe 블록 안, 기존 파일(`entity-schema-declarations.e2e-spec.ts`) 안에 추가됐다 — frontmatter `code:`
   목록(`spec/1-data-model.md:9-12`)에 새 항목이 늘지 않았다. 같은 Rationale이 명시적으로 "넣지 않은 것"으로 못 박은 "자기 기능의
   인덱스·컬럼을 곁들여 확인하는 기능 e2e"에도 해당하지 않는다 — 두 신규 테스트는 이 문서가 이미 다루는 두 컬럼(`model_config.kind`,
   `workflow_assistant_session.last_interaction_at`)의 컬럼 층 사실만 본다.
2. **읽기 전용 세션 "예방" 테스트 신설이 과거 결정의 연장인지** — `plan/complete/entity-column-declaration-drift.md`의 4라운드 리뷰가
   "탐지만 있고 예방이 살아 있는지 보는 테스트가 없다"를 **동작 결함 0의 "수렴 예외"**로 트래커에 넘겼고
   (`plan/in-progress/spec-draft-nullable-notation-followups.md` "컬럼 층 가드의 남은 빈칸" 항목), 이번 plan(`column-guard-gaps.md`)이
   그 정확한 문구("같은 `DataSource` 로 `CREATE TEMP TABLE` 을 시도해 read-only 거부를 단언하는 `it` 하나면 된다")를 그대로 구현했다.
   과거 결정(읽기 전용 세션 헬퍼 자체)을 뒤집지 않고, 그 헬퍼를 `readOnlyDataSourceOptions()`로 추출해 컬럼 층 테스트와 신규 테스트가
   공유하게 한 것도 리팩터일 뿐 동작 변경이 아니다(2라운드 리뷰가 소스 대조로 확인).
3. **`default` RETURNING 왕복 테스트가 "e2e 전체로 확인한다"는 과거 서술과 충돌하는지** — `entity-column-declaration-drift.md`의
   "런타임 영향" 절은 그 시점의 검증 수준("e2e 전체로 확인한다")을 적었을 뿐, 좁은 통합 테스트를 명시적으로 기각한 문장이 아니다. 오히려
   같은 plan의 4라운드 리뷰(`18_07_01/testing.md`)가 "안전망이 실제로 작동함을 겨냥한 좁은 통합 테스트"로 승격을 이미 제안했고, 이번
   구현은 그 제안을 따른 것이라 "결정의 무근거 번복"이 아니라 "새 Rationale(트래커 항목 + plan 본문 + 테스트 바로 위 JSDoc)을 갖춘 예정된
   후속"이다. 값 자체(`kind` default=`'chat'`, `last_interaction_at` default=`now()`)도 `spec/1-data-model.md` §2.16(1023행 이전, 643행)·
   §2.20(802행)의 서술과 일치한다.

**부수 확인** — 트래커(`spec-draft-nullable-notation-followups.md` 해당 항목)가 아직 존재하지 않는 `plan/complete/column-guard-gaps.md`를
선인용하는 것은 2라운드 코드 리뷰(`01_24_51` WARNING #2)가 이미 "관측 시점의 산물, 마무리 커밋에서 `git mv`로 함께 살아난다"로 처분했고,
인용 경로의 **내용**(대상 컬럼 · 뮤턴트 셋 · plan 링크)도 `plan/in-progress/column-guard-gaps.md`의 실제 내용과 일치함을 확인했다 — 이는
Rationale 설계 원칙과 무관한 plan 위생 이슈이므로 여기서 새 항목으로 올리지 않는다.

## 요약

이번 `--impl-done` diff(`entity-schema-declarations.e2e-spec.ts` 테스트 2건 추가 + 헬퍼 추출)는 `plan/complete/entity-column-declaration-drift.md`
4라운드 리뷰가 "동작 결함 0"으로 남긴 두 "수렴 예외"(예방 계층 자체의 회귀 테스트 부재, `default` RETURNING 미검증)를 트래커가 이미 좁혀 둔
scope 그대로 닫는 계획된 후속 작업이다. `spec/1-data-model.md` "`code:` 에 전용 e2e 가드 셋" Rationale이 규정한 "인덱스·제약은 단방향,
컬럼은 양방향" 비대칭이나 "기능 e2e를 넣지 않는다" 원칙을 건드리지 않고, frontmatter `code:` 목록에도 항목을 추가하지 않았다. 기각된
대안을 재도입하지도, 과거 결정을 무근거로 번복하지도 않았다 — 오히려 4라운드 리뷰가 명시적으로 제안한 좁은 테스트를 그 제안 문구 그대로
구현했고, 근거(plan·트래커·spec 컬럼 표)가 모두 갖춰져 있다. Rationale 연속성 관점에서 차단 사유가 없다.

## 위험도

NONE
