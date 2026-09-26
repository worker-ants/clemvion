# 아키텍처 리뷰 — forbidden-desc-codes

## 발견사항

- **[INFO]** `RolesGuard` 의 거부 코드 분기를 별도 "모델" 함수로 재구현 — 리프 함수(`lowestRequiredRole`)만 공유하고 상위 제어 흐름은 독립 구현
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:125-144` (`guardRejectionCodes`) vs `codebase/backend/src/common/guards/roles.guard.ts:134-229` (`RolesGuard.canActivate`/`assertMember`)
  - 상세: `lowestRequiredRole` 는 `workspace-roles.ts` 로 추출되어 가드와 저장소 가드(reflection 검사)가 공유하지만, "이 라우트에서 가드가 403 을 낼 수 있는가"(`@Public` 여부 · 워크스페이스 소비 여부 · 경로 파라미터 분기)를 판정하는 상위 로직은 `guardRejectionCodes()` 에 **별도로 재구현**되어 있다. 즉 `RolesGuard` 의 분기 트리 중 일부만 공유되고 나머지는 두 곳에서 손으로 맞춘 "모델"이다. `RolesGuard.canActivate` 에 새 분기(예: 새 데코레이터 · 새 예외 케이스)가 추가되면 이 모델은 자동으로 따라가지 않는다.
  - 완화 요인: `forbidden-response-codes.spec.ts:228-292` 의 "모델 캐너리"가 고정 fixture 컨트롤러에 대해 실제 `RolesGuard.canActivate()` 를 직접 호출해 모델과 대조한다. 다만 이 캐너리는 **손으로 만든 fixture 집합**만 순회하므로, 실서비스 라우트에 새로 등장하는 분기 모양이 fixture 에 반영되지 않으면 드리프트를 못 잡는다(fixture 자체가 진짜 대조군이 아니라 "저자가 예상한 모양의 목록"이기 때문). 저자도 이 한계를 문서화했다(주석 "이 표 전체가 실제 가드와 같은지는 … 모델 캐너리가 대조한다").
  - 제안: 당장 조치는 불요(문서화·완화 존재). 다만 향후 `RolesGuard` 에 새 분기가 생기면 같은 PR 에서 fixture 컨트롤러에도 해당 모양을 추가하는 것을 관례로 굳히는 편이 좋다(리뷰 체크리스트 항목화).

- **[INFO]** `forbiddenForRole()` 이 "이미 계산된 단일 역할"을 받는 API — 다중 역할 조합의 정오는 타입이 아니라 CI 가드가 사후에 잡는다
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:36-39` (`forbiddenForRole(role: WorkspaceRoleName)`)
  - 상세: `@Roles('admin', 'editor')` 처럼 여러 역할을 요구하는 라우트에서는 호출자가 `lowestRequiredRole([...])` 을 직접 불러 문턱을 구한 뒤 그 결과를 `forbiddenForRole()` 에 넘겨야 한다 — 이 조합 책임이 함수 시그니처로 강제되지 않는다. 실제로 저장소 가드의 대조군(`forbidden-response-codes.spec.ts:132-136` `multiDescribedAsAdmin`)이 바로 이 오용 형태(여러 역할 중 최저가 아닌 역할로 문서화)를 정확히 겨냥해 만들어졌다는 사실 자체가, 이 오용이 타입으로 막히지 않고 실제로 발생할 수 있는 형태임을 보여준다.
  - 제안: `forbiddenForRole(roles: readonly WorkspaceRoleName[])` 형태로 시그니처를 넓혀 내부에서 `lowestRequiredRole` 을 호출하게 하면, "여러 역할 중 잘못된 역할을 문서화" 라는 오용 클래스 자체가 API 설계로 봉쇄된다(현재는 CI 가드가 사후에만 잡는 defense-in-depth). 현재 controller 들이 전부 단일 역할만 쓰고 있어 시급하지는 않다.

