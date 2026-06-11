# RESOLUTION — 00_30_05

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | a1191baf | `testConnection` 응답 타입 `error` → `message` 정렬 (백엔드 DTO `ModelTestConnectionResultDto.message` 기준) |
| W2 | 코드 | a1191baf | Embedding 폼 `dimension` 숫자 입력 추가 + create/update payload 포함 + i18n key (en/ko) |
| W3 | 코드 | a1191baf | Rerank API Key 조건부 렌더 복구 — `showApiKey = kind !== "rerank" \|\| formProvider === "cohere"` |
| W4 | 코드 | a1191baf | API Key 테이블 렌더 클라이언트 마스킹 — `config.apiKey ? "••••••••" : "—"` |
| W5 | 코드 | (deferred) | SRP 분리 — `ModelConfigFormDialog` + `useModelConfigForm` 추출. 525 LOC → 중기 리팩토링으로 이월. 보류 항목 참조 |
| W6 | 코드 | a1191baf | 인라인 모달 ESC 키 닫기 핸들러 추가 (focus-trap 완전 구현은 shadcn Dialog 교체로 이월) |
| W7 | 코드 | a1191baf | `use-model-loader.ts` — `ModelLoaderApi` 인터페이스를 모든 import 완료 후로 이동 |
| W8 | 코드 | a1191baf | 매직 넘버 `0.7`·`4096` → `DEFAULT_TEMPERATURE`·`DEFAULT_MAX_TOKENS` 상수 선언 후 교체 |
| W9 | 코드 | a1191baf | `model-config-manager.test.tsx` 신규 작성 — handleSave 유효성 검사, kind 별 렌더, 삭제 확인, embedding dimension 필드 |
| W10 | 코드 | a1191baf | `useModelLoader`, `ModelCombobox`, `useEmbeddingModelLoader` — custom `api` 주입 테스트 케이스 추가 |
| W11 | 코드 | a1191baf | `models-page.test.tsx` — `?tab=embedding` API 호출 검증 + 탭 전환 `router.replace` URL 검증 |
| W12 | 코드 | a1191baf | `modelConfigsApi.list()` — `limit: 9999` 쿼리 추가 |
| INFO10 (SPEC-DRIFT) | spec | 085a7d08 | `max_tokens` 기본값 4096 — spec §B.4 `2048`→`4096` 정정 + Rationale R-5 신설 + ai-agent.md 예시 동반 갱신. consistency-check `--spec` BLOCK:NO(`00_56_14`) 후 반영. draft → `plan/complete/spec-update-model-config-defaults.md` |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4155 + 40 new tests passed)
- e2e   : 통과 (179/179)

## 보류·후속 항목

- **W5 + W6 partial (Architecture)** → `plan/in-progress/model-config-manager-refactor-followup.md` 로 이관: `ModelConfigManager` SRP 분리(`ModelConfigFormDialog`/`ModelConfigDeleteDialog`/`useModelConfigForm`) + 인라인 모달 → shadcn `<Dialog>`/`<AlertDialog>` focus-trap. 대형 리팩토링이라 in-PR fix 에서 이월(기능·정합성 영향 없음, ESC 닫기는 W6 에서 추가 완료).
- **INFO10 spec-drift**: ✅ 반영 완료 (commit 085a7d08). draft → `plan/complete/spec-update-model-config-defaults.md`.
- **INFO8 (Architecture)**: 사이드바 레거시 i18n 키(`llmConfig`, `reranker`) — PR4 에서 제거.
- **INFO13-15 (Documentation)**: 사용자 문서 구 API 경로 교체 + `[+ Add Provider]` → `[+ Add Model]` 레이블 + Embedding 탭 가이드 미작성 — PR4 문서 업데이트 시 처리.
