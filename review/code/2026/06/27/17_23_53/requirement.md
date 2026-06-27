# 요구사항(Requirement) Review

## 발견사항

### **[INFO] [SPEC-DRIFT] `spec/5-system/2-api-convention.md §7` 에 "sensitive action" 티어 행 누락**
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/common/constants/throttle.ts` JSDoc; `spec/5-system/2-api-convention.md §7 Rate Limiting` 표
- 상세: `SENSITIVE_ACTION_THROTTLE` JSDoc 이 "정책 SoT: `spec/5-system/2-api-convention.md §7 Rate Limiting`" 으로 명시하지만, §7 표에는 "인증 API | 10 req/min (IP 기준)" 한 행만 있으며 "초대 발송/재발송(email-bombing 방지)" 및 "provider probe(`preview-models`·`:id/test`·`:id/models`) — 과금 보호" 용 별도 행이 없다. `grep` 으로 확인한 결과 spec §7 에 `provider probe`, `invitation`, `sensitive`, `남용` 언급이 전무하다. 코드는 올바르고 값(10 req/min)도 기존 인라인 상수를 공유 상수로 승격한 것이므로 동작 변경은 없다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/2-api-convention.md §7 Rate Limiting` 표에 "남용·비용 민감 action (초대 발송/재발송, provider probe) | 10 req/min (사용자 기준) | 동일" 행 또는 주석을 추가해 `SENSITIVE_ACTION_THROTTLE` 의 SoT 역할을 명시한다. `--impl-done` 게이트가 이를 검증하도록 되어 있으나, `--impl-done` 체크리스트 수행 전 spec-planner 에 위임 권고.

---

### **[INFO] [SPEC-DRIFT] `spec/2-navigation/6-config.md §3 POST preview-models` 테이블 행에 cap 500 미기재**
- 위치: `spec/2-navigation/6-config.md §3 Model Config API` 표, `POST /api/model-configs/preview-models` 행
- 상세: 계획 메모에 "cap 은 … 같은 위치(6-config §3 / data-flow 7-llm-usage / 7-llm-client §5.5)에 1줄씩 문서화"라고 명시했으나, `6-config.md §3` 에서는 `GET :id/models` 행만 "결과 수 방어적 상한 500(초과 시 앞 500개로 절단)"으로 갱신됐다. `POST preview-models` 행은 그대로다. cap 은 `7-llm-client.md §5.5`(신규 bullet) 와 `data-flow/7-llm-usage.md` 에서는 preview-models 포함 문서화가 되어 있어 실질 정보 누락은 아니지만, 6-config §3 API 표 내 두 엔드포인트 간 비대칭이 남는다.
- 제안: 코드 유지 + spec 반영. `spec/2-navigation/6-config.md §3 POST /api/model-configs/preview-models` 행 설명 말미에 "결과 수 방어적 상한 500 적용" 문구를 추가한다.

---

### **[INFO] `workspaces.controller.ts` — `const INVITATION_THROTTLE` 가 import 문 사이에 위치**
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.controller.ts` 라인 1803–1806
- 상세: `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 가 `../../common/swagger` import 와 `WorkspacesService` import 사이에 위치한다. ESM/TypeScript 는 import 선언을 모듈 평가 전에 처리하므로 런타임 동작은 올바르고, 원본 파일도 동일한 패턴(`const` 가 import 앞)이 있었으며 lint PASS 확인됨. 기능 결함 없음.
- 제안: 개선 사항이 아닌 관찰. 원하면 `const` 를 모든 import 아래로 이동하면 관용적 순서가 된다.

---

## 요약

4개 파일(throttle 상수, model-type DTO, cap 로직, 컨트롤러 refactor)과 관련 spec/test 변경 전반에서 **기능 완전성·엣지 케이스·에러 시나리오·반환값·비즈니스 로직 모두 의도 요구사항을 충족**한다.

- `SENSITIVE_ACTION_THROTTLE` 추출: 기존 인라인 `{ default: { ttl: 60_000, limit: 10 } }` 두 곳을 단일 SoT 로 승격. 값 동일, 동작 무변경.
- `MODEL_TYPE_ENUM`/`ModelTypeFilter` DTO 분리: 컨트롤러 `ParseEnumPipe` + `LlmService.listModels opts.type` 가 동일 SOT 참조. `ModelInfo['type']` 이 `'chat' | 'embedding'`(인터페이스 확인) 이므로 타입 정합.
- `capModelList`(`MAX_MODEL_LIST_SIZE=500`): 빈 배열·경계값·초과·경고 로그를 단위 테스트가 검증. `LlmService.listModels`(캐시 전 적용)·`LlmPreviewService.previewModels`(timeout 반환 직후 적용) 양 경로 모두 올바르게 wiring.
- `@ApiQuery enumName: 'ModelTypeFilter'` 추가 및 spec 3곳(`6-config.md`, `7-llm-client.md`, `data-flow/7-llm-usage.md`) 동기화 완료.

식별된 이슈 2건은 모두 [SPEC-DRIFT] INFO(코드 정상, spec 갱신 누락): (1) `api-convention §7` 표에 "sensitive action" 티어 미기재, (2) `6-config.md §3 POST preview-models` 행에 cap 500 미기재. 코드 fix 불필요, spec 갱신만 필요(project-planner 경로).

## 위험도

LOW
