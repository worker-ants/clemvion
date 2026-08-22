# 요구사항(Requirement) 코드 리뷰

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- codebase/ spec/` 로 실질 변경 표면을 먼저 좁혔다:

```
codebase/backend/.../types/trigger-parameter.types.ts       |  9 +
codebase/backend/.../utils/resolve-trigger-parameters.ts    | 27 +++++--
codebase/backend/.../executions/dto/re-run.dto.ts           |  4 +-
codebase/backend/.../workflows/workflows.controller.ts      |  6 +-
spec/4-nodes/7-trigger/1-manual-trigger.md                  |  1 +
```

나머지 (`plan/**`, `review/**`) 는 이번 세션(4라운드째 `/ai-review` + 3라운드 `/consistency-check`)의
프로세스 산출물이며 애플리케이션 동작·spec 본문과 무관하다. 코드 4개 파일은 실행 가능한 라인
변경이 **0줄**이고 전부 JSDoc/인라인 주석/Swagger `description` 문자열만 바뀐다 — 이 사실을 각
파일을 직접 `Read` 하여 재확인했다(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`,
`re-run.dto.ts`, `workflows.controller.ts` 전체, `reject-masked-resubmission.ts`,
`sanitize-error-message.ts`, `codebase/packages/masked-markers/src/index.ts`).

## 발견사항

- **[WARNING]** `re-run.dto.ts` 의 `inputOverride` Swagger description 이 여전히 적용 대상
  규약(`spec/conventions/swagger.md` §3 "DTO `description`은 10~40자 내외")을 크게 벗어나며,
  같은 커밋의 자체 서술("길이 가이드 안(129자)으로 들어가 회피했다")이 실제로는 **다른** 가이드
  숫자(50~150자, `@ApiOperation` 의 `summary`/`description` 쌍에 적용되는 규정)를 잘못 대입한
  결과다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-24` (`inputOverride`
    필드 `@ApiPropertyOptional({ description })`) / 규약: `spec/conventions/swagger.md:256-257`
  - 상세: `swagger.md` §3 은 두 개의 서로 다른 길이 규정을 인접한 두 불릿으로 나열한다 —
    "DTO `description`은 10~40자 내외"(:256, `@ApiProperty(Optional)` 필드 설명 대상)와
    "`summary`는 10~20자 내외, `description`은 50~150자 내외"(:257, 문서 예시(:180-182)로 보아
    `@ApiOperation({ summary, description })` 의 엔드포인트 레벨 설명 대상). `inputOverride`
    는 DTO 필드이므로 적용 규정은 전자(10~40자)다. 직전 `/consistency-check`(`20_05_10`
    convention_compliance)도 정확히 이 10~40자 규정을 인용해 WARNING 을 냈다. 이번 diff(커밋
    `a578366c7`)가 그 WARNING 을 반영해 304→236→**129자**로 줄였지만, 실측(`python3 -c "print(len(...))"`
    로 직접 카운트)상 129자는 10~40자 규정을 여전히 **3배 이상** 초과한다. 커밋 메시지 자신은
    "예외에 기대지 않고 길이 가이드 안으로 들어갔다"고 서술하는데, 이는 (예외 조항이 응답 필드만
    포괄해 이 요청 필드엔 적용되지 않는다는 올바른 판단과는 별개로) **어느 가이드 안에 들어갔는지를
    착각**한 것이다 — 129자는 50~150자(ApiOperation) 규정 안에는 들지만, 실제로 적용되는
    10~40자(DTO 필드) 규정 밖이다. 즉 "코스메틱 followup 이 규약을 지킨다"는 이번 PR 의도가 이
    한 곳에서는 스스로 세운 검증 기준을 충족하지 못한 채 완료 처리됐다.
  - 참고(완화 요인): 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:825-833`)
    에 관련 항목이 이미 등재돼 있고, 그 항목의 핵심 논지("예외 조항이 요청 필드를 문면상
    포괄하지 않는다")는 정확하다. 다만 그 항목도 "129자로 들어갔다"만 적었을 뿐 **어느 가이드
    숫자에 들어간 것인지의 착오**는 포착하지 못했다 — 다음에 이 파일을 열 사람이 "이미 가이드
    준수"로 오독할 위험이 남는다. 기능 동작에는 영향이 없다(Swagger 문서 텍스트만).
  - 제안: 트래커 :825-833 항목에 "10~40자(DTO 필드) 대비로는 여전히 초과"를 한 줄 보태거나,
    description 을 "SoT: EIA §R17" 링크만 남기고 요약을 더 줄여 10~40자에 근접시킨다. 급하지
    않음(문서 텍스트 한정, 실행 계약 불변).

- **[INFO]** 긍정 확인 — 신규/개정 JSDoc·Swagger 서술과 실제 구현·spec 본문의 대조 결과 전부 일치
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123`,
    `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`,
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:170-176`,
    `codebase/packages/masked-markers/src/index.ts:43-57`,
    `spec/4-nodes/7-trigger/1-manual-trigger.md:158-202`,
    `spec/5-system/14-external-interaction-api.md:1568-1617`
  - 상세: 직접 소스를 열어 다음을 line-level 로 검증했다 — (1) base `resolveTriggerParameters`
    본문에는 마스킹 거부 검사가 없고 wrapper `resolveTriggerParametersRejectingMasked`
    (`reject-masked-resubmission.ts`)만 그 검사를 한다는 JSDoc 의 핵심 주장이 실제 코드와
    정확히 일치. (2) `isMaskedMarker` 는 `MASKED_MARKERS.includes(v)` (전체 값 완전 일치)로
    구현돼 있어 "정확히 일치하는 값만 거부, 부분 일치(`a***b`)는 통과" 서술과 부합. (3) CI 가드
    파일(`codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`) 실재 확인.
    (4) `spec/4-nodes/7-trigger/1-manual-trigger.md` §6·Rationale 과 `spec/5-system/14-external-interaction-api.md`
    §R17(1568~1617행) 이 새 JSDoc/Swagger 서술과 문구 수준까지 일치 — wrapper/base 분리 이유
    (Webhook·Schedule 공유), CI 가드 경로, "정확 일치만 감지" 경계 모두 동일. 지어낸 참조나 오래된
    주장 없음.
  - 제안: 조치 불요 (긍정 기록).

- **[INFO]** 기능 완전성 / 반환값 / 엣지 케이스 / TODO·FIXME — 해당 없음
  - 상세: 4개 코드 파일의 diff 는 실행 가능한 문(statement)·분기·시그니처·반환 경로를 0줄
    변경한다(`git diff origin/main...HEAD -- codebase/` 전량 확인). `resolveTriggerParameters`
    의 세 반환 경로(`{}` pass-through / `resolved` / `throw`)와 `toTriggerParameterErrorDetails`
    의 매핑은 diff 이전과 바이트 단위로 동일. `TODO`/`FIXME`/`HACK`/`XXX` 주석은 4개 파일
    전체에 0건(`grep` 확인). 따라서 이번 변경 자체에 대해서는 엣지 케이스·에러 시나리오·데이터
    유효성·비즈니스 로직 관점의 신규 결함 표면이 없다.

## 요약

이번 diff 는 `plan/complete/masked-marker-cosmetic-followups.md` 가 선언한 대로 실행 코드
0줄 변경의 순수 문서화(JSDoc·Swagger `description`·인라인 주석) followup이며, 이미 3라운드의
`/ai-review` + 3라운드의 `/consistency-check` 를 거쳤다. 직접 소스와 spec 을 대조한 결과 새로
추가된 서술(base/wrapper 분리 이유, CI 가드 경로, "정확 일치만 감지" 경계, `REASON_TO_DETAIL`
4종 행동 기준)은 전부 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6·Rationale 및
`spec/5-system/14-external-interaction-api.md` §R17 과 line-level 로 일치하고 실제 구현
(`reject-masked-resubmission.ts`, `masked-markers` 패키지)과도 부합한다. 유일한 실질 발견은
`re-run.dto.ts` 의 `inputOverride` Swagger description 이 세 차례 축약(304→236→129자)에도
불구하고 실제 적용 규약(`swagger.md` §3, DTO 필드 10~40자)을 여전히 크게 초과하며, 그 사실이
커밋 자신의 "가이드 안으로 들어갔다"는 서술과 어긋난다는 점이다 — 다른 길이 규정(50~150자,
ApiOperation 용)과 혼동된 것으로 보인다. 문서 텍스트 한정 사안이라 기능·계약에는 영향이 없고
트래커에 관련 항목이 이미 등재돼 있어 위험도는 낮다.

## 위험도
LOW
