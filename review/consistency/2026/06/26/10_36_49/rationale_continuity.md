# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 문서: `spec/2-navigation/6-config.md`
검토 범위: `codebase/backend/src/modules/llm/**`, `codebase/backend/src/modules/model-config/**` (git diff origin/main...HEAD)

---

## 발견사항

### 발견사항 없음 (CRITICAL)

기각된 대안 재도입, 합의된 invariant 직접 위반 없음.

---

### [WARNING] `spec/5-system/7-llm-client.md` Rationale 의 forwardRef 백로그 참조가 구현 이후 stale

- **target 위치**: 구현 변경 자체(diff)에는 해당 없음. 단, 구현이 해소한 사실이 spec 에 반영되지 않았다.
- **과거 결정 출처**: `spec/5-system/7-llm-client.md` §8.3 본문 (line 443) 및 `## Rationale` (line 476)
  - 본문 line 443: "모듈 의존은 `LlmModule → ModelConfigModule`(상호 forwardRef; **순환 정리는 백로그 `unified-model-management §7 W4`**)"
  - Rationale line 476: "이로 인해 `LlmModule → ModelConfigModule` 상호 forwardRef 순환이 생겼고, 그 정리는 **백로그 `unified-model-management §7 W4` 로 추적한다**(런타임 위험 없음)."
- **상세**: 위 두 곳은 forwardRef 순환을 "미해소 백로그"로 기술한다. 그러나 본 구현(`refactor-02 C-2 cluster 4`)은 `LlmModelConfigController` 신설 + observer 패턴(`ModelConfigService.onConfigInvalidated`)으로 그 순환을 완전히 제거했다 — `llm.module.ts` 와 `model-config.module.ts` 양쪽 모두 `forwardRef` 제거 확인. spec 이 "아직 미해소"를 명시하는데 코드는 해소된 상태가 됐으므로 정합성 차이가 생긴다.
- **제안**:
  - `spec/5-system/7-llm-client.md` line 443: "상호 forwardRef; 순환 정리는 백로그 …" → "단방향 `llm → model-config` 의존으로 정리됨 (`refactor-02 C-2 cluster 4`)."
  - Rationale line 476: 백로그 추적 문구를 "정리 완료" 표현으로 갱신하고, 해소 방법(엔드포인트 재배치 + observer 역전)을 한 줄 추가.
  - 이 갱신은 plan `02-architecture.md` 의 C-2 cluster 4 planner 후속 항목으로 이미 예정됨.

---

### [WARNING] `spec/data-flow/7-llm-usage.md` 의 컨트롤러 파일명 및 캐시 무효화 서술이 구현 이후 stale

- **target 위치**: 구현 변경 자체에는 해당 없음. 단, 구현이 바꾼 사실이 spec 에 반영되지 않았다.
- **과거 결정 출처**: `spec/data-flow/7-llm-usage.md` lines 50–54
  - line 50: "부속 엔드포인트 (`model-config.controller.ts`; …)"
  - line 54: "config 수정/삭제 시 **controller 가 `LlmService.clearClientCache(id)` 를 호출**해 client 캐시 + listModels 캐시를 함께 무효화한다."
- **상세**: 구현 이후 실제 동작은 다음과 같이 달라졌다:
  1. 부속 3 엔드포인트(`preview-models` / `:id/test` / `:id/models`)는 `model-config.controller.ts` 가 아니라 신설된 **`llm-model-config.controller.ts`** 에서 처리한다.
  2. 캐시 무효화는 `ModelConfigController` 가 `LlmService.clearClientCache` 를 직접 호출하는 방식이 아니라, **`ModelConfigService.onConfigInvalidated` 옵저버 → `LlmService.onConfigInvalidatedListener`** 경로로 역전됐다.
  이 두 서술이 stale 하면 data-flow 다이어그램 독자가 구현 흐름을 오독하고, 이후 수정 시 wrong 파일을 찾을 위험이 있다.
- **제안**:
  - line 50 "(`model-config.controller.ts`; …)" → "(`llm-model-config.controller.ts`; 라우트 프리픽스 `model-configs` 유지, 공개 API 무변 — `refactor-02 C-2 cluster 4`)"
  - line 54 "controller 가 `LlmService.clearClientCache(id)` 를 호출" → "`ModelConfigService.notifyInvalidated(id)` → `LlmService.onConfigInvalidatedListener` 가 client 캐시 + listModels 캐시 무효화 (옵저버 역전, forwardRef 제거를 위해)"
  - 이 갱신은 plan `02-architecture.md` C-2 cluster 4 planner 후속 INFO #6·#7 로 이미 예정됨.

---

### [INFO] `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 컨트롤러 미등재

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter `code:` 목록
- **과거 결정 출처**: `spec/2-navigation/6-config.md` 자체 frontmatter 규약 (spec-impl-evidence SoT 정책)
- **상세**: frontmatter 에 `codebase/backend/src/modules/llm/llm-preview.service.ts` 는 이미 등재되어 있으나, 본 구현이 새로 추가한 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 가 없다. 이 파일은 모델 config API 의 부속 엔드포인트 3종(`preview-models`/`test`/`models`)을 소유하므로 spec coverage 추적 대상이다. `LlmService.onModuleInit` 의 캐시 무효화 구독도 이 spec 영역의 구현이지만, `llm.service.ts` 는 llm-client spec(`5-system/7-llm-client.md`)의 code: 소관이라 여기서는 별도 판단 필요.
- **제안**: `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가. plan `02-architecture.md` C-2 cluster 4 planner 후속 WARNING #1 로 이미 예정됨.

---

## 요약

본 구현(`refactor-02 C-2 cluster 4`)은 `spec/5-system/7-llm-client.md` Rationale 에서 명시 추적한 backlog W4(forwardRef 순환)를 해소하기 위해, plan `02-architecture.md` 이 사용자 결정(2026-06-26)으로 확정한 **Option a′(엔드포인트 재배치 + observer 역전)** 를 그대로 구현했다. 기각된 대안(Option B: 이벤트 포트 교체 — 엔진↔WS 와 별개로 llm↔model-config 에도 해당하지 않음; Option C: 모듈 병합 — spec data-flow 다이어그램 구조 훼손 이유로 기각)은 재도입되지 않았다. 합의된 설계 원칙(spec 비언급 클러스터는 순환 제거 허용, 엔진↔WS forwardRef 는 §4.4 명시 유지) 도 모두 준수됐다. 발견된 2개 WARNING 은 구현이 해소한 사실을 spec 본문/Rationale 에 반영하지 않아 stale 해진 텍스트로, 기존 plan 의 planner 후속 항목으로 이미 추적 중이다. 구현 자체에 Rationale 연속성 위반은 없다.

## 위험도

LOW
