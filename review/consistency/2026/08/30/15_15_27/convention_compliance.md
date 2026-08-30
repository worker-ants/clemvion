# 정식 규약 준수 검토 — spec/data-flow/ (--impl-done)

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 실제 diff(`origin/main...HEAD`)는 `spec/data-flow/**` 를 전혀 건드리지 않는다. 변경된 파일은 전부
  backend 테스트/가드 코드다:
  - `codebase/backend/src/common/__test-utils__/source-scan.ts` (+`source-scan.spec.ts`) — `countRawUpdateReturning` / `hasRawUpdateReturning` 신설
  - `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 전수 발견형 가드(`findUnguarded`) 신설
  - `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (+`.spec.ts`) — raw `UPDATE … RETURNING` 반환 타입을 `{...}[]` → `[{...}[], number]` 튜플로 정정
- 즉 이번 변경은 **API 응답·이벤트 페이로드·엔드포인트·spec 문서를 신설/변경하지 않는** 순수 내부
  테스트 하드닝이다. `spec/conventions/**` 23개 파일을 전수 확인했으나 raw SQL
  `UPDATE/DELETE … RETURNING` 반환 shape 나 이런 소스-스캔 가드 자체를 규율하는 정식 규약은
  존재하지 않는다(`grep -l "RETURNING\|updateReturningRows\|source-scan" spec/conventions/*.md` → 0건).
  따라서 이 변경 자체가 위반할 수 있는 "정식 규약"이 없다.
- target 인 `spec/data-flow/` 중 프롬프트에 전문이 포함된 문서: `0-overview.md`, `2-auth.md`,
  `1-audit.md`, `3-execution.md`, `9-observability.md`, `11-workflow.md`. 나머지 10개
  (`4-file-storage.md`, `5-integration.md`, `6-knowledge-base.md`, `7-llm-usage.md`,
  `8-notifications.md`, `10-triggers.md`, `12-workspace.md`, `13-agent-memory.md`,
  `14-chat-channel.md`, `15-external-interaction.md`)는 컨텍스트 예산 초과로 절단됐다 — 이번 diff 가
  직접 건드린 `kb-stats.helper.ts`(knowledge-base 도메인) 관련 서술은 `6-knowledge-base.md` 에 있을
  것으로 추정되나 절단되어 이 검토에서 직접 대조하지 못했다(§발견사항 INFO 참조).

## 발견사항

이번 diff·bundle 범위에서 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

- **[INFO] 절단된 `6-knowledge-base.md` 를 이번 raw-RETURNING 가드 관점에서 별도 확인 필요**
  - target 위치: `spec/data-flow/6-knowledge-base.md` (본 프롬프트에서 컨텍스트 예산 초과로 절단됨)
  - 위반 규약: 해당 없음(직접 대조 불가 — 규약 위반을 주장하는 것이 아니라 범위 공백을 알리는 절차적 노트)
  - 상세: diff 가 고친 `kb-stats.helper.ts` 의 `UPDATE knowledge_base … RETURNING` 은 반환값이
    `{...}[]` 가 아니라 `[{...}[], number]` 튜플이라는 사실이 이번 PR 의 핵심 정정이다. `2-auth.md`
    §2.3(OAuth state one-shot `DELETE … RETURNING *`)·`3-execution.md` §1.4(재개 진입
    `UPDATE … RETURNING`)는 이미 이 튜플 계약을 정확히 서술하고 있어 정합적이다. `6-knowledge-base.md`
    가 `kb-stats.helper.ts` 의 raw UPDATE 를 문서화하고 있다면 같은 튜플 계약을 반영해야 하는데,
    본 절단으로 그 서술을 직접 확인하지 못했다.
  - 제안: 후속 라운드(또는 별도 `Read`)에서 `spec/data-flow/6-knowledge-base.md` 를 직접 열어 `kb_stats`
    관련 Schema 매핑 서술이 `{...}[]` 형태로 남아있지 않은지만 확인하면 된다 — 이번 diff 는 코드
    주석만 고쳤고 `6-knowledge-base.md` 자체를 건드리지 않았으므로, 원래도 그 서술이 부재했거나
    올바랐을 가능성이 높다(코드 diff 의 `RETURNING` 절 자체는 신규가 아니라 기존 로직의 주석/타입
    정정이다).

- **[INFO] 이번 하드닝이 근거로 삼는 새 helper 명명은 기존 자매 함수와 일관적**
  - target 위치: 해당 없음 (spec 문서가 아니라 코드) — 참고용
  - 위반 규약: 없음 — 정식 규약 위반이 아니라 준수 확인
  - 상세: `countRawUpdateReturning` / `hasRawUpdateReturning` 은 기존 `countCalls` 와 동일한
    `camelCase` 함수명·`count*`/`has*` 접두 관례를 따른다. `spec/conventions/` 어디에도 backend
    내부 테스트 유틸 명명 규약은 없으므로 이 판단은 규약 문서가 아니라 저장소 관례상의 정합성
    확인이다.
  - 제안: 조치 불필요.

## 요약

이번 diff(`origin/main...HEAD`)는 `spec/data-flow/**` 를 포함해 어떤 `spec/**` 문서도 변경하지 않았고,
raw `UPDATE/DELETE … RETURNING` 소스-스캔 가드 하드닝은 API 표면·이벤트 페이로드·문서 구조·명명
규약 어느 것도 신설·변경하지 않는 순수 내부 테스트 인프라 변경이다. `spec/conventions/` 23개 파일을
전수 확인했으나 이 변경 클래스를 규율하는 정식 규약이 존재하지 않으므로 위반할 대상 자체가 없다.
프롬프트에 전문이 포함된 6개 data-flow 문서(`0-overview.md`/`2-auth.md`/`1-audit.md`/`3-execution.md`/
`9-observability.md`/`11-workflow.md`)는 Overview/본문/Rationale 3섹션 구조, `0-` prefix, 감사 액션
`<resource>.<verb>` 명명(`audit-actions.md`), Flyway `V<N>__snake_case` 명명(`migrations.md`),
`AbortSignal` 계약(`node-cancellation.md`) 등 관련 정식 규약을 정확히 준수하고 있음을 재확인했다.
컨텍스트 예산으로 절단된 10개 문서 중 `6-knowledge-base.md` 만 이번 diff 대상 코드와 도메인이
겹치므로 INFO 로 후속 확인을 남긴다.

## 위험도

NONE
