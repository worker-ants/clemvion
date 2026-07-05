# 정식 규약 준수 검토 — convention_compliance

- 검토 대상: `plan/in-progress/spec-draft-ai-context-memory-close.md` (spec draft, `--spec` 모드)
- 대조 규약: `.claude/docs/plan-lifecycle.md` §5 Gate C, `spec/conventions/spec-impl-evidence.md`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (build guard 구현)
- 검토 시각: 2026-07-05 12:09
- 선행 리뷰: `review/consistency/2026/07/05/12_02_22/convention_compliance.md` (CRITICAL 1건, BLOCK: YES) — 본 리뷰는 draft 에 추가된 "변경 7"(해소 시도)의 정합성 검증 + 잔여 위반 재점검이 목적

## 변경 7 검증 결과 — 해소 확인 (선행 CRITICAL → 정정 완료)

target 변경 7 (라인 73):

> **`webchat-widget-refactor.md`** frontmatter `spec_impact` 정정 — `[]`(빈 배열) → `none`. **Gate C 필수**: `spec-plan-completion.test.ts` `hasValidSpecImpact([])=false`(빈 배열=`length>0` 위반) 라 이대로 `complete/` 이동 시 unit fail. behavior-preserving(spec 무변경)이므로 `none` 리터럴이 정답 ([plan-lifecycle §5 line 88] 이 정확히 이 함정 처방). `started:2026-06-27`>cutoff(2026-06-04) 라 grandfather 미면제.

실제 구현·규약 대조 결과, 이 수정은 **정확하고 완전**하다.

1. **build guard 소스 직접 확인** — `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`:
   - `hasValidSpecImpact(impact, specExists)`: `impact` 가 배열이면 `impact.length > 0 && impact.every(...)` 를 요구 → `[]` 는 `length===0` 이라 **항상 `false`**(해당 unit: `expect(hasValidSpecImpact([], exists)).toBe(false)`).
   - `impact` 가 문자열이면 `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])` 중 하나여야 `true`(대소문자 무시, trim). draft 가 선택한 `none` 은 이 집합의 정규 원소이자 `plan-lifecycle.md` §5 Gate C 본문의 canonical 예시(`spec_impact: none  # spec 변경 불요`)와 정확히 일치.
   - `isGateCEnforced`: `started >= 2026-06-04` 인 plan 만 강제. `plan/in-progress/webchat-widget-refactor.md:3` 의 실제 frontmatter 는 `started: 2026-06-27` → cutoff 이후 → grandfather 면제 **아님** → 강제 대상. draft 의 주장과 실측이 일치.
2. **선행 CRITICAL 과의 대응** — `review/consistency/2026/07/05/12_02_22/convention_compliance.md` 의 CRITICAL 이 정확히 이 조합(started 2026-06-27 + `spec_impact: []` + `complete/` 이동)을 지적했고, 같은 세션 SUMMARY.md 가 처방한 해소책(`spec_impact: none`, plan-lifecycle §5 line 88 인용)과 draft 변경 7 의 문구가 사실상 그대로 반영됐다.
3. **부수 INFO 2건도 함께 처리됨**:
   - "3-execution §6 선례 파일 경로 모호" INFO → draft 「status 승격 근거」 단락(라인 78)이 이제 `spec/3-workflow-editor/3-execution.md §6` 전체 경로 링크로 명시 — 해소.
   - "ai-context-memory-followup-v2.md 종결 시 spec_impact 부재" INFO → 이 plan 은 `started: 2026-06-03`(cutoff 이전, grandfather 면제)이라 애초에 강제 사항이 아니었고, 선행 리뷰도 "강제 아님 · 선택적 개선" 으로만 분류했다. draft 는 이를 추가하지 않았으나 규약 위반이 아니라 명시적 optional 사안이라 문제 없음.
4. **동봉 위치 확인** — 변경 7 은 변경 6(`git mv` → `complete/`)과 같은 PR 안에서 같은 파일의 frontmatter 수정으로 명시돼 있어, plan-lifecycle.md 의 "이동은 마지막 작업 PR 안에서, plan 이동만 담은 별 PR 분리 금지" 원칙과 충돌하지 않는다.
5. **체크리스트 정합** — 체크리스트(라인 83)가 "[x] ... → 해소(변경 7)" 로 이미 반영 표시했고, 다음 항목(라인 84) "재검증 → BLOCK: NO" 이 미체크 상태로 남아 본 재검증 리뷰가 그 gap 을 메우는 흐름과 일치한다. 모순 없음.

**결론**: 이 CRITICAL 은 완전히 해소됐다. draft 상에 build fail 재현 시나리오가 더 이상 남아 있지 않다.

## 잔여 위반 재점검 (전 관점)