- **[INFO]** Swagger 문구용 `ROLE_SHORTFALL` 과 런타임 메시지용 `ROLE_REQUIRED[role].message` — 같은 의미의 문구가 별도 테이블로 잔존
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:22-28` (`ROLE_SHORTFALL`) vs `codebase/backend/src/common/constants/workspace-roles.ts:72-82` (`ROLE_REQUIRED`)
  - 상세: 이번 리팩터의 핵심 동기는 "코드가 바뀌면 설명이 따라온다"(shotgun surgery 제거)인데, 코드(`.code`)는 상수 보간으로 완전히 해소된 반면 사람이 읽는 역할별 문구(`'Editor 이상 권한 필요'` vs `'Editor 이상의 권한이 필요합니다.'`)는 두 파일에 독립적으로 손으로 유지된다. 타입 시스템이 두 테이블 모두 `WorkspaceRoleName` 전체를 요구하므로 **항목 누락**은 컴파일에서 막히지만, **문구 자체의 표현 드리프트**(예: 런타임 메시지 어투가 바뀌어도 Swagger 문구는 안 바뀜)는 막지 못한다. 의도적으로 격식(런타임 응답)과 축약(API 문서) 두 톤을 분리한 것으로 보이나, 결과적으로 이 리팩터가 노린 "단일 진실"이 코드에는 완전히 적용되고 문구에는 부분적으로만 적용됐다.
  - 제안: 조치 불요(설계 트레이드오프로 보임). 다만 향후 역할 이름/문구를 바꿀 일이 생기면 두 테이블을 동시에 검토해야 한다는 점을 헤더 주석에 상호 참조로 남겨두면 좋다.

- **[INFO]** (기존 코드, 이번 diff 미변경) `common/constants` 스펙이 `modules/` DTO 를 import — 레이어 방향 역전
  - 위치: `codebase/backend/src/common/constants/workspace-roles.spec.ts:9` (`import { WORKSPACE_ROLES } from '../../modules/workspaces/dto/add-member.dto';`)
  - 상세: `common/` 은 통상 `modules/` 보다 낮은 레이어(공유 저수준 유틸)로 두는 것이 이 저장소의 관례인데, 테스트 파일이 특정 feature 모듈(`workspaces`)의 DTO 를 역참조한다. 이번 PR 은 같은 파일에 `lowestRequiredRole` import 한 줄과 `it` 블록 하나만 추가했을 뿐 이 구조를 만들지도 악화시키지도 않았다 — 새로 지적하는 결함이 아니라 인접 맥락으로만 기록한다.
  - 제안: 이번 PR 범위 밖. 별도 정리 대상으로만 남겨둔다.

## 요약

이 변경은 30여 개 컨트롤러에 흩어져 있던 `@ApiForbiddenResponse` 설명 문자열(129곳, 가드 거부 코드 누락)을 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole`)로 대체하는 대규모지만 기계적인 리팩터이며, 부수적으로 `RolesGuard` 내부의 "요구 역할 중 최저 문턱" 계산을 `workspace-roles.ts` 의 순수 함수 `lowestRequiredRole` 로 추출해 가드와 신설 reflection 기반 저장소 가드(`forbidden-response-codes-guard.ts`)가 공유하게 했다. 의존성 방향은 깨끗하다 — `roles.guard.ts` 와 `swagger/forbidden-descriptions.ts` 모두 저수준 `workspace-roles.ts` 에만 의존하고 서로 참조하지 않으며, 신규 순환 의존은 없다. 프레젠테이션(Swagger 문구) · 도메인(역할 서열/거부 코드) · 검증(reflection 가드) 세 책임이 파일 단위로 잘 분리되어 있고, 기존의 심각한 shotgun-surgery 안티패턴(코드명이 바뀌면 129곳을 손으로 고쳐야 하는 구조)을 실질적으로 제거한 점이 이 PR 의 가장 큰 아키텍처적 개선이다. 남는 것은 모두 INFO 수준의 관찰 — 가드 판정 로직의 부분적 모델 재구현(모델 캐너리로 완화), `forbiddenForRole` 의 단일-역할 API 설계(다중 역할 조합 오류를 타입이 아닌 CI 가드가 사후 차단), 그리고 역할 문구의 잔존 이중 테이블(코드는 완전히 단일화됐으나 사람이 읽는 문구는 두 곳에 남음) — 이며 즉시 조치가 필요한 구조적 결함은 없다.

## 위험도

LOW
