# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `extractClientIpFromHeaders` 반환형 변경이 소비처 전체에 반영됐는지 확인 필요
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` — `extractClientIpFromHeaders` 반환형 `string | null` → `string | undefined`
- 상세: `hooks.service.ts` 의 `?? undefined` 제거는 반환형 변경의 직접 결과이며 적절하다. 그러나 이 함수가 다른 소비처에도 사용될 경우 `null` 과 `undefined` 구분이 필요한 곳이 있을 수 있다. 본 PR 에서 변경된 파일만으로는 모든 소비처가 함께 갱신됐는지 알 수 없다. diff 내에서 확인된 `hooks.service.ts` 의 두 호출 위치(line 149, 259)는 모두 올바르게 갱신되었다.
- 제안: 리뷰 범위 내 변경사항 자체는 일관되게 처리됐으므로 추가 차단 불필요. 다만 `client-ip.ts` 를 import 하는 다른 파일이 있다면 `null` 반환을 가정한 `=== null` 비교가 있는지 별도 검토 권장.

### [INFO] `extractClientIp`(풀 요청 기반) 함수는 여전히 `string | null` 유지
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` — `extractClientIp` 함수 (변경 없음)
- 상세: `extractClientIpFromHeaders`(헤더 전용)만 `undefined` 로 변경하고, `extractClientIp`(req 기반, 최종 폴백 `null`)는 `string | null` 로 유지한 것은 의도적 선택이다. 두 함수의 반환형이 다른 상태가 되었으나, 사용처가 구분되어 있어 범위 이탈은 아니다.
- 제안: 향후 혼동 가능성을 위해 `client-ip.ts` JSDoc 에 두 함수의 반환형 차이를 명시하는 것 고려. 현재 변경 범위에서 요구되는 사항은 아님.

### [INFO] `hooks.service.spec.ts` mock 에 `executionRepository` 필드 잔류
- 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — mock `ExecutionsService` 정의 (약 line 88-633)
- 상세: `executionRepository` 브래킷 접근을 공개 메서드 `getStatusById` 로 교체한 이후에도, mock 의 `executionRepository` 객체는 여전히 존재하고 테스트 사이트(예: `execRepo.findOne.mockResolvedValue(...)`)에서 직접 사용된다. 이는 하위 호환성 유지 설계로 명시적으로 문서화되어 있다("23개 테스트 사이트 변경 없이 동작을 보존"). mock 내부에서 `getStatusById` 가 `executionRepository.findOne` 에 위임하는 패턴이므로 기능상 문제는 없다.
- 제안: mock 에 `executionRepository` 를 남긴 것은 의도적 트레이드오프로, 범위 이탈이 아니다. 단, 테스트에서 `executionRepository` 를 직접 참조하는 코드는 실제 프로덕션 코드에서 해당 private 접근이 제거됐으므로, 향후 테스트가 잘못된 `executionRepository` mock 제어로 인해 통과하는 false-positive 위험이 잠재한다. 핵심 경로인 `getStatusById` 가 올바르게 IIFE 내에서 `executionRepository.findOne` 에 위임하고 있으므로 현재는 안전하다.

### [INFO] `http-exception.filter.spec.ts` 에 테스트 2건 추가 — 범위 내 보완
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` lines 51-91 (diff 기준)
- 상세: QueryFailedError 23505 처리와 nested error shape 테스트는 `GlobalExceptionFilter` 의 기존 동작을 커버한다. 본 PR 의 `HooksService`/`ExecutionsService` 리팩토링과 직접 관련 없어 보일 수 있으나, `#763 후속` PR(webhook 하드닝) 의 CWE-209 sanitize·4xx 에러 처리 강화 맥락에서 누락된 필터 테스트를 보완한 것으로 판단된다. 무관한 파일 수정이라기보다 같은 보안 하드닝 PR 의 테스트 범위 확장으로 볼 수 있다.
- 제안: 범위 이탈로 차단하지 않으나, 커밋 분리(필터 테스트 vs 서비스 리팩토링)가 PR 검토 가독성을 높였을 것. 현재 하나의 PR 로 묶인 것은 허용 가능 수준.

## 요약

6개 파일 변경 모두 일관된 목적(webhook 하드닝 후속: private 브래킷 접근 → 공개 API 캡슐화, `extractClientIpFromHeaders` 반환형 통일, 필터 테스트 보완)으로 연결되어 있다. 각 변경은 다른 변경의 필수 의존성이거나 직접 연결된 테스트/주석 갱신이다. 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다. `client-ip.ts` 의 `extractClientIpFromHeaders` 반환형 변경(`null` → `undefined`)과 이를 소비하는 `hooks.service.ts` 의 `?? undefined` 제거는 정확히 대칭적으로 처리됐다. `executions.service.ts` 의 `getStatusById` 공개 메서드 추가는 `hooks.service.ts` 의 private 브래킷 접근 제거를 위한 최소 범위 변경이다.

## 위험도

NONE
