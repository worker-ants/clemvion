# Cross-Spec 재검토 — spec-update-execution-engine-pr4.md (amended)

대상: `/Volumes/project/private/clemvion/.claude/worktrees/exec-intake-pr4-stalled/plan/in-progress/spec-update-execution-engine-pr4.md`

이전 CRITICAL: `WORKER_HEARTBEAT_TIMEOUT` PR4 상태 flip 과 `maxStalledCount:0→1` 이 4개 타 spec 파일(1-data-model.md:469, 5-system/3-error-handling.md:76, conventions/error-codes.md:63, data-flow/3-execution.md:65/247/262/293)에 미전파, `spec_impact` 에 4-execution-engine.md 만 등재.

## 재검증 결과

### spec_impact — 해소
`spec_impact` (frontmatter line 3-8) 는 이제 5개 파일 전부 등재:
`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/data-flow/3-execution.md`. — CRITICAL 지적 사항 중 spec_impact 누락 부분은 해소.

### 3개 파일 (error-codes.md / 1-data-model.md / 3-error-handling.md) — 해소
실제 파일의 현재 라인을 직접 대조:

- `spec/conventions/error-codes.md:63` — E9 이 대상 문구("PR4 target … 코드명은 유지·PR4 재정의")를 정확히 인용하고 "PR4 구현, 2026-07-04" 로 flip. 대응 edit item 존재.
- `spec/1-data-model.md:469` — E10 이 대상 문구("PR4 예약", "PR3(2026-07-04)부터 … PR3 기간 미발동")를 정확히 인용하고 PR4 구현 완료로 flip. 대응 edit item 존재.
- `spec/5-system/3-error-handling.md:76` — E11 이 대상 문구("PR4 예약 — PR3 … 미발동")를 정확히 인용하고 flip. 대응 edit item 존재.

이 3개 파일은 각각 `WORKER_HEARTBEAT_TIMEOUT`/`maxStalledCount` 언급이 정확히 1곳씩뿐이며, 모두 E9/E10/E11 로 커버됨. 이 부분은 완전히 해소.

### `spec/data-flow/3-execution.md` — 부분 해소, 잔여 갭 1건 (WARNING)

이 파일은 관련 언급이 총 6곳 존재하는데, E12 는 4곳(:65, :247 및 인접 :245 코멘트, :262, :293)만 명시적으로 다룬다. 실제 grep 결과 놓친 지점:

- **:204 (§2.2 Redis/BullMQ 큐 카탈로그 표, `execution-run` 행)**: `attempts:1` / `maxStalledCount:0` / `removeOnFail:false` — E12 의 어떤 bullet 도 이 라인을 언급하지 않는다. E12 의 `:65` bullet 은 같은 파일 §1.1 산문 설명의 `maxStalledCount: 0` 만 다루고, §2.2 표(라인 204)의 동일 값은 **별개 occurrence** 로 남는다. 적용 후 같은 파일 안에서 §1.1 은 `maxStalledCount:1`(PR4 반영), §2.2 표는 `maxStalledCount:0`(미반영) 로 **자기모순**이 생긴다.
  - 이는 4-execution-engine.md 자체의 §9.3 큐 카탈로그(라인 1136, E6 대상)와는 별개 파일·별개 라인이므로, E6 적용으로 해소되지 않는다.

- **:245 (`running --> running` 다이어그램 코멘트)**: E12 의 두 번째 bullet("`:247 상태도`")안에 "`running --> running` 코멘트에 PR4 트리거 병기" 문구로 실질적으로 커버됨 — 별도 항목 번호는 없으나 편집 대상에는 포함. 이 부분은 실질적으로 해소된 것으로 판단(표기상 사소한 누락일 뿐 내용상 누락 아님, INFO 수준).

## 요약

