# Rationale 연속성 검토 결과

검토 모드: `--impl-done` | scope: `spec/2-navigation/6-config.md` | diff-base: `origin/main`

---

## 발견사항

### [WARNING] spec/5-system/7-llm-client.md Rationale 가 forwardRef 순환을 여전히 "오픈 백로그"로 기술
- **target 위치**: diff 전반 — `llm.module.ts` / `model-config.module.ts` 에서 `forwardRef` 제거, `LlmModelConfigController` 신설, `ModelConfigService.onConfigInvalidated` 옵저버 패턴 도입
- **과거 결정 출처**: `spec/5-system/7-llm-client.md` §Rationale "왜 testConnection·listModels 가 kind-agnostic 조회를 쓰나" 항
  > "이로 인해 `LlmModule → ModelConfigModule` 상호 forwardRef 순환이 생겼고, 그 정리는 백로그 `unified-model-management §7 W4` 로 추적한다(런타임 위험 없음)."
- **상세**: 현재 diff 는 이 forwardRef 순환을 실제로 제거한다(controller 분리 + 옵저버 역전). 그러나 spec Rationale 는 갱신되지 않아 문서상 여전히 "백로그에서 정리 예정"인 미해결 상태로 남아있다. 이후 독자가 `llm-client.md` 를 읽으면 순환이 아직 존재하며 `unified-model-management` 계획에서 처리 예정이라고 오해한다.
- **제안**: `spec/5-system/7-llm-client.md` Rationale 해당 항의 "(순환 정리는 백로그 unified-model-management §7 W4)" 문구를 제거하거나 "refactor-02 C-2 cluster 4 에서 LlmModelConfigController 분리 + 옵저버 패턴으로 해소됨" 으로 교체한다.

---

### [INFO] 계획이 예측한 W3/W4 해소 방식과 실제 구현 경로 차이
- **target 위치**: `model-config.controller.ts` 의 `llmService.clearClientCache()` 직접 호출 제거 + `ModelConfigService.notifyInvalidated` 옵저버 도입
- **과거 결정 출처**: `plan/complete/unified-model-management.md` §7 W3/W4
  > "W3: PR4 alias 제거 시 ModelConfigController 의 LlmService.clearClientCache() 직접 호출이 사라지므로 구조적으로 해소됨."
  > "W4: preview-llm-models.dto 이동으로 근본 원인 해소 — PR4 alias 모듈 제거 시 함께 처리."
- **상세**: 계획 문서는 W3/W4 가 PR4(alias 제거 + DTO 이동) 에서 해소될 것으로 예측했으나, PR4 완료 후에도 `forwardRef` 와 `clearClientCache` 직접 호출이 잔존했다. 현재 diff 가 이를 완전히 해소하지만, 계획이 서술한 "DTO 이동 경로" 가 아닌 "컨트롤러 분리 + 옵저버 역전" 방식을 사용한다. spec Rationale 어디에서도 이 접근법을 거부한 적은 없으므로 설계 원칙 충돌은 아니다.
- **제안**: spec Rationale 갱신 시(위 WARNING 항 제안) 채택된 해소 방식(컨트롤러 분리 + 구독 옵저버)을 명시하면 충분하다. 별도 대응 불필요.

---

### [INFO] spec/2-navigation/6-config.md 의 code: frontmatter 에 신설 파일 미반영
- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (신설)
- **과거 결정 출처**: `spec/2-navigation/6-config.md` frontmatter `code:` 목록 (현행: `codebase/backend/src/modules/model-config/**` + `codebase/backend/src/modules/llm/llm-preview.service.ts`)
- **상세**: `/api/model-configs/preview-models`, `/:id/test`, `/:id/models` 엔드포인트 핸들러가 이제 `llm` 모듈 내 `LlmModelConfigController` 에 위치하지만 spec `code:` 목록에 반영되어 있지 않다. `llm-preview.service.ts` 는 이미 목록에 있으나 `llm-model-config.controller.ts` 는 없다.
- **제안**: `spec/2-navigation/6-config.md` frontmatter 의 `code:` 목록에 `codebase/backend/src/modules/llm/llm-model-config.controller.ts` 를 추가한다.

---

## 요약

target diff(refactor-02 C-2 cluster 4)는 `spec/5-system/7-llm-client.md` Rationale 가 오픈 백로그로 명시한 `LlmModule ↔ ModelConfigModule` forwardRef 순환을 실제로 해소하며, 기각된 대안의 재도입이나 합의 원칙 위반은 없다. 공개 API 계약(`/api/model-configs` 라우트와 동작)은 불변이고, 캐시 무효화 시점·의미도 동일하게 유지된다. 다만 spec Rationale(`llm-client.md`)이 이 순환을 여전히 "미해결 백로그"로 가리키고 있어 문서 독자가 오해할 수 있는 WARNING 이 한 건 존재한다. 이 항을 갱신하면 Rationale 연속성이 완전해진다.

## 위험도

LOW
