# 변경 범위(Scope) 리뷰

검토 대상: RAG 평가 하베스 P0 Phase 0+1 (rag-eval-harness) — 2차 리뷰 (2026-06-06)
검토 커밋: 23eedfd3 (feat) + 92ebe8f2 (fix) + b64c21dc (NUL 바이트 수정)

---

## 발견사항

### [INFO] 모든 신규 파일이 plan 의 IN 범위 항목과 1:1 대응

- 위치: 전체 변경 파일 목록
- 상세: `plan/in-progress/rag-eval-harness.md §2 Phase A·B` 의 체크리스트 항목과 실제 변경 파일이 완전히 대응한다. `eval/golden-set.types.ts`, `eval/retrieval-metrics.ts`, `eval/retrieval-metrics.spec.ts`, `eval/lang-detect.ts`, `eval/eval-cli.module.ts`, `src/scripts/generate-golden-set.ts`, `src/scripts/eval-retrieval.ts`, `eval/golden.example.json`, `eval/README.md`, `package.json` npm scripts, `.gitignore`, `spec/conventions/rag-evaluation.md` 모두 plan 에 명시된 항목이다.
- 제안: 조치 불필요.

---

### [INFO] ROOT_ENTITIES 분리는 범위 내 필수 지원 변경

- 위치: `codebase/backend/src/database/root-entities.ts` (신규), `codebase/backend/src/app.module.ts` (수정)
- 상세: `app.module.ts` 에서 30여 개 entity import 와 `ROOT_ENTITIES` 배열 정의를 `src/database/root-entities.ts` 로 추출하고 re-export 만 남겼다. `EvalCliModule` 이 `app.module.ts` 전체를 transitive import 하지 않고 entity 목록만 재사용하기 위한 불가피한 구조 변경이다. 동기가 plan 에 명시되어 있고 기존 import 사이트 호환(re-export)이 유지된다. `app.module.ts` 의 변경은 entity 정의 제거 + 1줄 import + 1줄 re-export 로 한정되며 모듈 기능 로직에는 전혀 손대지 않았다. 범위 내로 판단한다.
- 제안: 조치 불필요.

---

### [INFO] review/ 산출물 커밋 — 정책 준수

- 위치: `review/consistency/2026/06/06/02_08_03/**`, `review/code/2026/06/06/02_39_25/**`
- 상세: CLAUDE.md 정책상 `review/consistency/**` 및 `review/code/**` 는 정상 커밋 대상 위치다. consistency-check 세션 산출물과 1차 ai-review 산출물(RESOLUTION.md, SUMMARY.md, 각 리뷰어 산출물, 상태 파일)이 함께 커밋됐다. 범위 이탈 없음.
- 제안: 조치 불필요.

---

### [INFO] src/scripts/cli-utils.ts 신규 추가 — 범위 내 DRY 수정

- 위치: `codebase/backend/src/scripts/cli-utils.ts`
- 상세: 1차 ai-review RESOLUTION.md #17 (`parseCliFlag` 중복 WARNING) 에 대한 fix 결과물이다. `eval-retrieval.ts`/`generate-golden-set.ts` 두 스크립트에 복사된 동일 함수를 공통 모듈로 추출한 것은 1차 리뷰에서 요청된 수정이므로 범위 내다.
- 제안: 조치 불필요.

---

### [INFO] plan 체크박스 갱신(b64c21dc) — 범위 내 추적 정합성 수정

- 위치: `plan/in-progress/rag-eval-harness.md`, `plan/in-progress/rag-quality-improvement.md`
- 상세: b64c21dc 커밋에서 Phase A·B 체크박스가 `[x]` 로 갱신됐고 상위 `rag-quality-improvement.md` P0 체크리스트의 해당 두 항목도 완료 표시됐다. 1차 scope 리뷰(02_39_25/scope.md)에서 "plan 체크박스 미갱신" INFO 를 지적했고 그에 대응한 수정이므로 범위 내다.
- 제안: 조치 불필요.

---

### [INFO] generate-golden-set.ts binary diff 근본 원인 수정 (b64c21dc)

- 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: 1차 리뷰에서 여러 리뷰어가 binary diff 로 검토 불가 상태를 지적했다. b64c21dc 에서 `stableEntryId` 해시 구분자의 NUL 바이트(`\x00`)를 `JSON.stringify` 방식으로 교체해 파일이 정상 UTF-8 텍스트로 인식되도록 수정했다. 이 변경은 바이너리 판정의 근본 원인 제거이며 범위 내다.
- 제안: 조치 불필요.

---

### [INFO] eval-retrieval.ts 이모지 → ASCII 치환 (b64c21dc)

- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (출력 문자열 `[FAIL]`/`[PASS]`/`[주의]` 변환)
- 상세: b64c21dc 에서 출력 문자열의 이모지(❌/✅/⚠️)가 ASCII 로 교체됐다. CLAUDE.md "이모지 사용 금지" 규약 준수이며 순수 출력 문자열 변경으로 기능 변경 없다. 범위 내 규약 준수 조치다.
- 제안: 조치 불필요.

---

### [INFO] spec/5-system/9-rag-search.md 1줄 링크 + pending_plans 추가

- 위치: `spec/5-system/9-rag-search.md`
- 상세: 23eedfd3 커밋에서 `rag-evaluation.md` 크로스링크 1줄 + `pending_plans:` 에 본 plan 등재가 추가됐다. plan §2 Phase B 에 명시된 작업("spec/5-system/9-rag-search.md 에서 1줄 링크 + pending_plans 에 본 plan 등재 검토")의 이행이므로 범위 내다.
- 제안: 조치 불필요.

---

### [INFO] plan/in-progress/rag-quality-improvement.md P0 체크박스 갱신

- 위치: `plan/in-progress/rag-quality-improvement.md`
- 상세: 상위 plan 의 P0 "골든셋" 및 "검색 지표" 두 항목이 `[x]` 로 갱신됐고 `rag-eval-harness.md` 링크가 추가됐다. 1차 cross-spec consistency 리뷰의 권고("해당 항목만 완료 표시, LLM-judge/autoevals 항목은 미착수로 분리")에 대한 이행이다. 범위 내.
- 제안: 조치 불필요.

---

## 요약

이번 변경(23eedfd3 + 92ebe8f2 + b64c21dc 세 커밋)은 `plan/in-progress/rag-eval-harness.md` Phase A·B 에 명시된 항목 전체를 구현하고, 1차 ai-review RESOLUTION 에서 확정된 fix 를 적용하며, binary diff 문제를 근본 수정한 흐름으로 구성된다. 모든 신규 파일이 plan 의 IN 범위 체크리스트와 1:1 대응하며, 기존 파일 수정도 `app.module.ts` ROOT_ENTITIES 분리(경량 부트스트랩 필수 지원), `package.json` npm scripts 추가, spec 1줄 링크 추가, plan 체크박스 갱신으로 한정된다. 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅·주석 변경, 무관한 임포트·설정 변경은 발견되지 않았다. 이모지 ASCII 치환은 CLAUDE.md 규약 이행이므로 범위 이탈이 아니다.

---

## 위험도

NONE
