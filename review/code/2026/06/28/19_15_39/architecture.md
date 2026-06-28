# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `PublicWebhookReqShape extends PublicWebhookReqExtension` 상속 방향의 의미 혼동
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `PublicWebhookReqShape` 인터페이스 신규 추가 부분
  - 상세: `PublicWebhookReqShape`(요청 입력 형태)가 `PublicWebhookReqExtension`(Guard가 사후에 주입하는 확장 필드 `__publicWebhookTrigger`)을 extends 하고 있다. 두 인터페이스의 의미 역할이 다르다 — `ReqExtension`은 Guard가 처리 이후 객체에 추가하는 side-effect 필드이고, `ReqShape`는 Guard가 처리 전에 읽는 입력 형태다. "입력 형태"가 "출력 확장"을 상속하면 레이어 방향이 역전된다. Guard → Request mutation 의 단방향 흐름이 타입 계층에서 역으로 표현된 것이다.
  - 제안: `getRequest` 타입 선언은 `PublicWebhookReqShape & PublicWebhookReqExtension`(intersection)으로 변경하거나, `ReqShape`에서 `ReqExtension`을 extends 하지 않고 별도 타입으로 유지한 뒤 Guard 내부에서만 assertion cast 하는 패턴을 검토한다. 현행은 실용적이고 JSDoc으로 의도가 명시돼 있어 차단급 문제는 아님.

- **[INFO]** `HooksService` 내 IP 추출 로직의 레이어 배치 — 비즈니스 서비스와 인프라 관심사 혼재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` — `extractClientIpFromHeaders(...) ?? undefined` 직접 호출부 2곳
  - 상세: 이번 변경으로 로컬 래퍼 `extractClientIp`가 제거되고 `extractClientIpFromHeaders`가 `HooksService`에서 직접 호출된다. `extractClientIpFromHeaders`는 `auth/utils/client-ip` 모듈에 있으므로 `hooks` 모듈이 `auth` 모듈 유틸에 의존하는 구조다. 이는 이미 기존부터 존재하는 의존 방향이나, 변경 이후 두 호출부 사이의 설명 수준 불균형(첫 번째는 4줄+plan 링크, 두 번째는 단 한 줄)이 이 의존 관계의 맥락을 불균등하게 전달한다. 아키텍처 관점에서 더 큰 문제는 `handleChatChannelWebhook`(약 410라인)이 IP 추출, 채널 어댑터 선택, command kind 분기, 폼 제출 처리, 캔슬, 이력 기록 등 여러 관심사를 모두 포함하고 있다는 점이다. 이는 SRP 위반이며 이번 PR의 변경 자체가 이를 심화시키지는 않으나 구조적 부채가 여전히 존재한다.
  - 제안: 단기적으로는 두 번째 호출부 주석을 첫 번째와 대칭으로 보강(plan 링크 포함)한다. 중장기적으로는 command kind별 private 핸들러 분리 및 IP 추출 단계를 메서드 상단의 명시적 "컨텍스트 수집" 단계로 그룹화한다.

- **[INFO]** `GlobalExceptionFilter`의 `private static readonly` 상수 패턴 — 적절한 추상화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` — `UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE` 추가
  - 상세: 매직 문자열 2종을 named 상수로 추출한 것은 OCP(수정 없이 동작 이해 가능)와 DRY 관점에서 올바른 방향이다. 두 상수가 의도적으로 다름을 JSDoc으로 명시한 점도 적절하다. 다만 `UNKNOWN`/`UNHANDLED` 이름의 유사성은 이름 수준에서의 추상화가 충분히 차별화되지 않았음을 뜻한다(`NON_ERROR_THROW_MESSAGE` vs `UNHANDLED_EXCEPTION_MESSAGE`가 더 명확할 수 있다). 현행은 허용 범위.
  - 제안: 이름 개선은 별도 리팩터링에서 검토. 현행 JSDoc 보완으로 충분.

- **[INFO]** `extractClientIpFromHeaders` 반환형 `string|null` vs 호출부 `string|undefined` 불일치 — 인터페이스 분리(ISP) 관점
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `?? undefined` 패턴 4회 반복
  - 상세: 유틸 함수 시그니처(`string|null`)와 소비자가 기대하는 타입(`string|undefined`)의 불일치가 모든 호출부에서 `?? undefined` 변환을 강제한다. 유틸 공개 인터페이스가 소비자의 계약을 완전히 충족하지 못하는 형태로, ISP 측면에서 유틸이 자신의 소비자에게 불필요한 변환 부담을 준다.
  - 제안: `extractClientIpFromHeaders` 반환형을 `string|undefined`로 변경하거나, 변환이 필요한 경우라면 공유 래퍼를 `auth/utils/client-ip`에 두어 단일 지점에서 처리한다.

- **[INFO]** `getActiveExecutionStatus`의 private 필드 브래킷 접근 — 의존성 역전(DIP) 위반
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L1606 (기존 코드, 이번 변경 직접 대상 아님)
  - 상세: `this.executionsService['executionRepository']` 패턴은 `HooksService`가 `ExecutionsService`의 내부 구현 세부사항(private 필드명)에 의존하는 구조다. 이는 DIP 위반 — 상위 모듈이 하위 모듈의 구현에 의존한다. 이번 PR에서 직접 변경된 코드는 아니나, 해당 서비스 파일이 리뷰 대상에 포함돼 있어 아키텍처 관점에서 확인이 필요하다.
  - 제안: `ExecutionsService`에 `getExecutionStatusById(id)` 같은 공개 메서드를 추가하고 `HooksService`가 해당 인터페이스에만 의존하도록 변경한다. 이는 별도 리팩터링 태스크로 관리한다.

## 요약

이번 변경셋은 아키텍처 관점에서 순수한 코드 정리에 해당한다. 래퍼 함수 제거(A-1), 인라인 익명 타입의 named interface 추출(A-3), 상수화(A-2)는 모두 단일 진실(DRY)과 모듈 경계 명확화 방향이며 새로운 아키텍처 부채를 도입하지 않는다. 주목할 지점은 `PublicWebhookReqShape extends PublicWebhookReqExtension` 상속 방향의 의미 역전, `extractClientIpFromHeaders` 반환형 불일치로 인한 ISP 마찰, `HooksService.handleChatChannelWebhook`의 기존 SRP 위반(약 410라인, 순환 복잡도 과도)이나 이들 모두 이번 변경이 신규 도입한 문제가 아니라 기존 구조적 부채다. 변경 동작 보존이 확인됐고 신규 아키텍처 위험 요소 없음.

## 위험도

NONE
