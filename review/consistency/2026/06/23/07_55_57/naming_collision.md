# 신규 식별자 충돌 분석 — spec/2-navigation (--impl-prep)

## 발견사항

- **[WARNING]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 에러 코드가 공식 카탈로그에 미등록
  - target 신규 식별자: `TRIGGER_ENDPOINT_PATH_CONFLICT` (`spec/2-navigation/2-trigger-list.md` §2.3.1 Webhook Configuration 행, §3 PATCH 노트)
  - 기존 사용처: `spec/5-system/3-error-handling.md` §1.2 카탈로그에 `RESOURCE_CONFLICT`(부모)·`DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT` 세 코드만 409 서브코드로 등록됨. `TRIGGER_ENDPOINT_PATH_CONFLICT`는 등록 없음. `spec/conventions/error-codes.md` historical-artifact 레지스트리에도 없음.
  - 상세: `3-error-handling.md` 카탈로그가 동일 의미의 특화 코드를 등록 관리하는 단일 진실인데(`DUPLICATE_NODE_LABEL`, `WORKFLOW_VERSION_CONFLICT` 선례), `TRIGGER_ENDPOINT_PATH_CONFLICT`는 `2-trigger-list.md` 에서만 사용되고 카탈로그에는 없다. 구현 코드(`codebase/backend/src/modules/triggers/triggers.service.ts`)에도 해당 문자열 리터럴이 발견되지 않아 spec-code 정합성도 미확인.
  - 제안: `spec/5-system/3-error-handling.md` §1.2 카탈로그에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 행 추가 (`RESOURCE_CONFLICT` 의 특화 코드 — `(workspace_id, endpoint_path)` UNIQUE 위반, 409). 구현 코드에도 동일 문자열 추가 확인 필요.

- **[WARNING]** `AUTH_CONFIG_NOT_FOUND` 에러 코드가 공식 카탈로그에 미등록
  - target 신규 식별자: `AUTH_CONFIG_NOT_FOUND` (`spec/2-navigation/2-trigger-list.md` §3 PATCH 노트)
  - 기존 사용처: `spec/5-system/3-error-handling.md` §1.2 카탈로그에 없음. 구현(`codebase/backend/src/modules/triggers/triggers.service.ts` line 502)에는 `code: 'AUTH_CONFIG_NOT_FOUND'`로 발행 중 — spec 카탈로그 미등록 상태로 구현에만 존재.
  - 상세: 카탈로그에 `RESOURCE_NOT_FOUND`(generic 404) + `MODEL_CONFIG_NOT_FOUND`(특화) 패턴이 선례인데, `AUTH_CONFIG_NOT_FOUND`는 동일 패턴이나 카탈로그에 없다. `RESOURCE_NOT_FOUND` 와 의미가 일부 겹치므로 구분이 불명확.
  - 제안: `spec/5-system/3-error-handling.md` §1.2 에 `AUTH_CONFIG_NOT_FOUND` 행 추가 (`RESOURCE_NOT_FOUND` 의 AuthConfig 특화 코드, `authConfigsService.findById` 미스매치 시 400 or 404 결정 명시). 또는 generic `RESOURCE_NOT_FOUND` 로 통일하고 spec 본문 수정.

- **[INFO]** spec/2-navigation 파일 번호 시퀀스에 `12-` 빠짐
  - target 신규 식별자: 파일명 관행 (`0-`~`16-` 번호 prefix)
  - 기존 사용처: `spec/2-navigation/` 폴더: `0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`...`11-error-empty-states.md`, `13-user-guide.md`...`16-agent-memory.md`. `12-` 번 파일이 없다.
  - 상세: 다른 영역과 달리 중간 번호가 빠져 있다. 신규 파일 추가 시 `12-` 슬롯에 배치하면 자연스럽지만, 의도적 공백인지 누락인지 불명확. 충돌은 아니나 나중에 `12-` 파일을 추가할 때 혼선 가능.
  - 제안: `spec/2-navigation/_product-overview.md` 또는 `_layout.md` 에 "12번은 의도적 공백" 또는 "예약" 한 줄 주석 추가, 또는 이미 삭제된 spec 파일이면 번호 재정렬.

- **[INFO]** `systemStatus.counts.failed` i18n 키 의미 변경이 기존 소비처와 충돌 가능
  - target 신규 식별자: `systemStatus.counts.failed` i18n 키 (`spec/2-navigation/15-system-status.md` §3 "기존 라벨 값의 의미가 '누적 보관'으로 바뀌므로 라벨 텍스트도 함께 갱신" 명시)
  - 기존 사용처: `spec/2-navigation/15-system-status.md` 에서 같은 키를 이전 의미(단순 실패 수)로 참조하던 기존 구현
  - 상세: 이 항목은 spec 자체가 기존 의미 변경임을 명시하고 갱신 지시를 포함하고 있어 계획적 변경이다. 그러나 소비 코드(`codebase/frontend/src/app/(main)/system-status/page.tsx`)에 갱신이 반드시 연동되어야 하는 종속성이다. spec 주석이 명시적이므로 CRITICAL은 아니지만 구현 착수 전 연동 체크리스트 포함 권장.
  - 제안: 구현 착수 시 i18n 파일(`codebase/frontend/src/lib/i18n/`) 의 `systemStatus.counts.failed` 값과 신규 키(`최근 윈도우`·`누적 보관` 등)를 동시 갱신하는 단일 커밋으로 묶어 의미 불일치 창을 최소화.

## 요약

`spec/2-navigation` 영역이 도입하는 신규 식별자 중 충돌 수준의 문제는 없다. 단, `TRIGGER_ENDPOINT_PATH_CONFLICT`와 `AUTH_CONFIG_NOT_FOUND` 두 에러 코드가 `spec/5-system/3-error-handling.md` 공식 카탈로그에 미등록 상태로 `2-trigger-list.md`에만 선언되어 있어 — 특히 `TRIGGER_ENDPOINT_PATH_CONFLICT`는 구현 코드에도 존재가 확인되지 않아 — spec-code 정합이 검증되지 않은 WARNING 두 건이 존재한다. 요구사항 ID(`NAV-*`, `EH-*`, `CCH-*` 등), API 엔드포인트, 환경변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`)는 각 SoT(`5-system/12-webhook.md` 등)와 중복 없이 일관되게 사용되고 있다.

## 위험도

LOW
