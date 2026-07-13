# 문서화(Documentation) Review

## 리뷰 대상
- `codebase/backend/src/modules/external-interaction/interaction.controller.ts` — `@ApiConflictResponse` 의 `description` 문자열에 "명령의 nodeId 가 실제 대기 노드와 불일치" 사유 한 구절 추가 (swagger 설명 문자열 전용, 로직 변경 없음).

## 검증 내역
- `interaction.service.ts` 상단 doc 주석(§77-98) 및 `interact()` 본문(§112-121) 을 대조: 외부 caller 는 `expectedNodeId(=dto.nodeId)` 를 publisher chokepoint(`resolveWaitingNodeExecutionId` → `assertCommandMatchesWaitingSurface`, 실행 엔진 §7.5.1)에 전달하고, 불일치 시 `InvalidExecutionStateError` → 409 `STATE_MISMATCH` 로 매핑됨을 확인. 추가된 설명 문구는 실제 동작과 정확히 일치한다.
- `dto/interact.dto.ts` 의 `nodeId` 필드 `ApiPropertyOptional.description` ("waiting_for_input 상태인 NodeExecution 의 graph node id 와 일치해야 한다")과도 정합 — 이번 변경으로 "일치해야 한다"는 DTO 문서와 "불일치 시 벌어지는 결과"(409 STATE_MISMATCH)를 다루는 컨트롤러 문서가 서로 보완되어 API 문서의 완결성이 오히려 개선됨.
- 같은 파일의 `interact()` 메서드 인라인 주석(§147: `dto 의 nodeId 와 URL 의 executionId 는 다른 차원이므로 별도 검증 X`)과도 모순되지 않음을 확인 — 이 주석은 "URL 의 executionId 와 dto.nodeId 를 컨트롤러 레벨에서 상호 대조하지 않는다"는 의미로, service/engine 레벨에서 이뤄지는 "dto.nodeId vs 실제 대기 노드 id" 검증(이번에 swagger 설명에 추가된 사유)과는 별개 축이라 상충 없음.

## 발견사항
- **[INFO]** 순수 설명 문자열 보강, 부작용 없음
  - 위치: `interaction.controller.ts:83` (구 라인 83, `@ApiConflictResponse` description)
  - 상세: 코드 동작 변경 없이 swagger 설명만 보강한 케이스. 앞서 검증한 대로 `interaction.service.ts` §7.5.1 nodeId 검증 로직 및 `interact.dto.ts` 의 nodeId 필드 설명과 완전히 정합하며, 오히려 기존에 문서화되지 않았던 STATE_MISMATCH 트리거 조건(nodeId 불일치) 하나를 명시적으로 드러내 API 소비자 관점에서 문서 완결성이 개선됨.
  - 제안: 없음 (변경 자체로 충분). 추가 개선을 원한다면 `interact.dto.ts` 의 nodeId 필드 description 에 "불일치 시 409 STATE_MISMATCH" 같은 상호 참조를 덧붙일 수 있으나 필수는 아님.
- **[INFO]** 구두점 스타일: 세미콜론 혼용
  - 위치: `interaction.controller.ts` 변경된 description 문자열
  - 상세: 기존에는 괄호 안에서 쉼표(`,`) + "또는"으로 절을 나열했으나, 이번 변경으로 세미콜론(`;`) 두 개가 추가되어 한 문자열 안에 쉼표/세미콜론/"또는"이 혼재. 동일 파일의 다른 `@Api*Response` description 들은 세미콜론을 쓰지 않아 스타일이 다소 도드라짐.
  - 제안: 선택적. 가독성상 문제는 없으나, 추후 이 description 을 더 손볼 일이 생기면 구분자를 통일(예: 전부 세미콜론 또는 전부 "/ ")하는 것을 고려.

## 요약
이번 델타는 swagger `@ApiConflictResponse` 설명 문자열에 "명령의 nodeId 가 실제 대기 노드와 불일치"라는 STATE_MISMATCH 트리거 사유 한 구절을 추가한 순수 문서 변경이다. `interaction.service.ts` 의 §7.5.1 nodeId 검증 로직(`assertCommandMatchesWaitingSurface` → `InvalidExecutionStateError` → 409 STATE_MISMATCH)과 `interact.dto.ts` 의 nodeId 필드 설명 모두와 대조 검증한 결과 실제 동작과 완전히 일치하며, 오히려 기존에 암묵적이었던 conflict 사유 하나를 명시화해 API 문서의 완결성을 개선한다. README/CHANGELOG/환경변수 문서 갱신이 필요한 범위(신규 기능·설정)가 아니며, 예제 코드 추가도 불필요한 규모다. 코드 로직·인라인 주석과의 모순도 발견되지 않았다.

## 위험도
NONE
