### 발견사항

변경 범위 문제는 발견되지 않았습니다. 14개 파일 전체가 계획(`plan/in-progress/mc-config-polish.md`)의 4개 체크리스트 항목에 직접 대응됩니다.

#### 파일별 과제 매핑 확인

| 파일 | 과제 | 판정 |
|---|---|---|
| `common/constants/throttle.ts` (신규) | (1) 공통 throttle 상수 추출 | 범위 내 |
| `workspaces/workspaces.controller.ts` | (1) INVITATION_THROTTLE → 공통 상수 참조 | 범위 내 (plan에 명시) |
| `model-config/dto/model-type.ts` (신규) | (2) MODEL_TYPE_ENUM/ModelTypeFilter DTO 이전 | 범위 내 |
| `llm-model-config.controller.ts` | (1)+(2)+(3) throttle·enum 이전 + enumName 추가 | 범위 내 |
| `llm.service.ts` | (2)+(4) opts.type 타입 교체 + capModelList 적용 | 범위 내 |
| `list-models-cap.ts` (신규) | (4) cap 구현 | 범위 내 |
| `list-models-cap.spec.ts` (신규) | (4) cap 단위 테스트 | 범위 내 (TDD 의무) |
| `llm.service.spec.ts` | (4) LlmService cap 통합 테스트 | 범위 내 |
| `llm-preview.service.ts` | (4) LlmPreviewService cap 적용 | 범위 내 |
| `llm-preview.service.spec.ts` | (4) LlmPreviewService cap 테스트 | 범위 내 |
| `plan/in-progress/mc-config-polish.md` | 계획 관리 | 범위 내 |
| `spec/2-navigation/6-config.md` | (4) cap 1줄 spec 동기화 | 범위 내 (plan 메모에 명시) |
| `spec/5-system/7-llm-client.md` | (4) cap 1줄 spec 동기화 | 범위 내 |
| `spec/data-flow/7-llm-usage.md` | (4) cap 1줄 spec 동기화 | 범위 내 |

#### INFO 1건

- **[INFO]** `workspaces.controller.ts`에서 `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 선언이 import 문 사이에 위치함.
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.controller.ts` line 1805 (full file context 기준)
  - 상세: TypeScript에서 import 호이스팅으로 동작에는 문제 없으나, const 선언을 import 블록 사이에 두는 것은 비관례적 스타일임. 단, 이는 변경 전 원본 코드(`const INVITATION_THROTTLE = {...}` 위치)에서 이미 동일한 패턴이었으므로 이번 변경이 새롭게 도입한 문제가 아님.
  - 제안: 별도 리팩토링 트랙에서 import 블록을 모두 모은 뒤 const 선언을 그 아래로 이동하는 것을 고려할 수 있으나, 본 PR 범위 밖.

---

### 요약

14개 변경 파일 모두 계획(`mc-config-polish.md`)의 4개 항목((1) 공통 throttle 상수, (2) MODEL_TYPE_ENUM DTO 이전, (3) @ApiQuery enumName, (4) listModels 결과 수 cap 500)에 1:1 대응되며, 의도 이상의 추가 수정·불필요한 리팩토링·관련 없는 파일 변경은 발견되지 않았다. spec 동기화 3파일은 plan 결정·메모에서 "동일 층 방어 동작이라 동일 위치에 1줄씩 문서화"로 명시한 범위다.

### 위험도

NONE
