# RESOLUTION — 21_05_46

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 (런타임 404 버그) | 761667c6 | `SETTINGS_HREF["llm-config-selector"]` `/llm-configs` → `/models?tab=chat` |
| W2 | 코드 (테스트 누락) | 761667c6 | `model-configs.test.ts` 신규 생성 — list(kind) envelope/dual-shape/error/limit, listModels/previewModels/testConnection |
| W3 | 코드 (픽스처 오류) | 761667c6 | `llm-config-selector.test.tsx` `baseConfig` + `kind:"chat"` + `isDefault` |
| W4 | 코드 (단언 누락) | 761667c6 | `use-default-llm-config-id.test.tsx` 3개 케이스 전부 `list("chat")` 호출 단언 |
| W5 | 코드 (단언 누락) | 761667c6 | `create-kb-form-dialog.test.tsx` `list("chat")` + `list("rerank")` 각각 호출 단언 케이스 추가 |
| W6 | 코드 (명칭 정합) | 761667c6 | `EmbeddingModelCombobox.llmConfigId` prop → `modelConfigId` (컴포넌트 + 테스트) |
| W7 | 코드 (명칭 정합) | 761667c6 | `useDefaultLlmConfigId` → `useDefaultChatModelConfigId` (새 파일 + JSDoc + re-export shim 유지) |
| W8 | 코드 (에러코드 누락) | 761667c6 | `MODEL_CONFIG_INVALID` + `MODEL_CONFIG_NOT_FOUND` 추가 (LLM_CONFIG_* 유지 — llm.service.ts 경로 여전히 사용) |
| W9 | 코드 (매직넘버) | 761667c6 | `ALL_RECORDS_LIMIT = 9999` 상수 추출 + `makeModelConfigsListKey` factory (INFO5/INFO7) |

INFO 처리 요약:
- INFO2: `use-embedding-model-loader.ts` JSDoc `GET /llm-configs/:id/models` → `/model-configs/:id/models` 수정 (commit 761667c6)
- INFO3/INFO4: `llmConfigs` 변수/prop → `chatModelConfigs` (`create-kb-form-dialog.tsx`, `kb-form-body.tsx`, KB settings page) (commit 761667c6)
- INFO7: `makeModelConfigsListKey` factory 추가 (commit 761667c6)
- INFO6: `unwrap` 헬퍼 미통일 — 아래 보류 참조

## TEST 결과

- lint  : 통과
- unit  : 통과 (4253 total — 4251 passed, 1 skipped; 이전 1건 실패 `sanitize-loader-error.test.ts` 도 W8 코드 변경에 맞춰 수정 후 통과)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- **INFO1 (FP — 코드 변경 없음)**: SUMMARY INFO1 이 `spec/2-navigation/6-config.md` L230, L312 의 `RERANK_CONFIG_INVALID` 를 SPEC-DRIFT 로 태깅했으나 **실제로는 false positive**. `rerank.service.ts:107` 은 여전히 `RERANK_CONFIG_INVALID` 를 emit 하며 (PR4 에서 의도적으로 보존), spec 과 코드가 일치한다. 코드 revert 불필요, spec 변경 불필요.

- **W9/INFO9 백엔드 limit cap 없음 (unbounded query 잠재 위험)**: `model-config.service.ts findAll` 은 `limit` 값을 `.take(limit)` 에 그대로 전달하며 서버 측 최대 cap 이 없다. `ALL_RECORDS_LIMIT=9999` 로 요청 시 TypeORM 이 `LIMIT 9999` SQL 을 발행한다. 워크스페이스 당 모델 config 는 통상 수십 건 미만이므로 현 시점 실질 위험은 낮으나, **향후 백엔드에 max-limit cap (예: 200) 을 추가하는 것을 권장**. plan 이슈로 등록 요망.

- **INFO6**: `list()` 응답 dual-shape 정규화가 `unwrap` 헬퍼를 쓰지 않음 — `unwrap<ModelConfigData[]>` 통일 또는 TODO 주석 추가로 후속 리팩토링 가능. 현 동작에는 영향 없음.

- **INFO8**: `embedding-model-combobox.test.tsx` 의 `DEFAULT_CONFIG` 에 `kind: "chat"` — 테스트 설명과 kind 가 맞지 않으나 기능 결함 아님. `DEFAULT_CHAT_CONFIG` 로 명확화하거나 주석 추가 가능 (minor).
