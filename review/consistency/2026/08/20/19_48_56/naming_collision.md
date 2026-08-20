STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec-draft-inputoverride-marker-reject.md`

## 검토 방법
target 이 새로 도입/확장하는 식별자(에러 `reason`/`code`, 표 행, spec 참조 등)를 실제 코드베이스(`codebase/backend/src`)와 관련 spec 3곳(`14-external-interaction-api.md` §R17, `3-error-handling.md` §1.3/§1.7, `13-replay-rerun.md` §8.1/§10.2, `4-nodes/7-trigger/1-manual-trigger.md`)에서 grep/직접 대조했다.

## 발견사항

- **[INFO]** 새 공개 에러 코드 `MASKED_VALUE_RESUBMITTED` 와 기존 내부 상수 `VALUE_MASK_MARKER` 의 어근 중복
  - target 신규 식별자: `MASKED_VALUE_RESUBMITTED` (`trigger-parameter.types.ts` 의 `reason: 'masked_marker'` → 공개 `code`)
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:115` `export const VALUE_MASK_MARKER = '***'` (값-마스킹이 남기는 리터럴 마커 자체를 가리키는 상수명)
  - 상세: 두 식별자 모두 "마스킹된 값"을 어근으로 공유하지만 계층이 다르다 — `VALUE_MASK_MARKER` 는 마스킹 **결과 리터럴**(`'***'`)을 가리키는 내부 상수이고, `MASKED_VALUE_RESUBMITTED` 는 그 마커가 **재제출됐다는 사실**을 나타내는 공개 wire 에러 코드다. 실제 충돌(동일 이름이 다른 의미로 쓰이는 경우)은 아니며, 코드 검색 시 "MASKED" 로 grep 하면 두 항목이 함께 걸려 혼동될 여지가 있는 정도다.
  - 제안: 조치 불요. spec 본문에 두 식별자를 나란히 언급할 일이 생기면 "마커 상수 `VALUE_MASK_MARKER` 자체가 아니라 그 재제출 사실을 나타내는 코드" 라는 한 줄 구분을 덧붙이면 충분하다.

## 검증 완료 — 충돌 없음 확인 항목

1. **요구사항 ID** — target 은 신규 `R-XX` ID 를 만들지 않고 기존 `§R17`(`14-external-interaction-api.md:1392`)의 잔여② 절을 확장한다. `R17` 은 이미 해당 문서의 유일한 정의이고 target 이 추가하는 "서버측" 행은 기존 표(폼 프리필/Re-run 모달/에디터 히스토리 로드, `14-external-interaction-api.md:1565-1575`)의 신규 행이지 ID 충돌이 아니다.
2. **에러 `reason`/`code`** — `grep -rn "MASKED_VALUE_RESUBMITTED\|masked_marker"` 결과 target 문서 밖에는 등장하지 않는다(신규). `trigger-parameter.types.ts` 의 기존 `reason` 세 값(`missing_required`/`coerce_failed`/`invalid_schema`) 및 대응 `code`(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)와 겹치지 않는다.
3. **`INVALID_INPUT` 재사용** — target 은 이 코드를 새로 만들지 않고 기존 의미(`Manual re-run` `inputOverride` 가 trigger parameter 스키마와 충돌, `13-replay-rerun.md:246`, `spec/4-nodes/7-trigger/1-manual-trigger.md:180`, `executions.service.ts:497`)를 그대로 재사용한다 — `masked_marker` 도 `TriggerParameterValidationException` 이 던지는 같은 예외 계열의 한 case 이므로 의미 이탈이 없다. §1.3 에 현재 `INVALID_INPUT` 행이 없음도 확인했다 — "(선택) 5." 로 추가해도 기존 다른 의미의 행과 충돌하지 않는다.
4. **API endpoint** — target 은 새 endpoint 를 만들지 않는다. 기존 5개 `resolveTriggerParameters` 호출부(re-run/execute/webhook/schedule×2) 중 두 곳의 **거부 로직**만 확장한다.
5. **환경변수·설정키** — `MAX_REDACT_DEPTH`(`sanitize-error-message.ts:112`, 값 10)는 이미 존재하는 상수를 target 이 "같은 값으로 맞춘다" 고 참조할 뿐 새 키를 도입하지 않는다.
6. **파일 경로** — target 자체(`plan/in-progress/spec-draft-inputoverride-marker-reject.md`)는 `spec-draft-*` 명명 컨벤션을 따르고 동일 경로의 기존 파일과 겹치지 않는다(`ls plan/in-progress/` 확인). spec 변경 대상 4(+1)곳도 전부 기존 문서의 기존 섹션(§R17/§1.7/§8.1/§10.2/§1.3) 편집이며 신규 파일 생성이 없다.
7. **§1.7 details[] 카탈로그 확장** — 기존 블록쿼트(`3-error-handling.md:203`)가 이미 execute(`POST /:id/execute`)·save(`POST /:id/save`)·webhook(`INVALID_WEBHOOK_PAYLOAD`) 를 열거하고 있어 target 이 "re-run(`INVALID_INPUT`)이 빠져 있다" 고 서술한 것은 실측과 일치한다 — re-run 추가가 새 항목을 다른 의미로 덮어쓰는 것이 아니라 누락된 소비처를 채우는 것임을 확인했다.

## 요약
target 이 새로 도입하는 식별자는 사실상 하나(`reason: 'masked_marker'` → `code: 'MASKED_VALUE_RESUBMITTED'`)이고, 이는 코드베이스·spec 전역에 기존 사용례가 없어 CRITICAL/WARNING 급 충돌이 없다. 나머지는 전부 기존 식별자(`INVALID_INPUT`, `MAX_REDACT_DEPTH`, `§R17`)의 **의도된 재사용/확장**이며 실제 값·의미 대조 결과 기존 정의와 일치한다. 새 endpoint·새 spec 파일·새 이벤트명도 없다. 유일한 지적은 어근이 겹치는 기존 상수(`VALUE_MASK_MARKER`)와의 표층적 유사성으로, 계층이 명확히 달라 INFO 수준에 그친다.

## 위험도
NONE
