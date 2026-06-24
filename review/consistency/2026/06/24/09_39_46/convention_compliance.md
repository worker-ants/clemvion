# Convention Compliance Review — M-3 3단계 impl-prep

검토 모드: `--impl-prep`
범위: WorkflowAssistantStreamService 에서 `persistAssistantTurn` + `makeResumeMeta` + 사용자/assistant 메시지 영속 로직을 무상태 `AssistantTurnPersistenceService`(`tools/assistant-turn-persistence.service.ts`)로 분리.
대상 spec: plan 기재 `spec/5-system/4-ai-assistant.md` (실제 경로 확인 포함)

---

## 발견사항

### [WARNING] plan 본문의 spec 경로가 잘못 기재됨
- **target 위치**: `plan/in-progress/refactor/02-architecture.md` §M-3 "spec 대조" 노트 및 `plan/in-progress/refactor/03-maintainability.md` M-5 포인터 노트
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 제품 정의·요구사항 · 기술 명세" 및 spec-impl-evidence.md §1 적용 대상 경로 규칙
- **상세**: plan M-3 spec 대조 노트에 `4-ai-assistant.md` 가 `spec/5-system/4-ai-assistant.md` 경로로 암시되어 있으나(`spec/5-system/` 디렉토리에는 해당 파일이 없음), 실제 파일은 `spec/3-workflow-editor/4-ai-assistant.md` 에 존재한다. `spec/5-system/` 에는 `4-execution-engine.md` 가 `4-` prefix 를 점유하고 있다. 구현 착수 전 spec 경로를 잘못 참조하면 코드의 `code:` glob 등 frontmatter 대조 시 오인 가능성이 있다.
- **제안**: `plan/in-progress/refactor/02-architecture.md` M-3 "spec 대조" 노트 및 관련 포인터를 `spec/3-workflow-editor/4-ai-assistant.md` 로 정정. (구현 자체에는 영향 없으나 plan 문서 정합성 차원에서 교정 권장)

### [INFO] 제안 파일 경로·클래스 명명이 기존 패턴과 일치함 — 확인
- **target 위치**: 구현 계획 상 신설 파일 `tools/assistant-turn-persistence.service.ts` / 클래스 `AssistantTurnPersistenceService`
- **위반 규약**: 없음 (확인 사항)
- **상세**: 기존 1·2단계 산출물(`tools/assistant-tool-router.service.ts` → `AssistantToolRouter`, `tools/assistant-finish-guard.service.ts` → `AssistantFinishGuard`)과 동일한 `tools/<domain>-<role>.service.ts` / `PascalCase` 패턴을 따른다. NestJS 관용 `@Injectable()` 서비스 파일 명명 규약(`swagger.md` §2 Controller 패턴 참조 기준)과도 일치.
- **제안**: 현행 계획대로 진행 가능.

### [INFO] 대상 spec frontmatter `status: implemented` — 변경 불필요 확인
- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` frontmatter
- **위반 규약**: 없음 (확인 사항)
- **상세**: spec-impl-evidence.md §3 기준으로 behavior-preserving 리팩터(verbatim 이동)는 spec 행위 계약을 변경하지 않으므로 frontmatter `status: implemented` + `code: codebase/backend/src/modules/workflow-assistant/**/*.ts` (glob 이 신설 파일 포함) 갱신이 불필요하다. plan M-3 "spec 갱신: 불요" 기재와 정합.
- **제안**: 현행 계획대로 진행 가능.

---

## 요약

M-3 3단계 구현 계획은 명명 규약(파일명·클래스명·`tools/` 하위 배치)·출력 포맷·문서 구조·API 문서 규약 측면에서 기존 1·2단계와 동일한 패턴을 따르고 있어 정식 규약 위반이 없다. 유일한 지적 사항은 plan 내 spec 경로 오기재(`spec/5-system/4-ai-assistant.md` → 실제 `spec/3-workflow-editor/4-ai-assistant.md`)로 WARNING 수준이나, 구현 행위 자체를 차단하지는 않는다.

## 위험도

LOW
