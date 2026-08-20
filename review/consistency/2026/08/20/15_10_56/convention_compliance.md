# 정식 규약 준수 검토 — convention_compliance

대상: `spec/5-system/` (특히 `14-external-interaction-api.md` §R17, `13-replay-rerun.md` §10.2,
`12-webhook.md` §5.3, `6-websocket-protocol.md` §4.1) + 연동 코드
(`masked-markers.ts` 신설, `rerun-modal.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.tsx`,
`execution-response.dto.ts`, `background-run-response.dto.ts`, `executions.service.ts`,
`background-runs.service.ts`). 기준 diff 는 `origin/main...HEAD`
(HEAD = `29d00021d`, "`Execution.inputData` 카브아웃 폐지 — 마커 가드 3곳" 시리즈).

## 진행 메모 (판정에 앞서)

이번 프롬프트 번들은 컨텍스트 예산 초과로 **`<git diff origin/main...HEAD -- code_areas>` 자체가
생략**됐다(§"컨텍스트 예산 초과로 생략된 파일 13개" 목록에 diff placeholder 가 끼어 있음). 즉
프롬프트만 보면 이 checker 는 실제 코드 변경을 전혀 못 보고 판정하게 된다. 아래 판정은 프롬프트가
지시한 대로 워킹트리를 **절대경로**로 직접 열어(`git diff`, `git log -p`, `Read`) 확보한 것이다 —
이 사실 자체를 아래 WARNING 으로 기록한다(§1). 같은 이유로 `spec/conventions/error-codes.md` ·
`execution-context.md` · `interaction-type-registry.md` · `node-output.md` · `redis-keys.md` ·
`spec-impl-evidence.md` 도 번들에서 생략됐으나, 이번 diff 가 에러코드·context·interaction
type·redis key·migration 을 건드리지 않아 실질적 영향은 없었다(직접 `Read` 로 확인). 단
`frontend-layering.md` 는 신규 파일(`masked-markers.ts`) 배치와 직결돼 직접 열어 대조했다(§본문).

## 발견사항

- **[WARNING]** 이 checker 의 입력 프롬프트에서 실제 diff 가 예산 초과로 누락됨
  - target 위치: (프롬프트 메타, target 문서 자체의 결함 아님) — `_prompts/convention_compliance.md` §"컨텍스트 예산 초과로 생략된 파일 13개" 목록의 `<git diff origin/main...HEAD -- code_areas>` 항목
  - 위반 규약: 직접적인 `spec/conventions/**` 항목은 아니지만, 프로젝트가 이미 문서화한 알려진 결함 클래스(`feedback_consistency_spec_mode_budget.md` — "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다")의 동일 계열 — 이번엔 conventions 가 아니라 **diff 본체**가 떨어졌다
  - 상세: 이 파일이 없으면 convention_compliance checker 는 "코드에 무엇이 바뀌었는지" 를 전혀 못 보고 target spec 본문만으로 판정하게 된다. 프롬프트 자체의 "⚠️ 현재 구현 코드의 기준" 절이 이 상황을 예견해 절대경로 워크트리 직접 조회를 지시해 뒀고, 이번 검토는 그 경로로 diff·코드를 전부 직접 확보해 판정했다. 다만 이 지시를 따르지 않고 프롬프트 본문만으로 판정하면 이 라운드는 사실상 "target spec 파일이 conventions 를 따르는가" 만 보고 "그 spec 이 최근 diff 로 conventions 를 어겼는가" 는 놓치는 조용한 커버리지 축소가 된다.
  - 제안: orchestrator 쪽에서 (a) diff 를 conventions 목록보다 예산 우선순위 상위에 두거나, (b) diff 가 생략됐을 때 "생략 목록"에 `<git diff ...>` placeholder 를 다른 파일들과 동일한 서식으로 섞어 넣지 말고 별도로 강조 표시할 것(현재는 262개 conventions 파일명 사이에 묻혀 있어 눈에 띄지 않는다).

## 본문 검토 결과 — CRITICAL/WARNING 없음

아래는 확인했지만 위반이 없었던 항목들이다(체크 흔적으로 남긴다).