1. **명명 규약** — `spec-draft-ai-context-memory-close.md` 는 기존 `spec-draft-<slug>.md` 패턴(같은 디렉토리의 `spec-draft-c2-atomic-claim.md`, `spec-draft-crash-running-redrive.md`, `spec-draft-concurrency-cap-pr2b.md` 등 다수 선례)과 일치. `webchat-widget-refactor.md` → `complete/` 이동은 `git mv` 특성상 basename 불변이라 명명 충돌 없음.
2. **출력 포맷 규약** — 본 draft 는 API 응답/이벤트 페이로드/에러 코드/DTO 를 신설하지 않는 순수 frontmatter·plan 정리이므로 이 관점은 적용 대상 없음(N/A).
3. **문서 구조 규약** — draft 자신은 `plan/in-progress/*.md` 라 spec 문서의 Overview/본문/Rationale 3섹션 의무 대상(그 의무는 `spec/**` 문서에 적용)은 아니다. 그럼에도 draft 는 배경 → pending_plans 표 → 변경 → Rationale → 체크리스트 구조를 갖춰 리포지토리의 다른 `spec-draft-*.md` 관행과 일관적이다. frontmatter 필수 3필드(`worktree`/`started`/`owner`)도 모두 존재해 `plan-lifecycle.md` §4 스키마를 준수한다.
4. **API 문서 규약** — 해당 사항 없음(OpenAPI/Swagger 데코레이터·DTO 신설 없음).
5. **금지 항목** — Gate C 의 "흔한 실패형"(bare string `spec_impact`, 빈 배열 `spec_impact: []`)이 draft 자신의 frontmatter(라인 27-31, 실제 4-path 리스트)와 변경 2·3·4·5·7 이 지시하는 모든 spec/plan frontmatter 수정안 어디에서도 재현되지 않는다 — 변경 2·3(→ `implemented`, pending_plans 빈 리스트로 정리)과 4·5(→ `partial` 유지, 잔존 항목 리스트 유지)는 `spec-impl-evidence.md` §2.1 스키마(리스트 형식, bare string 금지)를 그대로 따르고, 변경 7 은 위에서 검증한 대로 정합하다.

### 실측 대조 — draft 표(라인 52-56)의 "현 pending_plans" vs 실제 spec frontmatter

4개 spec 파일을 직접 열람해 대조한 결과, draft 표가 서술한 현재 상태(`status: partial` 전부, `pending_plans` 목록)가 실제 파일과 **완전히 일치**한다.

| spec | 실제 `status` | 실제 `pending_plans` | draft 표와 일치 |
|---|---|---|---|
| `4-nodes/3-ai/0-common.md` | partial | `[ai-context-memory-followup-v2]` | 일치 |
| `4-nodes/3-ai/1-ai-agent.md` | partial | `[ai-agent-tool-connection-rewrite, ai-context-memory-followup-v2, exec-park-durable-resume]` | 일치 |
| `5-system/17-agent-memory.md` | partial | `[ai-context-memory-followup-v2]` | 일치 |
| `conventions/conversation-thread.md` | partial | `[ai-context-memory-followup-v2, exec-park-durable-resume]` | 일치 |

draft 가 제안하는 변경 2·3·4·5(제거 후 잔존 목록·status 조치)는 이 실측 시작점을 정확히 반영하고 있어 사실관계 오류가 없다.

추가로 대상 4개 spec 경로가 모두 실존함을 확인했다(draft frontmatter `spec_impact` 리스트의 dangling-ref 없음 — `spec-pending-plan-existence` 동형 위반 없음).

## 요약

선행 리뷰(12_02_22)가 지적한 유일한 CRITICAL — `webchat-widget-refactor.md` 종결 시 `spec_impact: []` 가 Gate C build guard(`spec-plan-completion.test.ts`)를 fail 시키는 문제 — 는 변경 7(`[] → none`)로 완전히 해소됐다. `hasValidSpecImpact` 실제 구현, `isGateCEnforced` cutoff 판정, `plan-lifecycle.md` §5 Gate C 의 canonical 예시를 모두 대조한 결과 `none` 리터럴 선택이 규약과 정확히 일치하며, 선행 리뷰가 지목한 두 INFO(3-execution 선례 경로 명시·ai-context spec_impact 부재)도 전자는 draft 에 반영됐고 후자는 애초 강제 사항이 아니었다(grandfather 면제). 명명·출력 포맷·문서 구조·API 문서·금지 항목의 나머지 4개 관점에서도 새로운 위반이 발견되지 않았으며, draft 가 서술하는 4개 spec 의 현재 frontmatter 상태(status/pending_plans)는 실측과 완전히 일치해 사실관계 오류가 없다. target 은 정식 규약 준수 관점에서 이제 클린 상태다.

## 위험도

NONE
