# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 메모

`_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`
(원 123,012자) 를 포함해 spec/5-system 15개 파일 전문과 `spec/conventions/error-codes.md` ·
`node-output.md` · `swagger.md` · `execution-context.md` · `spec-impl-evidence.md` 등 대부분의
conventions 파일 본문을 **절단**했다. 실제 target 은 저장소 파일을 직접 `Read`/`git diff` 로
열어 판정했다 — 이 브랜치(`eia-inputoverride-reject-a3f1c9`)의 diff 는 아래 7개 spec 파일에
걸친 docs-only 변경이다 (`inputOverride` 재제출 경로 서버측 마커 리터럴 거부 — `MASKED_VALUE_RESUBMITTED`
신설):

- `spec/5-system/14-external-interaction-api.md` (§R17 — SoT)
- `spec/5-system/3-error-handling.md`
- `spec/5-system/13-replay-rerun.md`
- `spec/5-system/12-webhook.md`
- `spec/4-nodes/7-trigger/1-manual-trigger.md`
- `spec/1-data-model.md`
- `spec/3-workflow-editor/3-execution.md`

## 발견사항

- **[WARNING] `status: implemented` 5개 문서에 미구현 서버측 약속이 `pending_plans` 없이 얹혔다**
  - target 위치: `spec/5-system/3-error-handling.md` §1.3·§1.7 / `spec/5-system/13-replay-rerun.md` §8.1·§10.2
    / `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 / `spec/1-data-model.md` `input_data` 행 /
    `spec/3-workflow-editor/3-execution.md` 히스토리 로드 행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (`status` 라이프사이클) · §2.1(`pending_plans` 의무) ·
    Rationale R-5 (역방향 `pending_plans` 링크 — "어떤 plan 도 책임지지 않는 빈 약속" 방지)
  - 상세: 다섯 문서 모두 frontmatter `status: implemented` (본 PR 에서 미변경) 이며 `pending_plans:` 가
    없다. 그런데 이번 diff 로 얹힌 `MASKED_VALUE_RESUBMITTED` 서버측 거부는 실제로 **아직 코드에 없다** —
    `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 의
    `code: 'MISSING_REQUIRED_FIELD' | 'TYPE_COERCION_FAILED' | 'INVALID_SCHEMA'` 유니온에 새 값이
    없고, `toTriggerParameterErrorDetails` 매핑에도 없다(grep 로 직접 확인). 반면 같은 기능의 SoT 인
    `spec/5-system/14-external-interaction-api.md` 는 `status: partial` + `pending_plans:
    plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 정확히 이 미구현 갭을 신호하고 있고,
    그 tracker 문서 자체도 "이 체크박스는 구현이 머지될 때 닫는다 — spec 명문화만으로 닫으면
    '가드가 있다' 로 오독된다" 고 명시해 저자가 gap 을 충분히 인지하고 있음을 보여준다. 문제는
    이 인지가 **tracker/planner 관점에만** 있고, 다섯 위성 문서의 machine-readable frontmatter
    (build-time 가드 `spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts` 가 읽는 계약) 에는
    반영되지 않았다는 점이다. `spec-impl-evidence.md` R-1 은 "글로브가 파일에 매치하기만 하면
    가드는 통과한다(내용 수준 갭은 `/spec-coverage` 몫)" 이라 이 상태로도 기계적 build 가드는
    깨지지 않겠지만, R-5 가 텔레그램 chat-channel 사례로 경고한 실패 형태 — *"구현 부재가 어떤
    frontmatter 신호도 없이 'implemented' 로 남는다"* — 와 형태가 같다. 다만 완화 요인: CLAUDE.md
    워크플로상 `developer` 가 이 `--impl-prep` 체크 직후 같은 worktree 에서 구현을 이어가는 것이
    표준 절차이므로, PR 이 닫히는 시점에는 다섯 문서 모두 실제로 `implemented` 상태가 될 가능성이
    높다 — 그래서 CRITICAL 이 아니라 WARNING 이다.
  - 제안: (a) 다섯 문서에 임시로 `pending_plans:
    plan/in-progress/spec-draft-inputoverride-marker-reject.md` (또는 tracker 파일) 를 추가하고
    `status: partial` 로 격하했다가 구현 커�밋에서 되돌리거나, (b) 이 PR 이 spec-draft 전용이고
    바로 이어 구현 PR 이 온다는 것이 확실하면 규약 문서 자체에 "같은 worktree 세션 내 spec→impl
    연속 커밋" 예외를 짧게 명문화해 다음 검토자가 매번 이 gap 을 재지적하지 않도록 한다.
    둘 중 어느 쪽도 안 하면 이 다섯 문서만 단독으로 열람하는 사람은 `MASKED_VALUE_RESUBMITTED`
    가 이미 동작 중이라고 오독한다(`14-external-interaction-api.md` 를 함께 열지 않는 한).

- **[INFO] 신설 행의 표 스타일이 형제 행과 살짝 다르다**
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러 코드 표, `masked_value_resubmitted` 행
  - 위반 규약: 없음(강제 규약 아님) — 문서 내부 일관성 관찰
  - 상세: 같은 표의 다른 행("시점" 열)은 `handler.validate (저장 시점)` / `adapter
    resolveTriggerParameters` 처럼 평문인데, 신설 행만 `adapter \`resolveTriggerParameters\`
    **직후** (Manual 실행경로·Manual re-run **한정** — ...)` 로 볼드가 두 군데 섞여 있다. 의미
    전달에는 문제 없으나(오히려 "resolveTriggerParameters 안이 아니라 그 직후" 라는 설계상 중요한
    차이를 강조하려는 의도로 보임 — §R17 Rationale "공유 함수 안에 넣지 않는다" 와 정합), 표
    셀 안 볼드 사용 밀도가 형제 행과 다르다.
  - 제안: 의도된 강조라면 유지해도 무방(오독 방지 가치가 더 크다). 순수 스타일 일관성만
    문제라면 "직후" 만 이탤릭으로 낮추는 정도로 형제 행과 시각적 밀도를 맞출 수 있다. 강제 사항 아님.

