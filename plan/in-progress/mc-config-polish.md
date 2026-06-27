---
worktree: mc-cfg-polish
started: 2026-06-27
owner: developer
status: in-progress
base: origin/main @ 268ef02a4 (#719 포함)
source: refactor backlog ③ (model-config 부속 엔드포인트 후속, #716·#718·#719 흐름)
---

# ③ model-config 코드 polish

#716/#718/#719 흐름의 코드 polish. provider probe 엔드포인트(`llm-model-config.controller.ts`) 주변 4건. branch `claude/mc-cfg-polish`. (planner sub-step: cap spec delta.)

## 체크리스트

- [x] **(1) shared throttle 상수** — 공통 `SENSITIVE_ACTION_THROTTLE`(`common/constants/throttle.ts`) 추출. `PROVIDER_PROBE_THROTTLE`·`INVITATION_THROTTLE` 는 이 값을 가리키는 named 별칭(라우트 의미 보존 + #719 spec 의 `PROVIDER_PROBE_THROTTLE` 참조 유지).
- [x] **(2) MODEL_TYPE_ENUM/ModelTypeFilter → DTO** — `model-config/dto/model-type.ts` 로 이전. 컨트롤러(ParseEnumPipe·ApiQuery) + `LlmService.listModels` opts.type 공유 SOT.
- [x] **(3) @ApiQuery enumName** — `enumName: 'ModelTypeFilter'` 추가 (OpenAPI named enum, #718 I-3).
- [x] **(4) listModels 결과 수 cap 500** — silent 하드캡(사용자 결정). `list-models-cap.ts`(`MAX_MODEL_LIST_SIZE`=500, `capModelList`). `LlmService.listModels`·`LlmPreviewService.previewModels` 양 경로 적용. provider 순서 보존 + 초과 시 경고 로그. **응답 shape/계약 무변경**(여전히 `ModelInfo[]`).

## 워크플로 게이트

- [x] lint (PASS)
- [ ] unit test (plan-frontmatter guard 수정 후 재실행)
- [ ] build
- [ ] e2e
- [ ] /ai-review → Critical/Warning 0 (or resolution-applier fix)
- [ ] consistency-check --impl-done <spec 영역> → BLOCK NO (spec 연결 코드 변경)

## 결정·메모

- **cap 동작 = silent 하드캡 500 + 로그** (사용자 2차 결정). 당초 truncated 플래그(A)는 응답 shape 가 bare `ModelInfo[]` 라 `{models,truncated}` 로 깨야 하는 breaking 변경(back+front+test ~10파일)으로 판명 → silent 캡으로 선회. saved 모델은 6-config §3 placeholder 가 보존해 UX 안전.
- cap 은 spec 의 timeout(30s)·cache(5분) 와 동일 층 방어 동작이라 같은 위치(6-config §3 / data-flow 7-llm-usage / 7-llm-client §5.5)에 1줄씩 문서화. spec↔code 정합은 mandatory `--impl-done` 게이트가 검증.
- **부수 발견(미처리, 별 트랙)**: `ModelListDto`({models:[]}) swagger 가 실제 wire shape(bare `ModelInfo[]`)와 불일치 — 본 PR 범위 아님(응답 shape 변경 수반). 추후 별도 정정 필요.
- 항목 ① testConnection 404 일관성 / ④ marketplace 는 본 작업 아님(별 트랙).
