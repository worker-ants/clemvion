# 정식 규약 준수 검토 — `spec/5-system/` (eia-error-code-unify, impl-done)

## 검토 방법

`origin/main...HEAD` diff 범위(`spec/5-system/3-error-handling.md` · `13-replay-rerun.md` ·
`12-webhook.md` · `14-external-interaction-api.md` · `spec/4-nodes/7-trigger/1-manual-trigger.md`
· `spec/conventions/error-codes.md`)를 HEAD 워킹트리에서 직접 대조했다(프롬프트 번들에서
`14-external-interaction-api.md` 등 16개 파일이 예산 초과로 절단돼 있어, 해당 부분은 절대경로
`Read`/`grep -n`으로 재확인). `spec/conventions/error-codes.md`(전문) · `swagger.md` ·
`node-output.md §3.2`를 대조 규약으로 사용했고, 실제 발행 코드(`executions.service.ts` ·
`executions.controller.ts` · `workflows.controller.ts` · `toTriggerParameterErrorDetails` ·
`reject-masked-resubmission.ts` · `masked-reject-callers-guard.ts`)를 grep 으로 재확인했다.

## 발견사항

- **[WARNING]** `error-codes.md §5` 신규 행이 §2/§5 의 **선언된 진입 기준 문구**를 스스로 못 미친다고
  인정하면서도, 그 기준 문구(§2 rename 정책·§5 Rationale "client 분기 미존재") 자체는 갱신하지 않았다
  - target 위치: `spec/conventions/error-codes.md` §5 표의 `INVALID_INPUT → INVALID_TRIGGER_PARAMETERS`
    행(PR 컬럼 `#TBD_PR`), 그리고 그 위 §5 서문·`## Rationale` 의 "§5 진입 기준이 client 코드 분기
    미존재인 이유" 항목(파일 전체 기준 약 158줄 부근, 이번 diff 는 이 Rationale 텍스트를 건드리지
    않았다)
  - 위반 규약: `spec/conventions/error-codes.md §2`("이름 정확성 향상만을 위한 rename 은 하지
    않는다") · §5 서문("소비자가 **자사 클라이언트뿐**이라 breaking 영향이 **없음을 확인**한 뒤
    교체했다") · Rationale("client 코드에 하드코딩 분기가 있었다면 §2 의 breaking 정책이 적용돼
    §5 흡수가 아니라 신설(§3·§4) 또는 정식 마이그레이션을 거친다")
  - 상세: 신규 행 자신의 비고가 명시적으로 "위 세 행은 breaking 영향이 **없음을 확인**한 사례인
    반면, 이 행은 **워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트**라 저장소 밖 서드파티가
    이 값으로 분기했을 가능성을 **코드로 배제할 수 없다**"고 적는다. 즉 이 행은 §5 Rationale 이
    규정한 흡수 조건("외부 client 코드에 그 구 코드로 분기하는 지점이 있었는가 — 없어야 §5, 있으면
    §2 가 적용돼 §5 흡수 불가")을 **원문 그대로 적용하면 §5 에 들어갈 자격이 없다.** CHANGELOG 도
    "이것은 `spec/conventions/error-codes.md §2` 의 **명시적 예외**다" 라고 스스로 못박는다.
    투명하게 서술된 것은 좋으나, "예외" 라고 선언하는 것과 그 예외를 규약 텍스트에 반영하는 것은
    다르다 — 지금 상태에서는 §2/§5 의 선언 문구만 읽는 독자(신규 행의 비고를 안 보는 독자)는 여전히
    "client 분기 미확인이면 §5 흡수 불가" 로만 이해하게 되고, 다음에 유사 사례(내부 인증 REST 지만
    저장소 밖 노출 가능)가 왔을 때 "확인" 과 "관측 범위 내 미발견" 을 같은 것으로 오인해 §5 에
    안이하게 얹을 위험이 남는다. 신규 행이 "이후 이 표를 공개 API 든 rename 안전으로 일반화하지 말
    것" 이라고 각주로 경고해 어느 정도 완화하지만, 그 경고 자체가 §5 Rationale 본문이 아니라 한
    행의 비고에만 있어 발견 가능성이 낮다.
  - 제안: `spec/conventions/error-codes.md`의 §2 또는 §5 서문/Rationale 에 "내부 인증 REST
    엔드포인트(저장소 밖 서드파티가 유효 자격증명으로 호출 가능)의 경우, '분기 지점 없음 확인'
    대신 '관측 가능 범위(자사 프론트·저장소 내 grep) 내 미발견 + 잔여 위험 명시 인수(사용자 결정)'
    를 완화된 §5 흡수 조건으로 허용한다" 는 취지의 문장을 **명시적으로 추가**해, 이번 사례가 §5
    본문 기준에서도 정합하도록 규약 자체를 갱신할 것. (규약 텍스트 갱신이 목적에 맞고, target 행
    자체의 서술을 되돌릴 필요는 없다 — 오히려 그 서술이 갱신할 문구의 좋은 초안이다.)

- **[INFO]** `error-codes.md §5` 신규 행의 `PR` 컬럼이 placeholder `#TBD_PR`
  - target 위치: `spec/conventions/error-codes.md` §5 표, `INVALID_INPUT → INVALID_TRIGGER_PARAMETERS`
    행의 4번째 컬럼
  - 위반 규약: 명시적 규약 조항은 없음(표 스키마 자체가 정식 규약으로 못박혀 있지 않음) — 다만
    같은 표의 기존 3행은 전부 실제 참조값(`PR4b`·`#566`)을 쓰는데 이 행만 미확정 placeholder라
    형식 일관성이 깨진다
  - 상세: 이번 세션의 `naming_collision.md` 리포트가 동일 항목을 이미 INFO 로 지적했다(중복 확인,
    새 사실 아님) — 식별자 충돌은 아니고 이력 추적 완결성 문제
  - 제안: 이 브랜치가 실제 PR 번호를 받는 시점에 `#TBD_PR` 을 그 번호로 치환

## 검증 완료 항목 (규약 준수 관점에서 문제 없음)

- **명명 규약**: `INVALID_TRIGGER_PARAMETERS` 는 `UPPER_SNAKE_CASE`(`node-output.md §3.2`·
  `error-codes.md §1` 표기 규약) 준수. prefix 없음은 §1 이 명시한 "시스템 전역 공용 코드" 범주와
  같은 성격(3경로 공유 검증 실패)이라 도메인 prefix 원칙(§1 "권장")의 예외 대상이 아니다.
- **API 문서(Swagger) 규약**: `executions.controller.ts:274` 의 `@ApiBadRequestResponse({
  description: 'INVALID_TRIGGER_PARAMETERS / RERUN_DRY_RUN_NOT_APPLICABLE' })` 가 실제 발행
  코드와 일치하도록 갱신되어 있다(`swagger.md §2-4` 데코레이터 패턴 위반 없음).
  `workflows.controller.ts`(주 실행 경로)는 코드값이 이번에 바뀌지 않았으므로 Swagger 문구도
  그대로가 맞다 — 갱신 누락 아님.
- **문서 구조 규약**: 5개 spec 파일 모두 기존 `Overview / 본문 / Rationale` 3섹션 구조를 유지한
  채 절 내부에 표 행·블록쿼트만 추가했다. 신규 블록쿼트(`3-error-handling.md` "Re-run 경로는
  2026-08-22 에 옮겨 왔다" 등)는 같은 문서에 기존하는 "역사적 각주" 관행(§1.2.1 등)과 동형이라
  구조 이질감이 없다.
- **`error-codes.md §4` 재구성**: 이전 라운드(16:34:50) checker 가 지적한 "§4 표에 trigger-parameter
  코드를 단순 append 하면 표 자신의 scope 선언('Code 노드 핸들러 내부'·'노드 `output.error.code`')
  과 충돌한다"는 WARNING 이 이번 편집에서 §4.1(Code 노드)/§4.2(Trigger 파라미터) 분리로 정확히
  해소됐다. 최상위 `## 4.` 앵커가 보존돼 기존 3개 참조(`2-code.md`·`3-error-handling.md`·
  `chat-channel-adapter.md`)도 깨지지 않는다 — 실측 확인.
- **코드-스펙 정합**: `toTriggerParameterErrorDetails`(`trigger-parameter.types.ts:74`) ·
  `INVALID_TRIGGER_PARAMETERS`(`executions.service.ts:510`, `workflows.controller.ts:324`) ·
  `resolveTriggerParametersRejectingMasked`/`reject-masked-resubmission.ts` ·
  `masked-reject-callers-guard.ts` 모두 spec 이 인용한 그대로 실재한다.
- **잔존 `INVALID_INPUT` 문자열**: `13-replay-rerun.md:252`·`3-error-handling.md:91,93`·
  `error-codes.md:145`·`executions.service.ts` 주석 — 전부 "2026-08-22 이전엔 여기가
  `INVALID_INPUT` 이었다"는 rename 이력 서술이며 발행 코드가 아님. 활성 코드 경로·문서(spec 5곳,
  코드 2곳, mdx 2곳)는 전수 `INVALID_TRIGGER_PARAMETERS` 로 동기화됨.

## 요약

이번 변경(Manual 3경로 `error.code` 통일)은 `UPPER_SNAKE_CASE` 표기·Swagger 데코레이터·문서
3섹션 구조 등 형식적 규약은 전수 준수하며, 이전 라운드가 지적한 `error-codes.md §4` 표 scope
충돌 위험도 §4.1/§4.2 분리로 정확히 해소했다. 유일하게 남는 실질적 문제는 `error-codes.md §5`
신규 행이 그 절 자신의 선언된 흡수 조건("client 분기 없음을 확인")을 스스로 충족하지 못한다고
명시하면서도(정직한 처리) 그 조건을 규정하는 §2/§5 Rationale **텍스트 자체는 갱신하지 않은
채** 남겨둔 점이다 — CLAUDE.md 가 명시한 "의도된 규약 이탈이면 규약 자체를 갱신해야 한다"는
기준에 정확히 해당하는 WARNING 이다. `#TBD_PR` placeholder 는 이력 완결성 관점의 INFO 로,
이미 이번 세션의 `naming_collision.md` 가 동일 지적을 했다.

## 위험도

LOW
