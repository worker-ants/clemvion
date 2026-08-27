# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md (+ 연동 frontmatter)

## 검토 범위 요약

`origin/main...HEAD` diff 는 spec 3개 파일, 총 3줄 변경뿐이다:

```
spec/5-system/14-external-interaction-api.md | 2 +-
spec/conventions/egress-masking.md           | 1 +
spec/conventions/node-output.md              | 2 +-
```

- `14-external-interaction-api.md` / `node-output.md`: frontmatter·본문에서 `codebase/backend/src/shared/utils/node-output-allowlist.ts` → `codebase/backend/src/nodes/core/node-output-allowlist.ts` 로 경로 정정 (파일이 앞선 커밋 `044a2e19e` 에서 실제 이동했으나 이 두 spec 참조가 갱신되지 않고 남아 있었다).
- `egress-masking.md`: frontmatter `code:` 목록에 `codebase/backend/src/shared/utils/redact-stored-error.ts` 신규 추가.

## 검증 절차 및 결과

1. **경로 실존 확인** (절대경로, 현재 워크트리 기준)
   - `codebase/backend/src/nodes/core/node-output-allowlist.ts` — 존재, `NODE_OUTPUT_ALLOWED_KEYS` export 확인
   - `codebase/backend/src/shared/utils/node-output-allowlist.ts` (구 경로) — 부재 확인 (이동 완료)
   - `codebase/backend/src/shared/utils/redact-stored-error.ts` — 존재
   - `spec/`, `codebase/` 전체에 구 경로(`shared/utils/node-output-allowlist`) 잔존 참조 0건 (grep 확인) — 정정이 부분적이지 않고 전수 반영됨

2. **`spec/conventions/spec-impl-evidence.md` §2~§4 (frontmatter 규약) 대조**
   - 두 문서 모두 `id`(kebab-case) / `status`(`partial`/`implemented`) / `code:`(비어 있지 않음) 요건 충족
   - `14-external-interaction-api.md` (`status: partial`) 의 `pending_plans:` 항목(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`) 실존 확인 — §3 의무 충족
   - `node-output.md` (`status: partial`) 의 `pending_plans:` 항목(`plan/in-progress/node-output-redesign/README.md`) 실존 확인
   - 두 spec 의 `code:` 리스트 전체 항목(각 23개, 12개)을 glob 매칭으로 재검증 — 전부 매치. 특히 `spec-code-paths.test.ts` 가드는 "리스트 중 **최소 1개**만 매치하면 통과"(any-match) 로 구현돼 있어, 이번 정정 없이도 build 가드 자체는 통과했을 것 — 즉 이 정정은 R-1 Rationale 이 명시한 가드 사각지대("stale 글로브는 본 가드만으로 검출 불가")를 스스로 메운 자발적 위생 조치다. 규약이 요구하는 최소선을 넘어선 정확성 개선이며 위반 아님
   - `egress-masking.md` (`status: implemented`) 의 `code:` 리스트 전체(9개 항목, 신규 1개 포함) glob 재검증 — 전부 매치

3. **명명 규약 / 본문 정합**
   - `redact-stored-error.ts` 는 §1 좌표계 표 2행("`deepRedactSecrets`(REST 응답·**저장 에러**·conversation thread·workflow-assistant explore 응답)")의 "저장 에러" consumer 에 해당 — 파일명 리터럴로 재인용하지는 않으나 의미상 이미 프로즈에 커버되어 있음(해당 파일 JSDoc 도 "egress-only" 원칙을 EIA §R17 을 SoT 로 인용하며 동일 계약을 따름). 신규 항목이 문서 내 좌표계 서술과 모순되지 않음
   - 두 파일(`14-external-interaction-api.md`, `node-output.md`) 안에서 `node-output-allowlist` 참조는 각각 1곳뿐이고 모두 새 경로로 일치 — 문서 내부·문서 간 교차 참조 모두 정합

4. **문서 구조 규약 (Overview/본문/Rationale)** — 이번 diff 는 frontmatter·본문 인용 경로 문자열만 바꿨을 뿐 섹션 구조에 손대지 않음. 영향 없음

5. **금지 항목** — `spec/conventions/**` 어디에도 이런 종류의 frontmatter 경로 정정을 금지하는 조항 없음. 오히려 R-1 이 이런 정정을 권장하는 취지(stale 글로브 방지)

## 발견사항

없음 — 이번 diff 범위(spec frontmatter/본문의 파일 경로 참조 3곳) 는 `spec/conventions/spec-impl-evidence.md` 의 명명·frontmatter 스키마·code-path 증거 규약을 정확히 준수한다. CRITICAL/WARNING 대상 위반을 찾지 못했다.

## 요약

이번 PR 은 `spec/5-system/14-external-interaction-api.md` · `spec/conventions/{egress-masking,node-output}.md` 세 파일의 `code:` frontmatter/본문에서 앞선 커밋의 파일 이동(`shared/utils/node-output-allowlist.ts` → `nodes/core/node-output-allowlist.ts`)을 뒤늦게 반영하고, `redact-stored-error.ts` 를 `egress-masking.md` 의 증거 목록에 추가하는 3줄짜리 위생 정정이다. 모든 신규 경로는 실존을 확인했고 구 경로 잔존 참조는 0건이며, `spec-impl-evidence.md` 가 정한 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 요건도 두 대상 문서 모두 충족한다. 신규 추가된 `redact-stored-error.ts` 는 `egress-masking.md` §1 좌표계 표의 기존 "저장 에러" consumer 서술과 의미상 이미 정합해 문서 내부 모순이 없다. 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
