# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위

리뷰 대상 13개 파일 중 실제 소스 코드는 `codebase/backend/src/modules/executions/executions.service.ts` 1개뿐이다. 나머지 12개(`plan/**`, `review/consistency/**`)는 작업 추적 문서·자동 생성 리뷰 산출물(JSON/Markdown)로, 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도 같은 코드 유지보수성 관점이 적용되지 않는다(프로세스 문서일 뿐 실행 코드가 아님). 아래 발견사항은 전부 `executions.service.ts`에 대한 것이다.

이 diff 는 `ExecutionsService.reRun`(141줄·6책임으로 문서화된 기존 구조) 안의 40줄짜리 "입력 해석" 블록(스키마 로드 → 마커 거부 resolve → 검증 실패 응답 매핑)을 `resolveManualOverrideInput` private 헬퍼로 뽑아내는 **순수 extract-method 리팩터**다. `reRun` 본문은 109줄로 실측 축소된다(`awk` 로 직접 카운트해 확인).

## 발견사항

- **[INFO]** 에러 매핑 catch 블록이 `workflows.controller.ts` 와 여전히 중복이다(이 diff 로 생긴 것이 아니라 선존 상태 — 추출 전에도 같은 코드가 `reRun` 안에 있었고 위치만 옮겨졌다)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:565` (`resolveManualOverrideInput` 의 `catch (err) { if (err instanceof TriggerParameterValidationException) { throw new BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ... details: toTriggerParameterErrorDetails(err.errors) }) } }` 블록, gate 565~578)와 `codebase/backend/src/modules/workflows/workflows.controller.ts:319`(`grep` 로 확인 — 거의 동일한 `if (err instanceof TriggerParameterValidationException)` → `BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ..., details: toTriggerParameterErrorDetails(err.errors) })` 블록)
  - 상세: 두 자리 다 "자매 호출부와 같은 코드다 — 셋 다 같아야 한다"는 취지의 주석으로 의도적 동기화임을 명시하고 있어 우발적 중복은 아니다. 다만 코드 자체는 여전히 손으로 복제된 상태라, 향후 셋(또는 둘) 중 한 곳만 고치는 drift 재발 위험은 남아 있다 — 이 파일의 다른 곳(`toResponseExecution` JSDoc 등)이 반복적으로 지적하는 "자매 표면 하나만 고치는 결함 클래스"와 같은 패턴이다.
  - 제안: 이번 PR 범위는 아니지만, 다음에 이 에러 매핑을 손댈 일이 생기면 `TriggerParameterValidationException → BadRequestException({code, message, details})` 매핑을 공유 헬퍼(예: `toTriggerParameterBadRequest(err)`)로 뽑아 두 파일이 그 헬퍼를 호출하는 형태로 정리하면 drift 재발 표면을 줄일 수 있다.

- **[INFO]** `resolveManualOverrideInput` 은 이름이 "입력 override 해석"만 암시하지만 실제로는 `__triggerSource: 'manual'` 봉투 조립까지 책임진다(문서화됨)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:582` (`return { __triggerSource: 'manual' as const, parameters };`)
  - 상세: JSDoc(`resolveManualOverrideInput` 위 블록, gate 530~545)이 "왜 봉투까지 여기서 만드는가"를 명시적으로 설명하고 있어 의도는 분명하다. 다만 함수 시그니처만 보면 반환값이 "override 파라미터"인지 "실행 입력 전체(트리거 소스 봉투 포함)"인지 이름만으로는 드러나지 않는다.
  - 제안: 강제 사항은 아님. 필요하면 `buildManualOverrideExecutionInput` 처럼 반환 shape 을 더 암시하는 이름으로 바꿀 수 있으나, JSDoc 이 이미 충분히 설명하므로 우선순위 낮음.

## 요약

이번 diff 는 잘 실행된 extract-method 리팩터다. `reRun` 의 가장 크고(40줄) 가장 얽힌(로드·검증·에러매핑 3층) 블록을 단일 책임의 `resolveManualOverrideInput` private 메서드로 분리했고, `useOriginal` 판정을 호출부에 남긴 이유·`__triggerSource` 봉투를 헬퍼가 만드는 이유를 JSDoc 으로 명시해 이 저장소가 반복적으로 겪은 "동일 로직 두 곳에 존재 → 한쪽만 갱신되는 drift" 결함 클래스를 스스로 경계하고 있다. 네이밍·문서화 스타일(장문 rationale JSDoc, `##` 소제목, `{@link}` 상호참조)은 파일 전반의 기존 컨벤션과 일관되고, ternary 안에 `await` 를 쓰는 패턴도 코드베이스 전역에서 흔한 관용구라 이질적이지 않다. 새 매직넘버·과도한 중첩·순환복잡도 증가는 없다. 유일하게 짚을 만한 점은 에러 매핑 블록이 `workflows.controller.ts` 와 여전히 손으로 중복돼 있다는 것인데, 이는 이 diff 가 만든 것이 아니라 추출 이전부터 있던 상태이고 주석으로 의도가 명시돼 있어 차단 사유가 아니다. 나머지 리뷰 대상(`plan/**`, `review/consistency/**`)은 프로세스 문서로 코드 유지보수성 관점 밖이다.

## 위험도

NONE