## 명명·출력 포맷·문서 구조·API 문서 규약 검증 결과 (위반 없음)

- **명명 규약** (`spec/conventions/error-codes.md`): `MASKED_VALUE_RESUBMITTED` 는 `UPPER_SNAKE_CASE`,
  조건의 의미를 그대로 기술("마스킹된 값이 재제출됨")하며 구현 세부를 이름에 박지 않는다(§1 준수).
  형제 `details[].code` 군(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)과
  동일하게 prefix 없는 필드-레벨 코드로, §1 의 "시스템 전역 공용 코드는 prefix 없이" 예외 범주와
  일치한다. 내부 분류 문자열 `masked_value_resubmitted` 도 형제(`missing_required`/`coerce_failed`/
  `invalid_schema`)와 동일한 lower_snake_case. 기존 코드 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS`
  를 rename 하지 않고 `details[].code` 로 의미를 분기시킨 것은 §2 rename-stability 정책과 정확히
  합치한다(신규 조건 = 새 코드 신설, 기존 안정 코드는 유지).
- **출력 포맷 규약** (`spec/5-system/2-api-convention.md` §5.3): 신설 코드는 기존 `{ error: { code,
  message, requestId, details: [{ field, message, code }] } }` 봉투 구조를 그대로 따르며 새 필드를
  추가하지 않는다. HTTP 400 선택도 형제 코드들과 일관.
- **문서 구조 규약**: 이번 diff 의 모든 추가는 각 문서의 `## Rationale` 앞 본문(또는 `14-external-interaction-api.md`
  는 Rationale 내부의 R17 카탈로그 — 그 문서 고유의 정착된 구조)에 위치해 Overview/본문/Rationale
  섹션 배치를 흩트리지 않는다. `0-` prefix·`_product-overview.md` 명명 대상 파일은 이번 diff 에
  없다.
- **API 문서 규약** (`spec/conventions/swagger.md`): 이번 PR 은 DTO/컨트롤러 코드를 건드리지 않는
  docs-only 변경이라 데코레이터 위반 표면 자체가 없다. 문서가 예고하는 신규 `details[].code`
  값은 기존 `trigger-parameter.types.ts` 유니온 확장으로 흡수될 성질이라(swagger DTO 응답
  literal 이 아니라 backend-internal validation reason), `*.literal.ts` 형제-enum 분리 규칙(§5-1)
  대상도 아니다.
- **금지 항목**: `additionalProperties` 남용, config spread echo, 원문 메시지 echo(CWE-209) 등
  conventions 가 명시 금지하는 패턴은 이번 diff 어디에도 재현되지 않는다.

## 요약

이번 변경은 `MASKED_VALUE_RESUBMITTED` 신설 에러 코드의 명명·봉투 형식·문서 구조 측면에서
`spec/conventions/error-codes.md` 및 `2-api-convention.md` §5.3 규약을 정확히 따르고 있고, 기존
`INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD` 패밀리와의 정합도 촘촘하다
(4개 파일에서 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`
4종 카탈로그가 일관되게 재인용된다). 다만 `spec-impl-evidence.md` 관점에서, 이 기능의 SoT 문서
(`14-external-interaction-api.md`)만 `status: partial`+`pending_plans` 로 미구현 상태를 정직하게
신호하고, 같은 기능을 서술하는 다섯 위성 문서는 `status: implemented` 로 남아 frontmatter 만으로는
미구현 갭이 드러나지 않는다 — 계획 tracker 수준에서는 충분히 인지·기록돼 있으나(체크박스가
의도적으로 열려 있음), 기계 판독 가능한 spec frontmatter 계약에는 그 인지가 미러되지 않았다.
전체적으로 CRITICAL 급 위반은 없고, 위 WARNING 1건은 이어지는 구현 커밋으로 자연 해소될 가능성이
높은 프로세스성 리스크다.

## 위험도

LOW
