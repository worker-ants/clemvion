# 정식 규약 준수 검토 — convention_compliance

## 대상 요약

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- `spec/conventions/**` 델타: **0개 파일** (정상 — 이 브랜치는 conventions 문서를 바꾸지 않는다)
- 실제 구현 diff (4파일, `codebase/frontend/**`, `origin/main...HEAD` 기준 442줄):
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "코드로 실행 실패" → "메시지 접두일 뿐 전용 코드 없음" 으로 문장 정정 (ko/en 동시)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/`collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY` 신설("발행 축" 가드)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 가드에 대한 테스트 다수 신설

이 diff 는 `plan/in-progress/error-code-emission-axis.md` 가 트래커 CRITICAL(가이드 에러 코드 가드가 "존재" 만 보고 "방출" 을 안 봄, `#1330`/`#1331` 후속)을 닫는 라운드 1+라운드1-fix 누적분이다 (직전 라운드 `review/consistency/2026/09/13/19_23_31`·`18_40_54` 의 convention_compliance 를 승계해 재검증). `spec/conventions/error-codes.md`, `review-citations.md`, `user-guide-evidence.md`, `spec-impl-evidence.md`, `i18n-userguide.md`, `node-output.md` 를 워킹트리 절대경로에서 실측 대조했다.

## 발견사항

