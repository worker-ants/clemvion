# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] llm-preview.service.ts / llm.service.ts — 공개 메서드 JSDoc 부재 (사전 갭)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/llm/llm-preview.service.ts` `previewModels`, `llm.service.ts` `listModels`
- 상세: 두 공개 async 메서드 모두 이번 PR 이전부터 JSDoc 미보유. 이번 변경(`capModelList` 통합)이 새로 도입한 갭이 아니며, RESOLUTION.md 에 I-14 "공개 메서드 JSDoc 사전 갭 — tech-debt" 로 이미 인지·보류 처리됨.
- 제안: 후속 tech-debt 정리 트랙에서 `@param`/`@returns`/`@throws` 추가. 본 PR 범위 외.

### [INFO] workspaces.controller.ts INVITATION_THROTTLE 주석 — 수치 간접 표현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/mc-cfg-polish/codebase/backend/src/modules/workspaces/workspaces.controller.ts` L56-L58
- 상세: 주석이 "분당 10회" 를 직접 명시하지 않고 `SENSITIVE_ACTION_THROTTLE` 를 통해 간접 참조한다. 단일 SoT 설계 의도와 일치하지만, 수치가 주석에 없어 파일만 보는 독자가 스로틀 값을 바로 파악하기 어렵다. `llm-model-config.controller.ts` 주석(`분당 10회`)과 표현 방식이 미세하게 다름.
- 제안: 주석을 `SENSITIVE_ACTION_THROTTLE`(분당 10회) 로 수치를 병기하거나, 두 컨트롤러 주석 형식을 일치시키는 minor 개선. 기능 영향 없음.

## 긍정 관찰 (주요 문서화 항목 전부 양호)

이번 변경셋의 문서화 수준은 전반적으로 우수하다.

- **신규 파일 JSDoc 완비**: `throttle.ts`(`SENSITIVE_ACTION_THROTTLE`) 및 `list-models-cap.ts`(`MAX_MODEL_LIST_SIZE` + `capModelList`)는 목적·소비처·spec SoT·동작 계약을 상세히 기술하며, `@param`/`@returns` 태그도 포함. `model-type.ts`(`MODEL_TYPE_ENUM`, `ModelTypeFilter`)도 SOT 의미·소비처·`ModelInfo['type']` 관계·rerank 제외 이유를 명시.
- **Swagger 데코레이터 완비**: `llm-model-config.controller.ts` 3 핸들러 모두 `@ApiTooManyRequestsResponse`(분당 10회) 추가 완료; `@ApiQuery enumName: 'ModelTypeFilter'` 도 추가.
- **spec 4곳 일관 업데이트**: `6-config.md §3`(preview-models 행 cap 500 보강), `2-api-convention.md §7`(초대 tier 행 추가 + 범위 주석 "하위 3행" 갱신), `7-llm-client.md`(frontmatter code 등록 + preview-models 결과 수 상한 설명), `data-flow/7-llm-usage.md`(두 엔드포인트 행 결과 수 상한 추가)가 코드 변경과 정합.
- **인라인 주석**: `llm.service.ts` capModelList 적용 지점에 `// 병적 대량 응답 방어 — 캐시에는 상한 적용된 목록을 저장한다.` 명확히 기술.
- **plan 문서**: `mc-config-polish.md`에 결정 배경(silent 캡 선택 이유, breaking change 위험, spec 연동 계획)이 상세 기록됨.

## 요약

이번 변경(throttle 상수 추출, MODEL_TYPE_ENUM DTO 이전, enumName 추가, listModels cap 500)의 문서화 수준은 높다. 신규 공개 상수·함수·타입 전부에 목적과 계약을 충분히 설명하는 JSDoc이 있고, Swagger 응답 선언도 완비됐으며, spec 4개 파일이 일관되게 갱신됐다. 지적 사항 두 건 모두 이번 PR이 새로 유발하지 않은 사전 갭(tech-debt)이거나 표현 일관성 개선 수준의 INFO로, 기능·가독성에 실질적 영향이 없다.

## 위험도

NONE

---

STATUS=success ISSUES=0
