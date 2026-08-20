STATUS=success reviewer=convention_compliance target=plan/in-progress/spec-draft-inputdata-egress-masking.md
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-inputdata-egress-masking.md`

## 검토 방식

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 는 예산 초과로 대부분 절단돼
있어(특히 `error-codes.md`·`secret-store.md`·`spec-impl-evidence.md`·`swagger.md` 등 이 target 과
가장 관련 깊은 문서들), 해당 규약 파일들과 이 draft 가 참조하는 4개 spec 원문
(`spec/1-data-model.md`·`spec/5-system/13-replay-rerun.md`·`spec/3-workflow-editor/3-execution.md`·
`spec/5-system/14-external-interaction-api.md`)·`.claude/skills/project-planner/SKILL.md`·
`.claude/docs/plan-lifecycle.md` 를 저장소에서 직접 읽어 대조했다.

## 발견사항

- **[INFO]** draft 변경문에서 교차참조 링크 표기가 항목별로 비대칭
  - target 위치: `plan/in-progress/spec-draft-inputdata-egress-masking.md` ①·③ (line 47-51, 87-91)
  - 위반 규약: 명시적 `spec/conventions/*.md` 항목은 아니나, `spec/1-data-model.md`·
    `spec/3-workflow-editor/3-execution.md` 자신이 이미 확립한 교차참조 관행(모든 타 문서 참조를
    `[텍스트](경로#앵커)` 마크다운 링크로 건다 — 예: 원본 §2.13 행의
    `([EIA §R17](./5-system/14-external-interaction-api.md) 잔여 ② · [Re-run §10.2](./5-system/13-replay-rerun.md))`,
    `3-execution.md` 의 `[EIA §6 도입부](../5-system/14-external-interaction-api.md#6-...)`) 및
    `spec-impl-evidence.md §4.2` 가 언급하는 `spec-link-integrity.test.ts` 빌드 가드가 전제하는
    "본문 상호참조는 링크" 관행.
  - 상세: ①(`spec/1-data-model.md` §2.13)의 **변경** 문단은 `(EIA §R17)`·`(Re-run §10.2 · 에디터
    실행 §2.2)` 처럼 링크 없는 평문으로 축약했고, ③(`3-execution.md` §2.2)의 **변경** 문단도
    `(EIA §R17)` 을 평문으로 썼다. 반면 같은 draft 의 ②(`13-replay-rerun.md` §10.2)와 ④의 본문은
    `[EIA §R17](./14-external-interaction-api.md)` 처럼 정상적으로 링크를 걸었다. `spec-link-integrity`
    가드는 "존재하는 링크의 유효성"만 검증하므로 build 를 깨뜨리지는 않지만, 이 draft 문구를 그대로
    옮겨 적으면 같은 문서·같은 절 안에서 참조 표기 방식이 갈려 원본이 지켜온 상호참조 일관성이
    깨진다.
  - 제안: `spec/` 반영 시 ①·③ 문단의 `(EIA §R17)`·`(Re-run §10.2 · 에디터 실행 §2.2)` 부분도
    ②·④ 와 동일하게 `[EIA §R17](../5-system/14-external-interaction-api.md#r17-...)` 형태의 링크로
    복원할 것.

- **[INFO]** `rerun-modal.tsx` 가 자신을 직접 다루는 spec 문서의 `code:` 에는 안 실림
  - target 위치: `plan/in-progress/spec-draft-inputdata-egress-masking.md` ④ (line 102-104)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 정의 — "본 spec 이 약속한
    surface 의 구현 경로".
  - 상세: draft ④는 `codebase/frontend/src/components/executions/rerun-modal.tsx` 와
    `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 를
    `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에만 등재한다. 그런데
    Re-run 모달의 UI·마커 가드 동작을 직접 서술하는 문서는 `spec/5-system/13-replay-rerun.md` §10.2
    이고(이 draft 의 ②가 바로 그 절을 재작성한다), 그 문서의 현재 frontmatter `code:` 목록에는
    `rerun-modal.tsx` 가 아직 없다(백엔드 파일만 있음, 실측 완료). 반면 `editor-toolbar.tsx` 는 이미
    `spec/3-workflow-editor/3-execution.md` 자신의 `code:` 에 등재돼 있어 대칭적이다. `code:` 글로브가
    이미 다른 항목으로 ≥1 매치를 만족하므로 `spec-code-paths.test.ts` 빌드 가드는 통과하지만,
    "spec 이 약속한 surface" 원칙을 엄격히 따르면 §10.2 를 소유한 문서에도 같은 파일을 등재하는 쪽이
    일관적이다.
  - 제안: `spec/` 반영 시 `spec/5-system/13-replay-rerun.md` frontmatter `code:` 에도
    `codebase/frontend/src/components/executions/rerun-modal.tsx` 추가를 함께 고려(필수는 아님 —
    가드 위반 아니고 기존에도 없던 갭이라 이 draft 의 책임 범위를 벗어난다고 볼 수도 있음).

## 검증한 정합 항목 (위반 없음 — 근거 기록)

- draft 파일명·경로: `plan/in-progress/spec-draft-<name>.md` — `project-planner/SKILL.md` §명명 컨벤션과
  §작업 워크플로 3(`draft 작성` 단계)에 정확히 부합.
- frontmatter 3필드(`worktree`/`started`/`owner`) 존재 + `worktree: eia-inputdata-marker-guard` 가
  현재 worktree 디렉토리와 일치 — `plan-lifecycle.md §4` `plan-frontmatter.test.ts` 요건 충족.
  같은 worktree 에 연결된 `plan/in-progress/eia-inputdata-marker-guard.md`(developer 소유, BLOCK:YES
  로 정지)와의 2-plan 구조는 CLAUDE.md 가 명시한 "구현 중 spec 변경 필요 시 developer 는 멈추고
  project-planner 위임" 에스컬레이션 패턴 그대로이며 `plan-lifecycle.md` 의 "다수 plan 비권장" 경고가
  겨냥하는 임의 중복이 아니다.
  spec_impact 4개 경로도 두 plan 이 동일해 정합.
- 문서 구조: draft 자체는 project-planner SKILL 이 요구하는 "본문 끝 `## Rationale`" 만 충족하면
  되고(Overview/본문/Rationale 3섹션 전체 요건은 최종 `spec/*.md` 파일에 적용) 실제로 그렇게 구성돼
  있다. 4개 대상 spec 파일 쪽도 확인 결과 ①(`1-data-model.md` §2.13)·②(`13-replay-rerun.md` §10.2,
  본문 "## 10. UI 명세" 산하)·③(`3-execution.md` §2.2, "## 2. Mock Input" 산하)·④(`14-external-
  interaction-api.md` §R17, "## Rationale" 산하)가 각 문서의 기존 Overview/본문/Rationale 배치를
  그대로 유지하며 국소 수정만 가하므로 3섹션 구조를 깨지 않는다.
  - 이번 리뷰 결과 `1-data-model.md` §2.13 은 §Rationale 대상은 아니고 §Overview 하위이므로 draft 는
    본문(2번 섹션) 만 건드림 — 구조 위반 없음.
- 인용 정확성: draft 가 그대로 인용한 "현재" 문구(§2.13 `input_data` 행, §R17 표제·`1527` 행·"닫는
  조건" 문단, §2.2 "히스토리 로드" 행)를 실제 파일과 대조 — 전부 문자 그대로 일치(줄바꿈 위치 차이만).
  `1527` 행 번호도 실측과 일치.
- 용어·상수 정확성: `마스킹 마커(***)` = 실제 `VALUE_MASK_MARKER='***'`(`sanitize-error-message.ts`),
  `useOriginalInput` 필드명·UI 기본값 OFF, `DynamicFormUI` 컴포넌트명, `MASKED_INPUT_DATA_REASON`
  식별자 — 모두 코드와 일치.
  (단, "6개 참조처" 라는 수치는 grep 실측상 `MASKED_INPUT_DATA_REASON` 참조가 11곳이라 더 많다 —
  이는 spec/conventions 규약 위반이 아니라 사실 정확성 이슈이므로 다른 관점(cross_spec 등)의 소관으로
  남겨 두고 본 리뷰에서는 참고만 기록.)
- 글리프 규율: draft 자신의 ①②③④(4개 대상 문서 나열)는 원형숫자를 쓰지만, 이는 draft 문서 자체의
  조직용 표기일 뿐 spec 본문에 그대로 삽입되지 않는다. §R17 본문의 "표면 1~6"(아라비아)과 "잔여
  ①②③"(원형) 을 섞지 말라는 기존 규율은 draft ④가 명시적으로 보존(INFO 노트로 재확인)하고 있어
  위반 없음.
- API 문서/Swagger 규약(관점4): 이 draft 는 DTO·`@ApiProperty` 데코레이터를 직접 변경하지 않는다
  (그건 developer 턴의 구현 범위). 해당 관점은 이 target 에는 적용 대상 없음(N/A).
- 금지 항목(관점5): `spec/conventions/**` 에서 명시적으로 금지한 패턴(예: audit-actions 의 인라인
  문자열 금지 등)에 해당하는 패턴을 이 draft 는 도입하지 않는다.

## 요약

이 draft 는 project-planner SKILL 의 draft 작성 규약(파일명·frontmatter·본문 끝 Rationale)을 정확히
따르고, 인용하는 기존 spec 문구·줄 번호·코드 식별자를 전부 실측 대조해도 어긋남이 없는, 정합성이
높은 문서다. 규약을 직접 위반하는 CRITICAL/WARNING 급 사안은 발견되지 않았다. 다만 (1) 일부 변경
문단에서 기존 문서가 지켜 온 마크다운 교차참조 링크 표기가 평문으로 축약돼 있어 그대로 옮겨 적으면
상호참조 일관성이 흐려질 수 있고, (2) `rerun-modal.tsx` 를 `14-external-interaction-api.md` 의
`code:` 에만 등재하고 그 컴포넌트를 실제로 서술하는 `13-replay-rerun.md` 자신의 `code:` 에는 반영하지
않아 대칭성이 아쉽다 — 둘 다 build 가드를 깨뜨리지 않는 INFO 수준의 개선 여지다.

## 위험도

LOW
