# Code Review 조치 (RESOLUTION)

## 본 PR 의 범위

`engine-raw-config-exposure` Phase 3 — 25개 핸들러를 CONVENTIONS Principle 7 (config = raw / output = evaluated) 패턴으로 일괄 마이그레이션. 6개 PR (PR-3a~3f) 누적.

ai-review 결과 — Critical 2 / Warning 다수 / Info 다수 (13개 reviewer 산출물). 전체 위험도는 LOW~MEDIUM 으로, 직접적 익스플로잇 경로 없음. 단 Critical 2건은 즉시 회귀 가능성이 있어 본 PR 안에서 처리.

> **참고**: SUMMARY.md 는 ai-review orchestrator 의 stream timeout 으로 미생성. 13개 reviewer 산출물(`security/`, `maintainability/`, `requirement/`, `testing/`, `api_contract/`, ...) 을 직접 종합해 본 RESOLUTION 작성.

---

## (A) 본 PR 에서 조치한 항목 — 6건 (Critical 2 + Warning 4)

### Critical (2건)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| CRIT #1 | Requirement / Testing | AI Agent multi-turn resume 의 `systemPrompt` 폴백 누락 — `state.rawConfig` 가 없거나 `systemPrompt` 필드 누락 시 `undefined` echo. `state.systemPrompt` (state-preserved evaluated 값) fallback 추가. Phase 1 이전 실행이나 미기록 실행에서 회귀 차단. |
| CRIT #2 | Maintainability / Testing | Loop 의 `void parseNumeric()` dead code + 잘못된 주석 ("side-effect of validating") 제거. `parseNumeric` 함수 자체도 더 이상 사용되지 않아 삭제. validation 은 schema SSOT (`evaluateMetadataBlockingErrors`) 가 담당. |

### Warning (4건)

| ID | 카테고리 | 조치 |
|----|---------|-----|
| WARN (chart 잔류) | Maintainability | `chart.handler.ts` 의 `void chartType; void title;` 잔류 변수 억제 패턴 제거 — `const chartType` / `const title` 선언 자체를 삭제 (rawConfig 기반으로 대체됨). |
| WARN (chart buttons) | Testing / Maintainability | `chart.handler.ts` 의 buttons 분기에서 `buttons: config.buttons` (evaluated) 사용 → `buttons: rawConfig.buttons ?? buttons` 로 일관성 회복 (template / carousel 과 동일 패턴). |
| WARN (parallel context) | Architecture / API Contract | `parallel.handler.ts` 의 `context?: ExecutionContext` 옵셔널 → 필수 (`context: ExecutionContext`). 다른 핸들러들과 LSP 일관성 회복. `parallel.schema.spec.ts` 의 5개 호출 사이트에 `ctx` 객체 전달. |
| WARN (background spread) | Security | `background.handler.ts` 의 `config: { ...rawConfig }` 무제한 spread → 명시적 schema 필드만 echo (`notes`, `notifyOnFailure`, `maxDurationMs`). 향후 schema 가 credential 류 필드를 추가해도 자동 노출 차단. |

### Testing 보강

| ID | 조치 |
|----|-----|
| WARN (table columns 회귀 테스트) | `table.handler.spec.ts` 에 ENG-RC-* 케이스 추가 — `config.columns` raw 보존 vs `output.columns` resolved 분리 명시적 검증. |

---

## (B) 본 PR 외로 deferred — 다수 (대부분 Info / 정책 결정성)

### Security 정책 결정성

| ID | 사유 |
|----|-----|
| WARN (DatabaseQuery raw query/parameters echo) | 사용자 정책 결정 필요 — `query` / `parameters` 의 echo 가 DB 스키마 + 민감 참조를 execution 기록에 영구화. heuristic 마스킹은 false positive 위험. 별도 정책 PRD 트랙. |
| WARN (Code source echo) | 동일 — 코드 소스가 execution 기록에 저장됨을 명문화 필요. config echo 정책의 일부. |
| WARN (Double evaluation 인젝션) | 시스템 차원 검토 — echoed config 가 재평가 입력으로 절대 사용되지 않음을 엔진 차원에서 명시 / 차단. Phase 4~6 영역 (frontend / Swagger / DB) 에서 함께 검토. |

