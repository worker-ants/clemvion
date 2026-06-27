# Documentation Review

## 발견사항

### [INFO] `capModelList` — `@param`/`@returns` JSDoc 태그 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/list-models-cap.ts` L234–248
- 상세: `capModelList` 함수의 JSDoc 프로즈(동작 설명, 순서 보존, 로그)는 충실하지만 TypeScript 공식 `@param`/`@returns` 태그가 없어 IDE hover나 typedoc 자동 생성 시 파라미터별 설명이 노출되지 않는다. 특히 `logger` 파라미터가 optional이며 없을 때 경고 로그를 단순히 생략한다는 사실을 태그 없이는 추론해야 한다.
- 제안: `@param models` / `@param logger` (optional, absent 시 warn 생략) / `@returns` (cap 이하 시 same reference, 초과 시 slice) 태그 추가. 현재 프로즈 수준이면 INFO 수준이며 차단 불필요.

---

### [INFO] `spec/2-navigation/6-config.md` API 테이블 — `preview-models` 행에 500-cap 미기재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/spec/2-navigation/6-config.md` Model Config API 테이블 (`preview-models` 행)
- 상세: `:id/models` 행은 이번 변경으로 "결과 수 방어적 상한 500(초과 시 앞 500개로 절단)" 설명이 추가됐다. 그러나 `preview-models` 행은 갱신되지 않았다. 실제로는 `LlmPreviewService.previewModels`도 `capModelList`를 거쳐 동일 상한을 적용받는다(`7-llm-client.md`의 preview-models 절에서는 이를 문서화했으나 `6-config.md` 테이블 내 대칭 기재가 없다).
- 제안: `preview-models` 행 설명에도 "응답 모델 수 방어적 상한 500 적용(`:id/models`와 동일)" 한 줄 추가. 두 파일 간 교차 참조 일관성을 위한 개선이며 스펙 중단 수준은 아님.

---

### [INFO] `spec/5-system/2-api-convention.md §7` 참조만 있고 해당 파일 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/common/constants/throttle.ts` L44 (`정책 SoT: spec/5-system/2-api-convention.md §7 Rate Limiting`)
- 상세: `SENSITIVE_ACTION_THROTTLE`의 정책 SoT를 `2-api-convention.md §7`로 지정했으나, 이번 changeset에 해당 파일의 diff가 포함되지 않았다. §7이 "sensitive action tier" 개념과 소비자(워크스페이스 초대 + provider probe)를 이미 명시하고 있다면 문제없다. 그러나 §7이 단순히 전역 tier(100 req/min)만 다루고 있다면 새로 추출된 공통 tier에 대한 설명이 누락된 상태다.
- 제안: `spec/5-system/2-api-convention.md §7`를 확인하여 "민감 액션 tier(10 req/min)" 항목이 없다면 추가. `throttle.ts`의 소비처 목록은 상수 파일 내 JSDoc으로 관리되므로 스펙에서는 tier 정의만 기재해도 충분.

---

### [INFO] `LlmService.listModels` / `LlmPreviewService.previewModels` — 공개 서비스 메서드 JSDoc 부재
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm.service.ts` — `listModels` 메서드 (L1515)
  - `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm-preview.service.ts` — `previewModels` 메서드 (L1025)
- 상세: 두 메서드 모두 이번 changeset에서 `capModelList` 적용이 추가됐으나 메서드 수준 JSDoc은 없다. 이는 사전 존재하는 갭이지 이번 변경이 도입한 회귀는 아니다. `listModels`의 `opts.type` 타입이 인라인 리터럴에서 `ModelTypeFilter`로 변경됐는데, JSDoc이 없어 타입 변화의 의도를 코드 외부에서 파악하기 어렵다.
- 제안: 두 메서드에 최소 1~2줄 JSDoc(캐시 동작, cap 적용, SSRF 가드 등 핵심 계약) 추가를 향후 tech-debt으로 등록. 현 changeset 범위에서의 필수 사항은 아님.

---

## 요약

이번 changeset의 문서화 품질은 전반적으로 높다. 신규 파일 3개(`throttle.ts`, `list-models-cap.ts`, `model-type.ts`) 모두 정책 배경·스펙 교차 참조·소비처 목록을 갖춘 충실한 JSDoc을 포함하며, 컨트롤러 인라인 주석도 SoT 이동과 함께 정확히 갱신됐다. 스펙 파일 2개(`6-config.md`, `7-llm-client.md`)는 500-cap 동작을 코드와 동기화해 문서화했다. 발견된 갭은 모두 INFO 수준으로, `preview-models` 행의 테이블 기재 비대칭, `api-convention.md §7` 참조 대상의 실제 내용 확인 필요, 기존 공개 서비스 메서드의 JSDoc 부재(사전 존재 갭) 등이며 어느 것도 구현 이해나 유지보수에 즉각적인 위험을 초래하지 않는다.

## 위험도

LOW