1. **명명 규약**
   - 신규 `codebase/frontend/src/lib/utils/masked-markers.ts` 는 `MASKED_MARKERS`(상수, `ReadonlySet`) / `isMaskedMarker` / `hasMaskedMarkerLeaf` 네이밍을 backend SoT(`sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 집합, `MASKED_MARKERS`/`isMaskedMarker` 이름)와 **의도적으로 동일하게** 유지 — 파일 자체 JSDoc 이 "이름이 갈리면 grep 이 실패한다" 고 근거를 명시. 값도 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 로 backend 상수와 **정확히 일치**(직접 대조 완료).
   - i18n 키 `history.rerun.maskedInputBlocked` / `editor.runWithInputMasked` 는 기존 동일 파일의 이웃 키(`useOriginalInput`, `dryRunToggle`, `loadFromHistory` 등)와 같은 스코프-네임스페이스 패턴을 따르고, ko/en 두 dict 모두 갱신됨.
2. **출력 포맷 규약 (API 응답)**
   - `ExecutionDto.inputData` / `NodeExecutionSummaryDto.inputData` / `BackgroundRunNodeExecutionDto.inputData` 의 `@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })` 데코레이터는 자매 필드 `outputData`/`error` 와 동일한 열린-map 패턴 — `spec/conventions/swagger.md` §1-4 의 "열린/동적 map" 예외(실제로 키가 열려 있는 워크플로우 자유 payload)에 해당하고 신규 도입이 아니라 기존 패턴 유지이므로 §1-4 말미의 "Rationale 명시 의무"(형태 고정+SoT 이중화 회피 예외 한정) 대상이 아니다.
   - JSDoc 서술은 리뷰 라운드(`14_08_45` C2)에서 한 차례 "자매 필드는 갱신, 최상위 필드만 stale" 결함이 났었으나 이후 커밋(`b0d841923`)에서 3개 DTO 필드 전부 "값-패턴 마스킹 대상이다(2026-08-20~)" 로 정합하게 재작성된 상태를 확인(현재 워킹트리 기준).
3. **문서 구조 규약**
   - `spec/5-system/14-external-interaction-api.md` 는 Overview(§1~2)/본문(§3~12)/Rationale 3섹션 구조를 유지한 채 R17 섹션(본문 안) 내부만 수정 — 구조 이탈 없음.
   - `plan/in-progress/eia-inputdata-marker-guard.md` · `plan/in-progress/spec-draft-inputdata-egress-masking.md` 프런트매터에 `worktree`/`spec_impact`(YAML 리스트, bare string 아님) 정상 포함 — `.claude/docs/plan-lifecycle.md` frontmatter 스키마 준수.
   - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커의 `- [ ]` → `- [x]` 체크박스 전환이 실제 완료된 작업과 일치(plan checkbox = 실제 상태 원칙 준수).
4. **API 문서 규약**
   - 위 §2 참조. `writeOnly`/`readOnly`(swagger.md §1-5)는 secret-store plaintext 입력/derived 응답 필드 전용 패턴이라 이번 마스킹된 `inputData` 에는 적용 대상이 아님(적용하지 않은 것이 맞는 판단).
5. **금지 항목**
   - `frontend-layering.md` §1~2 기준으로 `masked-markers.ts` 는 `src/lib/utils/`(하위 계층)에 신설되고 `components/executions/rerun-modal.tsx`·`components/editor/toolbar/editor-toolbar.tsx`·`components/editor/run-results/dynamic-form-ui.tsx`(상위 계층)가 이를 import — `components → lib` 는 허용 방향, 반대 방향(`lib → components`) 금지 위반 없음. 오히려 이 PR 이전엔 마커 판별 함수가 `dynamic-form-ui.tsx`(컴포넌트) 안에 있어 모달·툴바가 그 컴포넌트를 import 해야 했던 잠재적 역전 위험을 `lib/` 승격으로 **선제 해소**한 것으로 읽힌다(§Rationale 자체가 이유를 명시).
   - backend `MASKED_INPUT_DATA_REASON` 앵커 상수 제거 후 코드 내 잔존 참조 0건(grep 확인) — 죽은 인용 없음.

## 참고 — 스코프 밖이라 격상하지 않은 관찰 (INFO)

- **[INFO]** `CHANGELOG.md` "Unreleased — `Execution.inputData` 카브아웃을 닫았다" 항목(19행)이 *"차단 판정은 '값이 비었는가' 가 아니라 '사용자가 그 키를 건드렸는가' 다"* 라고 서술하는데, 이는 커밋 `b0d841923` 시점의 중간 설계다. 바로 다음 커밋 `29d00021d`(같은 PR, review fix)에서 이 판정이 "건드림 **AND** 현재 값에 마커 없음"(`blockedByMaskedInput`)의 두 조건 합으로 다시 바뀌었는데 `CHANGELOG.md` 는 갱신되지 않았다. `spec/5-system/13-replay-rerun.md`·`14-external-interaction-api.md`·`plan/in-progress/eia-inputdata-marker-guard.md` 는 전부 최종본(AND 조건)으로 맞춰져 있어 **target(spec/5-system/) 은 stale 하지 않다** — 어긋난 건 `CHANGELOG.md` 뿐이다. `spec/conventions/` 에 CHANGELOG 서식을 규정한 파일이 없어(grep 확인, 0건) 정식 규약 위반으로 격상하지 않고 INFO 로만 남긴다. 정정하려면 19행 문단을 최종 AND-조건으로 다시 쓰면 된다.

## 요약

target(`spec/5-system/`)과 그 직접 연동 코드는 이번 diff 범위에서 명명·출력 포맷·문서 구조·Swagger DTO 패턴·frontend 레이어링 규약을 모두 준수했다 — CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다. 유일한 WARNING 은 target 문서 자체의 결함이 아니라 **이 checker 에게 주어진 프롬프트 번들이 diff 본체를 예산 초과로 생략**했다는 프로세스 신뢰성 문제이며(프롬프트 지시대로 워킹트리를 직접 열어 우회 확인함), INFO 하나는 `spec/conventions/` 대상이 아닌 `CHANGELOG.md` 의 stale 서술(최종 코드가 요구하는 AND 조건을 반영 못함)이다. 이 PR 은 이미 두 차례 code-review 라운드(`14_08_45`, `14_44_08`)를 거쳐 정확 일치→중첩 leaf 감지, "비었는가"→"건드림 AND 마커 잔존" 등으로 여러 차례 정정된 상태이고, 그 정정들이 spec/DTO/plan 3곳 모두에 일관되게 반영돼 있음을 직접 대조로 확인했다.

## 위험도
LOW