### Architecture / 큰 리팩토링

| ID | 사유 |
|----|-----|
| WARN (AI Agent conditions/knowledgeBases 삼중 삼항 중복) | `ai-agent.handler.ts` 3개 echo 지점에 동일 패턴 반복. `pickIfNonEmpty(raw, evaluated)` 헬퍼로 추출 가능. 별도 maintainability 라운드. |
| WARN (workflow buildSubWorkflowError 타입 광역화) | `Record<string, unknown>` 으로 광역화 — 타입 안전성 약화. 명시적 인터페이스 회복은 별도 정리. |
| WARN (rawConfig / turnRawConfig 이중 네이밍) | `ai-agent.handler.ts` 내 두 변수명 통일 — 단순 rename 이지만 grep 영향 없는 영역. |
| WARN (buildMultiTurnFinalOutput / buildConditionOutput 최종 echo) | 현재 `{mode, model}` 만 echo. `state.rawConfig` plumbing 으로 raw 전체 echo 가능. Phase 7 또는 별도 PR. |
| WARN (`as unknown as Type` 광범위 캐스팅) | 8+ 핸들러에 적용. 런타임 타입 가드 또는 ExecutionContext.getRawConfig() 헬퍼 도입 검토 — 별도 라운드. |

### Testing 보강 (deferred)

| ID | 사유 |
|----|-----|
| WARN (14개 핸들러 신규 ENG-RC-* 테스트 부족) | information-extractor / text-classifier / code / transform / workflow / database-query / merge / carousel / form / template / ai-agent (multi-turn) — 각 1~3개 추가. happy path 회귀는 기존 2789 테스트로 검증되나 raw vs evaluated 직교성 명시 테스트 없음. 시간 budget 으로 deferred. |
| INFO (`makeContext` 헬퍼 패턴 통일) | manual-trigger 만 헬퍼 함수, 다른 spec 은 inline. 공통 test util 로 추출 가능. |
| INFO (loop 다운스트림 grep 증거) | "outputData.config is never read back" 주장에 grep 결과 첨부 — 본 RESOLUTION 에 명시 (PR-3b 본문에서 grep 검증 완료). |

### Documentation / Side Effect / Performance Info

여러 reviewer 가 minor 개선 사항 제안 (chart `void` 변수 외에도 spec 문서 / 다운스트림 마이그레이션 가이드 등). Phase 4 (Frontend) / Phase 5 (Swagger) / Phase 6 (DB) 에서 자연스럽게 정리.

### `plan/complete/ai-agent-tool-connection-rewrite.md` 배치 규약

별도 사용자 결정으로 DEPRECATED 처리 + `complete/` 이동. 미체크 항목 잔존은 의도된 상태 (재작성 트랙이 처음부터 새로 시작). 본 PR 영역 외.

---

## (C) 사용자 결정 영향

사용자 지시: `auto mode` — "engine-raw-config-exposure 진행".

본 PR 에서 조치한 6건 (Critical 2 + Warning 4 + Testing 보강 1) 외 deferred 항목들은:
1. **정책 결정성** (DB / Code echo 마스킹 / double evaluation 차단) — 사용자 정책 PRD 트랙 영역.
2. **광범위 리팩토링** (헬퍼 추출 / 타입 안전성 / final echo plumbing) — 별도 maintainability PR 단위.
3. **테스트 보강** — 14개 핸들러에 1~3개씩 추가하면 ~30 테스트. 시간 budget. 핵심 회귀 가드 (table columns / parallel maxConcurrency / loop count) 는 본 PR 에 포함됨.

deferred 는 모두 별도 PR / Phase 4~7 영역 / 사용자 정책 결정으로 자연 흡수 — 별도 plan 신설 없음.

---

## 검증

- `npm run lint` clean
- `npm run test` — 169 suite, 2789 / 2789 pass (Phase 3 종료 직전 2788 → +1 신규: table columns 회귀 테스트)
- `npm run build` clean
- 행동 회귀 0 — 기존 모든 테스트가 ai-review 조치 후에도 통과