이전 CRITICAL 은 spec_impact 누락과 3개 파일(error-codes/1-data-model/3-error-handling)의 미편집 부분에 대해서는 완전히 해소됐다. 다만 `spec/data-flow/3-execution.md` 내부에 `maxStalledCount` 가 2곳(라인 65 산문, 라인 204 표)에 독립적으로 등장하는데 amended 편집 목록(E12)은 라인 65만 다루고 라인 204 표는 다루지 않아, 편집 적용 후에도 같은 파일 내에서 `maxStalledCount:1`(§1.1)과 `maxStalledCount:0`(§2.2 표)이 병존하는 새로운 자기모순이 발생한다. 이는 원래 CRITICAL 이 지적한 것과 동일한 종류(스펙 간 미전파)의 문제가 **같은 파일 내부**에서 재발하는 것이므로 WARNING 으로 등급을 매긴다 — CRITICAL 만큼 광범위하지 않으나(파일 자체는 spec_impact 에 있고 대부분 라인은 수정됨), 그대로 적용하면 독자가 §2.2 표만 보고 "여전히 stalled 재배달 차단" 으로 오독할 수 있는 활성 모순이 남는다.

## 발견사항

- **[WARNING]** `data-flow/3-execution.md:204` (§2.2 큐 카탈로그 표) 의 `maxStalledCount:0` 이 E12 편집 목록에서 누락
  - target 위치: `plan/in-progress/spec-update-execution-engine-pr4.md` E12 섹션 (라인 86-90)
  - 충돌 대상: `spec/data-flow/3-execution.md:204` (동일 파일 §2.2, E12 의 `:65` 편집과 병존)
  - 상세: E12 의 `:65` bullet 은 §1.1 산문의 `maxStalledCount: 0` 만 `1` 로 flip 하도록 지시한다. 같은 파일 §2.2 Redis/BullMQ 큐 카탈로그 표의 `execution-run` 행(라인 204)에도 독립적으로 `attempts:1` / `maxStalledCount:0` / `removeOnFail:false` 값이 실려 있으나 이 라인은 어떤 edit item 에도 언급되지 않는다. 적용 후 같은 문서 안에서 §1.1 은 PR4 값(`maxStalledCount:1`), §2.2 표는 PR3 값(`maxStalledCount:0`) 으로 표기되어 내부 모순이 생긴다.
  - 제안: E12 에 `:204` bullet 추가 — `attempts:1` / `maxStalledCount:1` 로 갱신하고 PR4 stalled 재배달 허용을 반영. (4-execution-engine.md §9.3 큐 카탈로그, 라인 1136, E6 대상과는 별개 라인이므로 E6 로 자동 해소되지 않음 — 명시 편집 필요.)

- **[INFO]** `:245` (`running --> running` 다이어그램 코멘트) 편집이 E12 의 별도 항목 번호 없이 `:247` bullet 안에 묻혀 있음
  - target 위치: `plan/in-progress/spec-update-execution-engine-pr4.md` E12 두 번째 bullet
  - 충돌 대상: `spec/data-flow/3-execution.md:245`
  - 상세: 내용상 편집 지시는 존재(“`running --> running` 코멘트에 PR4 트리거 병기”)하므로 실제 staleness 는 아니나, 별도 라인 번호로 명시되지 않아 적용자가 놓칠 위험이 약간 있다.
  - 제안: 필수 아님. 원한다면 `:245` 를 별도 sub-bullet 으로 분리해 명시성을 높일 수 있다.

## 위험도

MEDIUM — CRITICAL 로 지적됐던 4개 타 파일 전파 누락은 완전히 해소됐고 spec_impact 도 정합화됐다. 다만 `data-flow/3-execution.md` 내부에 새로운(더 작은 범위의) 편집 누락이 하나 남아 있어, 그대로 반영하면 같은 문서 안에서 `maxStalledCount` 값이 §1.1 과 §2.2 사이에서 불일치하게 된다. 이 갭은 파일 하나·라인 하나 규모로 원래 CRITICAL 보다 훨씬 좁으므로 WARNING 등급이 타당하다.
