# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 정정

`_prompts/convention_compliance.md` 에 임베드된 "Target 문서" 섹션(spec/data-flow/**, spec/conventions/cafe24-api-catalog/** 덤프)은 이번 작업 diff 와 무관한 콘텐츠였다(다른 세션/템플릿의 잔존으로 추정). orchestrator 지시에 따라 실제 diff 를 `git diff origin/main...HEAD` 로 직접 확인해 이를 target 으로 삼았다.

```
git merge-base origin/main HEAD  →  01e68001c (origin/main 과 동일 커밋, 이미 병합됨)
origin/main..HEAD 3 커밋:
  277e6d314 fix(execution-engine): 실패 알림 error 메시지의 secret 토큰 마스킹 (EIA §R17 잔여)
  3a522af2f fix(schedules): ai-review 반영 — schedule 실패 알림도 secret 마스킹 + boundary 테스트
  b43322b42 docs(review): 실패 알림 secret 마스킹 ai-review SUMMARY + RESOLUTION
```

변경 파일: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(+spec) · `codebase/backend/src/modules/schedules/schedule-runner.service.ts`(+spec) · `review/code/2026/07/10/{09_17_14,09_29_31}/**`. **spec/** 변경 없음.**

## 점검 관점별 결과

### 1. 명명 규약
- `sanitizeErrorMessage`(execution-engine 로컬 wrapper) / `redactSecrets`(shared SoT) 모두 기존에 이미 존재하던 식별자를 그대로 재사용했고, 새 식별자를 도입하지 않았다. `schedule-runner.service.ts` 는 이미 `../execution-engine/...` 로부터 `ExecutionEngineService`·`resolveTriggerParameters` 등을 import 하던 기존 cross-module 패턴을 그대로 연장한 것이라 신규 경계 위반이 아니다.
- 테스트 파일은 `sanitize-error-message.spec.ts` / `schedule-runner.service.spec.ts` 로 co-located `*.spec.ts` 관례를 그대로 따른다.
- 위반 없음.

### 2. 출력 포맷 규약
- `schedule_failed` 알림의 `message` 문자열 포맷은 `스케줄이 워크플로우 "${workflow.name}" 실행을 시작하지 못했어요: ${sanitizeErrorMessage(message)}` 로, 기존 `execution_failed` 의 `워크플로우 "${workflow.name}" 실행이 실패했어요: ${sanitizeErrorMessage(message)}` 와 동일한 wrapping 패턴이다. 새 포맷을 도입하지 않고 형제 알림 타입과 일관성을 유지했다.
- `sanitizeErrorMessage` 는 신규 마스킹 로직을 재구현하지 않고 `shared/utils/sanitize-error-message.ts` 의 `redactSecrets`(`SECRET_LEAK_PATTERNS`)를 호출만 한다 — diff 상 정규식·패턴 정의 추가는 0건.
- 위반 없음.

### 3·4. 문서 구조 규약 / API 문서 규약
- 이번 diff 는 spec 문서·OpenAPI/Swagger 데코레이터·DTO 를 건드리지 않는다(REST endpoint·컨트롤러 무변경, 내부 알림 payload 구성 로직만 수정). 해당 관점은 실질적으로 대상 없음(N/A).

### 5. 금지 항목 — SoT 재사용 원칙 준수 확인

이 저장소에는 "에러 메시지 secret 마스킹은 `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`redactSecrets` 를 재사용하고 새로 구현하지 않는다"는 규칙이 이미 여러 spec 문서에 반복 명문화돼 있고(정식 `spec/conventions/*.md` 단일 문서는 아니지만 cross-reference 되는 사실상 표준), 이번 diff 는 그 규칙을 정확히 준수한다.

- `spec/5-system/14-external-interaction-api.md` §R17(1148행): "모든 마스킹은 `shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`(에러 메시지 sanitizer 와 동일 SoT)을 재사용한다."
- `spec/5-system/11-mcp-client.md` §8.3(587행): "…공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 재사용하고 …별도 redaction 로직을 새로 두지 않은 이유: secret 패턴은 보안 민감 SoT 라 파편화 시 유지보수 위험이 크기 때문."
- `spec/2-navigation/4-integration.md`(1482행)도 동일 SoT(`SECRET_LEAK_PATTERNS`)를 인용.
- `plan/complete/eia-secret-masking-residuals.md` (P3-8, 56·64행)이 정확히 이 gap — "error 알림 경로의 Bearer 토큰 미마스킹 가능성" — 을 잔여 backlog 로 명시했고, 이번 diff(`277e6d314`/`3a522af2f`)가 그 항목을 해소한다.

diff 를 직접 확인한 결과(`git -C <worktree> diff`):
- `execution-engine/sanitize-error-message.ts` 는 신규 정규식을 추가하지 않고 `import { redactSecrets } from '../../shared/utils/sanitize-error-message'` 한 줄만 추가해 기존 strip 체인(`STACK_TRACE_PATTERN`/`CONNECTION_STRING_PATTERN`)에 합성했다.
- `schedule-runner.service.ts` 는 `sanitizeErrorMessage`(execution-engine 로컬 wrapper, 이미 `execution_failed`/`background_failed` 경로가 쓰던 동일 함수)를 import 해 `schedule_failed` 메시지에도 적용 — 3개 실패-알림 경로(execution-failed top-level·background·schedule) 모두 동일 방어선으로 통일됐다.

**"새로 구현 금지" 관점의 금지 패턴(자체 정규식 재정의·값 기반 마스킹 로직 중복)은 diff 어디에도 없다.** 위반 없음.

## 발견사항

- **[INFO]** `spec/data-flow/8-notifications.md` §1 이 `schedule_failed`/`execution_failed` 행의 `message` 필드에 secret 마스킹(`sanitizeErrorMessage`)이 적용된다는 사실을 아직 기술하지 않음
  - target 위치: 실제로는 `spec/data-flow/8-notifications.md` §1(71~72행, `execution_failed`/`schedule_failed` 카탈로그 행) — 프롬프트에 임베드된 target 문서 스냅샷과 무관하게 실제 spec 트리에서 확인
  - 위반 규약: 직접적 규약 위반은 아님(정식 규약 문서가 "data-flow 카탈로그 행에 마스킹 여부를 명시하라"고 강제하지 않음) — `spec/data-flow/0-overview.md §3.3` Schema 매핑 표 관례가 "실제 write 되는 컬럼/값" 을 기술하도록 권장하는 정신에는 살짝 못 미침
  - 상세: 코드는 `execution_failed`(이미 이전부터) / `schedule_failed`(이번 diff) 양쪽 모두 `message` 를 `sanitizeErrorMessage` 로 감싸지만, data-flow 카탈로그 표에는 이 방어 단계가 드러나지 않는다. 이번 diff 로 인한 신규 갭이 아니라 기존에도 있던 문서화 공백이 schedule_failed 로 확장된 것뿐이다.
  - 제안: 블로킹 사유 아님. 필요 시 project-planner 가 후속 spec-sync 턴에서 8-notifications.md §1 두 행에 "message 는 `sanitizeErrorMessage`(shared SoT `redactSecrets` 재사용)로 secret 마스킹 후 노출" 한 문구를 추가하는 정도로 충분. 이번 codebase-only PR 의 범위 확장을 요구할 사안은 아니다.

- **[INFO]** "secret 마스킹은 공용 SoT 재사용" 원칙이 canonical `spec/conventions/*.md` 로 승격되지 않음
  - target 위치: 해당 원칙은 `spec/5-system/14-external-interaction-api.md §R17`, `spec/5-system/11-mcp-client.md §8.3`, `spec/2-navigation/4-integration.md` 3곳에 각각 산발적으로 서술돼 있고, `spec/conventions/secret-store.md` 는 다른 관심사(SecretRef 저장)라 이 원칙을 담지 않음
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표의 "정식 규약 → `spec/conventions/<name>.md`" 원칙 — cross-cutting 규칙이 conventions 폴더에 canonical 문서 없이 여러 시스템 spec 에 반복 인용되는 상태
  - 상세: 이번 diff 자체는 이 산발적 서술을 정확히 준수했으므로 diff 잘못은 아니다. 다만 규약 자체가 파편화돼 있어 향후 새 모듈(예: 다음에 추가될 알림 타입)이 이 원칙을 발견하지 못하고 재구현할 위험이 구조적으로 존재한다.
  - 제안: (규약 갱신이 적절한 사례) 후속 spec 작업 시 `spec/conventions/secret-redaction.md` 같은 canonical 문서를 신설해 SECRET_LEAK_PATTERNS/redactSecrets/deepRedactSecrets/CREDENTIAL_KEY_PATTERN 의 단일 서술을 두고, EIA §R17·mcp-client §8.3·integration.md·(이번 diff 대상인) execution-engine/schedule-runner 사용처를 그 문서로 역참조하도록 정리하면 향후 파편화를 막을 수 있다. 이번 PR 의 blocking 사유는 아니다.

## 요약

이번 diff(`execution-engine/sanitize-error-message.ts` + `schedules/schedule-runner.service.ts`)는 spec/conventions 를 새로 건드리지 않는 순수 codebase 변경이며, "에러 메시지 secret 마스킹은 `shared/utils/sanitize-error-message.ts` 의 `redactSecrets`/`SECRET_LEAK_PATTERNS` 를 재사용하고 새로 구현하지 않는다"는, 여러 spec 문서(EIA §R17·mcp-client §8.3·integration.md)와 MEMORY.md 에 이미 정립된 원칙을 정확히 준수한다. 신규 정규식·마스킹 로직 재구현 없음, 명명·출력 포맷 모두 형제 알림 경로(`execution_failed`)와 일관되게 확장됐고, `plan/complete/eia-secret-masking-residuals.md` P3-8 이 명시했던 잔여 backlog 를 해소하는 정당한 follow-up 이다. CRITICAL/WARNING 급 규약 위반은 발견되지 않았으며, 위 INFO 2건은 모두 이번 diff 가 유발한 문제가 아니라 기존부터 있던 문서 파편화/완결성 공백에 대한 개선 제안이다.

## 위험도

NONE
