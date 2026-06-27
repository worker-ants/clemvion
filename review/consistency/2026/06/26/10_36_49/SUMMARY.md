# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done`
대상 spec: `spec/2-navigation/6-config.md`
diff-base: `origin/main`
검토 일시: 2026-06-26

---

## 전체 위험도
**LOW** — API 계약·RBAC·데이터 모델·상태 전이 모두 spec 정의와 일치. 위배는 구현이 해소한 사실이 spec 본문/Rationale 에 아직 반영되지 않은 stale 텍스트 3건(WARNING)뿐이며, 모두 plan 의 "planner 후속" 트랙으로 이미 예약되어 있다.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec, Rationale Continuity | `spec/5-system/7-llm-client.md` §8 Rationale 의 forwardRef 백로그(W4)가 "미해소 현재형"으로 기술됨. 본 구현(`refactor-02 C-2 cluster 4`)이 해당 순환을 완전 제거했으나 spec 미갱신 | `spec/5-system/7-llm-client.md` lines 443, 476 | 구현 diff — `llm.module.ts` / `model-config.module.ts` 양쪽 `forwardRef` 제거 확인 | line 443: "상호 forwardRef; 순환 정리는 백로그 W4" → "단방향 `llm → model-config` 의존으로 정리됨 (refactor-02 C-2 cluster 4)". line 476: 백로그 추적 문구를 "정리 완료"로 갱신, 해소 방법(엔드포인트 재배치 + observer 역전) 한 줄 추가 |
| W2 | Rationale Continuity, Plan Coherence | `spec/data-flow/7-llm-usage.md` 의 컨트롤러 파일명(line 50)·캐시 무효화 서술(line 54)이 구 구현을 기술해 코드와 불일치 | `spec/data-flow/7-llm-usage.md` lines 50–54 | 구현 diff — `llm-model-config.controller.ts` 신설 / `ModelConfigService.onConfigInvalidated` 옵저버 역전 | line 50: "`model-config.controller.ts`" → "`llm-model-config.controller.ts`(라우트 프리픽스 `model-configs` 유지, 공개 API 무변 — refactor-02 C-2 cluster 4)". line 54: "controller 가 `LlmService.clearClientCache(id)` 를 호출" → "`ModelConfigService.notifyInvalidated(id)` → `LlmService.onConfigInvalidatedListener` 가 client 캐시 + listModels 캐시 무효화 (옵저버 역전)" |
| W3 | Convention Compliance, Plan Coherence, Cross-Spec, Rationale Continuity | `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 `llm-model-config.controller.ts` 미등재 — `spec-impl-evidence §2.1` 의미론적 요건(약속한 surface 의 구현 경로 열거) 불충족. 빌드 가드는 다른 glob 으로 통과하나 spec-coverage 추적 부정확 | `spec/2-navigation/6-config.md` frontmatter `code:` (line 11 부근) | `spec/conventions/spec-impl-evidence.md §2.1` | frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가 (또는 `codebase/backend/src/modules/llm/**` glob 으로 확장). plan C-2 cluster 4 "planner 후속 ①"로 이미 예약됨 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/5-system/7-llm-client.md §5.5` — preview-models 엔드포인트의 모듈 귀속 설명이 잠재적 구식화 가능성. 현재 spec 본문이 컨트롤러 모듈을 명시적으로 지목하지 않아 즉각 충돌 없음 | `spec/5-system/7-llm-client.md §5.5` | W1 Rationale 갱신과 함께 처리 시 충분. 즉각 수정 불요 |
| I2 | Naming Collision | 동형 in-process observer 패턴이 두 가지 명명 관례 공존: `IntegrationCacheBus` 계열(`register`/`invalidators`/`runInvalidators`) vs `ModelConfigService` 계열(`onConfigInvalidated`/`invalidationListeners`/`notifyInvalidated`). 실제 식별자 충돌(동일명·다른 의미)은 없음 | `codebase/backend/src/common/redis/integration-cache-bus.service.ts`, `codebase/backend/src/modules/model-config/model-config.service.ts` | 향후 공통 추상화(`CacheInvalidationBus` 인터페이스) 도입 시 명명 통일 검토. 현 단계 차단 사유 없음 |
| I3 | Naming Collision | `LlmModelConfigController` 와 `ModelConfigController` 가 동일 `@Controller('model-configs')` 프리픽스 공유. 핸들러 이전 완료로 중복 등록 없음. 의도적 설계(C-2 cluster 4 forwardRef 제거), 클래스 JSDoc 에 명시됨 | `codebase/backend/src/modules/llm/llm-model-config.controller.ts` | 추가 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1건(spec/5-system/7-llm-client.md Rationale forwardRef stale), INFO 2건 |
| Rationale Continuity | LOW | WARNING 2건(forwardRef Rationale stale + data-flow 서술 stale), INFO 1건 |
| Convention Compliance | LOW | WARNING 1건(spec-impl-evidence §2.1 frontmatter code: 누락) |
| Plan Coherence | LOW | WARNING 2건(frontmatter code: 누락 + data-flow 서술 stale), INFO 1건(구현이 plan 처방 정확히 준수) |
| Naming Collision | NONE | INFO 3건. 실질적 식별자 충돌 없음 |

---

## 권장 조치사항

1. **(planner 트랙 — W1)** `spec/5-system/7-llm-client.md` lines 443·476 의 forwardRef 백로그 문구를 "단방향 의존으로 정리 완료(refactor-02 C-2 cluster 4)"로 갱신. `unified-model-management §7 W4` 백로그 항목도 완료 처리.
2. **(planner 트랙 — W2)** `spec/data-flow/7-llm-usage.md` line 50 컨트롤러 파일명, line 54 캐시 무효화 서술을 현행 옵저버 패턴 기준으로 현행화. plan `02-architecture.md` C-2 cluster 4 planner 후속 INFO #6·#7 로 이미 예약됨.
3. **(planner 트랙 — W3)** `spec/2-navigation/6-config.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 추가. plan C-2 cluster 4 planner 후속 ① 로 이미 예약됨.
4. **(선택 — I2)** 향후 공통 캐시 무효화 인터페이스 도입 시 `IntegrationCacheBus` 와 `ModelConfigService` observer 패턴 명명 통일 검토.

---

*모든 WARNING 은 plan `02-architecture.md` C-2 cluster 4 "planner 후속" 트랙으로 이미 예약된 항목이며, impl-done 단계 차단 사유가 아니다. BLOCK: NO.*