- **[WARNING] `review-citations.md` §2 위반 — bare `hh_mm_ss` 인용이 `codebase/**` 에 신규 혼입**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:203` (라운드 1 fix 커밋 `a397ccc55` 로 신설된 줄)
  - 위반 규약: `spec/conventions/review-citations.md` §2 "날짜를 포함한다" — bare 시각(`23_02_51` 류)은 표에서 명시적으로 **금지**. §3 적용 범위 표는 `codebase/**` 를 "적용" 대상으로 못 박는다(plan/review 는 예외이나 이 파일은 `codebase/frontend/**` 라 예외 아님).
  - 상세: 문제의 줄은 `// \`/ai-review\`(\`19_23_22\` testing WARNING#6): ...` 로, 날짜 없이 `19_23_22` 만 인용한다. 같은 diff·같은 파일의 다른 4곳(예: 같은 파일 254·471행, `guide-identifier-scan.ts` 353·480행)은 전부 `review/code/2026/09/13/19_23_22` 전체 경로로 정확히 인용하고 있어, 이 한 줄만 형태가 어긋난다. `review-citations.md` §2 의 근거표가 지적하듯 이런 bare 인용은 (여러 날짜에 걸쳐 같은 시각이 재사용되므로) **git 이력으로도 해소 불가**하다.
  - 제안: `` `19_23_22` `` → `` `review/code/2026/09/13/19_23_22` `` 로 전체 경로 보강. 한 토큰 치환이라 다음에 이 파일을 건드릴 때 함께 고쳐도 되지만(§4 "소급 정리 대상 아님"), 이번 diff 가 **이 줄을 직접 신설**했으므로 §4 의 "기존 인용" 유예 대상이 아니라 이번 라운드에서 바로 고치는 편이 규약 취지에 맞다.

- **[INFO] "가이드 식별자" 가드 family 가 여전히 어느 `spec/conventions/*.md` 의 `code:` 에도 등재되지 않음 (직전 라운드 INFO 승계, 신규 결함 아님)**
  - target 위치: `guide-identifier-scan.ts` 최상단 주석 "SoT: spec/conventions/user-guide-evidence.md (가드 가족) · spec/conventions/error-codes.md (코드 명명·은퇴 이력) · ..." (이 줄 자체는 이번 diff 이전 `#1331` 부터 존재, 이번 라운드가 손대지 않음)
  - 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" — 이 표는 `impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`triggers-coverage.test.ts` 3건만 자신의 "가드 가족" 으로 등재하며, frontmatter `code:` 도 이 3건 + 보조 파서 파일만 나열한다. `spec-impl-evidence.md` 의 `code:` 목록에도 `guide-identifier-*` 는 없다 (`grep -rn "guide-identifier" spec/` 0건, 이번 라운드 재확인).
  - 상세: `guide-identifier-scan.ts` 는 스스로 `user-guide-evidence.md` 를 SoT 로 자칭하지만, 정작 그 문서의 §2 표·frontmatter 어느 쪽도 이 파일을 인지하지 않는다. 이번 diff 로 이 가드 family 의 표면(예외 레지스트리 2종, export 함수 7종, 축 2개)이 한 단계 더 커져 괴리가 그만큼 커졌다.
  - 제안: 직전 라운드와 동일 — 이번 diff 범위에서 즉시 고칠 필요는 없다(plan 이 "동작·규약 변경은 별 배치" 로 스코프를 명시적으로 좁혔음). 후속으로 `user-guide-evidence.md` §2 표에 4번째 가드로 편입하거나 별도 `spec/conventions/guide-identifier-existence.md` 를 신설해 `code:` 로 두 파일을 등재할 것을 권한다.

## 준수 확인 (위반 아님 — 대조 근거로 기록)

- **`error-codes.md` §1/§3/§4**: `MAKESHOP_UNRESOLVED_PATH_PARAM`/`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 모두 UPPER_SNAKE_CASE + 의미 기술형이라 §1 표기와 충돌 없음. 세 토큰 다 `output.error.code`/`ErrorCode` enum 으로 실제 발행되지 않는 **메시지 접두 문자열**이므로 §3(historical-artifact)·§4(내부 분류→public 정규화) 등재 의무 대상이 아니다(두 절 다 "실제 `code` 필드 값" 한정). `execution-engine.service.ts:8016` 실측(`nodeExec.error = { message }`, `code` 필드 없음)과 일치.
- **`i18n-userguide.md` Principle 5/6**: `logic.mdx`(canonical)·`logic.en.mdx`(sibling) 를 동시에 수정했고 두 문장의 의미가 정확히 대응하며, 정정된 한국어 문장이 기존 해요체 톤을 유지한다.
- **`review-citations.md` §2/§3 — 나머지 인용**: 위 1건을 제외한 신규 인용(`review/consistency/2026/09/13/18_40_54 plan_coherence INFO#3`, `review/code/2026/09/13/19_23_22 maintainability WARNING#7` 등)은 전부 전체 경로 + 역할 + 지적 번호를 갖춘 권장 형태다. `plan/**`(`error-code-emission-axis.md`, `spec-draft-nullable-notation-followups.md`)·`review/**` 안의 bare 시각 인용은 §3 표에 의해 애초 규약 적용 대상이 아니다.
- **`spec-impl-evidence.md`**: 이번 diff 는 `spec/**.md` frontmatter 를 건드리지 않으므로 §2~§4 의 frontmatter 스키마·가드 규칙이 직접 적용될 변경이 없다.
- **`node-output.md` §3.2**: `code` UPPER_SNAKE_CASE 규칙은 실제 `output.error.code` 필드 값에 적용되는 것이며, 본 diff 가 다루는 메시지 접두 문자열은 그 필드에 도달하지 않으므로 이 규칙의 적용 대상 밖(위 error-codes.md §1 확인과 동일 근거).

## 요약

이번 diff 는 `spec/conventions/` 문서 자체는 바꾸지 않는 코드 전용 PR이며, `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 실제로는 `error.code` 로 발행되지 않는다는 사실을 유저 가이드 ko/en 양쪽에 정확히 반영하고, 그 판정을 뒷받침하는 "발행 축" 가드(`GUIDE_NON_EMITTED_VOCABULARY`)를 신설한 점은 `error-codes.md`·`i18n-userguide.md` 와 정합적이다. 다만 이번 라운드에서 새로 신설된 리뷰 인용 한 줄(`guide-identifier-existence.test.ts:203`)이 `review-citations.md` §2 가 명시적으로 금지하는 bare `hh_mm_ss` 형태라 WARNING 으로 지적한다 — 같은 파일 안 다른 4곳이 이미 올바른 전체 경로 형태를 쓰고 있어 국소적 누락으로 보이며 수정 비용이 작다. 그 외에는 직전 라운드부터 이어지는 "가이드 식별자 가드가 어떤 `spec/conventions/*.md` 에도 `code:` 로 소유되지 않는다" 는 구조적 공백(INFO, 이번 diff 가 만든 결함 아님)만 재확인됐다.

## 위험도

LOW
